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


class IsCompanyAdminOrOwner:
    @staticmethod
    def check(user, company):
        if user.is_superuser:
            return True

        return CompanyMembership.objects.filter(
            company=company,
            user=user,
            is_active=True,
            role__in=["owner", "admin"],
        ).exists()


class ProjectTypeViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProjectTypeSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = ProjectType.objects.select_related("company").order_by(
            "sort_order", "name"
        )

        company_public_id = self.request.query_params.get("company", "").strip()
        search = self.request.query_params.get("search", "").strip()
        is_active = self.request.query_params.get("is_active", "").strip().lower()

        if user.is_superuser:
            if company_public_id:
                queryset = queryset.filter(company__public_id=company_public_id)
        else:
            admin_company_ids = CompanyMembership.objects.filter(
                user=user,
                is_active=True,
                role__in=["owner", "admin"],
            ).values_list("company_id", flat=True)
            queryset = queryset.filter(company_id__in=admin_company_ids)

            if company_public_id:
                queryset = queryset.filter(company__public_id=company_public_id)

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(description__icontains=search)
                | Q(company__company_name__icontains=search)
                | Q(company__public_id__icontains=search)
            )

        if is_active in {"true", "1", "yes"}:
            queryset = queryset.filter(is_active=True)
        elif is_active in {"false", "0", "no"}:
            queryset = queryset.filter(is_active=False)

        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        company = serializer.validated_data["company"]

        if not IsCompanyAdminOrOwner.check(user, company):
            raise PermissionDenied(
                "You cannot create project types for this company."
            )

        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        company = serializer.validated_data.get("company", serializer.instance.company)

        if not IsCompanyAdminOrOwner.check(user, company):
            raise PermissionDenied(
                "You cannot update project types for this company."
            )

        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user

        if not IsCompanyAdminOrOwner.check(user, instance.company):
            raise PermissionDenied(
                "You cannot delete project types from this company."
            )

        if instance.projects.exists():
            raise PermissionDenied(
                "This project type is already used by existing projects and cannot be deleted."
            )

        instance.delete()


class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "public_id"

    def get_queryset(self):
        user = self.request.user
        queryset = Project.objects.select_related(
            "company",
            "customer",
            "project_type",
            "created_by",
            "updated_by",
        ).order_by("-created_at")

        company_public_id = self.request.query_params.get("company", "").strip()
        search = self.request.query_params.get("search", "").strip()
        status_value = self.request.query_params.get("status", "").strip()
        project_type_id = self.request.query_params.get("project_type", "").strip()
        is_active = self.request.query_params.get("is_active", "").strip().lower()

        if user.is_superuser:
            if company_public_id:
                queryset = queryset.filter(company__public_id=company_public_id)
        else:
            membership_company_ids = CompanyMembership.objects.filter(
                user=user,
                is_active=True,
            ).values_list("company_id", flat=True)
            queryset = queryset.filter(company_id__in=membership_company_ids)

            if company_public_id:
                queryset = queryset.filter(company__public_id=company_public_id)

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

        if status_value:
            queryset = queryset.filter(status=status_value)

        if project_type_id:
            queryset = queryset.filter(project_type_id=project_type_id)

        if is_active in {"true", "1", "yes"}:
            queryset = queryset.filter(is_active=True)
        elif is_active in {"false", "0", "no"}:
            queryset = queryset.filter(is_active=False)

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

        if not user.is_superuser:
            membership_exists = CompanyMembership.objects.filter(
                company=company,
                user=user,
                is_active=True,
            ).exists()
            if not membership_exists:
                raise PermissionDenied(
                    "You cannot create projects for this company."
                )

        serializer.save(
            created_by=user,
            updated_by=user,
        )

    def perform_update(self, serializer):
        user = self.request.user
        company = serializer.validated_data.get(
            "company",
            serializer.instance.company,
        )

        if not user.is_superuser:
            membership_exists = CompanyMembership.objects.filter(
                company=company,
                user=user,
                is_active=True,
            ).exists()
            if not membership_exists:
                raise PermissionDenied(
                    "You cannot update projects for this company."
                )

        serializer.save(updated_by=user)

    def perform_destroy(self, instance):
        user = self.request.user

        if user.is_superuser:
            instance.delete()
            return

        membership_exists = CompanyMembership.objects.filter(
            company=instance.company,
            user=user,
            is_active=True,
        ).exists()
        if not membership_exists:
            raise PermissionDenied(
                "You cannot delete projects from this company."
            )

        instance.delete()