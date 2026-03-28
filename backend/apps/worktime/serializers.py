from django.utils import timezone
from rest_framework import serializers

from .models import WorkTimeEntry


def get_minimum_break_minutes(started_at, ended_at):
    if not started_at or not ended_at:
        return 0

    total_minutes = int((ended_at - started_at).total_seconds() // 60)

    if total_minutes > 9 * 60:
        return 45
    if total_minutes > 6 * 60:
        return 30
    return 0


class WorkTimeEntryListSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="project.name", read_only=True)
    duration_minutes = serializers.IntegerField(read_only=True)
    duration_hours = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = WorkTimeEntry
        fields = (
            "id",
            "public_id",
            "company",
            "employee_membership",
            "employee_name",
            "project",
            "project_name",
            "entry_type",
            "status",
            "work_date",
            "started_at",
            "ended_at",
            "break_minutes",
            "duration_minutes",
            "duration_hours",
            "title",
            "description",
            "internal_note",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_employee_name(self, obj):
        user = getattr(obj.employee_membership, "user", None)
        if not user:
            return ""
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.email or str(user)


class WorkTimeEntryDetailSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="project.name", read_only=True)
    approved_by_name = serializers.SerializerMethodField()
    rejected_by_name = serializers.SerializerMethodField()
    duration_minutes = serializers.IntegerField(read_only=True)
    duration_hours = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = WorkTimeEntry
        fields = (
            "id",
            "public_id",
            "company",
            "employee_membership",
            "employee_name",
            "project",
            "project_name",
            "entry_type",
            "status",
            "work_date",
            "started_at",
            "ended_at",
            "break_minutes",
            "duration_minutes",
            "duration_hours",
            "title",
            "description",
            "internal_note",
            "submitted_at",
            "approved_at",
            "approved_by",
            "approved_by_name",
            "rejected_at",
            "rejected_by",
            "rejected_by_name",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "public_id",
            "submitted_at",
            "approved_at",
            "approved_by",
            "approved_by_name",
            "rejected_at",
            "rejected_by",
            "rejected_by_name",
            "created_at",
            "updated_at",
            "duration_minutes",
            "duration_hours",
        )

    def get_employee_name(self, obj):
        user = getattr(obj.employee_membership, "user", None)
        if not user:
            return ""
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.email or str(user)

    def get_approved_by_name(self, obj):
        membership = getattr(obj, "approved_by", None)
        user = getattr(membership, "user", None)
        if not user:
            return ""
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.email or str(user)

    def get_rejected_by_name(self, obj):
        membership = getattr(obj, "rejected_by", None)
        user = getattr(membership, "user", None)
        if not user:
            return ""
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.email or str(user)


class WorkTimeEntryCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkTimeEntry
        fields = (
            "company",
            "employee_membership",
            "project",
            "entry_type",
            "work_date",
            "started_at",
            "ended_at",
            "break_minutes",
            "title",
            "description",
            "internal_note",
            "is_active",
        )

    def validate(self, attrs):
        company = attrs.get("company")
        membership = attrs.get("employee_membership")
        project = attrs.get("project")
        entry_type = attrs.get("entry_type", WorkTimeEntry.EntryType.MANUAL)
        work_date = attrs.get("work_date")
        started_at = attrs.get("started_at")
        ended_at = attrs.get("ended_at")
        break_minutes = attrs.get("break_minutes", 0)
        internal_note = (attrs.get("internal_note") or "").strip()

        errors = {}

        if company and membership and membership.company_id != company.id:
            errors["employee_membership"] = (
                "Employee membership must belong to the same company."
            )

        if company and project and project.company_id != company.id:
            errors["project"] = "Project must belong to the same company."

        if not started_at:
            errors["started_at"] = "Start time is required."

        if not ended_at:
            errors["ended_at"] = "End time is required."

        if started_at and ended_at and ended_at <= started_at:
            errors["ended_at"] = "End time must be later than start time."

        if started_at and work_date:
            local_started_date = timezone.localtime(started_at).date()
            if local_started_date != work_date:
                errors["work_date"] = "work_date must match the local date of started_at."

        if break_minutes is not None and break_minutes < 0:
            errors["break_minutes"] = "Break minutes cannot be negative."

        if entry_type not in (
            WorkTimeEntry.EntryType.MANUAL,
            WorkTimeEntry.EntryType.TIMER,
        ):
            errors["entry_type"] = "Invalid entry type."

        if entry_type == WorkTimeEntry.EntryType.MANUAL:
            if not project:
                errors["project"] = "A project is required for manual work time entries."

        if errors:
            raise serializers.ValidationError(errors)

        if started_at and ended_at:
            minimum_break_minutes = get_minimum_break_minutes(started_at, ended_at)
            attrs["break_minutes"] = max(int(break_minutes or 0), minimum_break_minutes)

        attrs["internal_note"] = internal_note
        return attrs

    def create(self, validated_data):
        validated_data["status"] = WorkTimeEntry.Status.SUBMITTED
        validated_data["is_active"] = False
        return super().create(validated_data)


class WorkTimeEntryUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkTimeEntry
        fields = (
            "project",
            "status",
            "work_date",
            "started_at",
            "ended_at",
            "break_minutes",
            "title",
            "description",
            "internal_note",
            "is_active",
        )

    def validate(self, attrs):
        instance = self.instance
        request = self.context.get("request")
        updater_membership = self.context.get("updater_membership")

        project = attrs.get("project", instance.project)
        status_value = attrs.get("status", instance.status)
        work_date = attrs.get("work_date", instance.work_date)
        started_at = attrs.get("started_at", instance.started_at)
        ended_at = attrs.get("ended_at", instance.ended_at)
        break_minutes = attrs.get("break_minutes", instance.break_minutes)

        errors = {}

        if project and project.company_id != instance.company_id:
            errors["project"] = "Project must belong to the same company."

        if started_at and work_date:
            local_started_date = timezone.localtime(started_at).date()
            if local_started_date != work_date:
                errors["work_date"] = "work_date must match the local date of started_at."

        if ended_at and started_at and ended_at <= started_at:
            errors["ended_at"] = "End time must be later than start time."

        if break_minutes is not None and break_minutes < 0:
            errors["break_minutes"] = "Break minutes cannot be negative."

        if instance.status == WorkTimeEntry.Status.RUNNING and "ended_at" in attrs:
            errors["ended_at"] = "Running entries must be stopped via the stop action."

        if status_value != WorkTimeEntry.Status.RUNNING and not ended_at:
            errors["ended_at"] = "A finished entry must have an end time."

        if status_value == WorkTimeEntry.Status.RUNNING and ended_at:
            errors["status"] = "A running entry cannot already have an end time."

        if status_value in (
            WorkTimeEntry.Status.APPROVED,
            WorkTimeEntry.Status.REJECTED,
        ):
            if not request or not request.user or not request.user.is_authenticated:
                errors["status"] = "Authenticated user is required for this status change."
            elif not updater_membership:
                errors["status"] = "Only owner or admin can set approved or rejected."
            else:
                if updater_membership.company_id != instance.company_id:
                    errors["status"] = "Updater must belong to the same company."

        if errors:
            raise serializers.ValidationError(errors)

        if started_at and ended_at:
            minimum_break_minutes = get_minimum_break_minutes(started_at, ended_at)
            attrs["break_minutes"] = max(int(break_minutes or 0), minimum_break_minutes)

        return attrs

    def update(self, instance, validated_data):
        updater_membership = self.context.get("updater_membership")
        new_status = validated_data.get("status", instance.status)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        now = timezone.now()

        if new_status == WorkTimeEntry.Status.SUBMITTED:
            if not instance.submitted_at:
                instance.submitted_at = now
            instance.approved_at = None
            instance.approved_by = None
            instance.rejected_at = None
            instance.rejected_by = None
            instance.is_active = False

        elif new_status == WorkTimeEntry.Status.APPROVED:
            instance.approved_at = now
            instance.approved_by = updater_membership
            instance.rejected_at = None
            instance.rejected_by = None
            if not instance.submitted_at:
                instance.submitted_at = now
            instance.is_active = False

        elif new_status == WorkTimeEntry.Status.REJECTED:
            instance.rejected_at = now
            instance.rejected_by = updater_membership
            instance.approved_at = None
            instance.approved_by = None
            if not instance.submitted_at:
                instance.submitted_at = now
            instance.is_active = False

        elif new_status == WorkTimeEntry.Status.RUNNING:
            instance.submitted_at = None
            instance.approved_at = None
            instance.approved_by = None
            instance.rejected_at = None
            instance.rejected_by = None
            instance.is_active = True

        instance.save()
        return instance


class WorkTimeEntryStartSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkTimeEntry
        fields = (
            "company",
            "employee_membership",
            "project",
            "title",
            "description",
            "internal_note",
        )

    def validate(self, attrs):
        company = attrs.get("company")
        membership = attrs.get("employee_membership")
        project = attrs.get("project")

        errors = {}

        if company and membership and membership.company_id != company.id:
            errors["employee_membership"] = (
                "Employee membership must belong to the same company."
            )

        if company and project and project.company_id != company.id:
            errors["project"] = "Project must belong to the same company."

        active_running_exists = WorkTimeEntry.objects.filter(
            company=company,
            employee_membership=membership,
            status=WorkTimeEntry.Status.RUNNING,
            is_active=True,
        ).exists()

        if active_running_exists:
            errors["non_field_errors"] = [
                "This employee already has a running work time entry."
            ]

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def create(self, validated_data):
        now = timezone.now()
        validated_data["work_date"] = timezone.localtime(now).date()
        validated_data["started_at"] = now
        validated_data["ended_at"] = None
        validated_data["break_minutes"] = 0
        validated_data["entry_type"] = WorkTimeEntry.EntryType.TIMER
        validated_data["status"] = WorkTimeEntry.Status.RUNNING
        return super().create(validated_data)


class WorkTimeEntryStopSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkTimeEntry
        fields = (
            "break_minutes",
            "title",
            "description",
            "internal_note",
        )

    def validate(self, attrs):
        instance = self.instance
        break_minutes = attrs.get("break_minutes", instance.break_minutes)

        errors = {}

        if instance.status != WorkTimeEntry.Status.RUNNING:
            errors["status"] = "Only running entries can be stopped."

        if break_minutes is not None and break_minutes < 0:
            errors["break_minutes"] = "Break minutes cannot be negative."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def update(self, instance, validated_data):
        ended_at = timezone.now()
        raw_break_minutes = validated_data.get("break_minutes", instance.break_minutes) or 0
        minimum_break_minutes = get_minimum_break_minutes(instance.started_at, ended_at)
        final_break_minutes = max(int(raw_break_minutes), minimum_break_minutes)

        instance.ended_at = ended_at
        instance.break_minutes = final_break_minutes
        instance.title = validated_data.get("title", instance.title)
        instance.description = validated_data.get("description", instance.description)
        instance.internal_note = validated_data.get("internal_note", instance.internal_note)
        instance.status = WorkTimeEntry.Status.SUBMITTED
        instance.save()
        return instance


class WorkTimeEntryApproveSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkTimeEntry
        fields = ()

    def update(self, instance, validated_data):
        approver_membership = self.context.get("approver_membership")

        if instance.status != WorkTimeEntry.Status.SUBMITTED:
            raise serializers.ValidationError(
                {"status": "Only submitted entries can be approved."}
            )

        if not approver_membership:
            raise serializers.ValidationError(
                {"approved_by": "Approver membership is required."}
            )

        if approver_membership.company_id != instance.company_id:
            raise serializers.ValidationError(
                {"approved_by": "Approver must belong to the same company."}
            )

        instance.status = WorkTimeEntry.Status.APPROVED
        instance.approved_at = timezone.now()
        instance.approved_by = approver_membership
        instance.rejected_at = None
        instance.rejected_by = None
        instance.save()
        return instance


class WorkTimeEntryRejectSerializer(serializers.Serializer):
    internal_note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        instance = self.instance
        rejector_membership = self.context.get("rejector_membership")

        if instance.status != WorkTimeEntry.Status.SUBMITTED:
            raise serializers.ValidationError(
                {"status": "Only submitted entries can be rejected."}
            )

        if not rejector_membership:
            raise serializers.ValidationError(
                {"rejected_by": "Rejector membership is required."}
            )

        if rejector_membership.company_id != instance.company_id:
            raise serializers.ValidationError(
                {"rejected_by": "Rejector must belong to the same company."}
            )

        return attrs

    def update(self, instance, validated_data):
        rejector_membership = self.context["rejector_membership"]

        instance.status = WorkTimeEntry.Status.REJECTED
        instance.rejected_at = timezone.now()
        instance.rejected_by = rejector_membership
        instance.approved_at = None
        instance.approved_by = None

        internal_note = validated_data.get("internal_note")
        if internal_note is not None:
            instance.internal_note = internal_note

        instance.save()
        return instance

    def create(self, validated_data):
        raise NotImplementedError("Use this serializer only for updates.")