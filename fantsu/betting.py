import asyncio
import collections
import functools
from aiohttp import web
from fantsu.users import get_or_create_twitch
from fantsu.logging import logger
from fantsu.util import lazy_signal, dispatch

class BettingError(Exception):
    pass

class CountdownCancelled(Exception):
    pass

class Bet:

    def __init__(self, user, target, amount):
        self.user = user
        self.target = target
        self.amount = amount
        self.ret = None

class Countdown:

    def __init__(self, timeout):
        self._future = asyncio.ensure_future(asyncio.sleep(timeout))
        self._user_cancelled = False

    def cancel(self):
        self._user_cancelled = True
        self._future.cancel()

    def done(self):
        return self._future.done()

    def __await__(self):
        try:
            return self._future.__await__()
        except asyncio.CancelledError:
            if self._user_cancelled:
                raise CountdownCancelled
            raise

class BettingMatch:

    def __init__(self, targets):
        self.targets = targets
        self.bets = {}
        self._countdown = None

    def start_countdown(self, timeout):
        if self.countdown_active:
            raise BettingError("A countdown is already active")

        self._countdown = Countdown(timeout)
        return self._countdown

    def cancel_countdown(self):
        if self.countdown_active:
            self._countdown.cancel()
            self._countdown = None

    async def wait_countdown(self):
        if not self.countdown_active:
            raise BettingError("No countdown active")

        await self._countdown

    @property
    def countdown_active(self):
        return self._countdown is not None and not self._countdown.done()

    def place_bet(self, user, target, amount, check_countdown=True):
        if check_countdown and not self.countdown_active:
            raise BettingError("Can't place a bet now")

        if target not in self.targets:
            raise BettingError("Invalid target: %s (Expected one of: %s)" % (target, self.targets))

        if amount == 0:
            logger.debug("Skipping 0 bet [uid=%s]" % user.id)
            return

        self.remove_bet(user)

        user.allocate_points(amount)
        ret = Bet(user, target, amount)
        self.bets[user.id] = ret

        return ret

    def remove_bet(self, user):
        try:
            bet = self.bets.pop(user.id)
        except KeyError:
            return

        user.dealloc_points(bet.amount)
        return bet

    def cancel(self):
        self.cancel_countdown()
        while self.bets:
            self.remove_bet(next(iter(self.bets)).user)

    def finish(self, winner, basebet=0, min_points=0):
        self._calc_returns(basebet, winner)
        self._distribute_points(min_points)

        bets = self.bets
        # Ihan vaan siltä varalta ettei joku yritä käyttää tätä vahingossa
        self.bets = None
        return bets

    def _calc_returns(self, basebet, winner):
        total_bet = sum(b.amount for b in self.bets.values()) + basebet
        total_win = sum(b.amount for b in self.bets.values() if b.target == winner)

        for uid, bet in self.bets.items():
            if bet.target == winner:
                # jos tähän haaraan mennään niin välttämättä total_win>0
                # XXX: roundin sijasta olis myös mahollista tallentaa pisteet floattina
                bet.ret = round(total_bet * (bet.amount / total_win))
            else:
                bet.ret = 0

            logger.debug("%s: %d => %d" % (bet.user, bet.amount, bet.ret))

    def _distribute_points(self, min_points):
        for bet in self.bets.values():
            bet.user.dealloc_points(bet.amount)
            bet.user.give_points(bet.ret - bet.amount, min_points=min_points)

