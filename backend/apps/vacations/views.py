from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.companies.models import CompanyMembership
from .models import VacationBalance, VacationRequest
from .serializers import (
    VacationBalanceCreateUpdateSerializer,
    VacationBalanceDetailSerializer,
    VacationBalanceListSerializer,
    VacationRequestApproveSerializer,
    VacationRequestCancelSerializer,
    VacationRequestCreateUpdateSerializer,
    VacationRequestDetailSerializer,
    VacationRequestListSerializer,
    VacationRequestRejectSerializer,
    VacationRequestSubmitSerializer,
)


class VacationAccessMixin:
    permission_classes = [IsAuthenticated]

    def _get_user_company_memberships(self):
        return CompanyMembership.objects.select_related("company", "user").filter(
            user=self.request.user,
            is_active=True,
        )

    def _get_user_membership_for_company(self, company_id):
        return self._get_user_company_memberships().filter(company_id=company_id).first()

    def _user_belongs_to_company(self, company_id):
        if self.request.user.is_superuser:
            return True

        return self._get_user_company_memberships().filter(company_id=company_id).exists()

    def _user_can_manage_company_vacations(self, company_id):
        if self.request.user.is_superuser:
            return True

        membership = self._get_user_membership_for_company(company_id)
        if not membership:
            return False

        return membership.role in {
            CompanyMembership.Role.OWNER,
            CompanyMembership.Role.ADMIN,
        }

    def _user_can_access_membership(self, membership):
        if self.request.user.is_superuser:
            return True

        return self._user_belongs_to_company(membership.company_id)

    def _detail_response(self, serializer_class, instance):
        serializer = serializer_class(instance, context={"request": self.request})
        return Response(serializer.data)


