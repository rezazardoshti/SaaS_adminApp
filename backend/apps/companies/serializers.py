from django.contrib.auth import get_user_model
from django_countries.serializer_fields import CountryField
from rest_framework import serializers

from .models import Company, CompanyMembership
from .services import create_company_with_owner

User = get_user_model()


class CompanyOwnerSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

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

    def get_full_name(self, obj):
        full_name = f"{obj.first_name or ''} {obj.last_name or ''}".strip()
        return full_name or obj.email or str(obj.public_id)


class CompanyMembershipUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

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

    def get_full_name(self, obj):
        full_name = f"{obj.first_name or ''} {obj.last_name or ''}".strip()
        return full_name or obj.email or str(obj.public_id)


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

    country = CountryField(required=False)
    country_name = serializers.SerializerMethodField()

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
            "country_name",
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

    def get_country_name(self, obj):
        return str(obj.country) if obj.country else ""


class CompanyDetailSerializer(serializers.ModelSerializer):
    owner_user = CompanyOwnerSerializer(read_only=True)
    memberships = CompanyMembershipSerializer(many=True, read_only=True)
    full_address = serializers.CharField(read_only=True)
    is_trial_active = serializers.BooleanField(read_only=True)
    member_count = serializers.SerializerMethodField()

    country = CountryField(required=False)
    country_name = serializers.SerializerMethodField()

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
            "country_name",
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
            "gps_tracking_mode",
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

    def get_country_name(self, obj):
        return str(obj.country) if obj.country else ""


class CompanyCreateSerializer(serializers.ModelSerializer):
    country = CountryField(required=False, allow_blank=True)

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
            "gps_tracking_mode",
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
    country = CountryField(required=False, allow_blank=True)
    country_name = serializers.SerializerMethodField(read_only=True)
    full_address = serializers.CharField(read_only=True)
    is_trial_active = serializers.BooleanField(read_only=True)
    owner_user = CompanyOwnerSerializer(read_only=True)
    member_count = serializers.SerializerMethodField(read_only=True)

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
            "country_name",
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
            "gps_tracking_mode",
            "owner_user",
            "is_trial_active",
            "member_count",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "public_id",
            "owner_user",
            "is_trial_active",
            "member_count",
            "full_address",
            "created_at",
            "updated_at",
            "subscription_plan",
            "subscription_status",
            "trial_ends_at",
        )

    def get_country_name(self, obj):
        return str(obj.country) if obj.country else ""

    def get_member_count(self, obj):
        return obj.memberships.filter(is_active=True).count()

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