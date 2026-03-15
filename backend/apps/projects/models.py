from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction

from apps.companies.models import Company
from apps.customers.models import Customer


class ProjectPublicIDSequence(models.Model):
    key = models.CharField(max_length=50, unique=True)
    last_value = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "projects_public_id_sequence"

    def __str__(self):
        return f"{self.key}: {self.last_value}"


class Project(models.Model):

    STATUS_CHOICES = (
        ("planned", "Planned"),
        ("active", "Active"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    )

    public_id = models.CharField(max_length=32, unique=True, blank=True)

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="projects",
    )

    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="projects",
    )

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    project_number = models.CharField(
    max_length=50,
    blank=True,
)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="planned",
    )

    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    budget = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_projects",
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_projects",
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "projects_project"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["public_id"]),
            models.Index(fields=["company", "status"]),
            models.Index(fields=["customer"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.company.company_name})"

    def clean(self):
        if self.customer and self.company:
            if self.customer.company_id != self.company_id:
                raise ValidationError("Customer does not belong to this company.")

    @classmethod
    def _next_sequence_value(cls, key: str) -> int:
        with transaction.atomic():
            sequence, _ = ProjectPublicIDSequence.objects.select_for_update().get_or_create(
                key=key,
                defaults={"last_value": 0},
            )
            sequence.last_value += 1
            sequence.save(update_fields=["last_value", "updated_at"])
            return sequence.last_value

    @classmethod
    def generate_public_id(cls) -> str:
        next_value = cls._next_sequence_value("project_public_id")
        return f"PRO-{next_value:06d}"

    def save(self, *args, **kwargs):

        self.full_clean()

        if not self.public_id:
            self.public_id = self.generate_public_id()

        super().save(*args, **kwargs)