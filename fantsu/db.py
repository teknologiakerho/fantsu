import sqlalchemy as sa
from sqlalchemy.ext.declarative import declarative_base
import fantsu.betting_mixin as betting_mixin

Base = declarative_base()

class User(betting_mixin.BettingUserMixin, Base):
    __tablename__ = "users"

    id = sa.Column(sa.String, primary_key=True)
    display_name = sa.Column(sa.String)

    def __str__(self):
        return "%s (%s)" % (self.display_name, self.id)
