from django.db.models import Q
from django.utils.dateparse import parse_date

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.companies.models import CompanyMembership

from .models import WorkTimeEntry
from .permissions import (
    CanApproveRejectWorkTimeEntry,
    CanEditWorkTimeEntry,
    CanStartWorkTimeEntry,
    CanStopWorkTimeEntry,
    CanViewWorkTimeEntry,
    get_user_membership_for_company,
)
from .serializers import (
    WorkTimeEntryApproveSerializer,
    WorkTimeEntryCreateSerializer,
    WorkTimeEntryDetailSerializer,
    WorkTimeEntryListSerializer,
    WorkTimeEntryRejectSerializer,
    WorkTimeEntryStartSerializer,
    WorkTimeEntryStopSerializer,
    WorkTimeEntryUpdateSerializer,
)


class WorkTimeEntryViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = WorkTimeEntry.objects.select_related(
        "company",
        "employee_membership",
        "employee_membership__user",
        "project",
        "approved_by",
        "approved_by__user",
        "rejected_by",
        "rejected_by__user",
    ).all()
    lookup_field = "public_id"

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        memberships = CompanyMembership.objects.filter(
            user=user,
            is_active=True,
        ).select_related("company")

        company_ids = list(memberships.values_list("company_id", flat=True))
        queryset = queryset.filter(company_id__in=company_ids)

        company_id = self.request.query_params.get("company")
        employee_membership_id = self.request.query_params.get("employee_membership")
        status_value = self.request.query_params.get("status")
        entry_type = self.request.query_params.get("entry_type")
        project_id = self.request.query_params.get("project")
        work_date_from = self.request.query_params.get("work_date_from")
        work_date_to = self.request.query_params.get("work_date_to")
        is_active = self.request.query_params.get("is_active")
        search = self.request.query_params.get("search")
        mine = self.request.query_params.get("mine")

        if company_id:
            if not memberships.filter(company_id=company_id).exists():
                return queryset.none()
            queryset = queryset.filter(company_id=company_id)

        membership_by_company = {
            membership.company_id: membership for membership in memberships
        }

        selected_company_id = None
        if company_id:
            try:
                selected_company_id = int(company_id)
            except (TypeError, ValueError):
                selected_company_id = None

        if selected_company_id and selected_company_id in membership_by_company:
            requester_membership = membership_by_company[selected_company_id]
            if requester_membership.role == CompanyMembership.Role.EMPLOYEE:
                queryset = queryset.filter(employee_membership__user=user)
        else:
            employee_company_ids = [
                membership.company_id
                for membership in memberships
                if membership.role == CompanyMembership.Role.EMPLOYEE
            ]
            admin_owner_company_ids = [
                membership.company_id
                for membership in memberships
                if membership.role
                in (CompanyMembership.Role.OWNER, CompanyMembership.Role.ADMIN)
            ]

            employee_q = Q(
                company_id__in=employee_company_ids,
                employee_membership__user=user,
            )
            admin_q = Q(company_id__in=admin_owner_company_ids)
            queryset = queryset.filter(employee_q | admin_q)

        if employee_membership_id:
            queryset = queryset.filter(employee_membership_id=employee_membership_id)

        if status_value:
            queryset = queryset.filter(status=status_value)

        if entry_type:
            queryset = queryset.filter(entry_type=entry_type)

        if project_id:
            queryset = queryset.filter(project_id=project_id)

        if work_date_from:
            parsed_from = parse_date(work_date_from)
            if parsed_from:
                queryset = queryset.filter(work_date__gte=parsed_from)

        if work_date_to:
            parsed_to = parse_date(work_date_to)
            if parsed_to:
                queryset = queryset.filter(work_date__lte=parsed_to)

        if is_active is not None:
            if is_active.lower() in ("true", "1", "yes"):
                queryset = queryset.filter(is_active=True)
            elif is_active.lower() in ("false", "0", "no"):
                queryset = queryset.filter(is_active=False)

        if mine and mine.lower() in ("true", "1", "yes"):
            queryset = queryset.filter(employee_membership__user=user)

        if search:
            queryset = queryset.filter(
                Q(public_id__icontains=search)
                | Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(internal_note__icontains=search)
                | Q(project__name__icontains=search)
                | Q(employee_membership__user__first_name__icontains=search)
                | Q(employee_membership__user__last_name__icontains=search)
                | Q(employee_membership__user__email__icontains=search)
                | Q(company__company_name__icontains=search)
            )

        return queryset.order_by("-work_date", "-started_at", "-created_at").distinct()

    def get_serializer_class(self):
        if self.action == "list":
            return WorkTimeEntryListSerializer
        if self.action == "retrieve":
            return WorkTimeEntryDetailSerializer
        if self.action == "create":
            return WorkTimeEntryCreateSerializer
        if self.action == "manual":
            return WorkTimeEntryCreateSerializer
        if self.action in ("update", "partial_update"):
            return WorkTimeEntryUpdateSerializer
        if self.action == "start":
            return WorkTimeEntryStartSerializer
        if self.action == "stop":
            return WorkTimeEntryStopSerializer
        if self.action == "approve":
            return WorkTimeEntryApproveSerializer
        if self.action == "reject":
            return WorkTimeEntryRejectSerializer
        return WorkTimeEntryDetailSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()

        if self.action in ("update", "partial_update"):
            instance = self.get_object()
            membership = get_user_membership_for_company(
                self.request.user,
                instance.company,
            )
            if membership and membership.role in (
                CompanyMembership.Role.OWNER,
                CompanyMembership.Role.ADMIN,
            ):
                context["updater_membership"] = membership

        if self.action == "approve":
            instance = self.get_object()
            context["approver_membership"] = get_user_membership_for_company(
                self.request.user,
                instance.company,
            )

        if self.action == "reject":
            instance = self.get_object()
            context["rejector_membership"] = get_user_membership_for_company(
                self.request.user,
                instance.company,
            )

        return context

    def get_permissions(self):
        if self.action == "start":
            return [permissions.IsAuthenticated(), CanStartWorkTimeEntry()]

        if self.action == "stop":
            return [permissions.IsAuthenticated(), CanStopWorkTimeEntry()]

        if self.action == "manual":
            return [permissions.IsAuthenticated(), CanStartWorkTimeEntry()]

        if self.action in ("approve", "reject"):
            return [permissions.IsAuthenticated(), CanApproveRejectWorkTimeEntry()]

        if self.action == "retrieve":
            return [permissions.IsAuthenticated(), CanViewWorkTimeEntry()]

        if self.action in ("update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), CanEditWorkTimeEntry()]

        return [permissions.IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        return Response(
            {
                "detail": "Direct creation is not allowed. "
                "Use the start action to begin work time."
            },
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def perform_create(self, serializer):
        company = serializer.validated_data.get("company")
        membership = get_user_membership_for_company(self.request.user, company)

        if not membership:
            raise PermissionDenied("You do not have access to this company.")

        target_membership = serializer.validated_data.get("employee_membership")

        if membership.role == CompanyMembership.Role.EMPLOYEE:
            if not target_membership or target_membership.user_id != self.request.user.id:
                raise PermissionDenied("Employees can only create their own entries.")

        serializer.save()

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Deleting work time entries is not allowed."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=False, methods=["post"], url_path="start")
    def start(self, request, *args, **kwargs):
        permission_denied = False
        for permission in self.get_permissions():
            if not permission.has_permission(request, self):
                permission_denied = True
                break

        if permission_denied:
            return Response(
                {"detail": "You do not have permission to start this entry."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = serializer.save()

        response_serializer = WorkTimeEntryDetailSerializer(
            entry,
            context=self.get_serializer_context(),
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="manual")
    def manual(self, request, *args, **kwargs):
        permission_denied = False
        for permission in self.get_permissions():
            if not permission.has_permission(request, self):
                permission_denied = True
                break

        if permission_denied:
            return Response(
                {"detail": "You do not have permission to create this entry."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        entry = serializer.instance

        response_serializer = WorkTimeEntryDetailSerializer(
            entry,
            context=self.get_serializer_context(),
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="stop")
    def stop(self, request, *args, **kwargs):
        instance = self.get_object()
        self.check_object_permissions(request, instance)

        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        entry = serializer.save()

        response_serializer = WorkTimeEntryDetailSerializer(
            entry,
            context=self.get_serializer_context(),
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, *args, **kwargs):
        instance = self.get_object()
        self.check_object_permissions(request, instance)

        approver_membership = get_user_membership_for_company(
            request.user,
            instance.company,
        )
        if not approver_membership:
            return Response(
                {"detail": "You do not have access to approve this entry."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if approver_membership.role not in (
            CompanyMembership.Role.OWNER,
            CompanyMembership.Role.ADMIN,
        ):
            return Response(
                {"detail": "Only owner or admin can approve entries."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=True,
            context={
                **self.get_serializer_context(),
                "request": request,
                "approver_membership": approver_membership,
            },
        )
        serializer.is_valid(raise_exception=True)
        entry = serializer.save()

        response_serializer = WorkTimeEntryDetailSerializer(
            entry,
            context=self.get_serializer_context(),
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, *args, **kwargs):
        instance = self.get_object()
        self.check_object_permissions(request, instance)

        rejector_membership = get_user_membership_for_company(
            request.user,
            instance.company,
        )
        if not rejector_membership:
            return Response(
                {"detail": "You do not have access to reject this entry."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if rejector_membership.role not in (
            CompanyMembership.Role.OWNER,
            CompanyMembership.Role.ADMIN,
        ):
            return Response(
                {"detail": "Only owner or admin can reject entries."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=True,
            context={
                **self.get_serializer_context(),
                "request": request,
                "rejector_membership": rejector_membership,
            },
        )
        serializer.is_valid(raise_exception=True)
        entry = serializer.save()

        response_serializer = WorkTimeEntryDetailSerializer(
            entry,
            context=self.get_serializer_context(),
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)