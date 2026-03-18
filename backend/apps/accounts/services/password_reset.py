from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode


User = get_user_model()


class PasswordResetService:
    signer = signing.TimestampSigner(salt="accounts.password-reset")

    @classmethod
    def build_token(cls, user) -> str:
        """
        Erstellt einen signierten Token für Passwort-Reset.
        Der Token enthält nur die User-ID und ist zeitlich begrenzt.
        """
        return cls.signer.sign(str(user.pk))

    @classmethod
    def verify_token(cls, token: str):
        """
        Prüft den Token und gibt den User zurück.
        Wirft signing.BadSignature oder signing.SignatureExpired bei Fehler.
        """
        max_age = getattr(settings, "PASSWORD_RESET_TOKEN_TIMEOUT_SECONDS", 1800)
        unsigned_value = cls.signer.unsign(token, max_age=max_age)
        return User.objects.get(pk=unsigned_value, is_active=True)

    @classmethod
    def encode_uid(cls, user) -> str:
        return urlsafe_base64_encode(force_bytes(user.pk))

    @classmethod
    def decode_uid(cls, uidb64: str) -> str:
        return force_str(urlsafe_base64_decode(uidb64))

    @classmethod
    def build_reset_link(cls, user) -> str:
        """
        Baut den Link zum Frontend:
        http://localhost:3000/reset-password?uid=...&token=...
        """
        uid = cls.encode_uid(user)
        token = cls.build_token(user)

        base_url = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
        path = getattr(settings, "PASSWORD_RESET_FRONTEND_PATH", "/reset-password").strip()

        if not path.startswith("/"):
            path = f"/{path}"

        query = urlencode(
            {
                "uid": uid,
                "token": token,
            }
        )
        return f"{base_url}{path}?{query}"

    @classmethod
    def get_user_from_uid_and_token(cls, uidb64: str, token: str):
        """
        Für den finalen Reset:
        - uid decodieren
        - User laden
        - prüfen, ob Token zu diesem User gehört und gültig ist
        """
        user_id = cls.decode_uid(uidb64)
        user = User.objects.get(pk=user_id, is_active=True)

        verified_user = cls.verify_token(token)

        if str(user.pk) != str(verified_user.pk):
            raise signing.BadSignature("Token passt nicht zum Benutzer.")

        return user