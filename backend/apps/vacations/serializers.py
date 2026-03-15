from django.utils import timezone
from rest_framework import serializers

from .models import VacationBalance, VacationRequest


class VacationRequestListSerializer(serializers.ModelSerializer):
    employee_full_name = serializers.SerializerMethodField()
    employee_email = serializers.SerializerMethodField()
    requested_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = VacationRequest
        fields = (
            "id",
            "public_id",
            "company",
            "employee_membership",
            "employee_full_name",
            "employee_email",
            "leave_type",
            "status",
            "start_date",
            "end_date",
            "is_half_day_start",
            "is_half_day_end",
            "requested_days",
            "reason",
            "requested_by",
            "requested_by_name",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "rejected_at",
            "cancelled_at",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_employee_full_name(self, obj):
        user = getattr(obj.employee_membership, "user", None)
        if not user:
            return ""
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.email

    def get_employee_email(self, obj):
        user = getattr(obj.employee_membership, "user", None)
        return getattr(user, "email", "")

    def get_requested_by_name(self, obj):
        user = getattr(obj, "requested_by", None)
        if not user:
            return ""
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.email

    def get_approved_by_name(self, obj):
        user = getattr(obj, "approved_by", None)
        if not user:
            return ""
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.email


class VacationRequestDetailSerializer(serializers.ModelSerializer):
    employee_full_name = serializers.SerializerMethodField()
    employee_email = serializers.SerializerMethodField()
    requested_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = VacationRequest
        fields = (
            "id",
            "public_id",
            "company",
            "employee_membership",
            "employee_full_name",
            "employee_email",
            "leave_type",
            "status",
            "start_date",
            "end_date",
            "is_half_day_start",
            "is_half_day_end",
            "requested_days",
            "reason",
            "employee_note",
            "manager_note",
            "requested_by",
            "requested_by_name",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "rejected_at",
            "cancelled_at",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "public_id",
            "requested_days",
            "requested_by",
            "approved_by",
            "approved_at",
            "rejected_at",
            "cancelled_at",
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

    def get_requested_by_name(self, obj):
        user = getattr(obj, "requested_by", None)
        if not user:
            return ""
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.email

    def get_approved_by_name(self, obj):
        user = getattr(obj, "approved_by", None)
        if not user:
            return ""
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.email


class VacationRequestCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = VacationRequest
        fields = (
            "id",
            "public_id",
            "company",
            "employee_membership",
            "leave_type",
            "status",
            "start_date",
            "end_date",
            "is_half_day_start",
            "is_half_day_end",
            "requested_days",
            "reason",
            "employee_note",
            "manager_note",
            "requested_by",
            "approved_by",
            "approved_at",
            "rejected_at",
            "cancelled_at",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "public_id",
            "requested_days",
            "requested_by",
            "approved_by",
            "approved_at",
            "rejected_at",
            "cancelled_at",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        company = attrs.get("company") or getattr(instance, "company", None)
        employee_membership = attrs.get("employee_membership") or getattr(
            instance, "employee_membership", None
        )
        start_date = attrs.get("start_date") or getattr(instance, "start_date", None)
        end_date = attrs.get("end_date") or getattr(instance, "end_date", None)
        is_half_day_start = attrs.get(
            "is_half_day_start",
            getattr(instance, "is_half_day_start", False),
        )
        is_half_day_end = attrs.get(
            "is_half_day_end",
            getattr(instance, "is_half_day_end", False),
        )
        status_value = attrs.get("status") or getattr(
            instance,
            "status",
            VacationRequest.Status.DRAFT,
        )

        errors = {}

        if company and employee_membership:
            if employee_membership.company_id != company.id:
                errors["employee_membership"] = (
                    "Employee membership must belong to the same company."
                )

        if start_date and end_date and end_date < start_date:
            errors["end_date"] = "End date must be on or after start date."

        if (
            start_date
            and end_date
            and start_date != end_date
            and is_half_day_start
            and is_half_day_end
        ):
            errors["is_half_day_end"] = (
                "Half day at both start and end is only allowed for a single-day request."
            )

        if instance and instance.status in {
            VacationRequest.Status.APPROVED,
            VacationRequest.Status.REJECTED,
            VacationRequest.Status.CANCELLED,
        }:
            allowed_fields_after_decision = {
                "manager_note",
                "employee_note",
                "is_active",
            }
            changed_fields = set(attrs.keys()) - allowed_fields_after_decision
            if changed_fields:
                errors["non_field_errors"] = (
                    "Approved, rejected, or cancelled vacation requests can no longer be edited."
                )

        if not instance and status_value in {
            VacationRequest.Status.APPROVED,
            VacationRequest.Status.REJECTED,
            VacationRequest.Status.CANCELLED,
        }:
            errors["status"] = "New vacation requests must start as draft or pending."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")

        if request and request.user and request.user.is_authenticated:
            validated_data["requested_by"] = request.user

        if not validated_data.get("status"):
            validated_data["status"] = VacationRequest.Status.DRAFT

        return super().create(validated_data)


class VacationRequestSubmitSerializer(serializers.ModelSerializer):
    class Meta:
        model = VacationRequest
        fields = (
            "status",
            "employee_note",
        )

    def validate_status(self, value):
        if value != VacationRequest.Status.PENDING:
            raise serializers.ValidationError("Status must be pending.")
        return value

    def validate(self, attrs):
        instance = self.instance

        if instance.status not in {
            VacationRequest.Status.DRAFT,
            VacationRequest.Status.REJECTED,
        }:
            raise serializers.ValidationError(
                "Only draft or rejected vacation requests can be submitted."
            )

        return attrs


class VacationRequestApproveSerializer(serializers.ModelSerializer):
    class Meta:
        model = VacationRequest
        fields = (
            "status",
            "manager_note",
        )

    def validate_status(self, value):
        if value != VacationRequest.Status.APPROVED:
            raise serializers.ValidationError("Status must be approved.")
        return value

    def validate(self, attrs):
        instance = self.instance

        if instance.status != VacationRequest.Status.PENDING:
            raise serializers.ValidationError(
                "Only pending vacation requests can be approved."
            )

        return attrs

    def update(self, instance, validated_data):
        request = self.context.get("request")

        instance.status = VacationRequest.Status.APPROVED
        instance.manager_note = validated_data.get("manager_note", instance.manager_note)

        if request and request.user and request.user.is_authenticated:
            instance.approved_by = request.user

        instance.approved_at = timezone.now()
        instance.rejected_at = None
        instance.cancelled_at = None
        instance.save()

        return instance


class VacationRequestRejectSerializer(serializers.ModelSerializer):
    class Meta:
        model = VacationRequest
        fields = (
            "status",
            "manager_note",
        )

    def validate_status(self, value):
        if value != VacationRequest.Status.REJECTED:
            raise serializers.ValidationError("Status must be rejected.")
        return value

    def validate(self, attrs):
        instance = self.instance

        if instance.status != VacationRequest.Status.PENDING:
            raise serializers.ValidationError(
                "Only pending vacation requests can be rejected."
            )

        return attrs

    def update(self, instance, validated_data):
        request = self.context.get("request")

        instance.status = VacationRequest.Status.REJECTED
        instance.manager_note = validated_data.get("manager_note", instance.manager_note)

        if request and request.user and request.user.is_authenticated:
            instance.approved_by = request.user

        instance.rejected_at = timezone.now()
        instance.approved_at = None
        instance.cancelled_at = None
        instance.save()

        return instance


class VacationRequestCancelSerializer(serializers.ModelSerializer):
    class Meta:
        model = VacationRequest
        fields = (
            "status",
            "employee_note",
        )

    def validate_status(self, value):
        if value != VacationRequest.Status.CANCELLED:
            raise serializers.ValidationError("Status must be cancelled.")
        return value

    def validate(self, attrs):
        instance = self.instance

        if instance.status not in {
            VacationRequest.Status.DRAFT,
            VacationRequest.Status.PENDING,
            VacationRequest.Status.APPROVED,
        }:
            raise serializers.ValidationError(
                "This vacation request cannot be cancelled anymore."
            )

        return attrs

    def update(self, instance, validated_data):
        instance.status = VacationRequest.Status.CANCELLED
        instance.employee_note = validated_data.get("employee_note", instance.employee_note)
        instance.cancelled_at = timezone.now()
        instance.save()
        return instance


class VacationBalanceListSerializer(serializers.ModelSerializer):
    employee_full_name = serializers.SerializerMethodField()
    employee_email = serializers.SerializerMethodField()
    total_available_days = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        read_only=True,
    )
    used_days = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        read_only=True,
    )
    remaining_days = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = VacationBalance
        fields = (
            "id",
            "company",
            "employee_membership",
            "employee_full_name",
            "employee_email",
            "year",
            "entitled_days",
            "carried_over_days",
            "manual_adjustment_days",
            "total_available_days",
            "used_days",
            "remaining_days",
            "note",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_employee_full_name(self, obj):
        user = getattr(obj.employee_membership, "user", None)
        if not user:
            return ""
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.email

    def get_employee_email(self, obj):
        user = getattr(obj.employee_membership, "user", None)
        return getattr(user, "email", "")


class VacationBalanceDetailSerializer(serializers.ModelSerializer):
    employee_full_name = serializers.SerializerMethodField()
    employee_email = serializers.SerializerMethodField()
    total_available_days = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        read_only=True,
    )
    used_days = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        read_only=True,
    )
    remaining_days = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = VacationBalance
        fields = (
            "id",
            "company",
            "employee_membership",
            "employee_full_name",
            "employee_email",
            "year",
            "entitled_days",
            "carried_over_days",
            "manual_adjustment_days",
            "total_available_days",
            "used_days",
            "remaining_days",
            "note",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "total_available_days",
            "used_days",
            "remaining_days",
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


class VacationBalanceCreateUpdateSerializer(serializers.ModelSerializer):
    total_available_days = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        read_only=True,
    )
    used_days = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        read_only=True,
    )
    remaining_days = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = VacationBalance
        fields = (
            "id",
            "company",
            "employee_membership",
            "year",
            "entitled_days",
            "carried_over_days",
            "manual_adjustment_days",
            "total_available_days",
            "used_days",
            "remaining_days",
            "note",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "total_available_days",
            "used_days",
            "remaining_days",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        company = attrs.get("company") or getattr(instance, "company", None)
        employee_membership = attrs.get("employee_membership") or getattr(
            instance, "employee_membership", None
        )
        year = attrs.get("year") or getattr(instance, "year", None)

        errors = {}

        if company and employee_membership:
            if employee_membership.company_id != company.id:
                errors["employee_membership"] = (
                    "Employee membership must belong to the same company."
                )

        if year is not None and (year < 2000 or year > 3000):
            errors["year"] = "Year must be between 2000 and 3000."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs