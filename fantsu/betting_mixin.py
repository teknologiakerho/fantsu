import sqlalchemy as sa
from sqlalchemy.orm import relationship, reconstructor
from fantsu.betting import BettingError
from fantsu.db import Base

class BettingUserMixin:

    points = sa.Column(sa.Integer, default=0)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.init()

    @reconstructor
    def init(self):
        self.points_allocated = 0

    @property
    def points_available(self):
        return self.points - self.points_allocated

    def allocate_points(self, amount):
        if amount > self.points_available:
            raise BettingError("Trying to allocate %d points but only %d available"\
                    % (amount, self.points_available))

        if amount < 0:
            raise BettingError("Trying to allocate negative points: %d" % amount)

        self.points_allocated += amount

    def dealloc_points(self, amount):
        if amount > self.points_allocated:
            raise BettingError("Trying to dealloc %d points but only %d allocated" % (
                amount, self.points_allocated))

        if amount < 0:
            raise BettingError("Trying to dealloc negative points: %d" % amount)

        self.points_allocated -= amount

    def give_points(self, amount, min_points=0):
        self.points = max(self.points + amount, min_points)

class BettingEvent(Base):
    __tablename__ = "betting_events"

    id = sa.Column(sa.Integer, primary_key=True)
    desc = sa.Column(sa.String, server_default="")

class BettingResult(Base):
    __tablename__ = "betting_results"
    __table_args__ = ( sa.PrimaryKeyConstraint("user_id", "event_id"), )

    user_id = sa.Column(sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True
    )

    event_id = sa.Column(sa.Integer,
            sa.ForeignKey("betting_events.id", ondelete="CASCADE"),
            nullable=False,
            index=True
    )

    delta = sa.Column(sa.Integer, server_default=sa.text("0"))

    user = relationship("User")
    event = relationship("BettingEvent")
