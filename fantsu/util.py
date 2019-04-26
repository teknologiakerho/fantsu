import asyncio
import collections
from fantsu.logging import logger

class AsyncSignal:

    def __init__(self):
        self.listeners = []

    def __call__(self, f):
        self.listeners.append(f)

    def __delitem__(self, f):
        self.listeners.remove(f)

    async def dispatch(self, *args, **kwargs):
        return await asyncio.gather(*(l(*args, **kwargs) for l in self.listeners))

class AsyncLazySignalProperty:

    def __set_name__(self, cls, name):
        self.name = name

    def __get__(self, obj, cls):
        ret = AsyncSignal()
        setattr(obj, self.name, ret)
        return ret

signal = AsyncSignal
lazy_signal = AsyncLazySignalProperty

async def dispatch(self, signame, *args, **kwargs):
    if signame in self.__dict__:
        return await getattr(self, signame).dispatch(*args, **kwargs)

class AsyncJobQueue:

    def __init__(self):
        self._queue = collections.deque()
        self._fut = None

    def __call__(self, coro):
        self._queue.append(coro)
        if self._fut is None or self._fut.done(): # Tää rimmaa aika hyvin
            self._fut = asyncio.ensure_future(self._step())

    async def _step(self):
        while self._queue:
            coro = self._queue.popleft()
            await coro
