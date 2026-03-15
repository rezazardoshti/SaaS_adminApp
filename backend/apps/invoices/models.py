# apps/invoices/models.py

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone


class InvoicePublicIDSequence(models.Model):
    company = models.OneToOneField(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="invoice_public_id_sequence",
    )
    last_value = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Invoice Public ID Sequence"
        verbose_name_plural = "Invoice Public ID Sequences"

    def __str__(self):
        return f"{self.company} - {self.last_value}"


class InvoiceNumberSequence(models.Model):
    company = models.OneToOneField(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="invoice_number_sequence",
    )
    last_value = models.PositiveIntegerField(default=0)
    prefix = models.CharField(max_length=20, default="RE")
    year_based = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Invoice Number Sequence"
        verbose_name_plural = "Invoice Number Sequences"

    def __str__(self):
        return f"{self.company} - {self.prefix} - {self.last_value}"


class AccountingContact(models.Model):
    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="accounting_contacts",
    )
    public_id = models.CharField(max_length=30, unique=True, blank=True)

    name = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)

    export_preference = models.CharField(
        max_length=30,
        choices=(
            ("csv", "CSV"),
            ("zip_pdf", "ZIP with PDFs"),
            ("csv_zip_pdf", "CSV + ZIP with PDFs"),
            ("datev_later", "DATEV later"),
        ),
        default="csv_zip_pdf",
    )

    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "Accounting Contact"
        verbose_name_plural = "Accounting Contacts"

    def __str__(self):
        return f"{self.name} ({self.company})"


