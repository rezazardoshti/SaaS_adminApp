from django.contrib import admin

from .models import Project, ProjectPublicIDSequence


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    ordering = ("-created_at",)

    list_display = (
        "public_id",
        "project_number",
        "name",
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
        "created_at",
    )

    search_fields = (
        "public_id",
        "project_number",
        "name",
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

    fieldsets = (
        ("Basisdaten", {
            "fields": (
                "public_id",
                "project_number",
                "company",
                "customer",
                "name",
                "status",
                "is_active",
            )
        }),
        ("Beschreibung", {
            "fields": ("description",)
        }),
        ("Projektzeitraum", {
            "fields": (
                "start_date",
                "end_date",
            )
        }),
        ("Finanzen", {
            "fields": ("budget",)
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