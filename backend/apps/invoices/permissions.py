# apps/invoices/permissions.py

from rest_framework.permissions import SAFE_METHODS, BasePermission


WRITE_ROLES = {"owner", "admin"}
READ_ROLES = {"owner", "admin", "manager", "employee"}


class IsAuthenticatedAndActive(BasePermission):
    """
    Basis-Permission:
    - User muss eingeloggt sein
    - User muss aktiv sein
    """

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active)


class CompanyMembershipPermission(BasePermission):
    """
    Firmenbasierte Permission für Invoice-Module.

    Regeln:
    - Superuser: alles
    - Lesen: aktive Membership in der Firma reicht
    - Schreiben: nur owner/admin in der Firma
    """

    message = "You do not have permission to access this resource."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated or not user.is_active:
            return False

        if user.is_superuser:
            return True

        company_id = self._get_company_id_from_request(request, view)

        # Wenn keine company direkt im Request ist, lassen wir hier erstmal durch
        # und prüfen später im Objektzugriff / queryset-scope.
        if not company_id:
            return True

        membership = self._get_membership(user, company_id)
        if not membership:
            return False

        if request.method in SAFE_METHODS:
            return membership.role in READ_ROLES

        return membership.role in WRITE_ROLES

    def has_object_permission(self, request, view, obj):
        user = request.user

        if not user or not user.is_authenticated or not user.is_active:
            return False

        if user.is_superuser:
            return True

        company_id = self._extract_company_id_from_object(obj)
        if not company_id:
            return False

        membership = self._get_membership(user, company_id)
        if not membership:
            return False

        if request.method in SAFE_METHODS:
            return membership.role in READ_ROLES

        return membership.role in WRITE_ROLES

    def _get_membership(self, user, company_id):
        return (
            user.company_memberships.filter(
                company_id=company_id,
                is_active=True,
            )
            .select_related("company")
            .first()
        )

    def _get_company_id_from_request(self, request, view):
        data = request.data

        if hasattr(data, "get"):
            company_id = data.get("company")
            if company_id:
                return str(company_id)

            # Für untergeordnete Objekte wie lines/payments/attachments:
            invoice_id = data.get("invoice")
            if invoice_id:
                invoice_queryset = view.get_invoice_queryset_for_permission()
                invoice = invoice_queryset.filter(id=invoice_id).first()
                if invoice:
                    return str(invoice.company_id)

            batch_id = data.get("batch")
            if batch_id:
                batch_queryset = view.get_export_batch_queryset_for_permission()
                batch = batch_queryset.filter(id=batch_id).first()
                if batch:
                    return str(batch.company_id)

        company_id = request.query_params.get("company")
        if company_id:
            return str(company_id)

        return None

    def _extract_company_id_from_object(self, obj):
        if hasattr(obj, "company_id"):
            return obj.company_id

        if hasattr(obj, "invoice") and obj.invoice:
            return obj.invoice.company_id

        if hasattr(obj, "batch") and obj.batch:
            return obj.batch.company_id

        return None
