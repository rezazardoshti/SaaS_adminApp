# apps/invoices/admin.py

from django.contrib import admin

from .models import (
    AccountingContact,
    AccountingExportBatch,
    AccountingExportItem,
    Invoice,
    InvoiceAttachment,
    InvoiceLine,
    InvoiceNumberSequence,
    InvoicePayment,
    InvoicePublicIDSequence,
)


class InvoiceLineInline(admin.TabularInline):
    model = InvoiceLine
    extra = 0
    fields = (
        "public_id",
        "sort_order",
        "line_type",
        "name",
        "description",
        "quantity",
        "unit",
        "unit_price_net",
        "discount_percent",
        "tax_rate",
        "line_net",
        "line_tax",
        "line_gross",
        "service_date",
        "cost_center",
        "ledger_account",
        "is_active",
    )
    readonly_fields = (
        "public_id",
        "line_net",
        "line_tax",
        "line_gross",
        "created_at",
        "updated_at",
    )
    ordering = ("sort_order", "id")


class InvoiceAttachmentInline(admin.TabularInline):
    model = InvoiceAttachment
    extra = 0
    fields = (
        "public_id",
        "attachment_type",
        "title",
        "file",
        "uploaded_by",
        "is_active",
        "created_at",
    )
    readonly_fields = (
        "public_id",
        "created_at",
    )