class VacationRequestViewSet(VacationAccessMixin, viewsets.ModelViewSet):
    queryset = VacationRequest.objects.none()

    def get_queryset(self):
        user = self.request.user

        queryset = VacationRequest.objects.select_related(
            "company",
            "employee_membership",
            "employee_membership__user",
            "requested_by",
            "approved_by",
        )

        if not user.is_superuser:
            queryset = queryset.filter(
                company__memberships__user=user,
                company__memberships__is_active=True,
            )

        queryset = queryset.filter(is_active=True).distinct().order_by("-created_at")

        company_id = self.request.query_params.get("company")
        employee_membership_id = self.request.query_params.get("employee_membership")
        status_value = self.request.query_params.get("status")
        leave_type = self.request.query_params.get("leave_type")
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")
        mine = self.request.query_params.get("mine")

        if company_id:
            queryset = queryset.filter(company_id=company_id)

        if employee_membership_id:
            queryset = queryset.filter(employee_membership_id=employee_membership_id)

        if status_value:
            queryset = queryset.filter(status=status_value)

        if leave_type:
            queryset = queryset.filter(leave_type=leave_type)

        if start_date:
            queryset = queryset.filter(end_date__gte=start_date)

        if end_date:
            queryset = queryset.filter(start_date__lte=end_date)

        if str(mine).strip().lower() in {"1", "true", "yes"}:
            queryset = queryset.filter(employee_membership__user=user)

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return VacationRequestListSerializer
        if self.action == "retrieve":
            return VacationRequestDetailSerializer
        if self.action in {"create", "update", "partial_update"}:
            return VacationRequestCreateUpdateSerializer
        if self.action == "submit":
            return VacationRequestSubmitSerializer
        if self.action == "approve":
            return VacationRequestApproveSerializer
        if self.action == "reject":
            return VacationRequestRejectSerializer
        if self.action == "cancel":
            return VacationRequestCancelSerializer
        return VacationRequestDetailSerializer

    def _user_can_access_object(self, obj):
        return self._user_belongs_to_company(obj.company_id)

    def _user_can_edit_object(self, obj):
        if not self._user_can_access_object(obj):
            return False

        if self.request.user.is_superuser:
            return True

        if obj.employee_membership.user_id == self.request.user.id:
            return True

        return self._user_can_manage_company_vacations(obj.company_id)

    def _user_can_decide_object(self, obj):
        if not self._user_can_access_object(obj):
            return False

        return self._user_can_manage_company_vacations(obj.company_id)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        if not self._user_can_access_object(instance):
            return Response(
                {"detail": "You do not have permission to view this vacation request."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        company = serializer.validated_data["company"]
        employee_membership = serializer.validated_data["employee_membership"]

        if not self._user_can_access_membership(employee_membership):
            return Response(
                {"detail": "You do not have permission to use this employee membership."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if (
            not request.user.is_superuser
            and employee_membership.user_id != request.user.id
            and not self._user_can_manage_company_vacations(company.id)
        ):
            return Response(
                {"detail": "You can only create vacation requests for yourself."},
                status=status.HTTP_403_FORBIDDEN,
            )

        self.perform_create(serializer)
        return self._detail_response(VacationRequestDetailSerializer, serializer.instance)

    def perform_create(self, serializer):
        serializer.save()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        if not self._user_can_edit_object(instance):
            return Response(
                {"detail": "You do not have permission to edit this vacation request."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        company = serializer.validated_data.get("company", instance.company)
        employee_membership = serializer.validated_data.get(
            "employee_membership",
            instance.employee_membership,
        )

        if employee_membership.company_id != company.id:
            return Response(
                {"employee_membership": "Employee membership must belong to the same company."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (
            not request.user.is_superuser
            and employee_membership.user_id != request.user.id
            and not self._user_can_manage_company_vacations(company.id)
        ):
            return Response(
                {"detail": "You can only update your own vacation requests."},
                status=status.HTTP_403_FORBIDDEN,
            )

        self.perform_update(serializer)
        return self._detail_response(VacationRequestDetailSerializer, serializer.instance)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        if not self._user_can_edit_object(instance):
            return Response(
                {"detail": "You do not have permission to delete this vacation request."},
                status=status.HTTP_403_FORBIDDEN,
            )

        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _get_action_serializer(self, *args, **kwargs):
        serializer_class = self.get_serializer_class()
        kwargs.setdefault("context", self.get_serializer_context())
        return serializer_class(*args, **kwargs)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        instance = self.get_object()

        if not self._user_can_edit_object(instance):
            return Response(
                {"detail": "You do not have permission to submit this vacation request."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self._get_action_serializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)

        instance.status = VacationRequest.Status.PENDING
        instance.employee_note = serializer.validated_data.get(
            "employee_note",
            instance.employee_note,
        )
        instance.save()

        return self._detail_response(VacationRequestDetailSerializer, instance)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        instance = self.get_object()

        if not self._user_can_decide_object(instance):
            return Response(
                {"detail": "You do not have permission to approve this vacation request."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self._get_action_serializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return self._detail_response(VacationRequestDetailSerializer, instance)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        instance = self.get_object()

        if not self._user_can_decide_object(instance):
            return Response(
                {"detail": "You do not have permission to reject this vacation request."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self._get_action_serializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return self._detail_response(VacationRequestDetailSerializer, instance)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        instance = self.get_object()

        if not self._user_can_edit_object(instance):
            return Response(
                {"detail": "You do not have permission to cancel this vacation request."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self._get_action_serializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return self._detail_response(VacationRequestDetailSerializer, instance)


class VacationBalanceViewSet(VacationAccessMixin, viewsets.ModelViewSet):
    queryset = VacationBalance.objects.none()

    def get_queryset(self):
        user = self.request.user

        queryset = VacationBalance.objects.select_related(
            "company",
            "employee_membership",
            "employee_membership__user",
        )

        if not user.is_superuser:
            queryset = queryset.filter(
                company__memberships__user=user,
                company__memberships__is_active=True,
            )

        queryset = queryset.filter(is_active=True).distinct().order_by("-year", "-created_at")

        company_id = self.request.query_params.get("company")
        employee_membership_id = self.request.query_params.get("employee_membership")
        year = self.request.query_params.get("year")
        mine = self.request.query_params.get("mine")

        if company_id:
            queryset = queryset.filter(company_id=company_id)

        if employee_membership_id:
            queryset = queryset.filter(employee_membership_id=employee_membership_id)

        if year:
            queryset = queryset.filter(year=year)

        if str(mine).strip().lower() in {"1", "true", "yes"}:
            queryset = queryset.filter(employee_membership__user=user)

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return VacationBalanceListSerializer
        if self.action == "retrieve":
            return VacationBalanceDetailSerializer
        if self.action in {"create", "update", "partial_update"}:
            return VacationBalanceCreateUpdateSerializer
        return VacationBalanceDetailSerializer

    def _user_can_access_object(self, obj):
        return self._user_belongs_to_company(obj.company_id)

    def _user_can_manage_balance(self, obj):
        if not self._user_can_access_object(obj):
            return False
        return self._user_can_manage_company_vacations(obj.company_id)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()

        company_id = request.query_params.get("company")
        mine = str(request.query_params.get("mine")).strip().lower()

        if request.user.is_superuser:
            self.queryset = queryset
            return super().list(request, *args, **kwargs)

        if mine in {"1", "true", "yes"}:
            self.queryset = queryset.filter(employee_membership__user=request.user)
            return super().list(request, *args, **kwargs)

        if company_id and self._user_can_manage_company_vacations(company_id):
            self.queryset = queryset
            return super().list(request, *args, **kwargs)

        self.queryset = queryset.filter(employee_membership__user=request.user)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        if not self._user_can_access_object(instance):
            return Response(
                {"detail": "You do not have permission to view this vacation balance."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if (
            not request.user.is_superuser
            and instance.employee_membership.user_id != request.user.id
            and not self._user_can_manage_company_vacations(instance.company_id)
        ):
            return Response(
                {"detail": "You do not have permission to view this vacation balance."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        company = serializer.validated_data["company"]
        employee_membership = serializer.validated_data["employee_membership"]

        if not self._user_can_manage_company_vacations(company.id):
            return Response(
                {"detail": "You do not have permission to create vacation balances."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if employee_membership.company_id != company.id:
            return Response(
                {"employee_membership": "Employee membership must belong to the same company."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self.perform_create(serializer)
        return self._detail_response(VacationBalanceDetailSerializer, serializer.instance)

    def perform_create(self, serializer):
        serializer.save()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        if not self._user_can_manage_balance(instance):
            return Response(
                {"detail": "You do not have permission to edit this vacation balance."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        company = serializer.validated_data.get("company", instance.company)
        employee_membership = serializer.validated_data.get(
            "employee_membership",
            instance.employee_membership,
        )

        if employee_membership.company_id != company.id:
            return Response(
                {"employee_membership": "Employee membership must belong to the same company."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self.perform_update(serializer)
        return self._detail_response(VacationBalanceDetailSerializer, serializer.instance)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        if not self._user_can_manage_balance(instance):
            return Response(
                {"detail": "You do not have permission to delete this vacation balance."},
                status=status.HTTP_403_FORBIDDEN,
            )

        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)