import os
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction

from apps.companies.models import Company, CompanyMembership


def document_file_upload_to(instance, filename):
    """
    Beispiel:
    documents/company_1/membership_5/2026/03/uuid_originalname.pdf
    """
    ext = os.path.splitext(filename)[1].lower()
    safe_name = f"{uuid4().hex}{ext}"

    company_id = instance.company_id or "unknown"
    membership_id = instance.employee_membership_id or "general"
    created_at = instance.created_at if instance.created_at else None

    year = created_at.year if created_at else "unknown"
    month = f"{created_at.month:02d}" if created_at else "00"

    return (
        f"documents/company_{company_id}/"
        f"membership_{membership_id}/"
        f"{year}/{month}/{safe_name}"
    )


class DocumentPublicIDSequence(models.Model):
    employee_membership = models.OneToOneField(
        CompanyMembership,
        on_delete=models.CASCADE,
        related_name="document_public_id_sequence",
    )
    last_value = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Document Public ID Sequence"
        verbose_name_plural = "Document Public ID Sequences"

    def __str__(self):
        return f"{self.employee_membership} - {self.last_value}"


class Document(models.Model):
    class Category(models.TextChoices):
        GENERAL = "general", "General"
        INVOICE = "invoice", "Invoice"
        RECEIPT = "receipt", "Receipt"
        CONTRACT = "contract", "Contract"
        SICK_NOTE = "sick_note", "Sick Note"
        VACATION_ATTACHMENT = "vacation_attachment", "Vacation Attachment"
        OTHER = "other", "Other"

    class Visibility(models.TextChoices):
        PRIVATE = "private", "Private"
        COMPANY_ADMIN = "company_admin", "Company Admin"
        COMPANY_ALL = "company_all", "Company All"

    public_id = models.CharField(
        max_length=30,
        unique=True,
        editable=False,
        db_index=True,
    )

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="documents",
    )

    employee_membership = models.ForeignKey(
        CompanyMembership,
        on_delete=models.SET_NULL,
        related_name="documents",
        null=True,
        blank=True,
        help_text="Optional employee relation for employee-specific documents.",
    )

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="uploaded_documents",
    )

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        default=Category.GENERAL,
        db_index=True,
    )

    visibility = models.CharField(
        max_length=20,
        choices=Visibility.choices,
        default=Visibility.COMPANY_ADMIN,
        db_index=True,
    )

    file = models.FileField(upload_to="documents/",blank=True,null=True)
    original_filename = models.CharField(max_length=255, blank=True)
    file_size = models.PositiveBigIntegerField(default=0)
    mime_type = models.CharField(max_length=100, blank=True)

    is_active = models.BooleanField(default=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Document"
        verbose_name_plural = "Documents"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["company", "category"]),
            models.Index(fields=["company", "employee_membership"]),
            models.Index(fields=["company", "visibility"]),
            models.Index(fields=["company", "is_active"]),
        ]

    def __str__(self):
        return f"{self.public_id} - {self.title}"

    def clean(self):
        errors = {}

        if self.employee_membership_id and self.company_id:
            if self.employee_membership.company_id != self.company_id:
                errors["employee_membership"] = (
                    "Employee membership must belong to the same company."
                )

        # 👉 Nur Titel Pflicht
        if not self.title or not self.title.strip():
            errors["title"] = "Title is required."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.file and not self.original_filename:
            self.original_filename = self.file.name

        if self.file and hasattr(self.file, "size"):
            self.file_size = self.file.size or 0

        if not self.public_id:
            self.public_id = self._generate_public_id()

        self.full_clean()
        super().save(*args, **kwargs)

    def _generate_public_id(self) -> str:
        """
        Wenn employee_membership existiert:
            DOC-<employee_number>-000001
        sonst:
            DOC-COMPANY-<company_id>-000001
        """

        with transaction.atomic():
            if self.employee_membership_id:
                sequence, _ = DocumentPublicIDSequence.objects.select_for_update().get_or_create(
                    employee_membership_id=self.employee_membership_id,
                    defaults={"last_value": 0},
                )
                sequence.last_value += 1
                sequence.save(update_fields=["last_value"])

                employee_number = (
                    self.employee_membership.employee_number
                    or str(self.employee_membership_id)
                )
                return f"DOC-{employee_number}-{sequence.last_value:06d}"

            company_sequence_key = (
                CompanyMembership.objects.select_for_update()
                .filter(company_id=self.company_id)
                .order_by("id")
                .first()
            )

            if company_sequence_key:
                sequence, _ = DocumentPublicIDSequence.objects.select_for_update().get_or_create(
                    employee_membership=company_sequence_key,
                    defaults={"last_value": 0},
                )
                sequence.last_value += 1
                sequence.save(update_fields=["last_value"])
                return f"DOC-COMPANY-{self.company_id}-{sequence.last_value:06d}"

            return f"DOC-COMPANY-{self.company_id}-{uuid4().hex[:6].upper()}"