class InvoicePaymentInline(admin.TabularInline):
    model = InvoicePayment
    extra = 0
    fields = (
        "public_id",
        "amount",
        "payment_date",
        "payment_method",
        "reference",
        "notes",
        "created_by",
        "created_at",
    )
    readonly_fields = (
        "public_id",
        "created_at",
    )


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    ordering = ("-issue_date", "-created_at")

    list_display = (
        "public_id",
        "invoice_number",
        "company",
        "invoice_type",
        "document_type",
        "status",
        "bookkeeping_status",
        "issue_date",
        "due_date",
        "total_gross",
        "paid_amount",
        "open_amount",
        "is_active",
        "created_at",
    )

    list_filter = (
        "invoice_type",
        "document_type",
        "status",
        "bookkeeping_status",
        "tax_mode",
        "is_tax_exempt",
        "is_active",
        "company",
        "currency",
        "issue_date",
        "due_date",
        "created_at",
    )

    search_fields = (
        "public_id",
        "invoice_number",
        "external_invoice_number",
        "customer_reference",
        "external_reference",
        "title",
        "description",
        "partner_name_snapshot",
        "partner_email_snapshot",
        "company__name",
    )

    readonly_fields = (
        "public_id",
        "subtotal_net",
        "tax_total",
        "total_gross",
        "paid_amount",
        "open_amount",
        "sent_at",
        "received_at",
        "paid_at",
        "cancelled_at",
        "exported_at",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "company",
        "project",
        "responsible_membership",
        "accounting_contact",
        "created_by",
        "updated_by",
        "approved_by",
    )

    inlines = (
        InvoiceLineInline,
        InvoiceAttachmentInline,
        InvoicePaymentInline,
    )

    fieldsets = (
        (
            "Grunddaten",
            {
                "fields": (
                    "company",
                    "public_id",
                    "invoice_type",
                    "document_type",
                    "status",
                    "bookkeeping_status",
                    "is_active",
                )
            },
        ),
        (
            "Bezug",
            {
                "fields": (
                    "project",
                    "responsible_membership",
                    "accounting_contact",
                )
            },
        ),
        (
            "Nummern & Referenzen",
            {
                "fields": (
                    "invoice_number",
                    "external_invoice_number",
                    "customer_reference",
                    "external_reference",
                )
            },
        ),
        (
            "Inhalt",
            {
                "fields": (
                    "title",
                    "description",
                    "currency",
                )
            },
        ),
        (
            "Datumsfelder",
            {
                "fields": (
                    "issue_date",
                    "service_date_from",
                    "service_date_to",
                    "due_date",
                )
            },
        ),
        (
            "Zahlungsbedingungen & Steuer",
            {
                "fields": (
                    "payment_terms_label",
                    "payment_terms_days",
                    "tax_mode",
                    "is_tax_exempt",
                    "tax_exemption_reason",
                )
            },
        ),
        (
            "Beträge",
            {
                "fields": (
                    "subtotal_net",
                    "discount_amount",
                    "tax_total",
                    "rounding_amount",
                    "total_gross",
                    "paid_amount",
                    "open_amount",
                )
            },
        ),
        (
            "Partner Snapshot",
            {
                "classes": ("collapse",),
                "fields": (
                    "partner_name_snapshot",
                    "partner_email_snapshot",
                    "partner_phone_snapshot",
                    "partner_address_snapshot",
                    "partner_tax_id_snapshot",
                ),
            },
        ),
        (
            "Eigene Firmen-Snapshotdaten",
            {
                "classes": ("collapse",),
                "fields": (
                    "company_name_snapshot",
                    "company_address_snapshot",
                    "company_tax_id_snapshot",
                    "company_vat_id_snapshot",
                    "company_email_snapshot",
                    "company_phone_snapshot",
                ),
            },
        ),
        (
            "Datei & interne Notizen",
            {
                "fields": (
                    "pdf_file",
                    "notes_internal",
                )
            },
        ),
        (
            "Workflow-Zeitpunkte",
            {
                "classes": ("collapse",),
                "fields": (
                    "sent_at",
                    "received_at",
                    "paid_at",
                    "cancelled_at",
                    "exported_at",
                ),
            },
        ),
        (
            "Audit",
            {
                "classes": ("collapse",),
                "fields": (
                    "created_by",
                    "updated_by",
                    "approved_by",
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    def save_model(self, request, obj, form, change):
        if not change and not obj.created_by:
            obj.created_by = request.user
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(InvoiceLine)
class InvoiceLineAdmin(admin.ModelAdmin):
    ordering = ("invoice", "sort_order", "id")

    list_display = (
        "public_id",
        "invoice",
        "sort_order",
        "line_type",
        "name",
        "quantity",
        "unit_price_net",
        "tax_rate",
        "line_net",
        "line_tax",
        "line_gross",
        "is_active",
        "created_at",
    )

    list_filter = (
        "line_type",
        "is_active",
        "tax_rate",
        "created_at",
    )

    search_fields = (
        "public_id",
        "name",
        "description",
        "invoice__invoice_number",
        "invoice__public_id",
        "invoice__company__name",
    )

    readonly_fields = (
        "public_id",
        "line_net",
        "line_tax",
        "line_gross",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = ("invoice",)


@admin.register(InvoiceAttachment)
class InvoiceAttachmentAdmin(admin.ModelAdmin):
    ordering = ("-created_at",)

    list_display = (
        "public_id",
        "invoice",
        "attachment_type",
        "title",
        "uploaded_by",
        "is_active",
        "created_at",
    )

    list_filter = (
        "attachment_type",
        "is_active",
        "created_at",
    )

    search_fields = (
        "public_id",
        "title",
        "invoice__invoice_number",
        "invoice__public_id",
        "invoice__company__name",
    )

    readonly_fields = (
        "public_id",
        "created_at",
    )

    autocomplete_fields = (
        "invoice",
        "uploaded_by",
    )


@admin.register(InvoicePayment)
class InvoicePaymentAdmin(admin.ModelAdmin):
    ordering = ("-payment_date", "-created_at")

    list_display = (
        "public_id",
        "invoice",
        "amount",
        "payment_date",
        "payment_method",
        "reference",
        "created_by",
        "created_at",
    )

    list_filter = (
        "payment_method",
        "payment_date",
        "created_at",
    )

    search_fields = (
        "public_id",
        "reference",
        "notes",
        "invoice__invoice_number",
        "invoice__public_id",
        "invoice__company__name",
    )

    readonly_fields = (
        "public_id",
        "created_at",
    )

    autocomplete_fields = (
        "invoice",
        "created_by",
    )


@admin.register(AccountingContact)
class AccountingContactAdmin(admin.ModelAdmin):
    ordering = ("company", "name")

    list_display = (
        "public_id",
        "name",
        "company_name",
        "company",
        "email",
        "phone",
        "export_preference",
        "is_active",
        "updated_at",
    )

    list_filter = (
        "export_preference",
        "is_active",
        "company",
        "created_at",
        "updated_at",
    )

    search_fields = (
        "public_id",
        "name",
        "company_name",
        "email",
        "phone",
        "notes",
        "company__name",
    )

    readonly_fields = (
        "public_id",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = ("company",)


class AccountingExportItemInline(admin.TabularInline):
    model = AccountingExportItem
    extra = 0
    fields = (
        "invoice",
        "status",
        "exported_reference",
        "error_message",
        "created_at",
    )
    readonly_fields = ("created_at",)
    autocomplete_fields = ("invoice",)


@admin.register(AccountingExportBatch)
class AccountingExportBatchAdmin(admin.ModelAdmin):
    ordering = ("-created_at",)

    list_display = (
        "public_id",
        "title",
        "company",
        "export_format",
        "status",
        "accounting_contact",
        "period_start",
        "period_end",
        "handed_over_at",
        "created_at",
    )

    list_filter = (
        "export_format",
        "status",
        "company",
        "created_at",
        "handed_over_at",
    )

    search_fields = (
        "public_id",
        "title",
        "notes",
        "error_message",
        "company__name",
        "accounting_contact__name",
    )

    readonly_fields = (
        "public_id",
        "created_at",
        "handed_over_at",
    )

    autocomplete_fields = (
        "company",
        "accounting_contact",
        "created_by",
    )

    inlines = (AccountingExportItemInline,)

    fieldsets = (
        (
            "Grunddaten",
            {
                "fields": (
                    "company",
                    "public_id",
                    "title",
                    "export_format",
                    "status",
                    "accounting_contact",
                )
            },
        ),
        (
            "Zeitraum",
            {
                "fields": (
                    "period_start",
                    "period_end",
                )
            },
        ),
        (
            "Datei & Hinweise",
            {
                "fields": (
                    "file",
                    "notes",
                    "error_message",
                )
            },
        ),
        (
            "Audit",
            {
                "classes": ("collapse",),
                "fields": (
                    "created_by",
                    "created_at",
                    "handed_over_at",
                ),
            },
        ),
    )

    def save_model(self, request, obj, form, change):
        if not change and not obj.created_by:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(AccountingExportItem)
class AccountingExportItemAdmin(admin.ModelAdmin):
    ordering = ("-created_at",)

    list_display = (
        "batch",
        "invoice",
        "status",
        "exported_reference",
        "created_at",
    )

    list_filter = (
        "status",
        "created_at",
        "batch__company",
    )

    search_fields = (
        "exported_reference",
        "error_message",
        "invoice__invoice_number",
        "invoice__public_id",
        "batch__title",
        "batch__public_id",
    )

    readonly_fields = ("created_at",)

    autocomplete_fields = (
        "batch",
        "invoice",
    )


@admin.register(InvoicePublicIDSequence)
class InvoicePublicIDSequenceAdmin(admin.ModelAdmin):
    list_display = (
        "company",
        "last_value",
    )
    search_fields = (
        "company__name",
    )
    autocomplete_fields = ("company",)


@admin.register(InvoiceNumberSequence)
class InvoiceNumberSequenceAdmin(admin.ModelAdmin):
    list_display = (
        "company",
        "prefix",
        "year_based",
        "last_value",
    )
    list_filter = ("year_based",)
    search_fields = (
        "company__name",
        "prefix",
    )
    autocomplete_fields = ("company",)
