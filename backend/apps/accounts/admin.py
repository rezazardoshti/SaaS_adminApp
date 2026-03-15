from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User, PublicIDSequence
from apps.companies.models import CompanyMembership


class CompanyMembershipInline(admin.TabularInline):
    model = CompanyMembership
    fk_name = "user"
    extra = 0
    autocomplete_fields = ["company"]
    fields = ("company", "role", "is_active", "joined_at", "updated_at")
    readonly_fields = ("joined_at", "updated_at")
    verbose_name = "Firmenzuordnung"
    verbose_name_plural = "Firmenzuordnungen"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("-created_at",)
    inlines = [CompanyMembershipInline]

    list_display = (
        "public_id",
        "email",
        "first_name",
        "last_name",
        "get_companies",
        "get_roles",
        "is_staff",
        "is_superuser",
        "is_active",
        "created_at",
    )

    list_filter = (
        "is_staff",
        "is_superuser",
        "is_active",
        "is_email_verified",
        "gender",
        "country",
    )

    search_fields = (
        "public_id",
        "email",
        "first_name",
        "last_name",
        "phone",
    )

    readonly_fields = (
        "public_id",
        "last_login",
        "last_login_at",
        "email_verified_at",
        "created_at",
        "updated_at",
    )

    fieldsets = (
        ("Login", {
            "fields": ("email", "password", "public_id")
        }),
        ("Persönliche Daten", {
            "fields": (
                "first_name",
                "last_name",
                "gender",
                "phone",
                "birth_date",
                "profile_image",
                "document",
            )
        }),
        ("Adresse", {
            "fields": ("street", "postal_code", "city", "country")
        }),
        ("Notfallkontakt", {
            "fields": ("emergency_contact_person", "emergency_contact_phone")
        }),
        ("Status & Rechte", {
            "fields": (
                "is_active",
                "is_staff",
                "is_superuser",
                "is_email_verified",
                "groups",
                "user_permissions",
            )
        }),
        ("Zeitstempel", {
            "fields": (
                "last_login",
                "last_login_at",
                "email_verified_at",
                "created_at",
                "updated_at",
            )
        }),
        ("Intern", {
            "fields": ("notes",)
        }),
    )

    add_fieldsets = (
        ("Neuen Benutzer anlegen", {
            "classes": ("wide",),
            "fields": (
                "email",
                "password1",
                "password2",
                "first_name",
                "last_name",
                "is_staff",
                "is_superuser",
                "is_active",
            ),
        }),
    )

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.prefetch_related("company_memberships__company")

    @admin.display(description="Firmen")
    def get_companies(self, obj):
        companies = obj.company_memberships.select_related("company").all()
        return ", ".join(
            [
                f"{membership.company.public_id} - {membership.company.company_name}"
                for membership in companies
            ]
        ) or "-"

    @admin.display(description="Rollen")
    def get_roles(self, obj):
        roles = obj.company_memberships.all()
        return ", ".join([membership.role for membership in roles]) or "-"


@admin.register(PublicIDSequence)
class PublicIDSequenceAdmin(admin.ModelAdmin):
    list_display = ("key", "last_value", "updated_at")
    readonly_fields = ("updated_at",)