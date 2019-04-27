from setuptools import setup

setup(
        name = "fantsu",
        version = "0.1",
        packages = [
            "fantsu",
            "robostat.fantsu"
        ],
        install_requires = [
            "robostat3-web @ https://github.com/teknologiakerho/robostat-web/tarball/master",
            "sqlalchemy",
            "aiohttp",
            "aiohttp_sse"
        ]
)