class Invoice(models.Model):
    class InvoiceType(models.TextChoices):
        OUTGOING = "outgoing", "Outgoing"
        INCOMING = "incoming", "Incoming"

    class DocumentType(models.TextChoices):
        INVOICE = "invoice", "Invoice"
        CREDIT_NOTE = "credit_note", "Credit Note"
        CANCELLATION = "cancellation", "Cancellation"
        DOWN_PAYMENT = "down_payment", "Down Payment"
        FINAL_INVOICE = "final_invoice", "Final Invoice"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        APPROVED = "approved", "Approved"
        SENT = "sent", "Sent"
        RECEIVED = "received", "Received"
        PARTIALLY_PAID = "partially_paid", "Partially Paid"
        PAID = "paid", "Paid"
        OVERDUE = "overdue", "Overdue"
        CANCELLED = "cancelled", "Cancelled"

    class BookkeepingStatus(models.TextChoices):
        NOT_READY = "not_ready", "Not Ready"
        READY = "ready", "Ready"
        EXPORTED = "exported", "Exported"
        HANDED_OVER = "handed_over", "Handed Over"
        BOOKED = "booked", "Booked"
        ERROR = "error", "Error"

    class TaxMode(models.TextChoices):
        STANDARD = "standard", "Standard"
        REVERSE_CHARGE = "reverse_charge", "Reverse Charge"
        TAX_FREE = "tax_free", "Tax Free"

    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="invoices",
    )
    public_id = models.CharField(max_length=30, unique=True, blank=True)

    invoice_type = models.CharField(
        max_length=20,
        choices=InvoiceType.choices,
    )
    document_type = models.CharField(
        max_length=20,
        choices=DocumentType.choices,
        default=DocumentType.INVOICE,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    bookkeeping_status = models.CharField(
        max_length=20,
        choices=BookkeepingStatus.choices,
        default=BookkeepingStatus.NOT_READY,
    )

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoices",
    )
    responsible_membership = models.ForeignKey(
        "companies.CompanyMembership",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="responsible_invoices",
    )
    accounting_contact = models.ForeignKey(
        "invoices.AccountingContact",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoices",
    )

    invoice_number = models.CharField(max_length=50, blank=True)
    external_invoice_number = models.CharField(max_length=100, blank=True)
    customer_reference = models.CharField(max_length=255, blank=True)
    external_reference = models.CharField(max_length=255, blank=True)

    title = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)

    currency = models.CharField(max_length=10, default="EUR")

    issue_date = models.DateField(default=timezone.localdate)
    service_date_from = models.DateField(null=True, blank=True)
    service_date_to = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)

    payment_terms_label = models.CharField(max_length=255, blank=True)
    payment_terms_days = models.PositiveIntegerField(default=14)

    tax_mode = models.CharField(
        max_length=20,
        choices=TaxMode.choices,
        default=TaxMode.STANDARD,
    )
    is_tax_exempt = models.BooleanField(default=False)
    tax_exemption_reason = models.CharField(max_length=255, blank=True)

    subtotal_net = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tax_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    rounding_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_gross = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    open_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    partner_name_snapshot = models.CharField(max_length=255, blank=True)
    partner_email_snapshot = models.EmailField(blank=True)
    partner_phone_snapshot = models.CharField(max_length=50, blank=True)
    partner_address_snapshot = models.TextField(blank=True)
    partner_tax_id_snapshot = models.CharField(max_length=100, blank=True)

    company_name_snapshot = models.CharField(max_length=255, blank=True)
    company_address_snapshot = models.TextField(blank=True)
    company_tax_id_snapshot = models.CharField(max_length=100, blank=True)
    company_vat_id_snapshot = models.CharField(max_length=100, blank=True)
    company_email_snapshot = models.EmailField(blank=True)
    company_phone_snapshot = models.CharField(max_length=50, blank=True)

    pdf_file = models.FileField(upload_to="invoices/pdfs/", null=True, blank=True)
    notes_internal = models.TextField(blank=True)

    sent_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    exported_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_invoices",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_invoices",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_invoices",
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-issue_date", "-created_at")
        indexes = [
            models.Index(fields=["company", "invoice_type"]),
            models.Index(fields=["company", "status"]),
            models.Index(fields=["company", "bookkeeping_status"]),
            models.Index(fields=["company", "invoice_number"]),
            models.Index(fields=["company", "issue_date"]),
            models.Index(fields=["company", "due_date"]),
        ]
        verbose_name = "Invoice"
        verbose_name_plural = "Invoices"

    def __str__(self):
        if self.invoice_number:
            return f"{self.invoice_number} - {self.company}"
        return f"{self.public_id or self.pk} - {self.company}"

    def clean(self):
        if self.service_date_from and self.service_date_to:
            if self.service_date_from > self.service_date_to:
                raise ValidationError("service_date_from cannot be later than service_date_to.")

        if self.issue_date and self.due_date:
            if self.due_date < self.issue_date:
                raise ValidationError("due_date cannot be earlier than issue_date.")

        if self.responsible_membership and self.responsible_membership.company_id != self.company_id:
            raise ValidationError("responsible_membership must belong to the same company.")

        if self.accounting_contact and self.accounting_contact.company_id != self.company_id:
            raise ValidationError("accounting_contact must belong to the same company.")

        if self.project and hasattr(self.project, "company_id"):
            if self.project.company_id != self.company_id:
                raise ValidationError("project must belong to the same company.")

    def _generate_public_id(self):
        sequence, _ = InvoicePublicIDSequence.objects.select_for_update().get_or_create(
            company=self.company,
            defaults={"last_value": 0},
        )
        sequence.last_value += 1
        sequence.save(update_fields=["last_value"])
        return f"INV-{self.company_id}-{sequence.last_value}"

    def _generate_invoice_number(self):
        sequence, _ = InvoiceNumberSequence.objects.select_for_update().get_or_create(
            company=self.company,
            defaults={
                "last_value": 0,
                "prefix": "RE",
                "year_based": True,
            },
        )

        sequence.last_value += 1
        sequence.save(update_fields=["last_value"])

        number_part = str(sequence.last_value).zfill(4)

        if sequence.year_based:
            year = self.issue_date.year if self.issue_date else timezone.localdate().year
            return f"{sequence.prefix}-{year}-{number_part}"

        return f"{sequence.prefix}-{number_part}"

    def ensure_identifiers(self):
        if not self.company_id:
            raise ValidationError("company must be set before generating identifiers.")

        if not self.public_id:
            self.public_id = self._generate_public_id()

        if self.invoice_type == self.InvoiceType.OUTGOING and not self.invoice_number:
            self.invoice_number = self._generate_invoice_number()

    def recalculate_totals(self):
        lines = self.lines.all()

        subtotal_net = Decimal("0.00")
        tax_total = Decimal("0.00")
        total_gross = Decimal("0.00")

        for line in lines:
            subtotal_net += line.line_net
            tax_total += line.line_tax
            total_gross += line.line_gross

        total_gross = total_gross - self.discount_amount + self.rounding_amount
        open_amount = total_gross - self.paid_amount

        self.subtotal_net = subtotal_net
        self.tax_total = tax_total
        self.total_gross = total_gross
        self.open_amount = open_amount if open_amount > Decimal("0.00") else Decimal("0.00")

        if self.status == self.Status.CANCELLED:
            return

        if self.paid_amount <= Decimal("0.00"):
            if self.due_date and self.due_date < timezone.localdate() and self.status not in [self.Status.DRAFT]:
                self.status = self.Status.OVERDUE
        elif self.paid_amount < self.total_gross:
            self.status = self.Status.PARTIALLY_PAID
        else:
            self.status = self.Status.PAID
            if not self.paid_at:
                self.paid_at = timezone.now()

    def save(self, *args, **kwargs):
        with transaction.atomic():
            self.full_clean()

            if not self.pk:
                self.ensure_identifiers()

            super().save(*args, **kwargs)


