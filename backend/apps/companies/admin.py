from django.contrib import admin
from .models import Company, CompanyMembership, CompanyPublicIDSequence


class CompanyMembershipInline(admin.TabularInline):
    model = CompanyMembership
    extra = 0
    autocomplete_fields = ["user"]
    fields = (
        "user",
        "role",
        "employee_number",
        "job_title",
        "department",
        "contract_type",
        "employment_status",
        "entry_date",
        "exit_date",
        "weekly_target_hours",
        "monthly_target_hours",
        "hourly_wage",
        "vacation_days_per_year",
        "is_time_tracking_enabled",
        "can_manage_projects",
        "is_active",
    )
    readonly_fields = ("joined_at", "updated_at")


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    ordering = ("-created_at",)

    list_display = (
        "public_id",
        "company_name",
        "legal_form",
        "industry",
        "subscription_plan",
        "subscription_status",
        "employee_range",
        "owner_user",
        "is_active",
        "created_at",
    )

    list_filter = (
        "legal_form",
        "subscription_plan",
        "subscription_status",
        "employee_range",
        "is_active",
        "country",
    )

    search_fields = (
        "public_id",
        "company_name",
        "email",
        "vat_id",
        "tax_number",
    )

    readonly_fields = (
        "public_id",
        "created_at",
        "updated_at",
    )

    fieldsets = (
        ("Grunddaten", {
            "fields": (
                "public_id",
                "company_name",
                "legal_form",
                "industry",
                "employee_range",
                "owner_user",
            )
        }),

        ("Kontakt", {
            "fields": (
                "email",
                "phone",
                "website",
            )
        }),

        ("Adresse", {
            "fields": (
                "street",
                "postal_code",
                "city",
                "country",
            )
        }),

        ("Steuer & Register", {
            "fields": (
                "vat_id",
                "tax_number",
                "commercial_register",
            )
        }),

        ("Abo", {
            "fields": (
                "subscription_plan",
                "subscription_status",
                "trial_ends_at",
                "billing_email",
            )
        }),

        ("System", {
            "fields": (
                "timezone",
                "language",
                "logo",
                "is_active",
                "created_at",
                "updated_at",
            )
        }),
    )

    inlines = [CompanyMembershipInline]


@admin.register(CompanyMembership)
class CompanyMembershipAdmin(admin.ModelAdmin):
    ordering = ("company", "role")

    list_display = (
        "company",
        "user",
        "role",
        "employee_number",
        "contract_type",
        "employment_status",
        "weekly_target_hours",
        "hourly_wage",
        "vacation_days_per_year",
        "is_active",
        "joined_at",
    )

    list_filter = (
        "role",
        "contract_type",
        "employment_status",
        "is_active",
        "company",
    )

    search_fields = (
        "user__email",
        "user__first_name",
        "user__last_name",
        "employee_number",
        "company__company_name",
    )

    autocomplete_fields = (
        "user",
        "company",
    )

    readonly_fields = (
        "joined_at",
        "updated_at",
    )


@admin.register(CompanyPublicIDSequence)
class CompanyPublicIDSequenceAdmin(admin.ModelAdmin):
    list_display = (
        "key",
        "last_value",
        "updated_at",
    )

    readonly_fields = ("updated_at",)