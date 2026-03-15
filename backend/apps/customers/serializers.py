# apps/customers/serializers.py

from rest_framework import serializers

from apps.companies.models import CompanyMembership

from .models import Customer


class CustomerListSerializer(serializers.ModelSerializer):
    company_public_id = serializers.CharField(source="company.public_id", read_only=True)
    company_name = serializers.CharField(source="company.company_name", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    updated_by_email = serializers.EmailField(source="updated_by.email", read_only=True)

    class Meta:
        model = Customer
        fields = (
            "id",
            "public_id",
            "company_public_id",
            "company_name",
            "name",
            "customer_number",
            "contact_person",
            "email",
            "phone",
            "city",
            "country",
            "is_active",
            "created_by_email",
            "updated_by_email",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class CustomerDetailSerializer(serializers.ModelSerializer):
    company_public_id = serializers.CharField(source="company.public_id", read_only=True)
    company_name = serializers.CharField(source="company.company_name", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    updated_by_email = serializers.EmailField(source="updated_by.email", read_only=True)

    class Meta:
        model = Customer
        fields = (
            "id",
            "public_id",
            "company",
            "company_public_id",
            "company_name",
            "name",
            "customer_number",
            "contact_person",
            "email",
            "phone",
            "street",
            "house_number",
            "postal_code",
            "city",
            "country",
            "tax_number",
            "vat_id",
            "notes",
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
            "customer_number",
            "created_by",
            "created_by_email",
            "updated_by",
            "updated_by_email",
            "created_at",
            "updated_at",
        )


class CustomerCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = (
            "id",
            "public_id",
            "company",
            "name",
            "contact_person",
            "email",
            "phone",
            "street",
            "house_number",
            "postal_code",
            "city",
            "country",
            "tax_number",
            "vat_id",
            "notes",
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
            raise serializers.ValidationError("You do not belong to this company.")

        return company

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        return value

    def validate_email(self, value):
        if not value:
            return value
        return value.strip().lower()

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