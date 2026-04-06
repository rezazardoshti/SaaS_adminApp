from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied

from apps.companies.models import CompanyMembership

from .models import Project, ProjectType
from .serializers import (
    ProjectCreateUpdateSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
    ProjectTypeSerializer,
)


class CompanyAdminAccessMixin:
    admin_roles = ("owner", "admin")

    def _admin_company_ids(self, user):
        if user.is_superuser:
            return None

        return CompanyMembership.objects.filter(
            user=user,
            is_active=True,
            role__in=self.admin_roles,
        ).values_list("company_id", flat=True)

    def _is_company_admin(self, user, company):
        if user.is_superuser:
            return True

        return CompanyMembership.objects.filter(
            company=company,
            user=user,
            is_active=True,
            role__in=self.admin_roles,
        ).exists()


class ProjectTypeViewSet(CompanyAdminAccessMixin, viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProjectTypeSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = (
            ProjectType.objects.select_related("company")
            .all()
            .order_by("sort_order", "name")
        )

        company_public_id = self.request.query_params.get("company", "").strip()
        is_active = self.request.query_params.get("is_active", "").strip().lower()
        search = self.request.query_params.get("search", "").strip()

        if not user.is_superuser:
            admin_company_ids = self._admin_company_ids(user)
            queryset = queryset.filter(company_id__in=admin_company_ids)

        if company_public_id:
            queryset = queryset.filter(company__public_id=company_public_id)

        if is_active in {"true", "1", "yes"}:
            queryset = queryset.filter(is_active=True)
        elif is_active in {"false", "0", "no"}:
            queryset = queryset.filter(is_active=False)

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(description__icontains=search)
                | Q(company__company_name__icontains=search)
                | Q(company__public_id__icontains=search)
            )

        return queryset

    def perform_create(self, serializer):
        company = serializer.validated_data["company"]

        if not self._is_company_admin(self.request.user, company):
            raise PermissionDenied(
                "Only admin/owner of this company can create project types."
            )

        serializer.save()

    def perform_update(self, serializer):
        company = serializer.validated_data.get("company", serializer.instance.company)

        if not self._is_company_admin(self.request.user, company):
            raise PermissionDenied(
                "Only admin/owner of this company can update project types."
            )

        serializer.save()

    def perform_destroy(self, instance):
        if not self._is_company_admin(self.request.user, instance.company):
            raise PermissionDenied(
                "Only admin/owner of this company can delete project types."
            )

        instance.delete()


class ProjectViewSet(CompanyAdminAccessMixin, viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "public_id"

    def get_queryset(self):
        user = self.request.user
        queryset = (
            Project.objects.select_related(
                "company",
                "customer",
                "project_type",
                "created_by",
                "updated_by",
            )
            .all()
            .order_by("-created_at")
        )

        company_public_id = self.request.query_params.get("company", "").strip()
        search = self.request.query_params.get("search", "").strip()
        status_value = self.request.query_params.get("status", "").strip()
        project_type_id = self.request.query_params.get("project_type", "").strip()
        is_active = self.request.query_params.get("is_active", "").strip().lower()

        if not user.is_superuser:
            admin_company_ids = self._admin_company_ids(user)
            queryset = queryset.filter(company_id__in=admin_company_ids)

        if company_public_id:
            queryset = queryset.filter(company__public_id=company_public_id)

        if status_value:
            queryset = queryset.filter(status=status_value)

        if project_type_id.isdigit():
            queryset = queryset.filter(project_type_id=int(project_type_id))

        if is_active in {"true", "1", "yes"}:
            queryset = queryset.filter(is_active=True)
        elif is_active in {"false", "0", "no"}:
            queryset = queryset.filter(is_active=False)

        if search:
            queryset = queryset.filter(
                Q(public_id__icontains=search)
                | Q(project_number__icontains=search)
                | Q(name__icontains=search)
                | Q(description__icontains=search)
                | Q(site_location__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(project_type__name__icontains=search)
                | Q(company__company_name__icontains=search)
            )

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return ProjectListSerializer
        if self.action == "retrieve":
            return ProjectDetailSerializer
        return ProjectCreateUpdateSerializer

    def perform_create(self, serializer):
        user = self.request.user
        company = serializer.validated_data["company"]

        if not self._is_company_admin(user, company):
            raise PermissionDenied(
                "Only admin/owner of this company can create projects."
            )

        serializer.save(
            created_by=user,
            updated_by=user,
        )

    def perform_update(self, serializer):
        user = self.request.user
        company = serializer.validated_data.get("company", serializer.instance.company)

        if not self._is_company_admin(user, company):
            raise PermissionDenied(
                "Only admin/owner of this company can update projects."
            )

        serializer.save(updated_by=user)

    def perform_destroy(self, instance):
        if not self._is_company_admin(self.request.user, instance.company):
            raise PermissionDenied(
                "Only admin/owner of this company can delete projects."
            )

        instance.delete()