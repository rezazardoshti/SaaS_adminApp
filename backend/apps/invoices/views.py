# apps/invoices/views.py

from django.db.models import Prefetch, Q
from rest_framework import filters, viewsets
from rest_framework.parsers import FormParser, MultiPartParser

from .models import (
    AccountingContact,
    AccountingExportBatch,
    AccountingExportItem,
    Invoice,
    InvoiceAttachment,
    InvoiceLine,
    InvoicePayment,
)
from .permissions import CompanyMembershipPermission, IsAuthenticatedAndActive
from .serializers import (
    AccountingContactSerializer,
    AccountingExportBatchSerializer,
    AccountingExportItemSerializer,
    InvoiceAttachmentSerializer,
    InvoiceCreateUpdateSerializer,
    InvoiceDetailSerializer,
    InvoiceLineSerializer,
    InvoiceListSerializer,
    InvoicePaymentSerializer,
    InvoiceStatusUpdateSerializer,
)


class CompanyScopedQuerysetMixin:
    """
    Begrenzt Daten auf Firmenkontext.

    Regeln:
    - Superuser sieht alles
    - normale User sehen nur Datensätze aus Firmen,
      in denen sie aktive Memberships haben
    - optional kann per ?company=<id> gefiltert werden
    """

    company_field = "company"

    def get_user_company_ids(self):
        user = self.request.user

        if user.is_superuser:
            return None

        return list(
            user.company_memberships.filter(is_active=True).values_list("company_id", flat=True)
        )

    def filter_queryset_by_company_scope(self, queryset):
        user = self.request.user
        requested_company_id = self.request.query_params.get("company")

        if user.is_superuser:
            if requested_company_id:
                filter_key = f"{self.company_field}_id"
                return queryset.filter(**{filter_key: requested_company_id})
            return queryset

        company_ids = self.get_user_company_ids()
        filter_key = f"{self.company_field}_id"

        queryset = queryset.filter(**{f"{filter_key}__in": company_ids})

        if requested_company_id:
            queryset = queryset.filter(**{filter_key: requested_company_id})

        return queryset

    def get_invoice_queryset_for_permission(self):
        return Invoice.objects.select_related("company").all()

    def get_export_batch_queryset_for_permission(self):
        return AccountingExportBatch.objects.select_related("company").all()


class InvoiceQuerysetMixin(CompanyScopedQuerysetMixin):
    company_field = "company"

    def get_base_queryset(self):
        return (
            Invoice.objects.select_related(
                "company",
                "project",
                "responsible_membership",
                "accounting_contact",
                "created_by",
                "updated_by",
                "approved_by",
            )
            .prefetch_related(
                Prefetch("lines", queryset=InvoiceLine.objects.order_by("sort_order", "id")),
                "attachments",
                "payments",
            )
            .all()
        )

    def apply_filters(self, queryset):
        params = self.request.query_params

        invoice_type = params.get("invoice_type")
        document_type = params.get("document_type")
        status_value = params.get("status")
        bookkeeping_status = params.get("bookkeeping_status")
        project_id = params.get("project")
        responsible_membership_id = params.get("responsible_membership")
        accounting_contact_id = params.get("accounting_contact")
        is_active = params.get("is_active")
        issue_date_from = params.get("issue_date_from")
        issue_date_to = params.get("issue_date_to")
        due_date_from = params.get("due_date_from")
        due_date_to = params.get("due_date_to")
        search = params.get("search")

        if invoice_type:
            queryset = queryset.filter(invoice_type=invoice_type)

        if document_type:
            queryset = queryset.filter(document_type=document_type)

        if status_value:
            queryset = queryset.filter(status=status_value)

        if bookkeeping_status:
            queryset = queryset.filter(bookkeeping_status=bookkeeping_status)

        if project_id:
            queryset = queryset.filter(project_id=project_id)

        if responsible_membership_id:
            queryset = queryset.filter(responsible_membership_id=responsible_membership_id)

        if accounting_contact_id:
            queryset = queryset.filter(accounting_contact_id=accounting_contact_id)

        if is_active is not None and is_active != "":
            is_active_bool = str(is_active).lower() in ("1", "true", "yes")
            queryset = queryset.filter(is_active=is_active_bool)

        if issue_date_from:
            queryset = queryset.filter(issue_date__gte=issue_date_from)

        if issue_date_to:
            queryset = queryset.filter(issue_date__lte=issue_date_to)

        if due_date_from:
            queryset = queryset.filter(due_date__gte=due_date_from)

        if due_date_to:
            queryset = queryset.filter(due_date__lte=due_date_to)

        if search:
            queryset = queryset.filter(
                Q(public_id__icontains=search)
                | Q(invoice_number__icontains=search)
                | Q(external_invoice_number__icontains=search)
                | Q(customer_reference__icontains=search)
                | Q(external_reference__icontains=search)
                | Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(partner_name_snapshot__icontains=search)
                | Q(partner_email_snapshot__icontains=search)
                | Q(company__name__icontains=search)
            )

        return queryset


