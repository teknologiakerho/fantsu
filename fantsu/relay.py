import asyncio
import json
from aiohttp import web
from aiohttp_sse import sse_response
from robostat.web.views.api import jsonify
from fantsu.logging import logger, request_logger

class SSERelay:

    def __init__(self, resp, active_only, logger):
        self.resp = resp
        self.active_only = active_only
        self.logger = logger

    def hook(self, flt):
        flt.on_start(self._start)
        flt.on_switch_active(self._switch_active)
        flt.on_update(self._update)
        flt.on_end(self._end)

    def unhook(self, flt):
        del flt.on_start[self._start]
        del flt.on_switch_active[self._switch_active]
        del flt.on_update[self._update]
        del flt.on_end[self._end]

    async def init(self, flt):
        if self.active_only:
            if flt.active is None:
                return
            ejs = [flt.active]
        else:
            ejs = flt.all

        await asyncio.gather(*(self._relay("judging:init", self._jsonify_full_ej(ej))
            for ej in ejs))

    async def _start(self, ej, is_active):
        if is_active or not self.active_only:
            await self._relay("judging:start", self._jsonify_full_ej(ej))

    async def _switch_active(self, old_active, new_active):
        await self._relay("judging:switch-active", {
            "old": self._jsonify_full_ej(old_active),
            "new": self._jsonify_full_ej(new_active)
        })

    async def _update(self, ej, is_active):
        if is_active or not self.active_only:
            await self._relay("judging:update", self._jsonify_brief_ej(ej))

    async def _end(self, ej, is_active):
        if is_active or not self.active_only:
            await self._relay("judging:end", self._jsonify_brief_ej(ej))

    async def _relay(self, name, data):
        data = json.dumps(data)
        self.logger.outgoing("event=%s | data=%s" % (name, data))
        await self.resp.send(data, event=name)

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

routes = web.RouteTableDef()

@routes.get("/filter/{name}")
async def filter_sse(request):
    name = request.match_info["name"]

    try:
        flt = request.app["filters"][name]
    except KeyError:
        raise web.HTTPNotFound()

    logger = request_logger("SSE: %s" % request.rel_url)
    logger.start("Start listen")

    headers = {
            "Access-Control-Allow-Origin": "*"
    }

    async with sse_response(request, headers=headers) as resp:
        relay = SSERelay(resp, "all" not in request.query, logger=logger)
        relay.hook(flt)

        try:
            await relay.init(flt)
            await resp.wait()
        finally:
            relay.unhook(flt)
            logger.end("Stop listen")

    return resp

def init_relay(app):
    app.add_routes(routes)
    logger.info("Relay active!")