class InvoiceLine(models.Model):
    class LineType(models.TextChoices):
        NORMAL = "normal", "Normal"
        TEXT = "text", "Text"
        SUBTOTAL = "subtotal", "Subtotal"
        DISCOUNT = "discount", "Discount"

    invoice = models.ForeignKey(
        "invoices.Invoice",
        on_delete=models.CASCADE,
        related_name="lines",
    )
    public_id = models.CharField(max_length=30, unique=True, blank=True)

    sort_order = models.PositiveIntegerField(default=0)
    line_type = models.CharField(
        max_length=20,
        choices=LineType.choices,
        default=LineType.NORMAL,
    )

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("1.00"))
    unit = models.CharField(max_length=50, blank=True)
    unit_price_net = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("19.00"))

    service_date = models.DateField(null=True, blank=True)

    line_net = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    line_tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    line_gross = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    cost_center = models.CharField(max_length=100, blank=True)
    ledger_account = models.CharField(max_length=100, blank=True)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("sort_order", "id")
        verbose_name = "Invoice Line"
        verbose_name_plural = "Invoice Lines"

    def __str__(self):
        return f"{self.invoice} - {self.name}"

    def clean(self):
        if self.quantity < 0:
            raise ValidationError("quantity cannot be negative.")

        if self.unit_price_net < 0:
            raise ValidationError("unit_price_net cannot be negative.")

        if self.discount_percent < 0 or self.discount_percent > 100:
            raise ValidationError("discount_percent must be between 0 and 100.")

        if self.tax_rate < 0 or self.tax_rate > 100:
            raise ValidationError("tax_rate must be between 0 and 100.")

    def _generate_public_id(self):
        return f"INVL-{self.invoice_id}-{self.sort_order or self.pk or timezone.now().timestamp()}"

    def calculate_amounts(self):
        if self.line_type == self.LineType.TEXT:
            self.line_net = Decimal("0.00")
            self.line_tax = Decimal("0.00")
            self.line_gross = Decimal("0.00")
            return

        base_amount = self.quantity * self.unit_price_net
        discount_amount = base_amount * (self.discount_percent / Decimal("100"))
        net = base_amount - discount_amount
        tax = net * (self.tax_rate / Decimal("100"))
        gross = net + tax

        self.line_net = net.quantize(Decimal("0.01"))
        self.line_tax = tax.quantize(Decimal("0.01"))
        self.line_gross = gross.quantize(Decimal("0.01"))

    def save(self, *args, **kwargs):
        self.full_clean()
        self.calculate_amounts()
        super().save(*args, **kwargs)

        if not self.public_id:
            self.public_id = f"INVL-{self.invoice_id}-{self.id}"
            super().save(update_fields=["public_id"])

        self.invoice.recalculate_totals()
        self.invoice.save(update_fields=[
            "subtotal_net",
            "tax_total",
            "total_gross",
            "open_amount",
            "status",
            "paid_at",
            "updated_at",
        ])

    def delete(self, *args, **kwargs):
        invoice = self.invoice
        super().delete(*args, **kwargs)
        invoice.recalculate_totals()
        invoice.save(update_fields=[
            "subtotal_net",
            "tax_total",
            "total_gross",
            "open_amount",
            "status",
            "paid_at",
            "updated_at",
        ])


