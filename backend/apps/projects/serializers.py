from rest_framework import serializers

from apps.companies.models import CompanyMembership
from apps.customers.models import Customer

from .models import Project


class ProjectListSerializer(serializers.ModelSerializer):

    company_public_id = serializers.CharField(source="company.public_id", read_only=True)
    company_name = serializers.CharField(source="company.company_name", read_only=True)

    customer_public_id = serializers.CharField(source="customer.public_id", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    updated_by_email = serializers.EmailField(source="updated_by.email", read_only=True)

    class Meta:
        model = Project
        fields = (
            "id",
            "public_id",
            "project_number",
            "name",
            "company_public_id",
            "company_name",
            "customer_public_id",
            "customer_name",
            "status",
            "start_date",
            "end_date",
            "is_active",
            "created_by_email",
            "updated_by_email",
            "created_at",
            "updated_at",
        )

        read_only_fields = fields


class ProjectDetailSerializer(serializers.ModelSerializer):

    company_public_id = serializers.CharField(source="company.public_id", read_only=True)
    company_name = serializers.CharField(source="company.company_name", read_only=True)

    customer_public_id = serializers.CharField(source="customer.public_id", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    updated_by_email = serializers.EmailField(source="updated_by.email", read_only=True)

    class Meta:
        model = Project
        fields = (
            "id",
            "public_id",
            "project_number",
            "company",
            "company_public_id",
            "company_name",
            "customer",
            "customer_public_id",
            "customer_name",
            "name",
            "description",
            "status",
            "start_date",
            "end_date",
            "budget",
            "is_active",
            "created_by",
            "created_by_email",
            "updated_by",
            "updated_by_email",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "public_id",
            "created_by",
            "created_by_email",
            "updated_by",
            "updated_by_email",
            "created_at",
            "updated_at",
        )


class ProjectCreateUpdateSerializer(serializers.ModelSerializer):

    class Meta:
        model = Project
        fields = (
            "id",
            "public_id",
            "project_number",
            "company",
            "customer",
            "name",
            "description",
            "status",
            "start_date",
            "end_date",
            "budget",
            "is_active",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "public_id",
            "created_at",
            "updated_at",
        )

    def validate_company(self, company):

        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        if request.user.is_superuser:
            return company

        membership_exists = CompanyMembership.objects.filter(
            company=company,
            user=request.user,
            is_active=True,
        ).exists()

        if not membership_exists:
            raise serializers.ValidationError(
                "You do not belong to this company."
            )

        return company

    def validate_customer(self, customer):

        company = self.initial_data.get("company")

        if company and str(customer.company_id) != str(company):
            raise serializers.ValidationError(
                "Customer does not belong to this company."
            )

        return customer

    def validate_name(self, value):

        value = value.strip()

        if not value:
            raise serializers.ValidationError("Name is required.")

        return value

    def create(self, validated_data):

        request = self.context.get("request")

        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user
            validated_data["updated_by"] = request.user

        return super().create(validated_data)

    def update(self, instance, validated_data):

        request = self.context.get("request")

        if request and request.user.is_authenticated:
            validated_data["updated_by"] = request.user

        return super().update(instance, validated_data)