class Betting:

    on_start = lazy_signal()
    on_countdown_start = lazy_signal()
    on_countdown_cancel = lazy_signal()
    on_bet = lazy_signal()
    on_countdown_end = lazy_signal()
    on_cancel = lazy_signal()
    on_end = lazy_signal()

    def __init__(self, countdown_timeout=60, basebet=100, min_points=100):
        self.countdown_timeout = countdown_timeout
        self.basebet = basebet
        self.min_points = min_points
        self._match = None
        self._event = None
        self._countdown_lock = asyncio.Lock()

    @property
    def match_active(self):
        return self._match is not None

    async def start(self, event, timeout=None):
        if self.match_active:
            raise BettingError("Already have active match (match id=%s eid=%s)" % (
                self._match.id, eid))

        targets = set(event.team_ids)
        self._match = BettingMatch(targets)
        self._event = event
        timeout = timeout or self.countdown_timeout

        countdown = self._match.start_countdown(timeout)

        logger.debug("Start betting on eid=%s" % event.id)

        await dispatch(self, "on_start",
                match=self._match,
                event=self._event
        )

        asyncio.ensure_future(self._run_countdown(countdown, match=self._match, event=self._event))

    def restart_countdown(self, timeout=None):
        self._check_match()
        self._match.cancel_countdown()
        timeout = timeout or self.countdown_timeout
        asyncio.ensure_future(self._run_countdown(self._match.start_countdown(timeout),
            match=self._match, event=self._event))

    async def bet(self, user, target, amount):
        self._check_match()
        self._match.place_bet(user, target, amount)

        logger.debug("User %s placed bet %d on target %s" % (user, amount, target))

        await dispatch(self, "on_bet",
            match=self._match,
            event=self._event,
            user=user,
            target=target,
            amount=amount
        )

    async def cancel(self):
        if not self.match_active:
            return

        self._match.cancel()

        logger.debug("Cancelled bet eid=%s" % self._event.id)

        match = self._match
        event = self._event

        self._match = None
        self._event = None

        await dispatch(self, "on_cancel", match=match, event=event)

    async def end(self, winner):
        self._check_match()

        if self._match.countdown_active:
            self._match.cancel_countdown()
            logger.warning("Match ended while countdown is still active")

        bets = self._match.finish(winner=winner, basebet=self.basebet, min_points=self.min_points)

        logger.debug("Finished bet eid=%s" % self._event.id)

        match = self._match
        event = self._event

        self._match = None
        self._event = None

        await dispatch(self, "on_end", match=match, event=event, bets=bets)

    def _check_match(self):
        if not self.match_active:
            raise BettingError("No match active")

    async def _run_countdown(self, countdown_future, **event_kwargs):
        async with self._countdown_lock:
            await dispatch(self, "on_countdown_start", **event_kwargs)

            try:
                await countdown_future
            except CountdownCancelled:
                logger.debug("Countdown was cancelled eid")
                await dispatch(self, "on_countdown_cancel", **event_kwargs)
            else:
                logger.debug("Finished countdown eid=%s" % self._event.id)
                await dispatch(self, "on_countdown_end", **event_kwargs)

def require_betbot(f):
    @functools.wraps(f)
    async def ret(request):
        token = request.app["betbot-token"]
        if request.query.get("token", None) != token:
            raise web.HTTPUnauthorized()

        return await f(request)
    return ret

class BettingWebHandler:

    def __init__(self, betting):
        self.betting = betting
        self.db = None

    def init(self, app, flt):
        self.db = app["fantsu-db"]

        app.add_routes([
            web.post("/betbot/place", require_betbot(self.handle_betbot_place)),
            web.post("/betbot/restart", require_betbot(self.handle_betbot_restart))
        ])

        flt.on_start(self.start_judging)
        flt.on_end(self.end_judging)

    async def start_judging(self, ej, is_active):
        if not is_active:
            return

        await self.betting.start(ej.event)

    async def end_judging(self, ej, is_active):
        if not is_active:
            return

        if not self.betting.match_active:
            return

        # XXX: Tää oletaa xsumon, tän vois tehä yleisemminkin
        score1 = ej.state["score1"]
        score2 = ej.state["score2"]
        team1 = ej.state["state"]["team1"]
        team2 = ej.state["state"]["team2"]

        if score1 == score2:
            await self.betting.cancel()
            return

        await self.betting.end(team1 if score1 > score2 else team2)
        self.db.commit()

    async def handle_betbot_place(self, request):
        data = await request.json()

        try:
            twitch_name = data["twitch_name"]
            target = int(data["target"])
            amount = int(data["amount"])
        except:
            return web.json_response({"error": "invalid request"}, status=400)

        user = get_or_create_twitch(self.db, twitch_name)

        try:
            await self.betting.bet(user, target, amount)
        except BettingError as e:
            return web.json_response({"error": str(e)}, status=420)

        return web.json_response({"status": "OK"})

    async def handle_betbot_restart(self, request):
        try:
            data = await request.json()
            timeout = int(data["timeout"])
        except:
            timeout = None

        try:
            await self.betting.restart_countdown(timeout=timeout)
        except BettingError as e:
            return web.json_response({"error": str(e)}, status=420)

        return web.json_response({"status": "OK"})
