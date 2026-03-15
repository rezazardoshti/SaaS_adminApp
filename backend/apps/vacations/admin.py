from django.contrib import admin

from .models import VacationBalance, VacationPublicIDSequence, VacationRequest


@admin.register(VacationPublicIDSequence)
class VacationPublicIDSequenceAdmin(admin.ModelAdmin):
    list_display = (
        "employee_membership",
        "last_value",
    )
    search_fields = (
        "employee_membership__employee_number",
        "employee_membership__user__email",
        "employee_membership__user__first_name",
        "employee_membership__user__last_name",
        "employee_membership__company__company_name",
        "employee_membership__company__public_id",
    )
    ordering = (
        "employee_membership__company__company_name",
        "employee_membership__employee_number",
    )


@admin.register(VacationRequest)
class VacationRequestAdmin(admin.ModelAdmin):
    ordering = ("-created_at",)

    list_display = (
        "public_id",
        "company",
        "employee_membership",
        "leave_type",
        "status",
        "start_date",
        "end_date",
        "requested_days",
        "requested_by",
        "approved_by",
        "is_active",
        "created_at",
    )

    list_filter = (
        "leave_type",
        "status",
        "is_active",
        "company",
        "start_date",
        "end_date",
        "created_at",
    )

    search_fields = (
        "public_id",
        "reason",
        "employee_note",
        "manager_note",
        "company__company_name",
        "company__public_id",
        "employee_membership__employee_number",
        "employee_membership__user__email",
        "employee_membership__user__first_name",
        "employee_membership__user__last_name",
        "requested_by__email",
        "requested_by__first_name",
        "requested_by__last_name",
        "approved_by__email",
        "approved_by__first_name",
        "approved_by__last_name",
    )

    readonly_fields = (
        "public_id",
        "requested_days",
        "approved_at",
        "rejected_at",
        "cancelled_at",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "company",
        "employee_membership",
        "requested_by",
        "approved_by",
    )

    fieldsets = (
        (
            "Basic Information",
            {
                "fields": (
                    "public_id",
                    "company",
                    "employee_membership",
                    "requested_by",
                )
            },
        ),
        (
            "Vacation Details",
            {
                "fields": (
                    "leave_type",
                    "status",
                    "start_date",
                    "end_date",
                    "is_half_day_start",
                    "is_half_day_end",
                    "requested_days",
                )
            },
        ),
        (
            "Notes",
            {
                "fields": (
                    "reason",
                    "employee_note",
                    "manager_note",
                )
            },
        ),
        (
            "Approval",
            {
                "fields": (
                    "approved_by",
                    "approved_at",
                    "rejected_at",
                    "cancelled_at",
                )
            },
        ),
        (
            "System",
            {
                "fields": (
                    "is_active",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "company",
                "employee_membership",
                "employee_membership__user",
                "requested_by",
                "approved_by",
            )
        )


@admin.register(VacationBalance)
class VacationBalanceAdmin(admin.ModelAdmin):
    ordering = ("-year", "company__company_name")

    list_display = (
        "company",
        "employee_membership",
        "year",
        "entitled_days",
        "carried_over_days",
        "manual_adjustment_days",
        "total_available_days_display",
        "used_days_display",
        "remaining_days_display",
        "is_active",
        "created_at",
    )

    list_filter = (
        "year",
        "company",
        "is_active",
        "created_at",
    )

    search_fields = (
        "company__company_name",
        "company__public_id",
        "employee_membership__employee_number",
        "employee_membership__user__email",
        "employee_membership__user__first_name",
        "employee_membership__user__last_name",
        "note",
    )

    readonly_fields = (
        "total_available_days_display",
        "used_days_display",
        "remaining_days_display",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "company",
        "employee_membership",
    )

    fieldsets = (
        (
            "Basic Information",
            {
                "fields": (
                    "company",
                    "employee_membership",
                    "year",
                )
            },
        ),
        (
            "Balance",
            {
                "fields": (
                    "entitled_days",
                    "carried_over_days",
                    "manual_adjustment_days",
                    "total_available_days_display",
                    "used_days_display",
                    "remaining_days_display",
                )
            },
        ),
        (
            "Notes",
            {
                "fields": (
                    "note",
                )
            },
        ),
        (
            "System",
            {
                "fields": (
                    "is_active",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "company",
                "employee_membership",
                "employee_membership__user",
            )
        )

    @admin.display(description="Total Available Days")
    def total_available_days_display(self, obj):
        return obj.total_available_days

    @admin.display(description="Used Days")
    def used_days_display(self, obj):
        return obj.used_days

    @admin.display(description="Remaining Days")
    def remaining_days_display(self, obj):
        return obj.remaining_days