from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import models

from .models import Company, CompanyMembership
from .membership_serializers import (
    MembershipCreateSerializer,
    MembershipDetailSerializer,
    MembershipListSerializer,
    MembershipUpdateSerializer,
)
from .permissions import (
    HasCompanyAccess,
    user_is_company_owner,
    user_is_company_owner_or_admin,
)


class MembershipListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = CompanyMembership.objects.select_related("company", "user")

        user = self.request.user
        company_id = self.request.query_params.get("company")
        user_id = self.request.query_params.get("user")
        role = self.request.query_params.get("role")
        is_active = self.request.query_params.get("is_active")
        employment_status = self.request.query_params.get("employment_status")
        contract_type = self.request.query_params.get("contract_type")

        if user.is_superuser:
            filtered = queryset
        else:
            manageable_company_ids = CompanyMembership.objects.filter(
                user=user,
                is_active=True,
                role__in=[
                    CompanyMembership.Role.OWNER,
                    CompanyMembership.Role.ADMIN,
                ],
            ).values_list("company_id", flat=True)

            filtered = queryset.filter(company_id__in=manageable_company_ids)

        if company_id:
            filtered = filtered.filter(company_id=company_id)

        if user_id:
            filtered = filtered.filter(user_id=user_id)

        if role:
            filtered = filtered.filter(role=role)

        if employment_status:
            filtered = filtered.filter(employment_status=employment_status)

        if contract_type:
            filtered = filtered.filter(contract_type=contract_type)

        if is_active is not None:
            value = str(is_active).strip().lower()
            if value in ["true", "1", "yes"]:
                filtered = filtered.filter(is_active=True)
            elif value in ["false", "0", "no"]:
                filtered = filtered.filter(is_active=False)

        return filtered.order_by(
            "company__company_name",
            "role",
            "user__first_name",
            "user__last_name",
            "user__email",
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return MembershipCreateSerializer
        return MembershipListSerializer

    def create(self, request, *args, **kwargs):
        if request.user.is_superuser:
            return super().create(request, *args, **kwargs)

        company_id = request.data.get("company")
        if not company_id:
            return Response(
                {"company": ["Dieses Feld ist erforderlich."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        company = get_object_or_404(Company, pk=company_id)

        if not user_is_company_owner_or_admin(request.user, company):
            return Response(
                {"detail": "Keine Berechtigung für diese Firma."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_role = serializer.validated_data.get("role", CompanyMembership.Role.EMPLOYEE)
        if target_role == CompanyMembership.Role.OWNER and not user_is_company_owner(request.user, company):
            return Response(
                {"detail": "Nur der Owner darf eine Owner-Rolle vergeben."},
                status=status.HTTP_403_FORBIDDEN,
            )

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)

        response_serializer = MembershipDetailSerializer(serializer.instance)
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )


class MembershipRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "pk"

    def get_queryset(self):
        queryset = CompanyMembership.objects.select_related("company", "user")
        user = self.request.user

        if user.is_superuser:
            return queryset

        manageable_company_ids = CompanyMembership.objects.filter(
            user=user,
            is_active=True,
            role__in=[
                CompanyMembership.Role.OWNER,
                CompanyMembership.Role.ADMIN,
            ],
        ).values_list("company_id", flat=True)

        own_membership_ids = CompanyMembership.objects.filter(
            user=user,
            is_active=True,
        ).values_list("id", flat=True)

        return queryset.filter(
            models.Q(company_id__in=manageable_company_ids) |
            models.Q(id__in=own_membership_ids)
        ).distinct()

    def get_serializer_class(self):
        if self.request.method in permissions.SAFE_METHODS:
            return MembershipDetailSerializer
        return MembershipUpdateSerializer

    def update(self, request, *args, **kwargs):
        membership = self.get_object()
        company = membership.company

        if request.user.is_superuser:
            return super().update(request, *args, **kwargs)

        if not user_is_company_owner_or_admin(request.user, company):
            return Response(
                {"detail": "Keine Berechtigung für diese Firmenmitgliedschaft."},
                status=status.HTTP_403_FORBIDDEN,
            )

        incoming_role = request.data.get("role")
        if (
            incoming_role == CompanyMembership.Role.OWNER
            and not user_is_company_owner(request.user, company)
        ):
            return Response(
                {"detail": "Nur der Owner darf eine Owner-Rolle vergeben."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if (
            membership.role == CompanyMembership.Role.OWNER
            and not user_is_company_owner(request.user, company)
        ):
            return Response(
                {"detail": "Nur der Owner darf die Owner-Mitgliedschaft ändern."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().update(request, *args, **kwargs)


class MembershipDeactivateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        membership = get_object_or_404(
            CompanyMembership.objects.select_related("company", "user"),
            pk=pk,
        )
        company = membership.company

        if not request.user.is_superuser and not user_is_company_owner_or_admin(request.user, company):
            return Response(
                {"detail": "Keine Berechtigung für diese Firmenmitgliedschaft."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if membership.role == CompanyMembership.Role.OWNER and not user_is_company_owner(request.user, company):
            return Response(
                {"detail": "Nur der Owner darf die Owner-Mitgliedschaft deaktivieren."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not membership.is_active:
            return Response(
                {"detail": "Die Mitgliedschaft ist bereits deaktiviert."},
                status=status.HTTP_200_OK,
            )

        membership.is_active = False
        if membership.employment_status != CompanyMembership.EmploymentStatus.TERMINATED:
            membership.employment_status = CompanyMembership.EmploymentStatus.INACTIVE
        membership.save(update_fields=["is_active", "employment_status", "updated_at"])

        return Response(
            {"detail": "Die Mitgliedschaft wurde deaktiviert."},
            status=status.HTTP_200_OK,
        )


class MembershipActivateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        membership = get_object_or_404(
            CompanyMembership.objects.select_related("company", "user"),
            pk=pk,
        )
        company = membership.company

        if not request.user.is_superuser and not user_is_company_owner_or_admin(request.user, company):
            return Response(
                {"detail": "Keine Berechtigung für diese Firmenmitgliedschaft."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if membership.role == CompanyMembership.Role.OWNER and not user_is_company_owner(request.user, company):
            return Response(
                {"detail": "Nur der Owner darf die Owner-Mitgliedschaft aktivieren."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if membership.is_active:
            return Response(
                {"detail": "Die Mitgliedschaft ist bereits aktiv."},
                status=status.HTTP_200_OK,
            )

        membership.is_active = True
        if membership.employment_status == CompanyMembership.EmploymentStatus.INACTIVE:
            membership.employment_status = CompanyMembership.EmploymentStatus.ACTIVE
        membership.save(update_fields=["is_active", "employment_status", "updated_at"])

        return Response(
            {"detail": "Die Mitgliedschaft wurde aktiviert."},
            status=status.HTTP_200_OK,
        )


class MyMembershipListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MembershipListSerializer

    def get_queryset(self):
        return (
            CompanyMembership.objects
            .select_related("company", "user")
            .filter(user=self.request.user)
            .order_by("company__company_name", "role")
        )