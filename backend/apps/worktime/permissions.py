# apps/worktime/permissions.py

from rest_framework.permissions import BasePermission

from apps.companies.models import CompanyMembership


def get_user_membership_for_company(user, company):
    if not user or not user.is_authenticated or company is None:
        return None

    return CompanyMembership.objects.filter(
        user=user,
        company=company,
        is_active=True,
    ).first()


def user_can_access_company(user, company):
    return get_user_membership_for_company(user, company) is not None


def user_is_company_owner_or_admin(user, company):
    membership = get_user_membership_for_company(user, company)
    if not membership:
        return False

    return membership.role in (
        CompanyMembership.Role.OWNER,
        CompanyMembership.Role.ADMIN,
    )


def user_is_entry_owner(user, entry):
    if not user or not user.is_authenticated:
        return False

    membership = getattr(entry, "employee_membership", None)
    if not membership:
        return False

    return membership.user_id == user.id


class IsCompanyMember(BasePermission):
    """
    Zugriff nur für aktive Mitglieder der Firma.
    """

    def has_permission(self, request, view):
        company = None

        company_id = request.data.get("company") or request.query_params.get("company")
        if company_id:
            try:
                membership = CompanyMembership.objects.filter(
                    company_id=company_id,
                    user=request.user,
                    is_active=True,
                ).first()
                return membership is not None
            except Exception:
                return False

        return True

    def has_object_permission(self, request, view, obj):
        company = getattr(obj, "company", None)
        return user_can_access_company(request.user, company)


class IsCompanyOwnerOrAdmin(BasePermission):
    """
    Nur OWNER oder ADMIN der Firma.
    """

    def has_permission(self, request, view):
        company_id = request.data.get("company") or request.query_params.get("company")
        if not company_id:
            return False

        membership = CompanyMembership.objects.filter(
            company_id=company_id,
            user=request.user,
            is_active=True,
        ).first()

        if not membership:
            return False

        return membership.role in (
            CompanyMembership.Role.OWNER,
            CompanyMembership.Role.ADMIN,
        )

    def has_object_permission(self, request, view, obj):
        company = getattr(obj, "company", None)
        return user_is_company_owner_or_admin(request.user, company)


class CanViewWorkTimeEntry(BasePermission):
    """
    OWNER/ADMIN:
        dürfen alle Einträge der eigenen Firma sehen
    EMPLOYEE:
        darf nur eigene Einträge sehen
    """

    def has_object_permission(self, request, view, obj):
        membership = get_user_membership_for_company(request.user, obj.company)
        if not membership:
            return False

        if membership.role in (
            CompanyMembership.Role.OWNER,
            CompanyMembership.Role.ADMIN,
        ):
            return True

        return user_is_entry_owner(request.user, obj)


class CanEditWorkTimeEntry(BasePermission):
    """
    OWNER/ADMIN:
        dürfen Einträge der eigenen Firma bearbeiten
    EMPLOYEE:
        darf nur eigene Einträge bearbeiten,
        aber nicht wenn approved
    """

    def has_object_permission(self, request, view, obj):
        membership = get_user_membership_for_company(request.user, obj.company)
        if not membership:
            return False

        if membership.role in (
            CompanyMembership.Role.OWNER,
            CompanyMembership.Role.ADMIN,
        ):
            return True

        if membership.role == CompanyMembership.Role.EMPLOYEE:
            if not user_is_entry_owner(request.user, obj):
                return False

            return obj.status != obj.Status.APPROVED

        return False


class CanStartWorkTimeEntry(BasePermission):
    """
    Starten:
    - OWNER/ADMIN dürfen für Mitglieder der eigenen Firma starten
    - EMPLOYEE darf nur für sich selbst starten
    """

    def has_permission(self, request, view):
        company_id = request.data.get("company")
        employee_membership_id = request.data.get("employee_membership")

        if not company_id or not employee_membership_id:
            return False

        requester_membership = CompanyMembership.objects.filter(
            company_id=company_id,
            user=request.user,
            is_active=True,
        ).first()

        if not requester_membership:
            return False

        target_membership = CompanyMembership.objects.filter(
            id=employee_membership_id,
            company_id=company_id,
            is_active=True,
        ).first()

        if not target_membership:
            return False

        if requester_membership.role in (
            CompanyMembership.Role.OWNER,
            CompanyMembership.Role.ADMIN,
        ):
            return True

        if requester_membership.role == CompanyMembership.Role.EMPLOYEE:
            return requester_membership.id == target_membership.id

        return False


class CanStopWorkTimeEntry(BasePermission):
    """
    Stoppen:
    - EMPLOYEE darf nur eigenen laufenden Eintrag stoppen
    - OWNER/ADMIN dürfen fremde laufende Einträge nicht stoppen
    """

    def has_object_permission(self, request, view, obj):
        membership = get_user_membership_for_company(request.user, obj.company)
        if not membership:
            return False

        if membership.role == CompanyMembership.Role.EMPLOYEE:
            return (
                user_is_entry_owner(request.user, obj)
                and obj.status == obj.Status.RUNNING
            )

        return False


class CanApproveRejectWorkTimeEntry(BasePermission):
    """
    Approve / Reject nur für OWNER und ADMIN.
    """

    def has_object_permission(self, request, view, obj):
        return user_is_company_owner_or_admin(request.user, obj.company)