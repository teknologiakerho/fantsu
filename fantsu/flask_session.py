from itsdangerous import URLSafeTimedSerializer
from flask.sessions import SecureCookieSessionInterface

class SessionDecoder:

    def __init__(self, secret):
        self.serializer = URLSafeTimedSerializer(secret,
                salt=SecureCookieSessionInterface.salt,
                serializer=SecureCookieSessionInterface.serializer,
                signer_kwargs={
                    "key_derivation": SecureCookieSessionInterface.key_derivation,
                    "digest_method": SecureCookieSessionInterface.digest_method
                })

    def decode(self, session):
        return self.serializer.loads(session)
