from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction

from .models import Company, CompanyMembership


def create_company_with_owner(*, owner_user, **company_data):
    if owner_user is None:
        raise ValidationError("owner_user ist erforderlich.")

    if not getattr(owner_user, "is_authenticated", False):
        raise ValidationError("owner_user muss ein authentifizierter Benutzer sein.")

    with transaction.atomic():
        company = Company.objects.create(
            owner_user=owner_user,
            **company_data,
        )

        membership = CompanyMembership.objects.create(
            company=company,
            user=owner_user,
            role=CompanyMembership.Role.OWNER,
            employment_status=CompanyMembership.EmploymentStatus.ACTIVE,
            contract_type=CompanyMembership.ContractType.OTHER,
            weekly_target_hours=Decimal("0.00"),
            monthly_target_hours=Decimal("0.00"),
            vacation_days_per_year=0,
            is_time_tracking_enabled=True,
            can_manage_projects=True,
            is_active=True,
        )

        if company.owner_user_id != owner_user.id:
            company.owner_user = owner_user
            company.save(update_fields=["owner_user", "updated_at"])

        return company