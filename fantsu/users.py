import uuid
import fantsu.db as model
from fantsu.util import lazy_signal, dispatch

class UserManager:

    on_create_user = lazy_signal()

    def __init__(self, app):
        self.app = app
        self.db = app["fantsu-db"]

    def commit(self):
        self.db.commit()

    def get(self, id):
        return self.db.query(model.User).get(id)

    async def get_or_create(self, id, display_name, commit=True):
        user = self.get(id)

        if user is None:
            user = model.User(id=id, display_name=display_name)
            await dispatch(self, "on_create_user", user=user)
            self.db.add(user)
            if commit:
                self.db.commit()

        return user
