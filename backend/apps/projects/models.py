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


class ProjectType(models.Model):
    """
    Company-specific choice list for project types.
    Example values per company:
    - Elektroinstallation
    - Wartung
    - Renovierung
    - Gastronomie-Umbau
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="project_types",
    )
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "projects_project_type"
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "name"],
                name="uniq_project_type_name_per_company",
            )
        ]
        indexes = [
            models.Index(fields=["company", "is_active"]),
            models.Index(fields=["company", "name"]),
        ]

    def __str__(self):
        return f"{self.company.company_name} - {self.name}"

    def clean(self):
        self.name = (self.name or "").strip()
        if not self.name:
            raise ValidationError({"name": "Project type name is required."})


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

    # NEW: company-defined project type
    project_type = models.ForeignKey(
        ProjectType,
        on_delete=models.PROTECT,
        related_name="projects",
        null=True,
        blank=True,
    )

    # NEW: project place / location
    site_location = models.CharField(
        max_length=255,
        blank=True,
        default="",
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
            models.Index(fields=["company", "project_type"]),
            models.Index(fields=["customer"]),
        ]

    def __str__(self):
        label = self.project_number or self.public_id or str(self.pk)
        return f"{label} - {self.name}"

    def clean(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError(
                {"end_date": "End date cannot be earlier than start date."}
            )

        if self.customer_id and self.company_id:
            customer_company_id = getattr(self.customer, "company_id", None)
            if customer_company_id and customer_company_id != self.company_id:
                raise ValidationError(
                    {"customer": "Customer does not belong to the selected company."}
                )

        if self.project_type_id and self.company_id:
            project_type_company_id = getattr(self.project_type, "company_id", None)
            if project_type_company_id != self.company_id:
                raise ValidationError(
                    {
                        "project_type": (
                            "Selected project type does not belong to the selected company."
                        )
                    }
                )

    def save(self, *args, **kwargs):
        self.full_clean()

        if not self.public_id:
            self.public_id = self._generate_public_id()

        super().save(*args, **kwargs)

    @classmethod
    def _generate_public_id(cls):
        with transaction.atomic():
            sequence, _ = ProjectPublicIDSequence.objects.select_for_update().get_or_create(
                key="project_public_id",
                defaults={"last_value": 0},
            )
            sequence.last_value += 1
            sequence.save(update_fields=["last_value", "updated_at"])
            return f"PRJ-{sequence.last_value:05d}"