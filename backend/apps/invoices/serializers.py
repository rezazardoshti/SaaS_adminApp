# apps/invoices/serializers.py

from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

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


class InvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLine
        fields = (
            "id",
            "public_id",
            "invoice",
            "sort_order",
            "line_type",
            "name",
            "description",
            "quantity",
            "unit",
            "unit_price_net",
            "discount_percent",
            "tax_rate",
            "service_date",
            "line_net",
            "line_tax",
            "line_gross",
            "cost_center",
            "ledger_account",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "public_id",
            "line_net",
            "line_tax",
            "line_gross",
            "created_at",
            "updated_at",
        )
        extra_kwargs = {
            "invoice": {"required": False},
        }


class InvoiceAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.EmailField(source="uploaded_by.email", read_only=True)

    class Meta:
        model = InvoiceAttachment
        fields = (
            "id",
            "public_id",
            "invoice",
            "attachment_type",
            "title",
            "file",
            "uploaded_by",
            "uploaded_by_email",
            "is_active",
            "created_at",
        )
        read_only_fields = (
            "id",
            "public_id",
            "uploaded_by_email",
            "created_at",
        )


class InvoicePaymentSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = InvoicePayment
        fields = (
            "id",
            "public_id",
            "invoice",
            "amount",
            "payment_date",
            "payment_method",
            "reference",
            "notes",
            "created_by",
            "created_by_email",
            "created_at",
        )
        read_only_fields = (
            "id",
            "public_id",
            "created_by_email",
            "created_at",
        )


class AccountingContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountingContact
        fields = (
            "id",
            "public_id",
            "company",
            "name",
            "company_name",
            "email",
            "phone",
            "export_preference",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "public_id",
            "created_at",
            "updated_at",
        )


class AccountingExportItemSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)
    invoice_public_id = serializers.CharField(source="invoice.public_id", read_only=True)

    class Meta:
        model = AccountingExportItem
        fields = (
            "id",
            "batch",
            "invoice",
            "invoice_number",
            "invoice_public_id",
            "status",
            "exported_reference",
            "error_message",
            "created_at",
        )
        read_only_fields = (
            "id",
            "invoice_number",
            "invoice_public_id",
            "created_at",
        )


class AccountingExportBatchSerializer(serializers.ModelSerializer):
    items = AccountingExportItemSerializer(many=True, read_only=True)
    accounting_contact_name = serializers.CharField(source="accounting_contact.name", read_only=True)

    class Meta:
        model = AccountingExportBatch
        fields = (
            "id",
            "public_id",
            "company",
            "title",
            "export_format",
            "status",
            "accounting_contact",
            "accounting_contact_name",
            "period_start",
            "period_end",
            "file",
            "notes",
            "error_message",
            "created_by",
            "created_at",
            "handed_over_at",
            "items",
        )
        read_only_fields = (
            "id",
            "public_id",
            "accounting_contact_name",
            "created_at",
            "handed_over_at",
            "items",
        )


class InvoiceListSerializer(serializers.ModelSerializer):
    accounting_contact_name = serializers.CharField(source="accounting_contact.name", read_only=True)
    line_count = serializers.IntegerField(source="lines.count", read_only=True)
    payment_count = serializers.IntegerField(source="payments.count", read_only=True)

    class Meta:
        model = Invoice
        fields = (
            "id",
            "public_id",
            "company",
            "invoice_type",
            "document_type",
            "status",
            "bookkeeping_status",
            "project",
            "responsible_membership",
            "accounting_contact",
            "accounting_contact_name",
            "invoice_number",
            "external_invoice_number",
            "customer_reference",
            "external_reference",
            "title",
            "currency",
            "issue_date",
            "service_date_from",
            "service_date_to",
            "due_date",
            "subtotal_net",
            "discount_amount",
            "tax_total",
            "rounding_amount",
            "total_gross",
            "paid_amount",
            "open_amount",
            "line_count",
            "payment_count",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "public_id",
            "invoice_number",
            "subtotal_net",
            "tax_total",
            "total_gross",
            "paid_amount",
            "open_amount",
            "line_count",
            "payment_count",
            "created_at",
            "updated_at",
        )


