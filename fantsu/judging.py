import asyncio
import contextlib
from datetime import datetime
from aiohttp import web
from sqlalchemy.orm import joinedload
import itsdangerous
import robostat.db as model
from fantsu.logging import logger, request_logger
from fantsu.util import lazy_signal, dispatch

class JudgingError(Exception):
    pass

class EventJudging:

    def __init__(self, event, judge):
        self.event = event
        self.judge = judge
        self.state = None

    def __str__(self):
        return "(%d,%d) %s" % (self.event.id, self.judge.id, self.state)

class EventFilter:

    on_start = lazy_signal()
    on_switch_active = lazy_signal()
    on_update = lazy_signal()
    on_end = lazy_signal()

    def __init__(self):
        self.active = None
        self.all = set()
        self._update_lock = asyncio.Lock()

    def filter(self, ej):
        raise NotImplementedError

    def select_active(self, ejs):
        raise NotImplementedError

    def init(self, ejs):
        self.all.update(filter(self.filter, ejs))
        self._maybe_update_active()

    async def start(self, ej):
        if not self.filter(ej):
            return

        self.all.add(ej)
        old_active, new_active = self._maybe_update_active()

        async with self._update_lock:
            await dispatch(self, "on_start",
                    ej=ej,
                    is_active=ej==new_active
            )

            if new_active != old_active:
                await dispatch(self, "on_switch_active",
                        old_active=old_active,
                        new_active=new_active
                )

    async def update(self, ej):
        if ej not in self.all:
            return

        async with self._update_lock:
            await dispatch(self, "on_update", ej, is_active=ej==self.active)

    async def end(self, ej):
        if ej not in self.all:
            return

        self.all.remove(ej)
        was_active = ej == self.active
        if was_active:
            old_active = self.active
            self.active = None
            _, new_active = self._maybe_update_active()

        async with self._update_lock:
            await dispatch(self, "on_end",
                    ej=ej,
                    is_active=ej==old_active
            )

            if was_active:
                await dispatch(self, "on_switch_active",
                        old_active=old_active,
                        new_active=new_active
                )

    def _maybe_update_active(self):
        old_active = self.active
        new_active = self.select_active(self.all)
        self.active = new_active

        if old_active != new_active:
            logger.debug("(filter) active changed %s => %s" % (old_active, new_active))

        return old_active, new_active

class Judging:

    def __init__(self):
        self.active = {}
        self.filters = set()

    async def start(self, event, judge):
        if self.is_active(event.id, judge.id):
            raise JudgingError("Duplicate judging (%d, %d)" % (event.id, judge.id))

        ej = EventJudging(event, judge)
        self.active[event.id, judge.id] = ej

        await asyncio.gather(*(f.start(ej) for f in self.filters))
        return ej

    async def update(self, ej, state):
        ej.state = state
        await asyncio.gather(*(f.update(ej) for f in self.filters))

    async def end(self, ej):
        del self.active[ej.event.id, ej.judge.id]
        await asyncio.gather(*(f.end(ej) for f in self.filters))

    async def session(self, event, judge):
        ej = await self.start(event, judge)
        return JudgingSession(self, ej)

    def is_active(self, event_id, judge_id):
        return (event_id, judge_id) in self.active

    def add_filter(self, flt):
        self.filters.add(flt)
        flt.init(self.active.values())

    def remove_filter(self, flt):
        self.filters.remove(flt)

class JudgingSession:

    def __init__(self, judging, ej):
        self.judging = judging
        self.ej = ej

    async def update(self, state):
        await self.judging.update(self.ej, state)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.judging.end(self.ej)

class JudgingWebHandler:

    def __init__(self, judging):
        self.judging = judging

    def init(self, app):
        app.add_routes([web.get(r"/judging/{event_id:\d+}", self.judging_ws)])
        logger.info("Judging websocket available at /judging/<id>!")

    async def judging_ws(self, request):
        event_id = int(request.match_info["event_id"])
        decoder = request.app["session-decoder"]
        session_cookie = request.app["session-cookie"]
        robostat_db = request.app["robostat-db"]

        try:
            session = decoder(request.cookies[session_cookie])
        except (KeyError, itsdangerous.BadSignature):
            raise web.HTTPUnauthorized()

        try:
            judge_id = int(session["id"])
        except:
            raise web.HTTPUnauthorized()

        judge = robostat_db.query(model.Judge).filter_by(id=judge_id).first()

        ej = robostat_db.query(model.EventJudging)\
                .filter_by(event_id=event_id, judge_id=judge_id)\
                .options(
                        joinedload(model.EventJudging.event, innerjoin=True)
                        .joinedload(model.Event.teams_part, innerjoin=True)
                        .joinedload(model.EventTeam.team, innerjoin=True)
                )\
                .first()

        if judge is None or ej is None:
            raise web.HTTPForbidden()

        try:
            ses = await self.judging.session(ej.event, judge)
        except JudgingError:
            raise web.HTTPBadRequest()

        logger = request_logger("%s:%d:%d" % (judge.name, judge.id, event_id))
        logger.start("Open judging id: %d | Block: %s | Scheduled at: %s | Teams: %s" % (
            event_id,
            ej.event.block_id,
            datetime.fromtimestamp(ej.event.ts_sched).strftime("%d.%m.%Y %H:%M"),
            ", ".join("%s:%d" % (t.name, t.id) for t in ej.event.teams)
        ))

        try:
            async with ses:
                ws = web.WebSocketResponse()
                await ws.prepare(request)

                async for mes in ws:
                    state = mes.json()
                    logger.incoming(str(state))
                    await ses.update(state)
        finally:
            logger.end("Judging closed")

        return ws