class InvoiceViewSet(InvoiceQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndActive, CompanyMembershipPermission]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = [
        "created_at",
        "updated_at",
        "issue_date",
        "due_date",
        "invoice_number",
        "total_gross",
        "paid_amount",
        "open_amount",
        "status",
        "bookkeeping_status",
    ]
    ordering = ["-issue_date", "-created_at"]

    def get_queryset(self):
        queryset = self.get_base_queryset()
        queryset = self.filter_queryset_by_company_scope(queryset)
        queryset = self.apply_filters(queryset)
        return queryset.distinct()

    def get_serializer_class(self):
        if self.action == "list":
            return InvoiceListSerializer

        if self.action in ("create", "update", "partial_update"):
            return InvoiceCreateUpdateSerializer

        return InvoiceDetailSerializer

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class InvoiceStatusViewSet(InvoiceQuerysetMixin, viewsets.GenericViewSet):
    """
    Optionaler eigener Endpoint nur für Statuswechsel.
    Aktuell vorbereitet, aber nicht zwingend in urls registriert.
    """

    permission_classes = [IsAuthenticatedAndActive, CompanyMembershipPermission]
    queryset = Invoice.objects.all()
    serializer_class = InvoiceStatusUpdateSerializer

    def get_queryset(self):
        queryset = Invoice.objects.select_related("company").all()
        return self.filter_queryset_by_company_scope(queryset)


class InvoiceLineViewSet(CompanyScopedQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndActive, CompanyMembershipPermission]
    serializer_class = InvoiceLineSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["sort_order", "created_at", "updated_at"]
    ordering = ["sort_order", "id"]
    company_field = "invoice__company"

    def get_queryset(self):
        queryset = InvoiceLine.objects.select_related("invoice", "invoice__company").all()
        queryset = self.filter_queryset_by_company_scope(queryset)

        invoice_id = self.request.query_params.get("invoice")
        line_type = self.request.query_params.get("line_type")
        is_active = self.request.query_params.get("is_active")

        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)

        if line_type:
            queryset = queryset.filter(line_type=line_type)

        if is_active is not None and is_active != "":
            is_active_bool = str(is_active).lower() in ("1", "true", "yes")
            queryset = queryset.filter(is_active=is_active_bool)

        return queryset

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()


class InvoiceAttachmentViewSet(CompanyScopedQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndActive, CompanyMembershipPermission]
    serializer_class = InvoiceAttachmentSerializer
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]
    company_field = "invoice__company"

    def get_queryset(self):
        queryset = (
            InvoiceAttachment.objects.select_related(
                "invoice",
                "invoice__company",
                "uploaded_by",
            ).all()
        )

        queryset = self.filter_queryset_by_company_scope(queryset)

        invoice_id = self.request.query_params.get("invoice")
        attachment_type = self.request.query_params.get("attachment_type")
        is_active = self.request.query_params.get("is_active")

        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)

        if attachment_type:
            queryset = queryset.filter(attachment_type=attachment_type)

        if is_active is not None and is_active != "":
            is_active_bool = str(is_active).lower() in ("1", "true", "yes")
            queryset = queryset.filter(is_active=is_active_bool)

        return queryset

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save()


