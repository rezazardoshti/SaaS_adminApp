# apps/customers/views.py

from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied

from apps.companies.models import CompanyMembership

from .models import Customer
from .serializers import (
    CustomerCreateUpdateSerializer,
    CustomerDetailSerializer,
    CustomerListSerializer,
)


class CustomerViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "public_id"

    def get_queryset(self):
        user = self.request.user

        queryset = Customer.objects.select_related(
            "company",
            "created_by",
            "updated_by",
        ).order_by("company__company_name", "name")

        if user.is_superuser:
            search = self.request.query_params.get("search", "").strip()
            company_public_id = self.request.query_params.get("company", "").strip()
            is_active = self.request.query_params.get("is_active", "").strip()

            if company_public_id:
                queryset = queryset.filter(company__public_id=company_public_id)

            if is_active.lower() in {"true", "1"}:
                queryset = queryset.filter(is_active=True)
            elif is_active.lower() in {"false", "0"}:
                queryset = queryset.filter(is_active=False)

            if search:
                queryset = queryset.filter(
                    Q(public_id__icontains=search)
                    | Q(name__icontains=search)
                    | Q(customer_number__icontains=search)
                    | Q(contact_person__icontains=search)
                    | Q(email__icontains=search)
                    | Q(phone__icontains=search)
                    | Q(city__icontains=search)
                    | Q(postal_code__icontains=search)
                    | Q(company__company_name__icontains=search)
                    | Q(company__public_id__icontains=search)
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

        is_active = self.request.query_params.get("is_active", "").strip()
        if is_active.lower() in {"true", "1"}:
            queryset = queryset.filter(is_active=True)
        elif is_active.lower() in {"false", "0"}:
            queryset = queryset.filter(is_active=False)

        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(public_id__icontains=search)
                | Q(name__icontains=search)
                | Q(customer_number__icontains=search)
                | Q(contact_person__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
                | Q(city__icontains=search)
                | Q(postal_code__icontains=search)
            )

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return CustomerListSerializer
        if self.action == "retrieve":
            return CustomerDetailSerializer
        return CustomerCreateUpdateSerializer

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
                raise PermissionDenied("You cannot create customers for this company.")

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
                raise PermissionDenied("You cannot update customers for this company.")

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
            raise PermissionDenied("You cannot delete customers from this company.")

        instance.delete()