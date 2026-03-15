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
        )

        if user.is_superuser:
            return queryset.filter(is_active=True)

        memberships = CompanyMembership.objects.filter(
            user=user,
            is_active=True,
        )

        queryset = queryset.filter(
            company__memberships__in=memberships
        )

        queryset = queryset.filter(is_active=True).distinct()

        mine = self.request.query_params.get("mine")

        if str(mine).lower() in ["1", "true", "yes"]:
            queryset = queryset.filter(
                employee_membership__user=user
            )

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
