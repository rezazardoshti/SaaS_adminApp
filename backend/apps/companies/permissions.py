from rest_framework import permissions

from .models import CompanyMembership


def get_user_membership_for_company(user, company):
    if not user or not user.is_authenticated:
        return None

    if user.is_superuser:
        return None

    if not company:
        return None

    return (
        CompanyMembership.objects
        .select_related("company", "user")
        .filter(
            user=user,
            company=company,
            is_active=True,
        )
        .first()
    )


def user_is_company_owner(user, company):
    if not user or not user.is_authenticated:
        return False

    if user.is_superuser:
        return True

    membership = get_user_membership_for_company(user, company)
    return bool(membership and membership.role == CompanyMembership.Role.OWNER)


def user_is_company_admin(user, company):
    if not user or not user.is_authenticated:
        return False

    if user.is_superuser:
        return True

    membership = get_user_membership_for_company(user, company)
    return bool(membership and membership.role == CompanyMembership.Role.ADMIN)


def user_is_company_owner_or_admin(user, company):
    if not user or not user.is_authenticated:
        return False

    if user.is_superuser:
        return True

    membership = get_user_membership_for_company(user, company)
    return bool(
        membership
        and membership.role in [
            CompanyMembership.Role.OWNER,
            CompanyMembership.Role.ADMIN,
        ]
    )


def user_can_access_company(user, company):
    if not user or not user.is_authenticated:
        return False

    if user.is_superuser:
        return True

    membership = get_user_membership_for_company(user, company)
    return bool(membership)


class IsSuperUser(permissions.BasePermission):
    message = "Nur Superuser hat Zugriff."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_superuser
        )


class IsCompanyOwner(permissions.BasePermission):
    message = "Nur der Company Owner hat Zugriff."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        get_company = getattr(view, "get_company", None)
        if not callable(get_company):
            return False

        company = get_company()
        return user_is_company_owner(user, company)


class IsCompanyOwnerOrAdmin(permissions.BasePermission):
    message = "Nur Company Owner oder Admin haben Zugriff."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        get_company = getattr(view, "get_company", None)
        if not callable(get_company):
            return False

        company = get_company()
        return user_is_company_owner_or_admin(user, company)


class HasCompanyAccess(permissions.BasePermission):
    message = "Kein Zugriff auf diese Firma."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        get_company = getattr(view, "get_company", None)
        if not callable(get_company):
            return False

        company = get_company()
        return user_can_access_company(user, company)