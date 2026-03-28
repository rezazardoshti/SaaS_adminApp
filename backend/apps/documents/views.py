from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.companies.models import CompanyMembership
from .models import Document
from .serializers import (
    DocumentListSerializer,
    DocumentDetailSerializer,
    DocumentCreateUpdateSerializer,
)


class DocumentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Document.objects.none()

    def get_queryset(self):
        user = self.request.user

        queryset = Document.objects.select_related(
            "company",
            "employee_membership",
            "employee_membership__user",
            "uploaded_by",
        ).filter(is_active=True)

        if user.is_superuser:
            queryset = queryset
        else:
            memberships = CompanyMembership.objects.filter(
                user=user,
                is_active=True,
            )

            queryset = queryset.filter(
                company__memberships__in=memberships
            ).distinct()

        company = self.request.query_params.get("company")
        employee_membership = self.request.query_params.get("employee_membership")
        category = self.request.query_params.get("category")
        visibility = self.request.query_params.get("visibility")
        mine = self.request.query_params.get("mine")

        if company:
            queryset = queryset.filter(company_id=company)

        if employee_membership:
            queryset = queryset.filter(employee_membership_id=employee_membership)

        if category:
            queryset = queryset.filter(category=category)

        if visibility:
            queryset = queryset.filter(visibility=visibility)

        if str(mine).lower() in ["1", "true", "yes"]:
            queryset = queryset.filter(employee_membership__user=user)

        return queryset.order_by("-created_at")

    def get_serializer_class(self):
        if self.action == "list":
            return DocumentListSerializer

        if self.action == "retrieve":
            return DocumentDetailSerializer

        if self.action in ["create", "update", "partial_update"]:
            return DocumentCreateUpdateSerializer

        return DocumentDetailSerializer

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        if not request.user.is_superuser:
            membership = CompanyMembership.objects.filter(
                user=request.user,
                company=instance.company,
                is_active=True,
            ).first()

            if not membership:
                return Response(
                    {"detail": "Permission denied."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            if membership.role not in [
                CompanyMembership.Role.OWNER,
                CompanyMembership.Role.ADMIN,
            ]:
                return Response(
                    {"detail": "Only owner or admin can delete documents."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        instance.is_active = False
        instance.save(update_fields=["is_active"])

        return Response(status=status.HTTP_204_NO_CONTENT)