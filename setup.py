from setuptools import setup

setup(
        name = "fantsu",
        version = "0.1",
        packages = [
            "fantsu",
        ],
        install_requires = [
            "robostat3-web",
            "sqlalchemy",
            "aiohttp",
            "aiohttp_sse"
        ]
)
