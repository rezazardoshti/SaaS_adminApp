from django.contrib import admin

from .forms import WorkTimeEntryForm
from .models import WorkTimeEntry, WorkTimePublicIDSequence


def format_minutes_as_hhmm(minutes):
    if minutes is None:
        return "-"

    try:
        total_minutes = int(minutes)
    except (TypeError, ValueError):
        return "-"

    hours = total_minutes // 60
    rest_minutes = total_minutes % 60
    return f"{hours:02d}:{rest_minutes:02d}"


@admin.register(WorkTimePublicIDSequence)
class WorkTimePublicIDSequenceAdmin(admin.ModelAdmin):
    list_display = ("company", "last_value")
    search_fields = ("company__company_name",)
    readonly_fields = ("last_value",)


@admin.register(WorkTimeEntry)
class WorkTimeEntryAdmin(admin.ModelAdmin):
    form = WorkTimeEntryForm

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
        "duration_display",
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
        "internal_note",
        "employee_membership__user__first_name",
        "employee_membership__user__last_name",
        "employee_membership__user__email",
        "company__company_name",
        "project__name",
    )

    readonly_fields = (
        "public_id",
        "submitted_at",
        "created_at",
        "updated_at",
        "duration_display",
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
                    "duration_display",
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

    def duration_display(self, obj):
        return format_minutes_as_hhmm(obj.duration_minutes)

    duration_display.short_description = "Duration (HH:MM)"

    def duration_hours_display(self, obj):
        return obj.duration_hours

    duration_hours_display.short_description = "Duration (hours)"