from rest_framework import serializers

from .models import Document


class DocumentListSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.company_name", read_only=True)
    employee_full_name = serializers.SerializerMethodField()
    employee_email = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "public_id",
            "company",
            "company_name",
            "employee_membership",
            "employee_full_name",
            "employee_email",
            "title",
            "description",
            "category",
            "visibility",
            "file",
            "file_url",
            "original_filename",
            "file_size",
            "mime_type",
            "uploaded_by",
            "uploaded_by_name",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def get_employee_full_name(self, obj):
        if obj.employee_membership and obj.employee_membership.user:
            user = obj.employee_membership.user
            full_name = getattr(user, "full_name", "") or ""
            if full_name.strip():
                return full_name.strip()

            first_name = getattr(user, "first_name", "") or ""
            last_name = getattr(user, "last_name", "") or ""
            combined = f"{first_name} {last_name}".strip()
            return combined or getattr(user, "email", None)

        return None

    def get_employee_email(self, obj):
        if obj.employee_membership and obj.employee_membership.user:
            return getattr(obj.employee_membership.user, "email", None)
        return None

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            user = obj.uploaded_by
            full_name = getattr(user, "full_name", "") or ""
            if full_name.strip():
                return full_name.strip()

            first_name = getattr(user, "first_name", "") or ""
            last_name = getattr(user, "last_name", "") or ""
            combined = f"{first_name} {last_name}".strip()
            return combined or getattr(user, "email", None)

        return None

    def get_file_url(self, obj):
        request = self.context.get("request")
        if not obj.file:
            return None

        url = obj.file.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url


class DocumentDetailSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.company_name", read_only=True)
    employee_full_name = serializers.SerializerMethodField()
    employee_email = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = (
            "id",
            "public_id",
            "company",
            "company_name",
            "employee_membership",
            "employee_full_name",
            "employee_email",
            "title",
            "description",
            "category",
            "visibility",
            "file",
            "file_url",
            "original_filename",
            "file_size",
            "mime_type",
            "uploaded_by",
            "uploaded_by_name",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "public_id",
            "original_filename",
            "file_size",
            "mime_type",
            "uploaded_by",
            "created_at",
            "updated_at",
        )

    def get_employee_full_name(self, obj):
        user = getattr(obj.employee_membership, "user", None)
        if not user:
            return ""
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.email

    def get_employee_email(self, obj):
        user = getattr(obj.employee_membership, "user", None)
        return getattr(user, "email", "")

    def get_uploaded_by_name(self, obj):
        user = getattr(obj, "uploaded_by", None)
        if not user:
            return ""
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.email

    def get_file_url(self, obj):
        request = self.context.get("request")
        if not obj.file:
            return ""
        try:
            url = obj.file.url
        except Exception:
            return ""
        if request is not None:
            return request.build_absolute_uri(url)
        return url


class DocumentCreateUpdateSerializer(serializers.ModelSerializer):
    file = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = Document
        fields = (
            "id",
            "public_id",
            "company",
            "employee_membership",
            "title",
            "description",
            "category",
            "visibility",
            "file",
            "original_filename",
            "file_size",
            "mime_type",
            "uploaded_by",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "public_id",
            "original_filename",
            "file_size",
            "mime_type",
            "uploaded_by",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        company = attrs.get("company") or getattr(instance, "company", None)
        employee_membership = attrs.get("employee_membership") or getattr(
            instance, "employee_membership", None
        )
        file_obj = attrs.get("file") or getattr(instance, "file", None)
        description = attrs.get("description") or getattr(instance, "description", "")
        title = attrs.get("title") or getattr(instance, "title", "")
        visibility = attrs.get("visibility") or getattr(
            instance,
            "visibility",
            Document.Visibility.COMPANY_ADMIN,
        )

        errors = {}

        if company and employee_membership:
            if employee_membership.company_id != company.id:
                errors["employee_membership"] = (
                    "Employee membership must belong to the same company."
                )

        if visibility == Document.Visibility.PRIVATE and not employee_membership:
            errors["employee_membership"] = (
                "Private documents should be assigned to an employee membership."
            )

        if not file_obj and not str(description).strip() and not str(title).strip():
            errors["non_field_errors"] = (
                "Please provide at least a title, description, or file."
            )

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def create(self, validated_data):
        validated_data["is_active"] = True

        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["uploaded_by"] = request.user

        file_obj = validated_data.get("file")
        if file_obj:
            validated_data["original_filename"] = getattr(file_obj, "name", "") or ""
            validated_data["file_size"] = getattr(file_obj, "size", 0) or 0
            validated_data["mime_type"] = getattr(file_obj, "content_type", "") or ""
        else:
            validated_data["original_filename"] = ""
            validated_data["file_size"] = 0
            validated_data["mime_type"] = ""

        return super().create(validated_data)

    def update(self, instance, validated_data):
        file_obj = validated_data.get("file")
        if file_obj:
            validated_data["original_filename"] = getattr(file_obj, "name", "") or ""
            validated_data["file_size"] = getattr(file_obj, "size", 0) or 0
            validated_data["mime_type"] = getattr(file_obj, "content_type", "") or ""

        return super().update(instance, validated_data)