class InvoiceAttachment(models.Model):
    class AttachmentType(models.TextChoices):
        INVOICE_PDF = "invoice_pdf", "Invoice PDF"
        SCAN = "scan", "Scan"
        RECEIPT = "receipt", "Receipt"
        DELIVERY_NOTE = "delivery_note", "Delivery Note"
        OTHER = "other", "Other"

    invoice = models.ForeignKey(
        "invoices.Invoice",
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    public_id = models.CharField(max_length=30, unique=True, blank=True)

    attachment_type = models.CharField(
        max_length=30,
        choices=AttachmentType.choices,
        default=AttachmentType.OTHER,
    )
    title = models.CharField(max_length=255, blank=True)
    file = models.FileField(upload_to="invoices/attachments/")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_invoice_attachments",
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Invoice Attachment"
        verbose_name_plural = "Invoice Attachments"

    def __str__(self):
        return self.title or f"Attachment {self.pk}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.public_id:
            self.public_id = f"INVA-{self.invoice_id}-{self.id}"
            super().save(update_fields=["public_id"])


class InvoicePayment(models.Model):
    class PaymentMethod(models.TextChoices):
        BANK = "bank", "Bank Transfer"
        CASH = "cash", "Cash"
        CARD = "card", "Card"
        DIRECT_DEBIT = "direct_debit", "Direct Debit"
        OTHER = "other", "Other"

    invoice = models.ForeignKey(
        "invoices.Invoice",
        on_delete=models.CASCADE,
        related_name="payments",
    )
    public_id = models.CharField(max_length=30, unique=True, blank=True)

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_date = models.DateField(default=timezone.localdate)
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.BANK,
    )
    reference = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_invoice_payments",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-payment_date", "-created_at")
        verbose_name = "Invoice Payment"
        verbose_name_plural = "Invoice Payments"

    def __str__(self):
        return f"{self.invoice} - {self.amount}"

    def clean(self):
        if self.amount <= Decimal("0.00"):
            raise ValidationError("Payment amount must be greater than zero.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

        if not self.public_id:
            self.public_id = f"INVP-{self.invoice_id}-{self.id}"
            super().save(update_fields=["public_id"])

        paid_total = self.invoice.payments.aggregate(
            total=models.Sum("amount")
        )["total"] or Decimal("0.00")

        self.invoice.paid_amount = paid_total
        self.invoice.recalculate_totals()
        self.invoice.save(update_fields=[
            "paid_amount",
            "subtotal_net",
            "tax_total",
            "total_gross",
            "open_amount",
            "status",
            "paid_at",
            "updated_at",
        ])

    def delete(self, *args, **kwargs):
        invoice = self.invoice
        super().delete(*args, **kwargs)

        paid_total = invoice.payments.aggregate(
            total=models.Sum("amount")
        )["total"] or Decimal("0.00")

        invoice.paid_amount = paid_total
        invoice.recalculate_totals()
        invoice.save(update_fields=[
            "paid_amount",
            "subtotal_net",
            "tax_total",
            "total_gross",
            "open_amount",
            "status",
            "paid_at",
            "updated_at",
        ])


class AccountingExportBatch(models.Model):
    class ExportFormat(models.TextChoices):
        CSV = "csv", "CSV"
        ZIP_PDF = "zip_pdf", "ZIP PDF"
        CSV_ZIP_PDF = "csv_zip_pdf", "CSV + ZIP PDF"
        DATEV_LATER = "datev_later", "DATEV later"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        GENERATED = "generated", "Generated"
        HANDED_OVER = "handed_over", "Handed Over"
        FAILED = "failed", "Failed"

    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="accounting_export_batches",
    )
    public_id = models.CharField(max_length=30, unique=True, blank=True)

    title = models.CharField(max_length=255, blank=True)
    export_format = models.CharField(
        max_length=20,
        choices=ExportFormat.choices,
        default=ExportFormat.CSV_ZIP_PDF,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    accounting_contact = models.ForeignKey(
        "invoices.AccountingContact",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="export_batches",
    )

    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)

    file = models.FileField(upload_to="invoices/exports/", null=True, blank=True)
    notes = models.TextField(blank=True)
    error_message = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_accounting_export_batches",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    handed_over_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Accounting Export Batch"
        verbose_name_plural = "Accounting Export Batches"

    def __str__(self):
        return self.title or f"Export Batch {self.pk}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.public_id:
            self.public_id = f"EXPB-{self.company_id}-{self.id}"
            super().save(update_fields=["public_id"])


class AccountingExportItem(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        EXPORTED = "exported", "Exported"
        ERROR = "error", "Error"

    batch = models.ForeignKey(
        "invoices.AccountingExportBatch",
        on_delete=models.CASCADE,
        related_name="items",
    )
    invoice = models.ForeignKey(
        "invoices.Invoice",
        on_delete=models.CASCADE,
        related_name="export_items",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    exported_reference = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("batch", "invoice")
        ordering = ("-created_at",)
        verbose_name = "Accounting Export Item"
        verbose_name_plural = "Accounting Export Items"

    def __str__(self):
        return f"{self.batch} - {self.invoice}"
