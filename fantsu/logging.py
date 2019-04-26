import logging

def _inject_extra(kw, **extra):
    if "extra" in kw:
        for k,v in extra.items():
            kw["extra"].setdefault(k, v)
    else:
        kw["extra"] = extra
    return kw

class FantsuAdapter(logging.LoggerAdapter):

    def event(self, *args, **kwargs):
        self.debug(*args, **_inject_extra(kwargs, event=True))

    def process(self, mes, kwargs):
        return mes, kwargs

class RequestAdapter(logging.LoggerAdapter):

    def start(self, *args, **kwargs):
        self.info(*args, **_inject_extra(kwargs, start_request=True))

    def end(self, *args, **kwargs):
        self.info(*args, **_inject_extra(kwargs, end_request=True))

    def incoming(self, *args, **kwargs):
        self.info(*args, **_inject_extra(kwargs, incoming=True))

    def outgoing(self, *args, **kwargs):
        self.debug(*args, **_inject_extra(kwargs, outgoing=True))

    def process(self, mes, kwargs):
        return "(%s) %s" % (self._id(), mes), kwargs

    def _id(self):
        return self.extra["id"]

logger = FantsuAdapter(logging.getLogger("fantsu"), None)

def request_logger(id):
    return RequestAdapter(logger, {"id": id})
