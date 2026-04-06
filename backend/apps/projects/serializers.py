from rest_framework import serializers

from apps.companies.models import CompanyMembership
from apps.customers.models import Customer

from .models import Project, ProjectType


class ProjectTypeSerializer(serializers.ModelSerializer):
    company_public_id = serializers.CharField(source="company.public_id", read_only=True)
    company_name = serializers.CharField(source="company.company_name", read_only=True)

    class Meta:
        model = ProjectType
        fields = (
            "id",
            "company",
            "company_public_id",
            "company_name",
            "name",
            "description",
            "is_active",
            "sort_order",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "company_public_id",
            "company_name",
        )

    def validate_company(self, company):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        if request.user.is_superuser:
            return company

        membership = CompanyMembership.objects.filter(
            company=company,
            user=request.user,
            is_active=True,
            role__in=["owner", "admin"],
        ).exists()
        if not membership:
            raise serializers.ValidationError(
                "Only company admin or owner can manage project types for this company."
            )
        return company

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Project type name is required.")
        return value


class ProjectListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    project_type_name = serializers.CharField(source="project_type.name", read_only=True)

    class Meta:
        model = Project
        fields = (
            "id",
            "public_id",
            "project_number",
            "name",
            "customer_name",
            "project_type",
            "project_type_name",
            "site_location",
            "status",
            "start_date",
            "end_date",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class ProjectDetailSerializer(serializers.ModelSerializer):
    company_public_id = serializers.CharField(source="company.public_id", read_only=True)
    company_name = serializers.CharField(source="company.company_name", read_only=True)
    customer_public_id = serializers.CharField(source="customer.public_id", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    project_type_name = serializers.CharField(source="project_type.name", read_only=True)
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
            "project_type",
            "project_type_name",
            "site_location",
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
            "project_type",
            "site_location",
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

    def _request_user(self):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")
        return request.user

    def validate_company(self, company):
        user = self._request_user()

        if user.is_superuser:
            return company

        membership_exists = CompanyMembership.objects.filter(
            company=company,
            user=user,
            is_active=True,
        ).exists()
        if not membership_exists:
            raise serializers.ValidationError("You do not belong to this company.")

        return company

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        return value

    def validate_site_location(self, value):
        return (value or "").strip()

    def validate(self, attrs):
        company = attrs.get("company") or getattr(self.instance, "company", None)
        customer = attrs.get("customer") or getattr(self.instance, "customer", None)
        project_type = attrs.get("project_type") if "project_type" in attrs else getattr(self.instance, "project_type", None)

        if customer and company and customer.company_id != company.id:
            raise serializers.ValidationError(
                {"customer": "Customer does not belong to the selected company."}
            )

        if project_type and company and project_type.company_id != company.id:
            raise serializers.ValidationError(
                {"project_type": "Selected project type does not belong to the selected company."}
            )

        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": "End date cannot be earlier than start date."}
            )

        return attrs

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