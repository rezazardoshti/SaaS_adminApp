from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models, transaction
from django.utils import timezone
from django_countries.fields import CountryField


def company_logo_upload_path(instance, filename):
    return f"companies/logos/{instance.pk or 'new'}/{filename}"


class CompanyPublicIDSequence(models.Model):
    key = models.CharField(max_length=50, unique=True)
    last_value = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "companies_public_id_sequence"
        verbose_name = "Company Public ID Sequence"
        verbose_name_plural = "Company Public ID Sequences"

    def __str__(self):
        return f"{self.key}: {self.last_value}"


class Company(models.Model):
    class LegalForm(models.TextChoices):
        SOLE_PROPRIETORSHIP = "sole_proprietorship", "Einzelunternehmen"
        GBR = "gbr", "GbR"
        UG = "ug", "UG"
        GMBH = "gmbh", "GmbH"
        AG = "ag", "AG"
        OTHER = "other", "Sonstige"

    class SubscriptionPlan(models.TextChoices):
        FREE = "free", "Free"
        BASIC = "basic", "Basic"
        PRO = "pro", "Pro"

    class EmployeeRange(models.TextChoices):
        SMALL = "1-5", "1-5"
        MEDIUM = "6-20", "6-20"
        LARGE = "21-50", "21-50"
        ENTERPRISE = "50+", "50+"

    class SubscriptionStatus(models.TextChoices):
        ACTIVE = "active", "Aktiv"
        TRIAL = "trial", "Testphase"
        EXPIRED = "expired", "Abgelaufen"
        CANCELED = "canceled", "Gekündigt"
        SUSPENDED = "suspended", "Gesperrt"

    vat_id_validator = RegexValidator(
        regex=r"^[A-Z]{2}[A-Z0-9]{2,20}$",
        message="Bitte eine gültige USt-IdNr. eingeben, z. B. DE123456789.",
    )

    tax_number_validator = RegexValidator(
        regex=r"^[0-9A-Za-z/\-]{6,30}$",
        message="Bitte eine gültige Steuernummer eingeben.",
    )

    phone_validator = RegexValidator(
        regex=r"^[0-9+\-\s()/]{6,30}$",
        message="Bitte eine gültige Telefonnummer eingeben.",
    )

    public_id = models.CharField(
        max_length=20,
        unique=True,
        db_index=True,
        blank=True,
        editable=False,
        verbose_name="Firmen-ID",
    )

    company_name = models.CharField(
        max_length=255,
        verbose_name="Firmenname",
    )

    legal_form = models.CharField(
        max_length=50,
        choices=LegalForm.choices,
        default=LegalForm.OTHER,
        verbose_name="Rechtsform",
    )

    industry = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="Branche",
    )

    employee_range = models.CharField(
        max_length=10,
        choices=EmployeeRange.choices,
        blank=True,
        verbose_name="Mitarbeiteranzahl",
    )

    email = models.EmailField(
        max_length=255,
        blank=True,
        verbose_name="Firmen-E-Mail",
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
        validators=[phone_validator],
        verbose_name="Telefon",
    )

    website = models.URLField(
        blank=True,
        verbose_name="Webseite",
    )

    country = CountryField(
        blank=True,
        verbose_name="Land",
    )

    street = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Straße",
    )

    postal_code = models.CharField(
        max_length=20,
        blank=True,
        verbose_name="PLZ",
    )

    city = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="Stadt",
    )

    vat_id = models.CharField(
        max_length=30,
        blank=True,
        validators=[vat_id_validator],
        verbose_name="USt-IdNr.",
    )

    tax_number = models.CharField(
        max_length=30,
        blank=True,
        validators=[tax_number_validator],
        verbose_name="Steuernummer",
    )

    commercial_register = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="Handelsregister",
    )

    logo = models.ImageField(
        upload_to=company_logo_upload_path,
        blank=True,
        null=True,
        verbose_name="Logo",
    )

    subscription_plan = models.CharField(
        max_length=20,
        choices=SubscriptionPlan.choices,
        default=SubscriptionPlan.FREE,
        verbose_name="Paketplan",
    )

    subscription_status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.TRIAL,
        verbose_name="Abo-Status",
    )

    trial_ends_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Testphase endet am",
    )

    billing_email = models.EmailField(
        max_length=255,
        blank=True,
        verbose_name="Abrechnungs-E-Mail",
    )

    timezone = models.CharField(
        max_length=100,
        default="Europe/Berlin",
        verbose_name="Zeitzone",
    )

    language = models.CharField(
        max_length=10,
        default="de",
        verbose_name="Sprache",
    )

    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="owned_companies",
        verbose_name="Firmenbesitzer",
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name="Aktiv",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Erstellt am",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Aktualisiert am",
    )

    class Meta:
        db_table = "companies_company"
        verbose_name = "Firma"
        verbose_name_plural = "Firmen"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["public_id"]),
            models.Index(fields=["company_name"]),
            models.Index(fields=["subscription_plan"]),
            models.Index(fields=["subscription_status"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.public_id or 'NEU'} - {self.company_name}"

    @property
    def full_address(self):
        parts = [
            self.street,
            self.postal_code,
            self.city,
            str(self.country) if self.country else "",
        ]
        return ", ".join([part for part in parts if part])

    @property
    def is_trial_active(self):
        if self.subscription_status != self.SubscriptionStatus.TRIAL:
            return False
        if not self.trial_ends_at:
            return True
        return self.trial_ends_at >= timezone.now()

    def clean(self):
        super().clean()

        if self.billing_email:
            self.billing_email = self.billing_email.lower().strip()

        if self.email:
            self.email = self.email.lower().strip()

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.lower().strip()

        if self.billing_email:
            self.billing_email = self.billing_email.lower().strip()

        is_new = self._state.adding
        super().save(*args, **kwargs)

        if is_new and not self.public_id:
            public_id = self._generate_public_id()
            self.__class__.objects.filter(pk=self.pk).update(public_id=public_id)
            self.public_id = public_id

    def _generate_public_id(self) -> str:
        with transaction.atomic():
            sequence, _ = CompanyPublicIDSequence.objects.select_for_update().get_or_create(
                key="company",
                defaults={"last_value": 0},
            )
            sequence.last_value += 1
            sequence.save(update_fields=["last_value", "updated_at"])
            return f"C-{sequence.last_value:05d}"

    def get_active_memberships(self):
        return self.memberships.filter(is_active=True, employment_status="active")

    def active_employee_count(self):
        return self.get_active_memberships().count()

    def can_use_feature(self, feature_key: str) -> bool:
        return True     


class CompanyMembership(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        EMPLOYEE = "employee", "Employee"

    class ContractType(models.TextChoices):
        FULL_TIME = "full_time", "Vollzeit"
        PART_TIME = "part_time", "Teilzeit"
        MINI_JOB = "mini_job", "Minijob"
        TEMPORARY = "temporary", "Befristet"
        APPRENTICE = "apprentice", "Azubi"
        INTERN = "intern", "Praktikant"
        FREELANCER = "freelancer", "Freelancer"
        OTHER = "other", "Sonstiges"

    class EmploymentStatus(models.TextChoices):
        ACTIVE = "active", "Aktiv"
        INACTIVE = "inactive", "Inaktiv"
        ON_LEAVE = "on_leave", "Beurlaubt"
        TERMINATED = "terminated", "Beendet"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="memberships",
        verbose_name="Firma",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="company_memberships",
        verbose_name="Benutzer",
    )

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.EMPLOYEE,
        verbose_name="Rolle",
    )

    employee_number = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="Personalnummer",
    )

    job_title = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="Position",
    )

    department = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="Abteilung",
    )

    contract_type = models.CharField(
        max_length=30,
        choices=ContractType.choices,
        default=ContractType.FULL_TIME,
        verbose_name="Vertragstyp",
    )

    employment_status = models.CharField(
        max_length=20,
        choices=EmploymentStatus.choices,
        default=EmploymentStatus.ACTIVE,
        verbose_name="Beschäftigungsstatus",
    )

    entry_date = models.DateField(
        blank=True,
        null=True,
        verbose_name="Eintrittsdatum",
    )

    exit_date = models.DateField(
        blank=True,
        null=True,
        verbose_name="Austrittsdatum",
    )

    weekly_target_hours = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal("40.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Soll-Stunden / Woche",
    )

    monthly_target_hours = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        default=Decimal("173.33"),
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Soll-Stunden / Monat",
    )

    hourly_wage = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Lohn €/Std.",
    )

    vacation_days_per_year = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(366)],
        verbose_name="Urlaubstage / Jahr",
    )

    is_time_tracking_enabled = models.BooleanField(
        default=True,
        verbose_name="Zeiterfassung aktiviert",
    )

    can_manage_projects = models.BooleanField(
        default=False,
        verbose_name="Darf Projekte verwalten",
    )

    notes = models.TextField(
        blank=True,
        verbose_name="Interne Notizen",
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name="Aktiv",
    )

    joined_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Beigetreten am",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Aktualisiert am",
    )

    class Meta:
        db_table = "companies_companymembership"
        verbose_name = "Firmenmitgliedschaft"
        verbose_name_plural = "Firmenmitgliedschaften"
        ordering = ["company__company_name", "role", "user__first_name", "user__last_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "user"],
                name="unique_company_user_membership",
            ),
            models.UniqueConstraint(
                fields=["company", "employee_number"],
                condition=~models.Q(employee_number=""),
                name="unique_company_employee_number",
            ),
        ]
        indexes = [
            models.Index(fields=["company", "role"]),
            models.Index(fields=["company", "employment_status"]),
            models.Index(fields=["user"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["employee_number"]),
        ]

    def __str__(self):
        user = self.user
        full_name = f"{user.first_name} {user.last_name}".strip() or user.email
        return f"{user.public_id} | {full_name} | {self.company.company_name}"

    def clean(self):
        super().clean()

        if self.entry_date and self.exit_date and self.exit_date < self.entry_date:
            raise ValidationError({
                "exit_date": "Austrittsdatum darf nicht vor dem Eintrittsdatum liegen."
            })

        if self.role == self.Role.OWNER:
            qs = CompanyMembership.objects.filter(
                company=self.company,
                role=self.Role.OWNER,
            )
            if self.pk:
                qs = qs.exclude(pk=self.pk)

            if qs.exists():
                raise ValidationError({
                    "role": "Diese Firma hat bereits einen Owner."
                })

        if self.role == self.Role.OWNER and self.company.owner_user_id:
            if self.company.owner_user_id != self.user_id:
                raise ValidationError({
                    "user": "Owner-Membership muss mit company.owner_user übereinstimmen."
                })

        if self.role == self.Role.OWNER:
            self.is_active = True
            self.employment_status = self.EmploymentStatus.ACTIVE

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

        if self.role == self.Role.OWNER and self.company.owner_user_id != self.user_id:
            Company.objects.filter(pk=self.company_id).update(owner_user_id=self.user_id)
            self.company.owner_user_id = self.user_id

           