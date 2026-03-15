from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Company, CompanyMembership
from .services import create_company_with_owner

User = get_user_model()


class CompanyOwnerSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "public_id",
            "email",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "is_active",
        )
        read_only_fields = fields


class CompanyMembershipUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "public_id",
            "email",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "is_active",
        )
        read_only_fields = fields


class CompanyMembershipSerializer(serializers.ModelSerializer):
    user = CompanyMembershipUserSerializer(read_only=True)

    class Meta:
        model = CompanyMembership
        fields = (
            "id",
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


class CompanyListSerializer(serializers.ModelSerializer):
    owner_user = CompanyOwnerSerializer(read_only=True)
    full_address = serializers.CharField(read_only=True)
    is_trial_active = serializers.BooleanField(read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = (
            "id",
            "public_id",
            "company_name",
            "legal_form",
            "industry",
            "employee_range",
            "email",
            "phone",
            "city",
            "country",
            "subscription_plan",
            "subscription_status",
            "is_trial_active",
            "owner_user",
            "member_count",
            "is_active",
            "created_at",
        )
        read_only_fields = fields

    def get_member_count(self, obj):
        return obj.memberships.filter(is_active=True).count()


class CompanyDetailSerializer(serializers.ModelSerializer):
    owner_user = CompanyOwnerSerializer(read_only=True)
    memberships = CompanyMembershipSerializer(many=True, read_only=True)
    full_address = serializers.CharField(read_only=True)
    is_trial_active = serializers.BooleanField(read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = (
            "id",
            "public_id",
            "company_name",
            "legal_form",
            "industry",
            "employee_range",
            "email",
            "phone",
            "website",
            "country",
            "street",
            "postal_code",
            "city",
            "full_address",
            "vat_id",
            "tax_number",
            "commercial_register",
            "logo",
            "subscription_plan",
            "subscription_status",
            "trial_ends_at",
            "billing_email",
            "timezone",
            "language",
            "owner_user",
            "is_trial_active",
            "member_count",
            "is_active",
            "created_at",
            "updated_at",
            "memberships",
        )
        read_only_fields = fields

    def get_member_count(self, obj):
        return obj.memberships.filter(is_active=True).count()


class CompanyCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = (
            "company_name",
            "legal_form",
            "industry",
            "employee_range",
            "email",
            "phone",
            "website",
            "country",
            "street",
            "postal_code",
            "city",
            "vat_id",
            "tax_number",
            "commercial_register",
            "logo",
            "billing_email",
            "timezone",
            "language",
        )

    def validate_email(self, value):
        return value.lower().strip() if value else value

    def validate_billing_email(self, value):
        return value.lower().strip() if value else value

    def create(self, validated_data):
        request = self.context["request"]
        return create_company_with_owner(
            owner_user=request.user,
            **validated_data,
        )


class CompanyUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = (
            "company_name",
            "legal_form",
            "industry",
            "employee_range",
            "email",
            "phone",
            "website",
            "country",
            "street",
            "postal_code",
            "city",
            "vat_id",
            "tax_number",
            "commercial_register",
            "logo",
            "billing_email",
            "timezone",
            "language",
            "is_active",
        )

    def validate_email(self, value):
        return value.lower().strip() if value else value

    def validate_billing_email(self, value):
        return value.lower().strip() if value else value

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.full_clean()
        instance.save()
        return instance