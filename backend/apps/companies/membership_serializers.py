from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import CompanyMembership

User = get_user_model()


class MembershipUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "public_id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "is_active",
        )
        read_only_fields = fields


class MembershipListSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.company_name", read_only=True)
    company_public_id = serializers.CharField(source="company.public_id", read_only=True)
    user = MembershipUserSerializer(read_only=True)

    class Meta:
        model = CompanyMembership
        fields = (
            "id",
            "company",
            "company_public_id",
            "company_name",
            "user",
            "role",
            "employee_number",
            "job_title",
            "department",
            "contract_type",
            "employment_status",
            "entry_date",
            "exit_date",
            "weekly_target_hours",
            "monthly_target_hours",
            "hourly_wage",
            "vacation_days_per_year",
            "is_time_tracking_enabled",
            "can_manage_projects",
            "is_active",
            "joined_at",
            "updated_at",
        )
        read_only_fields = fields


class MembershipDetailSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.company_name", read_only=True)
    company_public_id = serializers.CharField(source="company.public_id", read_only=True)
    user = MembershipUserSerializer(read_only=True)

    class Meta:
        model = CompanyMembership
        fields = (
            "id",
            "company",
            "company_public_id",
            "company_name",
            "user",
            "role",
            "employee_number",
            "job_title",
            "department",
            "contract_type",
            "employment_status",
            "entry_date",
            "exit_date",
            "weekly_target_hours",
            "monthly_target_hours",
            "hourly_wage",
            "vacation_days_per_year",
            "is_time_tracking_enabled",
            "can_manage_projects",
            "notes",
            "is_active",
            "joined_at",
            "updated_at",
        )
        read_only_fields = fields


class MembershipCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyMembership
        fields = (
            "company",
            "user",
            "role",
            "employee_number",
            "job_title",
            "department",
            "contract_type",
            "employment_status",
            "entry_date",
            "exit_date",
            "weekly_target_hours",
            "monthly_target_hours",
            "hourly_wage",
            "vacation_days_per_year",
            "is_time_tracking_enabled",
            "can_manage_projects",
            "notes",
            "is_active",
        )

    def validate(self, attrs):
        company = attrs.get("company")
        user = attrs.get("user")
        employee_number = attrs.get("employee_number")

        if CompanyMembership.objects.filter(company=company, user=user).exists():
            raise serializers.ValidationError(
                {"non_field_errors": ["Dieser Benutzer ist dieser Firma bereits zugeordnet."]}
            )

        if employee_number:
            exists = CompanyMembership.objects.filter(
                company=company,
                employee_number=employee_number,
            ).exists()
            if exists:
                raise serializers.ValidationError(
                    {"employee_number": ["Diese Personalnummer existiert in dieser Firma bereits."]}
                )

        entry_date = attrs.get("entry_date")
        exit_date = attrs.get("exit_date")
        if entry_date and exit_date and exit_date < entry_date:
            raise serializers.ValidationError(
                {"exit_date": ["Austrittsdatum darf nicht vor dem Eintrittsdatum liegen."]}
            )

        return attrs

    def create(self, validated_data):
        return CompanyMembership.objects.create(**validated_data)


class MembershipUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyMembership
        fields = (
            "role",
            "employee_number",
            "job_title",
            "department",
            "contract_type",
            "employment_status",
            "entry_date",
            "exit_date",
            "weekly_target_hours",
            "monthly_target_hours",
            "hourly_wage",
            "vacation_days_per_year",
            "is_time_tracking_enabled",
            "can_manage_projects",
            "notes",
            "is_active",
        )

    def validate(self, attrs):
        instance = self.instance

        employee_number = attrs.get("employee_number", instance.employee_number)
        if employee_number:
            exists = CompanyMembership.objects.filter(
                company=instance.company,
                employee_number=employee_number,
            ).exclude(pk=instance.pk).exists()
            if exists:
                raise serializers.ValidationError(
                    {"employee_number": ["Diese Personalnummer existiert in dieser Firma bereits."]}
                )

        entry_date = attrs.get("entry_date", instance.entry_date)
        exit_date = attrs.get("exit_date", instance.exit_date)
        if entry_date and exit_date and exit_date < entry_date:
            raise serializers.ValidationError(
                {"exit_date": ["Austrittsdatum darf nicht vor dem Eintrittsdatum liegen."]}
            )

        return attrs

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.full_clean()
        instance.save()
        return instance