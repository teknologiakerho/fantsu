import asyncio
import json
from aiohttp import web
from aiohttp_sse import sse_response
from robostat.web.views.api import jsonify
from fantsu.logging import logger, request_logger

class SSERelay:

    def __init__(self, resp, logger):
        self.resp = resp
        self.logger = logger

    async def __aenter__(self):
        self._resp = await self.resp.__aenter__()
        await self.init()
        return self._resp

    async def __aexit__(self, *args):
        await self.deinit()
        await self._resp.__aexit__()
        del self._resp

    async def wait(self):
        await self._resp.wait()

    async def relay_event(self, name, data):
        data = json.dumps(data)
        self.logger.outgoing("event=%s | data=%s" % (name, data))
        await self._resp.send(data, event=name)

    async def init(self):
        pass

    async def deinit(self):
        pass

class EventFilterRelay(SSERelay):

    def __init__(self, resp, logger, flt, active_only):
        super().__init__(resp, logger)
        self._flt = flt
        self._active_only = active_only

    async def init(self):
        self._flt.on_start(self._start)
        self._flt.on_switch_active(self._switch_active)
        self._flt.on_update(self._update)
        self._flt.on_end(self._end)

        if self._active_only:
            if self._flt.active is None:
                return
            ejs = [self._flt.active]
        else:
            ejs = self._tl.all

        await asyncio.gather(*(self.relay_event("judging:init", self._jsonify_full_ej(ej))
            for ej in ejs))

    async def deinit(self):
        del self._flt.on_start[self._start]
        del self._flt.on_switch_active[self._switch_active]
        del self._flt.on_update[self._update]
        del self._flt.on_end[self._end]

    async def _start(self, ej, is_active):
        if is_active or not self._active_only:
            await self.relay_event("judging:start", self._jsonify_full_ej(ej))

    async def _switch_active(self, old_active, new_active):
        await self.relay_event("judging:switch-active", {
            "old": self._jsonify_full_ej(old_active),
            "new": self._jsonify_full_ej(new_active)
        })

    async def _update(self, ej, is_active):
        if is_active or not self._active_only:
            await self.relay_event("judging:update", self._jsonify_brief_ej(ej))

    async def _end(self, ej, is_active):
        if is_active or not self._active_only:
            await self.relay_event("judging:end", self._jsonify_brief_ej(ej))

    def _jsonify_full_ej(self, ej):
        if ej is None:
            return None

        return {
            "event_id": ej.event.id,
            "judge_id": ej.judge.id,
            "block_id": ej.event.block_id,
            "arena": ej.event.arena,
            "ts_sched": ej.event.ts_sched,
            "teams": [jsonify(t) for t in ej.event.teams],
            "state": ej.state
        }

    def _jsonify_brief_ej(self, ej):
        if ej is None:
            return None

        return {
            "event_id": ej.event.id,
            "judge_id": ej.judge.id,
            "state": ej.state
        }

class BettingRelay(SSERelay):

    def __init__(self, resp, logger, betting):
        super().__init__(resp, logger)
        self._betting = betting

    async def init(self):
        self._betting.on_start(self._start)
        self._betting.on_countdown_start(self._countdown_start)
        self._betting.on_countdown_cancel(self._countdown_cancel)
        self._betting.on_bet(self._bet)
        self._betting.on_countdown_end(self._countdown_end)
        self._betting.on_cancel(self._cancel)
        self._betting.on_end(self._end)

        if self._betting.event is not None:
            await self.relay_event("betting:init", {
                "event_id": self._betting.event.id,
                "countdown": self._betting.match.countdown_left
            })

    async def deinit(self):
        del self._betting.on_start[self._start]
        del self._betting.on_countdown_start[self._countdown_start]
        del self._betting.on_countdown_cancel[self._countdown_cancel]
        del self._betting.on_bet[self._bet]
        del self._betting.on_countdown_end[self._countdown_end]
        del self._betting.on_cancel[self._cancel]
        del self._betting.on_end[self._end]

    async def _start(self, match, event):
        await self.relay_event("betting:start", {"event_id": event.id})

    async def _countdown_start(self, match, event):
        await self.relay_event("betting:countdown-start", {
            "event_id": event.id,
            "countdown": match.countdown_left
        })

    async def _countdown_cancel(self, match, event):
        await self.relay_event("betting:countdown-cancel", {"event_id": event.id})

    async def _bet(self, match, event, user, target, amount):
        await self.relay_event("betting:bet", {
            "event_id": event.id,
            "display_name": user.display_name,
            "target": target,
            "amount": amount
        })

    async def _countdown_end(self, match, event):
        await self.relay_event("betting:countdown-end", {
            "event_id": event.id,
            "bets": self._jsonify_bets(match)
        })

    async def _cancel(self, match, event):
        await self.relay_event("betting:cancel", {"event_id": event.id})

    async def _end(self, match, event, bets):
        await self.relay_event("betting:end", {
            "event_id": event.id,
            "bets": self._jsonify_bets(match)
        })

    def _jsonify_bet(self, bet):
        ret = {
            "display_name": bet.user.display_name,
            "target": bet.target,
            "amount": bet.amount
        }

        if bet.ret is not None:
            ret["ret"] = bet.ret

        return ret

    def _jsonify_bets(self, match):
        return list(map(self._jsonify_bet, match.bets.values()))

async def relay_sse(request, relay_class, logger_name=None, headers=None, **relay_kwargs):
    if logger_name is None:
        logger_name = "SSE: %s" % request.rel_url

    logger = request_logger(logger_name)

    if request.app["debug"] and (headers is None or "Access-Control-Allow-Origin" not in headers):
        logger.debug("Debug enabled -- allowing CORS requests on sse relay")
        if headers is None:
            headers = {}
        headers["Access-Control-Allow-Origin"] = "*"

    relay = relay_class(
            resp=sse_response(request, headers=headers),
            logger=logger,
            **relay_kwargs
    )

    async with relay as resp:
        logger.start("Relaying events on %s" % request.url)
        await relay.wait()
        logger.end("Stop relaying events on %s" % request.url)

    return resp

async def filter_sse(request):
    name = request.match_info["name"]

    try:
        flt = request.app["filters"][name]
    except KeyError:
        raise web.HTTPNotFound()

    return await relay_sse(request,
            relay_class=EventFilterRelay,
            flt=flt,
            active_only=True
    )

async def betting_sse(request):
    return await relay_sse(request,
            relay_class=BettingRelay,
            betting=request.app["betting"]
    )

def init_relay(app):
    app.add_routes([web.get("/filter/{name}", filter_sse)])

    if "betting" in app:
        app.add_routes([web.get("/betting/events", betting_sse)])

    logger.info("Relay active!")
