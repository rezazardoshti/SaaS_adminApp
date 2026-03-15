from django.db.models import Prefetch
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Company, CompanyMembership
from .permissions import (
    HasCompanyAccess,
    IsCompanyOwner,
    IsCompanyOwnerOrAdmin,
)
from .serializers import (
    CompanyCreateSerializer,
    CompanyDetailSerializer,
    CompanyListSerializer,
    CompanyUpdateSerializer,
)


class CompanyListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        base_queryset = (
            Company.objects
            .select_related("owner_user")
            .prefetch_related(
                Prefetch(
                    "memberships",
                    queryset=CompanyMembership.objects.select_related("user", "company"),
                )
            )
        )

        if user.is_superuser:
            return base_queryset.order_by("-created_at")

        return (
            base_queryset
            .filter(memberships__user=user, memberships__is_active=True)
            .distinct()
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CompanyCreateSerializer
        return CompanyListSerializer

    def perform_create(self, serializer):
        serializer.save()


class CompanyRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    lookup_field = "pk"

    def get_queryset(self):
        return (
            Company.objects
            .select_related("owner_user")
            .prefetch_related(
                Prefetch(
                    "memberships",
                    queryset=CompanyMembership.objects.select_related("user", "company").order_by(
                        "role", "user__first_name", "user__last_name"
                    ),
                )
            )
        )

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            permission_classes = [permissions.IsAuthenticated, HasCompanyAccess]
        else:
            permission_classes = [permissions.IsAuthenticated, IsCompanyOwnerOrAdmin]

        return [permission() for permission in permission_classes]

    def get_company(self):
        return self.get_object()

    def get_serializer_class(self):
        if self.request.method in permissions.SAFE_METHODS:
            return CompanyDetailSerializer
        return CompanyUpdateSerializer


class CompanyActivateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCompanyOwner]

    def get_company(self):
        return Company.objects.select_related("owner_user").get(pk=self.kwargs["pk"])

    def post(self, request, pk):
        company = self.get_company()

        if company.is_active:
            return Response(
                {"detail": "Die Firma ist bereits aktiv."},
                status=status.HTTP_200_OK,
            )

        company.is_active = True
        company.save(update_fields=["is_active", "updated_at"])

        return Response(
            {"detail": "Die Firma wurde aktiviert."},
            status=status.HTTP_200_OK,
        )


class CompanyDeactivateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCompanyOwner]

    def get_company(self):
        return Company.objects.select_related("owner_user").get(pk=self.kwargs["pk"])

    def post(self, request, pk):
        company = self.get_company()

        if not company.is_active:
            return Response(
                {"detail": "Die Firma ist bereits deaktiviert."},
                status=status.HTTP_200_OK,
            )

        company.is_active = False
        company.save(update_fields=["is_active", "updated_at"])

        return Response(
            {"detail": "Die Firma wurde deaktiviert."},
            status=status.HTTP_200_OK,
        )


class CompanyDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsCompanyOwner]

    def get_company(self):
        return (
            Company.objects
            .select_related("owner_user")
            .prefetch_related("memberships")
            .get(pk=self.kwargs["pk"])
        )

    def delete(self, request, pk):
        company = self.get_company()
        company_name = company.company_name
        company.delete()

        return Response(
            {"detail": f"Die Firma '{company_name}' wurde gelöscht."},
            status=status.HTTP_200_OK,
        )