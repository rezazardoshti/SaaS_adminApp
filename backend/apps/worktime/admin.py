# apps/worktime/admin.py

from django.contrib import admin

from .models import WorkTimeEntry, WorkTimePublicIDSequence


@admin.register(WorkTimePublicIDSequence)
class WorkTimePublicIDSequenceAdmin(admin.ModelAdmin):
    list_display = ("company", "last_value")
    search_fields = ("company__name",)
    readonly_fields = ("last_value",)


@admin.register(WorkTimeEntry)
class WorkTimeEntryAdmin(admin.ModelAdmin):
    ordering = ("-work_date", "-started_at", "-created_at")

    list_display = (
        "public_id",
        "company",
        "employee_membership",
        "project",
        "entry_type",
        "status",
        "work_date",
        "started_at",
        "ended_at",
        "break_minutes",
        "duration_minutes_display",
        "is_active",
        "created_at",
    )

    list_filter = (
        "entry_type",
        "status",
        "is_active",
        "company",
        "work_date",
        "created_at",
    )

    search_fields = (
        "public_id",
        "title",
        "description",
        "employee_membership__user__first_name",
        "employee_membership__user__last_name",
        "employee_membership__user__email",
        "company__name",
        "project__name",
    )

    readonly_fields = (
        "public_id",
        "submitted_at",
        "approved_at",
        "rejected_at",
        "created_at",
        "updated_at",
        "duration_minutes_display",
        "duration_hours_display",
    )

    autocomplete_fields = (
        "company",
        "employee_membership",
        "project",
        "approved_by",
        "rejected_by",
    )

    fieldsets = (
        (
            "Basis",
            {
                "fields": (
                    "public_id",
                    "company",
                    "employee_membership",
                    "project",
                    "entry_type",
                    "status",
                    "is_active",
                )
            },
        ),
        (
            "Zeitdaten",
            {
                "fields": (
                    "work_date",
                    "started_at",
                    "ended_at",
                    "break_minutes",
                    "duration_minutes_display",
                    "duration_hours_display",
                )
            },
        ),
        (
            "Inhalt",
            {
                "fields": (
                    "title",
                    "description",
                    "internal_note",
                )
            },
        ),
        (
            "Freigabe / Prüfung",
            {
                "fields": (
                    "submitted_at",
                    "approved_at",
                    "approved_by",
                    "rejected_at",
                    "rejected_by",
                )
            },
        ),
        (
            "System",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    def duration_minutes_display(self, obj):
        return obj.duration_minutes

    duration_minutes_display.short_description = "Duration (minutes)"

    def duration_hours_display(self, obj):
        return obj.duration_hours

    duration_hours_display.short_description = "Duration (hours)"