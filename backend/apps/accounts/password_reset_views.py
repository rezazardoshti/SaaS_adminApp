from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.password_reset_serializers import (
    ForgotPasswordSerializer,
    ResetPasswordConfirmSerializer,
)
from apps.accounts.services.email_service import AccountEmailService


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = serializer.save()

        user = result.get("user")
        reset_link = result.get("reset_link")

        if user and reset_link:
            AccountEmailService.send_password_reset_email(
                user=user,
                reset_link=reset_link,
            )

        return Response(
            {
                "detail": "Falls ein Konto existiert, wurde eine E-Mail gesendet."
            },
            status=status.HTTP_200_OK,
        )


class ResetPasswordConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                "detail": "Passwort wurde erfolgreich zurückgesetzt."
            },
            status=status.HTTP_200_OK,
        )