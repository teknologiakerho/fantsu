import sqlalchemy as sa
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

import fantsu.betting_mixin as betting_mixin

class User(Base, betting_mixin.BettingUserMixin):
    __tablename__ = "users"

    id = sa.Column(sa.String, primary_key=True)
    twitch_name = sa.Column(sa.String, unique=True, index=True)

    def __str__(self):
        return "%s (%s)" % (self.twitch_name, self.id)
