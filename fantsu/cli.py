import os
import sys
import contextlib
import logging
from aiohttp import web
import click
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
from sqlalchemy.event import listens_for
import robostat.db
import robostat.web.db
from fantsu.flask_session import SessionDecoder
from fantsu.db import Base
from fantsu.judging import Judging, JudgingWebHandler
from fantsu.filters import from_dict as flt_from_dict, from_list as flt_from_list, prio
from fantsu.betting import Betting, BettingWebHandler
from fantsu.relay import init_relay
from fantsu.logging import logger

class ClickFormatter(logging.Formatter):

    syms = {
        "start_request": click.style("(+++)", fg="green", bold=True),
        "end_request": click.style("(---)", fg="red", bold=True),
        "incoming": click.style("(>>>)", fg="cyan", bold=True),
        "outgoing": click.style("(<<<)", fg="cyan", bold=True)
    }

    def formatTime(self, record, datefmt):
        return click.style(super().formatTime(record, datefmt), fg="bright_black", bold=True)

    def formatException(self, ei):
        return click.style(super().formatException(ei), fg="bright_red")

    def formatStack(self, stack_info):
        return click.style(super().formatStack(stack_info), fg="bright_red")

    def formatMessage(self, record):
        level = record.levelname

        if record.levelno in (logging.ERROR, logging.CRITICAL):
            record.message = click.style(record.message, fg="red")
        elif record.levelno == logging.WARNING:
            record.message = click.style(record.message, fg="yellow")
        elif hasattr(record, "event"):
            #record.levelname = "EVENT"
            record.message = click.style(record.message, fg="cyan")

        for s, sym in self.syms.items():
            if hasattr(record, s):
                record.message = "%s %s" % (sym, record.message)

        #record.levelname = click.style(record.levelname, fg="bright_black", bold=True)
        #record.name = click.style(record.name, bold=True)

        return super().formatMessage(record)

class ClickHandler(logging.Handler):

    def emit(self, record):
        try:
            mes = self.format(record)
            click.echo(mes, err=True)
        except:
            super().handleError(record)

def setup_cookies(app, config):
    secret_key = config["SECRET_KEY"]
    decoder = SessionDecoder(secret_key).decode
    app["session-decoder"] = decoder
    app["session-cookie"] = config.get("SESSION_COOKIE_NAME", "session")
    app["fantsu-cookie"] = config.get("FANTSU_COOKIE_NAME", "fantsu-id")

def setup_db(app, config):
    rs_db_url = config["ROBOSTAT_DB"]
    rs_engine = sa.create_engine("sqlite:///%s" % rs_db_url)

    fantsu_db_url = config["FANTSU_DB"]
    fantsu_engine = sa.create_engine("sqlite:///%s" % fantsu_db_url)

    @listens_for(rs_engine, "connect")
    def configure_rs_engine(connection, record):
        connection.isolation_level = None
        with contextlib.closing(connection.cursor()) as cursor:
            cursor.execute("PRAGMA query_only=1;")

    @listens_for(fantsu_engine, "connect")
    def configure_fantsu_engine(connection, record):
        with contextlib.closing(connection.cursor()) as cursor:
            cursor.execute("PRAGMA journal_model=WAL;")

    Base.metadata.create_all(fantsu_engine)
    app["robostat-db"] = sessionmaker(bind=rs_engine)()
    app["fantsu-db"] = sessionmaker(bind=fantsu_engine)()

def setup_judging(app, config):
    judging = Judging()
    handler = JudgingWebHandler(judging)
    handler.init(app)
    app["judging"] = judging

def setup_filters(app, config):
    if "FANTSU_FILTERS" not in config:
        return

    app["filters"] = {}

    for name, v in config["FANTSU_FILTERS"].items():
        if isinstance(v, dict):
            flt = prio(flt_from_dict(v))
        elif isinstance(v, list):
            flt = flt_from_list(v)
        else:
            flt = v

        app["filters"][name] = flt
        app["judging"].add_filter(flt)

    logger.debug("Named filters available: %s" % list(app["filters"]))

def setup_betting(app, config):
    if "FANTSU_BETTING_FILTER" not in config:
        return

    timeout = config.get("FANTSU_BETTING_COUNTDOWN", 60)
    basebet = config.get("FANTSU_BETTING_BASEBET", 100)
    min_points = config.get("FANTSU_BETTING_MIN_POINTS", 100)
    betting = Betting(countdown_timeout=timeout, basebet=basebet, min_points=min_points)
    app["betting"] = betting

    app["betbot-token"] = config["FANTSU_BETBOT_TOKEN"]
    flt = app["filters"][config["FANTSU_BETTING_FILTER"]]
    handler = BettingWebHandler(betting)
    handler.init(app, flt)

    logger.info("Betting available on filter '%s'!" % config["FANTSU_BETTING_FILTER"])

def configure(app, config):
    setup_cookies(app, config)
    setup_db(app, config)
    setup_judging(app, config)
    setup_filters(app, config)
    setup_betting(app, config)

    init_relay(app)

@click.command()
@click.option("-c", "--config", required=True)
@click.option("-h", "--host", default="0.0.0.0")
@click.option("-p", "--port", default=8080)
@click.option("-d", "--debug", is_flag=True)
def main(**kwargs):
    app = web.Application()

    conf = {}
    exec(open(kwargs["config"]).read(), conf)

    debug = kwargs["debug"] or conf.get("DEBUG", False)\
            or os.environ.get("FLASK_ENV", "") == "debug"

    handler = ClickHandler()
    handler.setFormatter(ClickFormatter(
        fmt="%(asctime)s %(levelname)-8s %(name)-10s %(message)s",
        datefmt="%d.%m.%Y %H:%M"
    ))
    logging.basicConfig(
        level=debug and logging.DEBUG or logging.INFO,
        handlers=[handler]
    )

    if sys.stderr.isatty():
        click.echo("".join([
            click.style(" F ", bg="magenta", bold=True),
            click.style(" A ", bg="green", bold=True),
            click.style(" N ", bg="red", bold=True),
            click.style(" T ", bg="yellow", bold=True),
            click.style(" S ", bg="cyan", bold=True),
            click.style(" U ", bg="magenta", bold=True),
        ]), err=True)

    if debug:
        logging.getLogger("sqlalchemy.engine").setLevel(logging.DEBUG)
        logger.debug("Running in debug mode!")
    else:
        logging.getLogger("aiohttp").setLevel(logging.WARNING)

    configure(app, conf)

    host = conf.get("FANTSU_HOST", kwargs["host"])
    port = conf.get("FANTSU_PORT", kwargs["port"])

    logger.info("Running on %s:%d" % (host, port))

    web.run_app(app, print=None, host=host, port=port)
