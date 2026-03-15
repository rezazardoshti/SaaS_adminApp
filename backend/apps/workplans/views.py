# apps/workplans/views.py

from django.db.models import Count, Q
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone
from apps.companies.models import CompanyMembership

from .models import WorkPlan, WorkPlanItem
from .serializers import (
    WorkPlanCreateUpdateSerializer,
    WorkPlanDetailSerializer,
    WorkPlanItemCreateUpdateSerializer,
    WorkPlanItemDetailSerializer,
    WorkPlanItemListSerializer,
    WorkPlanListSerializer,
)


class WorkPlanViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "public_id"

    def get_queryset(self):
        user = self.request.user

        queryset = (
            WorkPlan.objects.select_related(
                "company",
                "created_by",
                "updated_by",
            )
            .annotate(item_count=Count("items"))
            .order_by("-period_start", "-created_at")
        )

        if user.is_superuser:
            company_public_id = self.request.query_params.get("company", "").strip()
            status_value = self.request.query_params.get("status", "").strip()
            search = self.request.query_params.get("search", "").strip()

            if company_public_id:
                queryset = queryset.filter(company__public_id=company_public_id)

            if status_value:
                queryset = queryset.filter(status=status_value)

            if search:
                queryset = queryset.filter(
                    Q(public_id__icontains=search)
                    | Q(company__company_name__icontains=search)
                    | Q(notes__icontains=search)
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

        status_value = self.request.query_params.get("status", "").strip()
        if status_value:
            queryset = queryset.filter(status=status_value)

        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(public_id__icontains=search)
                | Q(notes__icontains=search)
            )

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return WorkPlanListSerializer
        if self.action == "retrieve":
            return WorkPlanDetailSerializer
        return WorkPlanCreateUpdateSerializer

    def perform_create(self, serializer):
        user = self.request.user
        company = serializer.validated_data["company"]
        status_value = serializer.validated_data.get("status", "draft")

        if not user.is_superuser:
            membership_exists = CompanyMembership.objects.filter(
                company=company,
                user=user,
                is_active=True,
            ).exists()

            if not membership_exists:
                raise PermissionDenied("You cannot create work plans for this company.")

        extra_data = {
            "created_by": user,
            "updated_by": user,
        }

        if status_value == "published":
            extra_data["published_by"] = user
            extra_data["published_at"] = timezone.now()

        serializer.save(**extra_data)

    def perform_update(self, serializer):
        user = self.request.user
        instance = serializer.instance
        company = serializer.validated_data.get("company", instance.company)
        new_status = serializer.validated_data.get("status", instance.status)

        if not user.is_superuser:
            membership_exists = CompanyMembership.objects.filter(
                company=company,
                user=user,
                is_active=True,
            ).exists()

            if not membership_exists:
                raise PermissionDenied("You cannot update work plans for this company.")

        if instance.status == "published" and new_status != "published":
            raise PermissionDenied("Published work plans cannot be changed back to another status.")

        extra_data = {
            "updated_by": user,
        }

        if instance.status != "published" and new_status == "published":
            extra_data["published_by"] = user
            extra_data["published_at"] = timezone.now()

        serializer.save(**extra_data)

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
            raise PermissionDenied("You cannot delete work plans from this company.")

        instance.delete()


class WorkPlanItemViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "public_id"

    def get_queryset(self):
        user = self.request.user

        queryset = WorkPlanItem.objects.select_related(
            "work_plan",
            "company",
            "employee_membership",
            "employee_membership__user",
            "project",
            "created_by",
            "updated_by",
        ).order_by("work_date", "start_time", "created_at")

        if user.is_superuser:
            company_public_id = self.request.query_params.get("company", "").strip()
            work_plan_public_id = self.request.query_params.get("work_plan", "").strip()
            project_public_id = self.request.query_params.get("project", "").strip()
            employee_membership_public_id = self.request.query_params.get("employee_membership", "").strip()
            status_value = self.request.query_params.get("status", "").strip()
            work_date = self.request.query_params.get("work_date", "").strip()
            search = self.request.query_params.get("search", "").strip()

            if company_public_id:
                queryset = queryset.filter(company__public_id=company_public_id)

            if work_plan_public_id:
                queryset = queryset.filter(work_plan__public_id=work_plan_public_id)

            if project_public_id:
                queryset = queryset.filter(project__public_id=project_public_id)

            if employee_membership_public_id:
                queryset = queryset.filter(employee_membership__public_id=employee_membership_public_id)

            if status_value:
                queryset = queryset.filter(status=status_value)

            if work_date:
                queryset = queryset.filter(work_date=work_date)

            if search:
                queryset = queryset.filter(
                    Q(public_id__icontains=search)
                    | Q(task_name__icontains=search)
                    | Q(notes__icontains=search)
                    | Q(project__name__icontains=search)
                    | Q(company__company_name__icontains=search)
                    | Q(employee_membership__user__email__icontains=search)
                    | Q(employee_membership__user__first_name__icontains=search)
                    | Q(employee_membership__user__last_name__icontains=search)
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

        work_plan_public_id = self.request.query_params.get("work_plan", "").strip()
        if work_plan_public_id:
            queryset = queryset.filter(work_plan__public_id=work_plan_public_id)

        project_public_id = self.request.query_params.get("project", "").strip()
        if project_public_id:
            queryset = queryset.filter(project__public_id=project_public_id)

        employee_membership_public_id = self.request.query_params.get("employee_membership", "").strip()
        if employee_membership_public_id:
            queryset = queryset.filter(employee_membership__public_id=employee_membership_public_id)

        status_value = self.request.query_params.get("status", "").strip()
        if status_value:
            queryset = queryset.filter(status=status_value)

        work_date = self.request.query_params.get("work_date", "").strip()
        if work_date:
            queryset = queryset.filter(work_date=work_date)

        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(public_id__icontains=search)
                | Q(task_name__icontains=search)
                | Q(notes__icontains=search)
                | Q(project__name__icontains=search)
                | Q(employee_membership__user__email__icontains=search)
                | Q(employee_membership__user__first_name__icontains=search)
                | Q(employee_membership__user__last_name__icontains=search)
            )

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return WorkPlanItemListSerializer
        if self.action == "retrieve":
            return WorkPlanItemDetailSerializer
        return WorkPlanItemCreateUpdateSerializer

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
                raise PermissionDenied("You cannot create work plan items for this company.")

        serializer.save(created_by=user, updated_by=user)

    def perform_update(self, serializer):
        user = self.request.user
        company = serializer.validated_data.get("company", serializer.instance.company)

        if not user.is_superuser:
            membership_exists = CompanyMembership.objects.filter(
                company=company,
                user=user,
                is_active=True,
            ).exists()

            if not membership_exists:
                raise PermissionDenied("You cannot update work plan items for this company.")

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
            raise PermissionDenied("You cannot delete work plan items from this company.")

        instance.delete()