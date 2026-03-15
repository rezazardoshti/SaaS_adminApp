from django.contrib import admin

from .models import Document, DocumentPublicIDSequence


@admin.register(DocumentPublicIDSequence)
class DocumentPublicIDSequenceAdmin(admin.ModelAdmin):
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

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "employee_membership",
                "employee_membership__user",
                "employee_membership__company",
            )
        )


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    ordering = ("-created_at",)

    list_display = (
        "public_id",
        "title",
        "company",
        "employee_membership",
        "category",
        "visibility",
        "uploaded_by",
        "file_size",
        "is_active",
        "created_at",
    )

    list_filter = (
        "category",
        "visibility",
        "is_active",
        "company",
        "created_at",
    )

    search_fields = (
        "public_id",
        "title",
        "description",
        "original_filename",
        "mime_type",
        "company__company_name",
        "company__public_id",
        "employee_membership__employee_number",
        "employee_membership__user__email",
        "employee_membership__user__first_name",
        "employee_membership__user__last_name",
        "uploaded_by__email",
        "uploaded_by__first_name",
        "uploaded_by__last_name",
    )

    readonly_fields = (
        "public_id",
        "original_filename",
        "file_size",
        "created_at",
        "updated_at",
    )

    autocomplete_fields = (
        "company",
        "employee_membership",
        "uploaded_by",
    )

    fieldsets = (
        (
            "Basic Information",
            {
                "fields": (
                    "public_id",
                    "title",
                    "description",
                    "company",
                    "employee_membership",
                    "uploaded_by",
                )
            },
        ),
        (
            "Document Settings",
            {
                "fields": (
                    "category",
                    "visibility",
                    "file",
                    "original_filename",
                    "file_size",
                    "mime_type",
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
                "uploaded_by",
            )
        )
