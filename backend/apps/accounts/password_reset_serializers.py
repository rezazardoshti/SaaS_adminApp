from rest_framework import serializers

from apps.accounts.services.password_reset import PasswordResetService


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()

    def get_user(self):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        email = self.validated_data["email"]

        try:
            return User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return None

    def save(self, **kwargs):
        """
        Immer neutrales Verhalten:
        - existiert E-Mail nicht -> gleiche Antwort
        - User ist inaktiv -> gleiche Antwort
        """
        user = self.get_user()

        if user is None or not user.is_active:
            return {
                "email_sent": False,
                "user": None,
                "reset_link": None,
            }

        reset_link = PasswordResetService.build_reset_link(user)

        return {
            "email_sent": True,
            "user": user,
            "reset_link": reset_link,
        }


class ResetPasswordConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True, min_length=8)

    default_error_messages = {
        "password_mismatch": "Die Passwörter stimmen nicht überein.",
        "invalid_token": "Der Link ist ungültig oder abgelaufen.",
    }

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            self.fail("password_mismatch")

        try:
            user = PasswordResetService.get_user_from_uid_and_token(
                uidb64=attrs["uid"],
                token=attrs["token"],
            )
        except Exception:
            self.fail("invalid_token")

        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        password = self.validated_data["new_password"]

        user.set_password(password)
        user.save(update_fields=["password"])

        return user