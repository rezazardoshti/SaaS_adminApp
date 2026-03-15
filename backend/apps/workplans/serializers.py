# apps/workplans/serializers.py

from rest_framework import serializers

from apps.companies.models import CompanyMembership
from apps.projects.models import Project

from .models import WorkPlan, WorkPlanItem


class WorkPlanListSerializer(serializers.ModelSerializer):
    company_public_id = serializers.CharField(source="company.public_id", read_only=True)
    company_name = serializers.CharField(source="company.company_name", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    updated_by_email = serializers.EmailField(source="updated_by.email", read_only=True)
    item_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = WorkPlan
        fields = (
            "id",
            "public_id",
            "company_public_id",
            "company_name",
            "calendar_week",
            "period_start",
            "period_end",
            "status",
            "is_active",
            "notes",
            "item_count",
            "created_by_email",
            "updated_by_email",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class WorkPlanDetailSerializer(serializers.ModelSerializer):
    company_public_id = serializers.CharField(source="company.public_id", read_only=True)
    company_name = serializers.CharField(source="company.company_name", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    updated_by_email = serializers.EmailField(source="updated_by.email", read_only=True)

    class Meta:
        model = WorkPlan
        fields = (
            "id",
            "public_id",
            "company",
            "company_public_id",
            "company_name",
            "calendar_week",
            "period_start",
            "period_end",
            "status",
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
            "created_by",
            "created_by_email",
            "updated_by",
            "updated_by_email",
            "created_at",
            "updated_at",
        )


class WorkPlanCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkPlan
        fields = (
            "id",
            "public_id",
            "company",
            "calendar_week",
            "period_start",
            "period_end",
            "status",
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

    def validate(self, attrs):
        period_start = attrs.get("period_start", getattr(self.instance, "period_start", None))
        period_end = attrs.get("period_end", getattr(self.instance, "period_end", None))
        notes = attrs.get("notes")

        if period_start and period_end and period_start > period_end:
            raise serializers.ValidationError(
                {"period_end": "End date must be after or equal to start date."}
            )

        if notes is not None:
            attrs["notes"] = notes.strip()

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


class WorkPlanItemListSerializer(serializers.ModelSerializer):
    work_plan_public_id = serializers.CharField(source="work_plan.public_id", read_only=True)
    company_public_id = serializers.CharField(source="company.public_id", read_only=True)
    company_name = serializers.CharField(source="company.company_name", read_only=True)

    employee_membership_public_id = serializers.CharField(source="employee_membership.public_id", read_only=True)
    employee_user_email = serializers.EmailField(source="employee_membership.user.email", read_only=True)
    employee_first_name = serializers.CharField(source="employee_membership.user.first_name", read_only=True)
    employee_last_name = serializers.CharField(source="employee_membership.user.last_name", read_only=True)

    project_public_id = serializers.CharField(source="project.public_id", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)

    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    updated_by_email = serializers.EmailField(source="updated_by.email", read_only=True)

    class Meta:
        model = WorkPlanItem
        fields = (
            "id",
            "public_id",
            "work_plan_public_id",
            "company_public_id",
            "company_name",
            "employee_membership_public_id",
            "employee_user_email",
            "employee_first_name",
            "employee_last_name",
            "project_public_id",
            "project_name",
            "work_date",
            "start_time",
            "end_time",
            "planned_hours",
            "task_name",
            "status",
            "is_active",
            "created_by_email",
            "updated_by_email",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class WorkPlanItemDetailSerializer(serializers.ModelSerializer):
    work_plan_public_id = serializers.CharField(source="work_plan.public_id", read_only=True)
    company_public_id = serializers.CharField(source="company.public_id", read_only=True)
    company_name = serializers.CharField(source="company.company_name", read_only=True)

    employee_membership_public_id = serializers.CharField(source="employee_membership.public_id", read_only=True)
    employee_user_email = serializers.EmailField(source="employee_membership.user.email", read_only=True)
    employee_first_name = serializers.CharField(source="employee_membership.user.first_name", read_only=True)
    employee_last_name = serializers.CharField(source="employee_membership.user.last_name", read_only=True)

    project_public_id = serializers.CharField(source="project.public_id", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)

    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    updated_by_email = serializers.EmailField(source="updated_by.email", read_only=True)

    class Meta:
        model = WorkPlanItem
        fields = (
            "id",
            "public_id",
            "work_plan",
            "work_plan_public_id",
            "company",
            "company_public_id",
            "company_name",
            "employee_membership",
            "employee_membership_public_id",
            "employee_user_email",
            "employee_first_name",
            "employee_last_name",
            "project",
            "project_public_id",
            "project_name",
            "work_date",
            "start_time",
            "end_time",
            "planned_hours",
            "task_name",
            "notes",
            "status",
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


class WorkPlanItemCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkPlanItem
        fields = (
            "id",
            "public_id",
            "work_plan",
            "company",
            "employee_membership",
            "project",
            "work_date",
            "start_time",
            "end_time",
            "planned_hours",
            "task_name",
            "notes",
            "status",
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

    def validate(self, attrs):
        work_plan = attrs.get("work_plan", getattr(self.instance, "work_plan", None))
        company = attrs.get("company", getattr(self.instance, "company", None))
        employee_membership = attrs.get(
            "employee_membership", getattr(self.instance, "employee_membership", None)
        )
        project = attrs.get("project", getattr(self.instance, "project", None))
        work_date = attrs.get("work_date", getattr(self.instance, "work_date", None))
        start_time = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end_time = attrs.get("end_time", getattr(self.instance, "end_time", None))
        planned_hours = attrs.get("planned_hours", getattr(self.instance, "planned_hours", None))
        task_name = attrs.get("task_name")
        notes = attrs.get("notes")

        errors = {}

        if work_plan and company and work_plan.company_id != company.id:
            errors["company"] = "Company must match the selected work plan."

        if employee_membership and company:
            if employee_membership.company_id != company.id:
                errors["employee_membership"] = "Employee membership does not belong to this company."
            elif not employee_membership.is_active:
                errors["employee_membership"] = "Employee membership must be active."

        if project and company:
            if project.company_id != company.id:
                errors["project"] = "Project does not belong to this company."

        if work_plan and work_date:
            if work_date < work_plan.period_start or work_date > work_plan.period_end:
                errors["work_date"] = "Work date must be inside the work plan period."

        if start_time and end_time and start_time >= end_time:
            errors["end_time"] = "End time must be after start time."

        if planned_hours is not None and planned_hours < 0:
            errors["planned_hours"] = "Planned hours cannot be negative."

        if task_name is not None:
            attrs["task_name"] = task_name.strip()

        if notes is not None:
            attrs["notes"] = notes.strip()

        if errors:
            raise serializers.ValidationError(errors)

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