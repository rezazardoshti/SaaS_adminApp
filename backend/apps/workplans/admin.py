# apps/workplans/admin.py

from django.contrib import admin

from .models import WorkPlan, WorkPlanItem, WorkPlanPublicIDSequence


class WorkPlanItemInline(admin.TabularInline):
    model = WorkPlanItem
    extra = 0
    fields = (
        "public_id",
        "employee_membership",
        "project",
        "work_date",
        "start_time",
        "end_time",
        "planned_hours",
        "task_name",
        "status",
        "is_active",
    )
    readonly_fields = ("public_id",)


@admin.register(WorkPlan)
class WorkPlanAdmin(admin.ModelAdmin):
    ordering = ("-period_start", "-created_at")

    list_display = (
        "public_id",
        "company",
        "calendar_week",
        "period_start",
        "period_end",
        "status",
        "is_active",
        "created_at",
    )

    list_filter = (
        "status",
        "is_active",
        "company",
        "calendar_week",
        "created_at",
    )

    search_fields = (
        "public_id",
        "company__company_name",
        "notes",
    )

    readonly_fields = (
        "public_id",
        "published_at",
        "published_by",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )

    fieldsets = (
        ("Basisdaten", {
            "fields": (
                "public_id",
                "company",
                "calendar_week",
                "period_start",
                "period_end",
                "status",
                "is_active",
            )
        }),
        ("Notizen", {
            "fields": (
                "notes",
            )
        }),
        ("Audit", {
            "fields": (
                "published_by",
                "published_at",
                "created_by",
                "updated_by",
                "created_at",
                "updated_at",
            )
        }),
    )

    inlines = [WorkPlanItemInline]


@admin.register(WorkPlanItem)
class WorkPlanItemAdmin(admin.ModelAdmin):
    ordering = ("work_date", "start_time", "created_at")

    list_display = (
        "public_id",
        "work_plan",
        "company",
        "employee_membership",
        "project",
        "work_date",
        "start_time",
        "end_time",
        "planned_hours",
        "status",
        "is_active",
    )

    list_filter = (
        "status",
        "is_active",
        "company",
        "work_date",
        "project",
    )

    search_fields = (
        "public_id",
        "task_name",
        "notes",
        "company__company_name",
        "project__name",
        "employee_membership__user__email",
        "employee_membership__user__first_name",
        "employee_membership__user__last_name",
    )

    readonly_fields = (
        "public_id",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )

    fieldsets = (
        ("Basisdaten", {
            "fields": (
                "public_id",
                "work_plan",
                "company",
                "employee_membership",
                "project",
                "work_date",
                "status",
                "is_active",
            )
        }),
        ("Zeitplanung", {
            "fields": (
                "start_time",
                "end_time",
                "planned_hours",
            )
        }),
        ("Task / Notizen", {
            "fields": (
                "task_name",
                "notes",
            )
        }),
        ("Audit", {
            "fields": (
                "created_by",
                "updated_by",
                "created_at",
                "updated_at",
            )
        }),
    )


@admin.register(WorkPlanPublicIDSequence)
class WorkPlanPublicIDSequenceAdmin(admin.ModelAdmin):
    list_display = (
        "key",
        "last_value",
        "updated_at",
    )
    readonly_fields = ("updated_at",)