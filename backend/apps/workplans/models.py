from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction

from apps.companies.models import Company, CompanyMembership
from apps.projects.models import Project


class WorkPlanPublicIDSequence(models.Model):
    key = models.CharField(max_length=50, unique=True)
    last_value = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workplans_public_id_sequence"
        verbose_name = "WorkPlan Public ID Sequence"
        verbose_name_plural = "WorkPlan Public ID Sequences"

    def __str__(self) -> str:
        return f"{self.key}: {self.last_value}"


class WorkPlan(models.Model):
    STATUS_CHOICES = (
        ("draft", "Draft"),
        ("published", "Published"),
        ("archived", "Archived"),
    )

    public_id = models.CharField(max_length=32, unique=True, blank=True)

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="work_plans",
    )

    calendar_week = models.PositiveSmallIntegerField()
    period_start = models.DateField()
    period_end = models.DateField()

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="draft",
    )

    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_work_plans",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_work_plans",
    )

    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="published_work_plans",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workplans_work_plan"
        verbose_name = "Work Plan"
        verbose_name_plural = "Work Plans"
        ordering = ["-period_start", "-created_at"]
        indexes = [
            models.Index(fields=["public_id"]),
            models.Index(fields=["company", "calendar_week"]),
            models.Index(fields=["company", "period_start", "period_end"]),
            models.Index(fields=["company", "status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "calendar_week", "period_start", "period_end"],
                name="unique_workplan_per_company_period",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.company.company_name} - "
            f"KW {self.calendar_week} ({self.period_start} - {self.period_end})"
        )

    def clean(self):
        super().clean()

        if not self.company_id:
            raise ValidationError({"company": "Company is required."})

        if self.calendar_week < 1 or self.calendar_week > 53:
            raise ValidationError(
                {"calendar_week": "Calendar week must be between 1 and 53."}
            )

        if self.period_start and self.period_end and self.period_start > self.period_end:
            raise ValidationError(
                {"period_end": "End date must be after or equal to start date."}
            )

        if self.notes:
            self.notes = self.notes.strip()

        if self.pk:
            old = WorkPlan.objects.filter(pk=self.pk).only("status").first()
            if old and old.status == "published" and self.status == "draft":
                raise ValidationError(
                    {"status": "Published work plans cannot be moved back to draft."}
                )

    @classmethod
    def _next_sequence_value(cls, key: str) -> int:
        with transaction.atomic():
            sequence, _ = WorkPlanPublicIDSequence.objects.select_for_update().get_or_create(
                key=key,
                defaults={"last_value": 0},
            )
            sequence.last_value += 1
            sequence.save(update_fields=["last_value", "updated_at"])
            return sequence.last_value

    @classmethod
    def generate_public_id(cls) -> str:
        next_value = cls._next_sequence_value("work_plan_public_id")
        return f"WPL-{next_value:06d}"

    def save(self, *args, **kwargs):
        self.full_clean()

        if not self.public_id:
            self.public_id = self.generate_public_id()

        super().save(*args, **kwargs)


class WorkPlanItem(models.Model):
    STATUS_CHOICES = (
        ("planned", "Planned"),
        ("done", "Done"),
        ("cancelled", "Cancelled"),
    )

    public_id = models.CharField(max_length=32, unique=True, blank=True)

    work_plan = models.ForeignKey(
        WorkPlan,
        on_delete=models.CASCADE,
        related_name="items",
    )

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="work_plan_items",
    )

    employee_membership = models.ForeignKey(
        CompanyMembership,
        on_delete=models.CASCADE,
        related_name="work_plan_items",
    )

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="work_plan_items",
    )

    work_date = models.DateField()

    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)

    planned_hours = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
    )

    task_name = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="planned",
    )

    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_work_plan_items",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_work_plan_items",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workplans_work_plan_item"
        verbose_name = "Work Plan Item"
        verbose_name_plural = "Work Plan Items"
        ordering = ["work_date", "start_time", "created_at"]
        indexes = [
            models.Index(fields=["public_id"]),
            models.Index(fields=["company", "work_date"]),
            models.Index(fields=["company", "status"]),
            models.Index(fields=["project"]),
            models.Index(fields=["employee_membership"]),
            models.Index(fields=["work_plan", "work_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.employee_membership.user} - {self.project.name} - {self.work_date}"

    @classmethod
    def generate_public_id(cls) -> str:
        next_value = WorkPlan._next_sequence_value("work_plan_item_public_id")
        return f"WPI-{next_value:06d}"

    def clean(self):
        super().clean()

        errors = {}

        if not self.work_plan_id:
            errors["work_plan"] = "Work plan is required."

        if not self.company_id:
            errors["company"] = "Company is required."

        if not self.employee_membership_id:
            errors["employee_membership"] = "Employee membership is required."

        if not self.project_id:
            errors["project"] = "Project is required."

        if self.work_plan_id and self.company_id:
            if self.work_plan.company_id != self.company_id:
                errors["company"] = "Company must match the selected work plan."

        if self.employee_membership_id and self.company_id:
            if self.employee_membership.company_id != self.company_id:
                errors["employee_membership"] = (
                    "Employee membership does not belong to this company."
                )
            elif not self.employee_membership.is_active:
                errors["employee_membership"] = "Employee membership must be active."

        if self.project_id and self.company_id:
            if self.project.company_id != self.company_id:
                errors["project"] = "Project does not belong to this company."

        if self.work_plan_id and self.work_date:
            if (
                self.work_date < self.work_plan.period_start
                or self.work_date > self.work_plan.period_end
            ):
                errors["work_date"] = "Work date must be inside the work plan period."

        if self.start_time and self.end_time and self.start_time >= self.end_time:
            errors["end_time"] = "End time must be after start time."

        if self.planned_hours is not None and self.planned_hours < 0:
            errors["planned_hours"] = "Planned hours cannot be negative."

        if self.task_name:
            self.task_name = self.task_name.strip()

        if self.notes:
            self.notes = self.notes.strip()

        if (
            self.company_id
            and self.employee_membership_id
            and self.work_date
            and self.start_time
            and self.end_time
        ):
            overlapping_items = WorkPlanItem.objects.filter(
                company_id=self.company_id,
                employee_membership_id=self.employee_membership_id,
                work_date=self.work_date,
                is_active=True,
            ).exclude(pk=self.pk)

            for item in overlapping_items:
                if item.start_time and item.end_time:
                    overlaps = (
                        self.start_time < item.end_time
                        and self.end_time > item.start_time
                    )
                    if overlaps:
                        errors["start_time"] = (
                            "This employee already has an overlapping work plan item on this date."
                        )
                        break

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()

        if not self.public_id:
            self.public_id = self.generate_public_id()

        super().save(*args, **kwargs)