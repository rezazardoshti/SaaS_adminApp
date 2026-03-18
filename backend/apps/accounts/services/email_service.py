from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string


class AccountEmailService:
    @staticmethod
    def send_password_reset_email(user, reset_link: str) -> None:
        subject = "Passwort zurücksetzen"

        context = {
            "user": user,
            "reset_link": reset_link,
            "support_email": getattr(settings, "SUPPORT_EMAIL", ""),
            "project_name": "Craft Flow",
        }

        text_body = render_to_string(
            "emails/accounts/password_reset.txt",
            context,
        )
        html_body = render_to_string(
            "emails/accounts/password_reset.html",
            context,
        )

        message = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        message.attach_alternative(html_body, "text/html")
        message.send(fail_silently=False)