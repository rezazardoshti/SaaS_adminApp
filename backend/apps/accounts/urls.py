from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .auth_views import LoginView
from .password_reset_views import ForgotPasswordView, ResetPasswordConfirmView
from .views import (
    OwnerRegisterView,
    MeView,
    ChangePasswordView,
    UserListCreateView,
    UserRetrieveUpdateView,
    UserDeactivateView,
    UserActivateView,
    UserDeleteView,
)

app_name = "accounts"

urlpatterns = [
    path("register-owner/", OwnerRegisterView.as_view(), name="register-owner"),
    path("login/", LoginView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    path("me/", MeView.as_view(), name="me"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),

    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path(
        "reset-password-confirm/",
        ResetPasswordConfirmView.as_view(),
        name="reset-password-confirm",
    ),

    path("users/", UserListCreateView.as_view(), name="user-list-create"),
    path("users/<int:pk>/", UserRetrieveUpdateView.as_view(), name="user-detail-update"),
    path("users/<int:pk>/activate/", UserActivateView.as_view(), name="user-activate"),
    path("users/<int:pk>/deactivate/", UserDeactivateView.as_view(), name="user-deactivate"),
    path("users/<int:pk>/delete/", UserDeleteView.as_view(), name="user-delete"),
]