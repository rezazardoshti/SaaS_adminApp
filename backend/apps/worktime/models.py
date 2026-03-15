# apps/worktime/models.py

from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class WorkTimePublicIDSequence(models.Model):
    company = models.OneToOneField(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="worktime_public_id_sequence",
    )
    last_value = models.PositiveBigIntegerField(default=0)

    class Meta:
        verbose_name = "Work time public ID sequence"
        verbose_name_plural = "Work time public ID sequences"

    def __str__(self):
        return f"{self.company} - {self.last_value}"


class WorkTimeEntry(models.Model):
    class EntryType(models.TextChoices):
        TIMER = "timer", "Timer"
        MANUAL = "manual", "Manual"

    class Status(models.TextChoices):
        RUNNING = "running", "Running"
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    public_id = models.CharField(max_length=30, unique=True, blank=True)

    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="worktime_entries",
    )
    employee_membership = models.ForeignKey(
        "companies.CompanyMembership",
        on_delete=models.PROTECT,
        related_name="worktime_entries",
    )
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="worktime_entries",
    )

    entry_type = models.CharField(
        max_length=20,
        choices=EntryType.choices,
        default=EntryType.TIMER,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.RUNNING,
    )

    work_date = models.DateField()
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)

    break_minutes = models.PositiveIntegerField(default=0)

    title = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    internal_note = models.TextField(blank=True)

    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)

    approved_by = models.ForeignKey(
        "companies.CompanyMembership",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_worktime_entries",
    )
    rejected_by = models.ForeignKey(
        "companies.CompanyMembership",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rejected_worktime_entries",
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-work_date", "-started_at", "-created_at")
        indexes = [
            models.Index(fields=("company", "work_date")),
            models.Index(fields=("employee_membership", "work_date")),
            models.Index(fields=("status",)),
            models.Index(fields=("project",)),
            models.Index(fields=("started_at",)),
        ]
        verbose_name = "Work time entry"
        verbose_name_plural = "Work time entries"

    def __str__(self):
        return f"{self.public_id} - {self.employee_membership}"

    @property
    def duration_minutes(self) -> int:
        if not self.started_at or not self.ended_at:
            return 0

        total_seconds = (self.ended_at - self.started_at).total_seconds()
        minutes = int(total_seconds // 60) - int(self.break_minutes or 0)
        return max(minutes, 0)

    @property
    def duration_hours(self) -> Decimal:
        return Decimal(self.duration_minutes) / Decimal("60.00")

    def clean(self):
        errors = {}

        if self.employee_membership_id and self.company_id:
            if self.employee_membership.company_id != self.company_id:
                errors["employee_membership"] = (
                    "Employee membership must belong to the same company."
                )

        if self.project_id and self.company_id:
            if self.project.company_id != self.company_id:
                errors["project"] = "Project must belong to the same company."

        if self.approved_by_id and self.company_id:
            if self.approved_by.company_id != self.company_id:
                errors["approved_by"] = (
                    "Approver membership must belong to the same company."
                )

        if self.rejected_by_id and self.company_id:
            if self.rejected_by.company_id != self.company_id:
                errors["rejected_by"] = (
                    "Rejector membership must belong to the same company."
                )

        if self.ended_at and self.started_at and self.ended_at <= self.started_at:
            errors["ended_at"] = "End time must be later than start time."

        if self.break_minutes < 0:
            errors["break_minutes"] = "Break minutes cannot be negative."

        if self.status == self.Status.RUNNING and self.ended_at:
            errors["status"] = "A running entry cannot already have an end time."

        if self.status != self.Status.RUNNING and not self.ended_at:
            errors["ended_at"] = "A finished entry must have an end time."

        if self.status == self.Status.APPROVED:
            if not self.approved_at:
                errors["approved_at"] = "Approved entries must have approved_at."
            if not self.approved_by:
                errors["approved_by"] = "Approved entries must have approved_by."

        if self.status == self.Status.REJECTED:
            if not self.rejected_at:
                errors["rejected_at"] = "Rejected entries must have rejected_at."
            if not self.rejected_by:
                errors["rejected_by"] = "Rejected entries must have rejected_by."

        if self.work_date and self.started_at:
            local_started = timezone.localtime(self.started_at).date()
            if self.work_date != local_started:
                errors["work_date"] = (
                    "work_date must match the local date of started_at."
                )

        if self.ended_at and self.duration_minutes < 0:
            errors["ended_at"] = "Calculated duration cannot be negative."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = self._generate_public_id()

        if self.status == self.Status.SUBMITTED and not self.submitted_at:
            self.submitted_at = timezone.now()

        super().save(*args, **kwargs)

    def _generate_public_id(self) -> str:
        sequence, _ = WorkTimePublicIDSequence.objects.get_or_create(
            company=self.company
        )
        sequence.last_value += 1
        sequence.save(update_fields=["last_value"])
        return f"WTE-{self.company_id}-{sequence.last_value:06d}"