class InvoiceDetailSerializer(serializers.ModelSerializer):
    lines = InvoiceLineSerializer(many=True, required=False)
    attachments = InvoiceAttachmentSerializer(many=True, read_only=True)
    payments = InvoicePaymentSerializer(many=True, read_only=True)

    accounting_contact_name = serializers.CharField(source="accounting_contact.name", read_only=True)

    class Meta:
        model = Invoice
        fields = (
            "id",
            "public_id",
            "company",
            "invoice_type",
            "document_type",
            "status",
            "bookkeeping_status",
            "project",
            "responsible_membership",
            "accounting_contact",
            "accounting_contact_name",
            "invoice_number",
            "external_invoice_number",
            "customer_reference",
            "external_reference",
            "title",
            "description",
            "currency",
            "issue_date",
            "service_date_from",
            "service_date_to",
            "due_date",
            "payment_terms_label",
            "payment_terms_days",
            "tax_mode",
            "is_tax_exempt",
            "tax_exemption_reason",
            "subtotal_net",
            "discount_amount",
            "tax_total",
            "rounding_amount",
            "total_gross",
            "paid_amount",
            "open_amount",
            "partner_name_snapshot",
            "partner_email_snapshot",
            "partner_phone_snapshot",
            "partner_address_snapshot",
            "partner_tax_id_snapshot",
            "company_name_snapshot",
            "company_address_snapshot",
            "company_tax_id_snapshot",
            "company_vat_id_snapshot",
            "company_email_snapshot",
            "company_phone_snapshot",
            "pdf_file",
            "notes_internal",
            "sent_at",
            "received_at",
            "paid_at",
            "cancelled_at",
            "exported_at",
            "created_by",
            "updated_by",
            "approved_by",
            "is_active",
            "created_at",
            "updated_at",
            "lines",
            "attachments",
            "payments",
        )
        read_only_fields = (
            "id",
            "public_id",
            "invoice_number",
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
            "attachments",
            "payments",
        )

    def validate(self, attrs):
        issue_date = attrs.get("issue_date", getattr(self.instance, "issue_date", None))
        due_date = attrs.get("due_date", getattr(self.instance, "due_date", None))
        service_date_from = attrs.get(
            "service_date_from",
            getattr(self.instance, "service_date_from", None),
        )
        service_date_to = attrs.get(
            "service_date_to",
            getattr(self.instance, "service_date_to", None),
        )

        if issue_date and due_date and due_date < issue_date:
            raise serializers.ValidationError(
                {"due_date": "due_date cannot be earlier than issue_date."}
            )

        if service_date_from and service_date_to and service_date_from > service_date_to:
            raise serializers.ValidationError(
                {"service_date_from": "service_date_from cannot be later than service_date_to."}
            )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])

        invoice = Invoice.objects.create(**validated_data)

        for index, line_data in enumerate(lines_data, start=1):
            if "sort_order" not in line_data:
                line_data["sort_order"] = index
            InvoiceLine.objects.create(invoice=invoice, **line_data)

        if not lines_data:
            invoice.subtotal_net = Decimal("0.00")
            invoice.tax_total = Decimal("0.00")
            invoice.total_gross = Decimal("0.00")
            invoice.open_amount = Decimal("0.00")
            invoice.save(
                update_fields=[
                    "subtotal_net",
                    "tax_total",
                    "total_gross",
                    "open_amount",
                    "updated_at",
                ]
            )

        invoice.refresh_from_db()
        return invoice

    @transaction.atomic
    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if lines_data is not None:
            existing_lines_by_id = {
                str(line.id): line for line in instance.lines.all()
            }

            sent_line_ids = set()

            for index, line_data in enumerate(lines_data, start=1):
                line_id = line_data.get("id")

                if "sort_order" not in line_data:
                    line_data["sort_order"] = index

                if line_id:
                    line_obj = existing_lines_by_id.get(str(line_id))
                    if not line_obj:
                        raise serializers.ValidationError(
                            {"lines": f"Line with id {line_id} does not belong to this invoice."}
                        )

                    sent_line_ids.add(str(line_id))

                    for attr, value in line_data.items():
                        if attr != "id":
                            setattr(line_obj, attr, value)
                    line_obj.save()
                else:
                    InvoiceLine.objects.create(invoice=instance, **line_data)

            for existing_id, existing_line in existing_lines_by_id.items():
                if existing_id not in sent_line_ids:
                    existing_line.delete()

        instance.refresh_from_db()
        return instance


class InvoiceCreateUpdateSerializer(InvoiceDetailSerializer):
    """
    Kann später getrennt werden, falls du für create/update andere Regeln willst.
    Für V1 nutzen wir gleiche Logik wie DetailSerializer.
    """

    pass


class InvoiceStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = (
            "status",
            "bookkeeping_status",
        )

    def validate_status(self, value):
        allowed_values = {choice[0] for choice in Invoice.Status.choices}
        if value not in allowed_values:
            raise serializers.ValidationError("Invalid status.")
        return value

    def validate_bookkeeping_status(self, value):
        allowed_values = {choice[0] for choice in Invoice.BookkeepingStatus.choices}
        if value not in allowed_values:
            raise serializers.ValidationError("Invalid bookkeeping status.")
        return value


class InvoicePublicIDSequenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoicePublicIDSequence
        fields = (
            "id",
            "company",
            "last_value",
        )


class InvoiceNumberSequenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceNumberSequence
        fields = (
            "id",
            "company",
            "last_value",
            "prefix",
            "year_based",
        )
