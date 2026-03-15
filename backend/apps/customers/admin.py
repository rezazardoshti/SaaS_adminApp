from django.contrib import admin

from .models import Customer, CustomerPublicIDSequence


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    ordering = ("company__company_name", "name")
    list_display = (
        "public_id",
        "name",
        "customer_number",
        "company",
        "contact_person",
        "email",
        "phone",
        "city",
        "country",
        "is_active",
        "created_at",
    )
    list_filter = (
        "is_active",
        "country",
        "company",
        "created_at",
        "updated_at",
    )
    search_fields = (
        "public_id",
        "name",
        "customer_number",
        "contact_person",
        "email",
        "phone",
        "city",
        "postal_code",
        "company__public_id",
        "company__company_name",
    )
    readonly_fields = (
        "public_id",
        "customer_number",
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
                "name",
                "customer_number",
                "is_active",
            )
        }),
        ("Kontakt", {
            "fields": (
                "contact_person",
                "email",
                "phone",
            )
        }),
        ("Adresse", {
            "fields": (
                "street",
                "house_number",
                "postal_code",
                "city",
                "country",
            )
        }),
        ("Steuerdaten", {
            "fields": (
                "tax_number",
                "vat_id",
            )
        }),
        ("Notizen", {
            "fields": (
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


@admin.register(CustomerPublicIDSequence)
class CustomerPublicIDSequenceAdmin(admin.ModelAdmin):
    list_display = ("key", "last_value", "updated_at")
    readonly_fields = ("updated_at",)