from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Custom Claims
        token["user_id"] = user.id
        token["email"] = user.email
        token["first_name"] = user.first_name or ""
        token["last_name"] = user.last_name or ""
        token["full_name"] = user.full_name or ""
        token["is_staff"] = user.is_staff
        token["is_superuser"] = user.is_superuser
        token["is_email_verified"] = user.is_email_verified

        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        # Zusätzliche User-Daten direkt in der Response
        data["user"] = {
            "id": self.user.id,
            "email": self.user.email,
            "first_name": self.user.first_name,
            "last_name": self.user.last_name,
            "full_name": self.user.full_name,
            "is_staff": self.user.is_staff,
            "is_superuser": self.user.is_superuser,
            "is_email_verified": self.user.is_email_verified,
        }

        return data