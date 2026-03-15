from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied

from apps.companies.models import CompanyMembership

from .models import Project
from .serializers import (
    ProjectCreateUpdateSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
)


class ProjectViewSet(viewsets.ModelViewSet):

    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "public_id"

    def get_queryset(self):

        user = self.request.user

        queryset = Project.objects.select_related(
            "company",
            "customer",
            "created_by",
            "updated_by",
        ).order_by("-created_at")

        if user.is_superuser:
            search = self.request.query_params.get("search", "").strip()
            company_public_id = self.request.query_params.get("company", "").strip()

            if company_public_id:
                queryset = queryset.filter(company__public_id=company_public_id)

            if search:
                queryset = queryset.filter(
                    Q(public_id__icontains=search)
                    | Q(project_number__icontains=search)
                    | Q(name__icontains=search)
                    | Q(customer__name__icontains=search)
                    | Q(company__company_name__icontains=search)
                )

            return queryset

        membership_company_ids = CompanyMembership.objects.filter(
            user=user,
            is_active=True,
        ).values_list("company_id", flat=True)

        queryset = queryset.filter(company_id__in=membership_company_ids)

        company_public_id = self.request.query_params.get("company", "").strip()
        if company_public_id:
            queryset = queryset.filter(company__public_id=company_public_id)

        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(public_id__icontains=search)
                | Q(project_number__icontains=search)
                | Q(name__icontains=search)
                | Q(customer__name__icontains=search)
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