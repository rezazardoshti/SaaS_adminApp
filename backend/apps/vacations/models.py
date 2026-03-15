from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from apps.companies.models import Company, CompanyMembership


class VacationPublicIDSequence(models.Model):
    employee_membership = models.OneToOneField(
        CompanyMembership,
        on_delete=models.CASCADE,
        related_name="vacation_public_id_sequence",
    )
    last_value = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Vacation Public ID Sequence"
        verbose_name_plural = "Vacation Public ID Sequences"

    def __str__(self):
        return f"{self.employee_membership} - {self.last_value}"


class VacationRequest(models.Model):
    class LeaveType(models.TextChoices):
        ANNUAL = "annual", "Annual Leave"
        SPECIAL = "special", "Special Leave"
        UNPAID = "unpaid", "Unpaid Leave"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    public_id = models.CharField(
        max_length=20,
        unique=True,
        editable=False,
        db_index=True,
    )

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="vacation_requests",
    )

    employee_membership = models.ForeignKey(
        CompanyMembership,
        on_delete=models.PROTECT,
        related_name="vacation_requests",
    )

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_vacation_requests",
    )

    leave_type = models.CharField(
        max_length=20,
        choices=LeaveType.choices,
        default=LeaveType.ANNUAL,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )

    start_date = models.DateField()
    end_date = models.DateField()

    is_half_day_start = models.BooleanField(default=False)
    is_half_day_end = models.BooleanField(default=False)

    requested_days = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Automatically calculated working days (Mon-Fri) without public holidays.",
    )

    reason = models.CharField(max_length=255, blank=True)
    employee_note = models.TextField(blank=True)
    manager_note = models.TextField(blank=True)

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="approved_vacation_requests",
        null=True,
        blank=True,
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(default=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Vacation Request"
        verbose_name_plural = "Vacation Requests"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["company", "status"]),
            models.Index(fields=["company", "employee_membership"]),
            models.Index(fields=["company", "start_date", "end_date"]),
            models.Index(fields=["company", "is_active"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(end_date__gte=models.F("start_date")),
                name="vacation_end_date_gte_start_date",
            ),
        ]

    def __str__(self):
        return f"{self.public_id} - {self.employee_membership}"

    def clean(self):
        errors = {}

        if self.employee_membership_id and self.company_id:
            if self.employee_membership.company_id != self.company_id:
                errors["employee_membership"] = (
                    "Employee membership must belong to the same company."
                )

        if self.start_date and self.end_date and self.end_date < self.start_date:
            errors["end_date"] = "End date must be on or after start date."

        if self.is_half_day_start and self.is_half_day_end and self.start_date != self.end_date:
            errors["is_half_day_end"] = (
                "Half day at both start and end is only allowed for a single-day request."
            )

        if self.approved_by_id and self.status not in {
            self.Status.APPROVED,
            self.Status.REJECTED,
        }:
            errors["approved_by"] = (
                "approved_by can only be set when status is approved or rejected."
            )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        self.requested_days = self.calculate_requested_days()

        if self.status == self.Status.APPROVED:
            if self.approved_at is None:
                self.approved_at = timezone.now()
        else:
            self.approved_at = None

        if self.status == self.Status.REJECTED:
            if self.rejected_at is None:
                self.rejected_at = timezone.now()
        else:
            self.rejected_at = None

        if self.status == self.Status.CANCELLED:
            if self.cancelled_at is None:
                self.cancelled_at = timezone.now()
        else:
            self.cancelled_at = None

        if self.status not in {self.Status.APPROVED, self.Status.REJECTED}:
            self.approved_by = None

        if not self.public_id:
            self.public_id = self._generate_public_id()

        super().save(*args, **kwargs)

    def calculate_requested_days(self) -> Decimal:
        if not self.start_date or not self.end_date:
            return Decimal("0.00")

        total_days = Decimal("0.00")
        current_date = self.start_date

        while current_date <= self.end_date:
            if current_date.weekday() < 5:
                total_days += Decimal("1.00")
            current_date += timedelta(days=1)

        if total_days == Decimal("0.00"):
            return Decimal("0.00")

        if self.start_date == self.end_date:
            if self.start_date.weekday() >= 5:
                return Decimal("0.00")

            if self.is_half_day_start or self.is_half_day_end:
                return Decimal("0.50")

            return Decimal("1.00")

        if self.is_half_day_start and self.start_date.weekday() < 5:
            total_days -= Decimal("0.50")

        if self.is_half_day_end and self.end_date.weekday() < 5:
            total_days -= Decimal("0.50")

        if total_days < Decimal("0.00"):
            return Decimal("0.00")

        return total_days.quantize(Decimal("0.01"))

    def _generate_public_id(self) -> str:
        if not self.employee_membership_id:
            raise ValidationError(
                {"employee_membership": "Employee membership must be set before generating public_id."}
            )

        with transaction.atomic():
            sequence, _ = VacationPublicIDSequence.objects.select_for_update().get_or_create(
                employee_membership_id=self.employee_membership_id,
                defaults={"last_value": 0},
            )
            sequence.last_value += 1
            sequence.save(update_fields=["last_value"])

            employee_number = self.employee_membership.employee_number or str(self.employee_membership_id)
            return f"VAC-{employee_number}-{sequence.last_value:06d}"


