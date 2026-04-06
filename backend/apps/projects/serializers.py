from rest_framework import serializers

from apps.companies.models import CompanyMembership

from .models import Project, ProjectType


class CompanyAdminValidationMixin:
    admin_roles = ("owner", "admin")

    def _validate_company_admin_access(self, company):
        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        if request.user.is_superuser:
            return company

        membership_exists = CompanyMembership.objects.filter(
            company=company,
            user=request.user,
            is_active=True,
            role__in=self.admin_roles,
        ).exists()

        if not membership_exists:
            raise serializers.ValidationError(
                "Only admin/owner of this company can use this action."
            )

        return company


class ProjectTypeSerializer(CompanyAdminValidationMixin, serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.company_name", read_only=True)

    class Meta:
        model = ProjectType
        fields = (
            "id",
            "company",
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
            "company_name",
        )

    def validate_company(self, company):
        return self._validate_company_admin_access(company)

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Project type name is required.")
        return value

    def validate_description(self, value):
        return (value or "").strip()


class ProjectTypeListSerializer(serializers.ModelSerializer):
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
        read_only_fields = fields


class ProjectListSerializer(serializers.ModelSerializer):
    company_public_id = serializers.CharField(source="company.public_id", read_only=True)
    company_name = serializers.CharField(source="company.company_name", read_only=True)

    customer_public_id = serializers.CharField(source="customer.public_id", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    project_type_id = serializers.IntegerField(source="project_type.id", read_only=True)
    project_type_name = serializers.CharField(source="project_type.name", read_only=True)

    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    updated_by_email = serializers.EmailField(source="updated_by.email", read_only=True)

    class Meta:
        model = Project
        fields = (
            "id",
            "public_id",
            "project_number",
            "name",
            "company",
            "company_public_id",
            "company_name",
            "customer",
            "customer_public_id",
            "customer_name",
            "project_type",
            "project_type_id",
            "project_type_name",
            "site_location",
            "status",
            "start_date",
            "end_date",
            "budget",
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

    project_type_id = serializers.IntegerField(source="project_type.id", read_only=True)
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
            "project_type_id",
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
            "project_type_id",
            "project_type_name",
            "company_public_id",
            "company_name",
            "customer_public_id",
            "customer_name",
        )


class ProjectCreateUpdateSerializer(CompanyAdminValidationMixin, serializers.ModelSerializer):
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

    def validate_company(self, company):
        return self._validate_company_admin_access(company)

    def validate_name(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        return value

    def validate_description(self, value):
        return (value or "").strip()

    def validate_site_location(self, value):
        return (value or "").strip()

    def validate_project_number(self, value):
        return (value or "").strip()

    def validate(self, attrs):
        company = attrs.get("company")
        customer = attrs.get("customer")
        project_type = attrs.get("project_type")

        if self.instance:
            if company is None:
                company = self.instance.company
            if customer is None:
                customer = self.instance.customer
            if project_type is None:
                project_type = self.instance.project_type

        if customer and company:
            if getattr(customer, "company_id", None) != company.id:
                raise serializers.ValidationError({
                    "customer": "Customer does not belong to the selected company."
                })

        if project_type and company:
            if getattr(project_type, "company_id", None) != company.id:
                raise serializers.ValidationError({
                    "project_type": "Selected project type does not belong to the selected company."
                })

        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({
                "end_date": "End date cannot be earlier than start date."
            })

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