class InvoicePaymentViewSet(CompanyScopedQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndActive, CompanyMembershipPermission]
    serializer_class = InvoicePaymentSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["payment_date", "created_at", "amount"]
    ordering = ["-payment_date", "-created_at"]
    company_field = "invoice__company"

    def get_queryset(self):
        queryset = (
            InvoicePayment.objects.select_related(
                "invoice",
                "invoice__company",
                "created_by",
            ).all()
        )

        queryset = self.filter_queryset_by_company_scope(queryset)

        invoice_id = self.request.query_params.get("invoice")
        payment_method = self.request.query_params.get("payment_method")
        payment_date_from = self.request.query_params.get("payment_date_from")
        payment_date_to = self.request.query_params.get("payment_date_to")

        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)

        if payment_method:
            queryset = queryset.filter(payment_method=payment_method)

        if payment_date_from:
            queryset = queryset.filter(payment_date__gte=payment_date_from)

        if payment_date_to:
            queryset = queryset.filter(payment_date__lte=payment_date_to)

        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save()


class AccountingContactViewSet(CompanyScopedQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndActive, CompanyMembershipPermission]
    serializer_class = AccountingContactSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["name", "created_at", "updated_at"]
    ordering = ["name"]
    company_field = "company"

    def get_queryset(self):
        queryset = AccountingContact.objects.select_related("company").all()
        queryset = self.filter_queryset_by_company_scope(queryset)

        is_active = self.request.query_params.get("is_active")
        export_preference = self.request.query_params.get("export_preference")
        search = self.request.query_params.get("search")

        if is_active is not None and is_active != "":
            is_active_bool = str(is_active).lower() in ("1", "true", "yes")
            queryset = queryset.filter(is_active=is_active_bool)

        if export_preference:
            queryset = queryset.filter(export_preference=export_preference)

        if search:
            queryset = queryset.filter(
                Q(public_id__icontains=search)
                | Q(name__icontains=search)
                | Q(company_name__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
                | Q(notes__icontains=search)
                | Q(company__name__icontains=search)
            )

        return queryset

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()


class AccountingExportBatchViewSet(CompanyScopedQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndActive, CompanyMembershipPermission]
    serializer_class = AccountingExportBatchSerializer
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["created_at", "handed_over_at", "period_start", "period_end"]
    ordering = ["-created_at"]
    company_field = "company"

    def get_queryset(self):
        queryset = (
            AccountingExportBatch.objects.select_related(
                "company",
                "accounting_contact",
                "created_by",
            )
            .prefetch_related(
                Prefetch(
                    "items",
                    queryset=AccountingExportItem.objects.select_related("invoice").order_by("-created_at"),
                )
            )
            .all()
        )

        queryset = self.filter_queryset_by_company_scope(queryset)

        status_value = self.request.query_params.get("status")
        export_format = self.request.query_params.get("export_format")
        accounting_contact_id = self.request.query_params.get("accounting_contact")
        period_start_from = self.request.query_params.get("period_start_from")
        period_end_to = self.request.query_params.get("period_end_to")
        search = self.request.query_params.get("search")

        if status_value:
            queryset = queryset.filter(status=status_value)

        if export_format:
            queryset = queryset.filter(export_format=export_format)

        if accounting_contact_id:
            queryset = queryset.filter(accounting_contact_id=accounting_contact_id)

        if period_start_from:
            queryset = queryset.filter(period_start__gte=period_start_from)

        if period_end_to:
            queryset = queryset.filter(period_end__lte=period_end_to)

        if search:
            queryset = queryset.filter(
                Q(public_id__icontains=search)
                | Q(title__icontains=search)
                | Q(notes__icontains=search)
                | Q(error_message__icontains=search)
                | Q(company__name__icontains=search)
                | Q(accounting_contact__name__icontains=search)
            )

        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save()


class AccountingExportItemViewSet(CompanyScopedQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndActive, CompanyMembershipPermission]
    serializer_class = AccountingExportItemSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]
    company_field = "batch__company"

    def get_queryset(self):
        queryset = (
            AccountingExportItem.objects.select_related(
                "batch",
                "batch__company",
                "invoice",
            ).all()
        )

        queryset = self.filter_queryset_by_company_scope(queryset)

        batch_id = self.request.query_params.get("batch")
        invoice_id = self.request.query_params.get("invoice")
        status_value = self.request.query_params.get("status")

        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)

        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)

        if status_value:
            queryset = queryset.filter(status=status_value)

        return queryset

    def perform_create(self, serializer):
        batch = serializer.validated_data["batch"]
        invoice = serializer.validated_data["invoice"]

        if batch.company_id != invoice.company_id:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Batch and invoice must belong to the same company.")

        serializer.save()

    def perform_update(self, serializer):
        serializer.save()