class VacationBalance(models.Model):
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="vacation_balances",
    )

    employee_membership = models.ForeignKey(
        CompanyMembership,
        on_delete=models.CASCADE,
        related_name="vacation_balances",
    )

    year = models.PositiveIntegerField()

    entitled_days = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="If empty, defaults to membership.vacation_days_per_year.",
    )

    carried_over_days = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Transferred vacation days from previous year.",
    )

    manual_adjustment_days = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Manual plus/minus adjustment by HR or admin.",
    )

    note = models.TextField(blank=True)

    is_active = models.BooleanField(default=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Vacation Balance"
        verbose_name_plural = "Vacation Balances"
        ordering = ("-year", "-created_at")
        indexes = [
            models.Index(fields=["company", "year"]),
            models.Index(fields=["employee_membership", "year"]),
            models.Index(fields=["company", "employee_membership", "year"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "employee_membership", "year"],
                name="unique_vacation_balance_per_employee_company_year",
            ),
        ]

    def __str__(self):
        return f"{self.employee_membership} - {self.year}"

    def clean(self):
        errors = {}

        if self.employee_membership_id and self.company_id:
            if self.employee_membership.company_id != self.company_id:
                errors["employee_membership"] = (
                    "Employee membership must belong to the same company."
                )

        if self.year < 2000 or self.year > 3000:
            errors["year"] = "Year must be between 2000 and 3000."

        if self.entitled_days is not None and self.entitled_days < Decimal("0.00"):
            errors["entitled_days"] = "Entitled days cannot be negative."

        if self.carried_over_days < Decimal("0.00"):
            errors["carried_over_days"] = "Carried over days cannot be negative."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.entitled_days is None and self.employee_membership_id:
            self.entitled_days = Decimal(
                str(self.employee_membership.vacation_days_per_year)
            ).quantize(Decimal("0.01"))

        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def base_entitlement_days(self) -> Decimal:
        if self.entitled_days is not None:
            return Decimal(self.entitled_days).quantize(Decimal("0.01"))

        if self.employee_membership_id:
            return Decimal(
                str(self.employee_membership.vacation_days_per_year)
            ).quantize(Decimal("0.01"))

        return Decimal("0.00")

    @property
    def total_available_days(self) -> Decimal:
        total = (
            self.base_entitlement_days
            + self.carried_over_days
            + self.manual_adjustment_days
        )
        return total.quantize(Decimal("0.01"))

    def _approved_annual_requests(self):
        return VacationRequest.objects.filter(
            company_id=self.company_id,
            employee_membership_id=self.employee_membership_id,
            status=VacationRequest.Status.APPROVED,
            is_active=True,
            leave_type=VacationRequest.LeaveType.ANNUAL,
        )

    @staticmethod
    def _working_days_in_range(start_date, end_date) -> Decimal:
        if not start_date or not end_date or end_date < start_date:
            return Decimal("0.00")

        total = Decimal("0.00")
        current_date = start_date

        while current_date <= end_date:
            if current_date.weekday() < 5:
                total += Decimal("1.00")
            current_date += timedelta(days=1)

        return total.quantize(Decimal("0.01"))

    def _split_requested_days_for_year(self, request_obj) -> Decimal:
        year_start = date(self.year, 1, 1)
        year_end = date(self.year, 12, 31)

        overlap_start = max(request_obj.start_date, year_start)
        overlap_end = min(request_obj.end_date, year_end)

        if overlap_end < overlap_start:
            return Decimal("0.00")

        if request_obj.start_date.year == self.year and request_obj.end_date.year == self.year:
            return Decimal(request_obj.requested_days).quantize(Decimal("0.01"))

        total = self._working_days_in_range(overlap_start, overlap_end)

        if request_obj.is_half_day_start and request_obj.start_date == overlap_start and overlap_start.weekday() < 5:
            total -= Decimal("0.50")

        if request_obj.is_half_day_end and request_obj.end_date == overlap_end and overlap_end.weekday() < 5:
            total -= Decimal("0.50")

        if total < Decimal("0.00"):
            total = Decimal("0.00")

        return total.quantize(Decimal("0.01"))

    @property
    def used_days(self) -> Decimal:
        total = Decimal("0.00")

        for request_obj in self._approved_annual_requests():
            total += self._split_requested_days_for_year(request_obj)

        return total.quantize(Decimal("0.01"))

    @property
    def remaining_days(self) -> Decimal:
        remaining = self.total_available_days - self.used_days
        return remaining.quantize(Decimal("0.01"))