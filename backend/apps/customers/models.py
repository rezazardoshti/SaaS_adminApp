from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction

from apps.companies.models import Company


class CustomerPublicIDSequence(models.Model):
    key = models.CharField(max_length=50, unique=True)
    last_value = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "customers_public_id_sequence"
        verbose_name = "Customer Public ID Sequence"
        verbose_name_plural = "Customer Public ID Sequences"

    def __str__(self) -> str:
        return f"{self.key}: {self.last_value}"


class Customer(models.Model):
    public_id = models.CharField(max_length=32, unique=True, blank=True)

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="customers",
    )

    name = models.CharField(max_length=255)
    customer_number = models.CharField(max_length=50, blank=True)

    contact_person = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)

    street = models.CharField(max_length=255, blank=True)
    house_number = models.CharField(max_length=50, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    city = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=120, blank=True, default="Deutschland")

    tax_number = models.CharField(max_length=100, blank=True)
    vat_id = models.CharField(max_length=100, blank=True)

    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_customers",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_customers",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "customers_customer"
        verbose_name = "Customer"
        verbose_name_plural = "Customers"
        ordering = ["company__company_name", "name", "-created_at"]
        indexes = [
            models.Index(fields=["public_id"]),
            models.Index(fields=["company", "is_active"]),
            models.Index(fields=["company", "name"]),
            models.Index(fields=["customer_number"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "name"],
                name="unique_customer_name_per_company",
            ),
            models.UniqueConstraint(
                fields=["company", "customer_number"],
                condition=~models.Q(customer_number=""),
                name="unique_customer_number_global",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} - {self.company.company_name}"

    def clean(self):
        super().clean()

        if not self.company_id:
            raise ValidationError({"company": "Company is required."})

        if self.name:
            self.name = self.name.strip()

        if not self.name:
            raise ValidationError({"name": "Name is required."})

        if self.email:
            self.email = self.email.strip().lower()

        if self.contact_person:
            self.contact_person = self.contact_person.strip()

        if self.phone:
            self.phone = self.phone.strip()

        if self.street:
            self.street = self.street.strip()

        if self.house_number:
            self.house_number = self.house_number.strip()

        if self.postal_code:
            self.postal_code = self.postal_code.strip()

        if self.city:
            self.city = self.city.strip()

        if self.country:
            self.country = self.country.strip()

        if self.tax_number:
            self.tax_number = self.tax_number.strip()

        if self.vat_id:
            self.vat_id = self.vat_id.strip()

        if self.customer_number:
            self.customer_number = self.customer_number.strip().upper()

    @classmethod
    def _next_sequence_value(cls, key: str) -> int:
        with transaction.atomic():
            sequence, _ = CustomerPublicIDSequence.objects.select_for_update().get_or_create(
                key=key,
                defaults={"last_value": 0},
            )
            sequence.last_value += 1
            sequence.save(update_fields=["last_value", "updated_at"])
            return sequence.last_value

    @classmethod
    def generate_public_id(cls) -> str:
        next_value = cls._next_sequence_value("customer_public_id")
        return f"CUS-{next_value:06d}"

    def generate_customer_number(self) -> str:
        next_value = self._next_sequence_value(f"customer_number")
        return f"KUN-{next_value:06d}"

    def save(self, *args, **kwargs):
        self.full_clean()

        if not self.public_id:
            self.public_id = self.generate_public_id()

        if not self.customer_number:
            if not self.company_id:
                raise ValidationError({"company": "Company is required to generate customer number."})
            self.customer_number = self.generate_customer_number()

        super().save(*args, **kwargs)