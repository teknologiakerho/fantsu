import uuid
import fantsu.db as model

def create_user(db):
    ret = model.User(id=str(uuid.uuid4()))
    db.add(ret)
    return ret

def get_or_create_twitch(db, twitch_name, commit=True):
    user = db.query(model.User).filter_by(twitch_name=twitch_name).first()

    if user is None:
        user = create_user(db)
        user.twitch_name = twitch_name
        if commit:
            db.commit()

    return user
