from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.companies.models import CompanyMembership
from apps.companies.permissions import get_user_membership_for_company

from .serializers import (
    UserListSerializer,
    UserDetailSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    MeSerializer,
    ChangePasswordSerializer,
)

User = get_user_model()


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        serializer = MeSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, *args, **kwargs):
        serializer = UserUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        response_serializer = MeSerializer(request.user)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def put(self, request, *args, **kwargs):
        serializer = UserUpdateSerializer(
            request.user,
            data=request.data,
            partial=False,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        response_serializer = MeSerializer(request.user)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {"detail": "Passwort wurde erfolgreich geändert."},
            status=status.HTTP_200_OK,
        )


class UserListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = User.objects.all().order_by("-created_at")
        user = self.request.user

        if user.is_superuser:
            return queryset

        allowed_company_ids = CompanyMembership.objects.filter(
            user=user,
            is_active=True,
            role__in=[
                CompanyMembership.Role.OWNER,
                CompanyMembership.Role.ADMIN,
            ],
        ).values_list("company_id", flat=True)

        return queryset.filter(
            company_memberships__company_id__in=allowed_company_ids,
            company_memberships__is_active=True,
        ).distinct()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UserCreateSerializer
        return UserListSerializer

    def create(self, request, *args, **kwargs):
        if request.user.is_superuser:
            return super().create(request, *args, **kwargs)

        company_id = request.data.get("company_id")
        if not company_id:
            return Response(
                {"company_id": ["Dieses Feld ist erforderlich."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        requester_membership = CompanyMembership.objects.filter(
            user=request.user,
            company_id=company_id,
            is_active=True,
            role__in=[
                CompanyMembership.Role.OWNER,
                CompanyMembership.Role.ADMIN,
            ],
        ).first()

        if not requester_membership:
            return Response(
                {"detail": "Keine Berechtigung für diese Firma."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        role = request.data.get("role", CompanyMembership.Role.EMPLOYEE)

        if (
            role == CompanyMembership.Role.OWNER
            and requester_membership.role != CompanyMembership.Role.OWNER
        ):
            user.delete()
            return Response(
                {"detail": "Nur der Owner darf einen weiteren Owner anlegen."},
                status=status.HTTP_403_FORBIDDEN,
            )

        CompanyMembership.objects.create(
            company_id=company_id,
            user=user,
            role=role,
            is_active=True,
        )

        response_serializer = UserDetailSerializer(user)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class UserRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = User.objects.all()
        user = self.request.user

        if user.is_superuser:
            return queryset

        allowed_company_ids = CompanyMembership.objects.filter(
            user=user,
            is_active=True,
            role__in=[
                CompanyMembership.Role.OWNER,
                CompanyMembership.Role.ADMIN,
            ],
        ).values_list("company_id", flat=True)

        return queryset.filter(
            company_memberships__company_id__in=allowed_company_ids,
            company_memberships__is_active=True,
        ).distinct()

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return UserUpdateSerializer
        return UserDetailSerializer

    def update(self, request, *args, **kwargs):
        target_user = self.get_object()

        if request.user.is_superuser:
            return super().update(request, *args, **kwargs)

        shared_membership = (
            CompanyMembership.objects
            .filter(
                user=target_user,
                is_active=True,
                company__memberships__user=request.user,
                company__memberships__is_active=True,
                company__memberships__role__in=[
                    CompanyMembership.Role.OWNER,
                    CompanyMembership.Role.ADMIN,
                ],
            )
            .select_related("company")
            .first()
        )

        if not shared_membership:
            return Response(
                {"detail": "Keine Berechtigung."},
                status=status.HTTP_403_FORBIDDEN,
            )

        requester_membership = get_user_membership_for_company(
            request.user,
            shared_membership.company,
        )
        target_membership = get_user_membership_for_company(
            target_user,
            shared_membership.company,
        )

        if not requester_membership:
            return Response(
                {"detail": "Keine Berechtigung."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if requester_membership.role == CompanyMembership.Role.ADMIN:
            if target_user.is_superuser:
                return Response(
                    {"detail": "Admin darf Superuser nicht bearbeiten."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            if target_membership and target_membership.role == CompanyMembership.Role.OWNER:
                return Response(
                    {"detail": "Admin darf Owner nicht bearbeiten."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        return super().update(request, *args, **kwargs)


class UserDeactivateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, *args, **kwargs):
        user = generics.get_object_or_404(User, pk=pk)

        if request.user.is_superuser:
            if user.is_superuser:
                return Response(
                    {"detail": "Superuser kann nicht deaktiviert werden."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user.is_active = False
            user.save(update_fields=["is_active", "updated_at"])
            return Response(
                {"detail": "Benutzer wurde deaktiviert."},
                status=status.HTTP_200_OK,
            )

        shared_membership = (
            CompanyMembership.objects
            .filter(
                user=user,
                is_active=True,
                company__memberships__user=request.user,
                company__memberships__is_active=True,
                company__memberships__role__in=[
                    CompanyMembership.Role.OWNER,
                    CompanyMembership.Role.ADMIN,
                ],
            )
            .select_related("company")
            .first()
        )

        if not shared_membership:
            return Response(
                {"detail": "Keine Berechtigung."},
                status=status.HTTP_403_FORBIDDEN,
            )

        requester_membership = get_user_membership_for_company(
            request.user,
            shared_membership.company,
        )
        target_membership = get_user_membership_for_company(
            user,
            shared_membership.company,
        )

        if not requester_membership:
            return Response(
                {"detail": "Keine Berechtigung."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if user.is_superuser:
            return Response(
                {"detail": "Superuser kann nicht deaktiviert werden."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if requester_membership.role == CompanyMembership.Role.ADMIN:
            if target_membership and target_membership.role == CompanyMembership.Role.OWNER:
                return Response(
                    {"detail": "Admin darf Owner nicht deaktivieren."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        user.is_active = False
        user.save(update_fields=["is_active", "updated_at"])

        return Response(
            {"detail": "Benutzer wurde deaktiviert."},
            status=status.HTTP_200_OK,
        )


class UserActivateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, *args, **kwargs):
        user = generics.get_object_or_404(User, pk=pk)

        if request.user.is_superuser:
            user.is_active = True
            user.save(update_fields=["is_active", "updated_at"])
            return Response(
                {"detail": "Benutzer wurde aktiviert."},
                status=status.HTTP_200_OK,
            )

        shared_membership = (
            CompanyMembership.objects
            .filter(
                user=user,
                is_active=True,
                company__memberships__user=request.user,
                company__memberships__is_active=True,
                company__memberships__role__in=[
                    CompanyMembership.Role.OWNER,
                    CompanyMembership.Role.ADMIN,
                ],
            )
            .select_related("company")
            .first()
        )

        if not shared_membership:
            return Response(
                {"detail": "Keine Berechtigung."},
                status=status.HTTP_403_FORBIDDEN,
            )

        user.is_active = True
        user.save(update_fields=["is_active", "updated_at"])

        return Response(
            {"detail": "Benutzer wurde aktiviert."},
            status=status.HTTP_200_OK,
        )


class UserDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk, *args, **kwargs):
        user = generics.get_object_or_404(User, pk=pk)

        if request.user.is_superuser:
            if user.is_superuser:
                return Response(
                    {"detail": "Superuser kann nicht gelöscht werden."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        shared_membership = (
            CompanyMembership.objects
            .filter(
                user=user,
                is_active=True,
                company__memberships__user=request.user,
                company__memberships__is_active=True,
                company__memberships__role__in=[
                    CompanyMembership.Role.OWNER,
                    CompanyMembership.Role.ADMIN,
                ],
            )
            .select_related("company")
            .first()
        )

        if not shared_membership:
            return Response(
                {"detail": "Keine Berechtigung."},
                status=status.HTTP_403_FORBIDDEN,
            )

        requester_membership = get_user_membership_for_company(
            request.user,
            shared_membership.company,
        )
        target_membership = get_user_membership_for_company(
            user,
            shared_membership.company,
        )

        if not requester_membership:
            return Response(
                {"detail": "Keine Berechtigung."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if user.is_superuser:
            return Response(
                {"detail": "Superuser kann nicht gelöscht werden."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if requester_membership.role == CompanyMembership.Role.ADMIN:
            if target_membership and target_membership.role == CompanyMembership.Role.OWNER:
                return Response(
                    {"detail": "Admin darf Owner nicht löschen."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        if target_membership and target_membership.role == CompanyMembership.Role.OWNER:
            return Response(
                {"detail": "Owner kann nicht gelöscht werden."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)