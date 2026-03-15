from django.db import models, transaction
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.core.validators import RegexValidator
from django.utils import timezone
from django_countries.fields import CountryField


class PublicIDSequence(models.Model):
    class Keys(models.TextChoices):
        SYSTEM_USER = "system_user", "System User"
        NORMAL_USER = "normal_user", "Normal User"

    key = models.CharField(max_length=50, unique=True)
    last_value = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "accounts_public_id_sequence"

    def __str__(self):
        return f"{self.key}: {self.last_value}"


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("E-Mail ist erforderlich.")

        email = self.normalize_email(email).lower()
        extra_fields.setdefault("is_active", True)

        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.full_clean()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("is_email_verified", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser muss is_staff=True haben.")

        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser muss is_superuser=True haben.")

        return self.create_user(email=email, password=password, **extra_fields)


def user_profile_upload_path(instance, filename):
    return f"users/profile_images/{instance.pk or 'new'}/{filename}"


def user_document_upload_path(instance, filename):
    return f"users/documents/{instance.pk or 'new'}/{filename}"


class User(AbstractBaseUser, PermissionsMixin):
    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        DIVERSE = "diverse", "Diverse"
        NOT_SPECIFIED = "not_specified", "Not specified"

    phone_validator = RegexValidator(
        regex=r"^[0-9+\-\s()/]{6,30}$",
        message="Bitte eine gültige Telefonnummer eingeben."
    )

    id = models.BigAutoField(primary_key=True)

    public_id = models.CharField(
        max_length=20,
        unique=True,
        db_index=True,
        null=True,
        blank=True,
        editable=False,
        verbose_name="Öffentliche ID"
    )

    email = models.EmailField(unique=True, max_length=255, verbose_name="E-Mail")
    first_name = models.CharField(max_length=150, blank=True, verbose_name="Vorname")
    last_name = models.CharField(max_length=150, blank=True, verbose_name="Nachname")
    gender = models.CharField(max_length=20, choices=Gender.choices, default=Gender.NOT_SPECIFIED, verbose_name="Geschlecht")
    phone = models.CharField(max_length=30, blank=True, validators=[phone_validator], verbose_name="Telefon")
    birth_date = models.DateField(blank=True, null=True, verbose_name="Geburtsdatum")

    profile_image = models.ImageField(upload_to=user_profile_upload_path, blank=True, null=True, verbose_name="Profilbild")
    document = models.FileField(upload_to=user_document_upload_path, blank=True, null=True, verbose_name="Dokument")

    street = models.CharField(max_length=255, blank=True, verbose_name="Straße")
    postal_code = models.CharField(max_length=20, blank=True, verbose_name="PLZ")
    city = models.CharField(max_length=120, blank=True, verbose_name="Stadt")
    country = CountryField(blank=True, verbose_name="Land")

    emergency_contact_person = models.CharField(max_length=255, blank=True, verbose_name="Notfallkontakt Person")
    emergency_contact_phone = models.CharField(max_length=30, blank=True, validators=[phone_validator], verbose_name="Notfallkontakt Telefon")

    notes = models.TextField(blank=True, verbose_name="Notizen")

    is_active = models.BooleanField(default=True, verbose_name="Aktiv")
    is_staff = models.BooleanField(default=False, verbose_name="Staff-Status")
    is_email_verified = models.BooleanField(default=False, verbose_name="E-Mail verifiziert")

    email_verified_at = models.DateTimeField(blank=True, null=True, verbose_name="E-Mail verifiziert am")
    last_login_at = models.DateTimeField(blank=True, null=True, verbose_name="Letzter Login am")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "accounts_user"
        verbose_name = "Benutzer"
        verbose_name_plural = "Benutzer"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["public_id"]),
            models.Index(fields=["email"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["is_staff"]),
        ]

    def __str__(self):
        return f"{self.public_id or 'NEU'} - {self.full_name or self.email}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def mark_email_as_verified(self, commit=True):
        self.is_email_verified = True
        self.email_verified_at = timezone.now()
        if commit:
            self.save(update_fields=["is_email_verified", "email_verified_at", "updated_at"])

    def update_last_login_timestamp(self, commit=True):
        self.last_login_at = timezone.now()
        if commit:
            self.save(update_fields=["last_login_at", "updated_at"])

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.__class__.objects.normalize_email(self.email).lower()

        if not self.public_id:
            self.public_id = self._generate_public_id()

        super().save(*args, **kwargs)

    def _generate_public_id(self) -> str:
        with transaction.atomic():

        # SUPERUSER ID
            if self.is_superuser:
                sequence, _ = PublicIDSequence.objects.select_for_update().get_or_create(
                    key=PublicIDSequence.Keys.SYSTEM_USER,
                    defaults={"last_value": 0},
                )

                sequence.last_value += 1
                sequence.save(update_fields=["last_value", "updated_at"])

                return f"SU{sequence.last_value:03d}"

            # NORMAL USER ID
            now = timezone.now()
            year = now.strftime("%y")   # 26
            month = now.strftime("%m")  # 01

            key = f"{PublicIDSequence.Keys.NORMAL_USER}_{year}{month}"

            sequence, _ = PublicIDSequence.objects.select_for_update().get_or_create(
                key=key,
                defaults={"last_value": 0},
            )

            sequence.last_value += 1
            sequence.save(update_fields=["last_value", "updated_at"])

            return f"U{year}{month}{sequence.last_value:04d}"