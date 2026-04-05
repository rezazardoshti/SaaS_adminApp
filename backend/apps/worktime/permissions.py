from rest_framework import permissions

from apps.companies.models import CompanyMembership


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
        and membership.role in (
            CompanyMembership.Role.OWNER,
            CompanyMembership.Role.ADMIN,
        )
    )


def user_can_view_worktime_entry(user, entry):
    if not user or not user.is_authenticated or not entry:
        return False

    if user.is_superuser:
        return True

    membership = get_user_membership_for_company(user, entry.company)
    if not membership:
        return False

    if membership.role in (
        CompanyMembership.Role.OWNER,
        CompanyMembership.Role.ADMIN,
    ):
        return True

    return entry.employee_membership.user_id == user.id


def user_can_start_worktime_for_membership(user, company, target_membership):
    if not user or not user.is_authenticated:
        return False

    if user.is_superuser:
        return True

    requester_membership = get_user_membership_for_company(user, company)
    if not requester_membership or not target_membership:
        return False

    if target_membership.company_id != company.id:
        return False

    if requester_membership.role in (
        CompanyMembership.Role.OWNER,
        CompanyMembership.Role.ADMIN,
    ):
        return True

    return (
        requester_membership.role == CompanyMembership.Role.EMPLOYEE
        and target_membership.user_id == user.id
    )


def user_can_stop_worktime_entry(user, entry):
    if not user or not user.is_authenticated or not entry:
        return False

    if user.is_superuser:
        return True

    membership = get_user_membership_for_company(user, entry.company)
    if not membership:
        return False

    if membership.role in (
        CompanyMembership.Role.OWNER,
        CompanyMembership.Role.ADMIN,
    ):
        return True

    return (
        membership.role == CompanyMembership.Role.EMPLOYEE
        and entry.employee_membership.user_id == user.id
    )


def user_can_edit_worktime_entry(user, entry):
    if not user or not user.is_authenticated or not entry:
        return False

    if user.is_superuser:
        return True

    membership = get_user_membership_for_company(user, entry.company)
    if not membership:
        return False

    if membership.role in (
        CompanyMembership.Role.OWNER,
        CompanyMembership.Role.ADMIN,
    ):
        return True

    if entry.employee_membership.user_id != user.id:
        return False

    return entry.status in (
        entry.Status.RUNNING,
        entry.Status.REJECTED,
    )


def user_can_approve_reject_worktime_entry(user, entry):
    if not user or not user.is_authenticated or not entry:
        return False

    if user.is_superuser:
        return True

    membership = get_user_membership_for_company(user, entry.company)
    return bool(
        membership
        and membership.role in (
            CompanyMembership.Role.OWNER,
            CompanyMembership.Role.ADMIN,
        )
    )


def can_user_view_entry_checkin_location(user, entry):
    if not user or not user.is_authenticated or not entry:
        return False

    if user.is_superuser:
        return True

    membership = get_user_membership_for_company(user, entry.company)
    if not membership:
        return False

    if membership.role in (
        CompanyMembership.Role.OWNER,
        CompanyMembership.Role.ADMIN,
    ):
        return bool(entry.company.gps_visible_to_admin)

    if entry.employee_membership.user_id == user.id:
        return bool(entry.company.gps_visible_to_employee)

    return False


class CanViewWorkTimeEntry(permissions.BasePermission):
    message = "Kein Zugriff auf diesen Arbeitszeiteintrag."

    def has_object_permission(self, request, view, obj):
        return user_can_view_worktime_entry(request.user, obj)


class CanStartWorkTimeEntry(permissions.BasePermission):
    message = "Keine Berechtigung, diesen Arbeitszeiteintrag zu starten."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        company_id = request.data.get("company")
        employee_membership_id = request.data.get("employee_membership")

        if not company_id or not employee_membership_id:
            return False

        try:
            target_membership = (
                CompanyMembership.objects
                .select_related("company", "user")
                .get(pk=employee_membership_id, company_id=company_id, is_active=True)
            )
        except CompanyMembership.DoesNotExist:
            return False

        return user_can_start_worktime_for_membership(
            user=user,
            company=target_membership.company,
            target_membership=target_membership,
        )


class CanStopWorkTimeEntry(permissions.BasePermission):
    message = "Keine Berechtigung, diesen Arbeitszeiteintrag zu stoppen."

    def has_object_permission(self, request, view, obj):
        return user_can_stop_worktime_entry(request.user, obj)


class CanEditWorkTimeEntry(permissions.BasePermission):
    message = "Keine Berechtigung, diesen Arbeitszeiteintrag zu bearbeiten."

    def has_object_permission(self, request, view, obj):
        return user_can_edit_worktime_entry(request.user, obj)


class CanApproveRejectWorkTimeEntry(permissions.BasePermission):
    message = "Keine Berechtigung, diesen Arbeitszeiteintrag freizugeben oder abzulehnen."

    def has_object_permission(self, request, view, obj):
        return user_can_approve_reject_worktime_entry(request.user, obj)