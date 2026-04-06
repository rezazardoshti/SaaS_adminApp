from django.contrib import admin

from .models import Project, ProjectPublicIDSequence, ProjectType


@admin.register(ProjectType)
class ProjectTypeAdmin(admin.ModelAdmin):
    ordering = ("company", "sort_order", "name")
    list_display = (
        "name",
        "company",
        "sort_order",
        "is_active",
        "created_at",
        "updated_at",
    )
    list_filter = (
        "is_active",
        "company",
        "created_at",
    )
    search_fields = (
        "name",
        "description",
        "company__company_name",
        "company__public_id",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    fieldsets = (
        ("Basisdaten", {
            "fields": (
                "company",
                "name",
                "description",
            )
        }),
        ("Anzeige", {
            "fields": (
                "sort_order",
                "is_active",
            )
        }),
        ("Audit", {
            "fields": (
                "created_at",
                "updated_at",
            )
        }),
    )


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    ordering = ("-created_at",)
    list_display = (
        "public_id",
        "project_number",
        "name",
        "project_type",
        "site_location",
        "company",
        "customer",
        "status",
        "start_date",
        "end_date",
        "is_active",
        "created_at",
    )
    list_filter = (
        "status",
        "is_active",
        "company",
        "project_type",
        "created_at",
    )
    search_fields = (
        "public_id",
        "project_number",
        "name",
        "site_location",
        "project_type__name",
        "customer__name",
        "company__company_name",
    )
    readonly_fields = (
        "public_id",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )
    autocomplete_fields = (
        "company",
        "customer",
        "project_type",
    )
    fieldsets = (
        ("Basisdaten", {
            "fields": (
                "public_id",
                "project_number",
                "company",
                "customer",
                "name",
                "project_type",
                "site_location",
                "status",
                "is_active",
            )
        }),
        ("Beschreibung", {
            "fields": (
                "description",
            )
        }),
        ("Projektzeitraum", {
            "fields": (
                "start_date",
                "end_date",
            )
        }),
        ("Finanzen", {
            "fields": (
                "budget",
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

    def save_model(self, request, obj, form, change):
        if not obj.created_by:
            obj.created_by = request.user
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(ProjectPublicIDSequence)
class ProjectPublicIDSequenceAdmin(admin.ModelAdmin):
    list_display = (
        "key",
        "last_value",
        "updated_at",
    )
    readonly_fields = ("updated_at",)