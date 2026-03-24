from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.companies.models import CompanyMembership


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        membership = (
            CompanyMembership.objects.select_related("company")
            .filter(user=user, is_active=True)
            .order_by("-company__is_active", "role", "-joined_at")
            .first()
        )

        token["user_id"] = user.id
        token["email"] = user.email
        token["first_name"] = user.first_name or ""
        token["last_name"] = user.last_name or ""
        token["full_name"] = user.full_name or ""
        token["is_staff"] = user.is_staff
        token["is_superuser"] = user.is_superuser
        token["is_email_verified"] = user.is_email_verified

        token["role"] = membership.role if membership else None
        token["company_id"] = membership.company.id if membership else None
        token["company_name"] = (
            membership.company.company_name if membership else None
        )
        token["membership_id"] = membership.id if membership else None

        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        membership = (
            CompanyMembership.objects.select_related("company")
            .filter(user=self.user, is_active=True)
            .order_by("-company__is_active", "role", "-joined_at")
            .first()
        )

        role = membership.role if membership else None
        company = membership.company if membership else None

        data["user"] = {
            "id": self.user.id,
            "email": self.user.email,
            "first_name": self.user.first_name,
            "last_name": self.user.last_name,
            "full_name": self.user.full_name,
            "is_staff": self.user.is_staff,
            "is_superuser": self.user.is_superuser,
            "is_email_verified": self.user.is_email_verified,
            "role": role,
            "can_access_admin_dashboard": (
                role in {"owner", "admin"} or self.user.is_superuser
            ),
            "can_access_employee_workspace": (
                role in {"owner", "admin", "employee"} or self.user.is_superuser
            ),
        }

        data["membership"] = (
            {
                "id": membership.id,
                "role": membership.role,
                "employee_number": membership.employee_number,
                "job_title": membership.job_title,
                "department": membership.department,
                "employment_status": membership.employment_status,
                "is_active": membership.is_active,
                "monthly_target_hours": membership.monthly_target_hours,
                
            }
            if membership
            else None
        )

        data["company"] = (
            {
                "id": company.id,
                "public_id": str(company.public_id),
                "company_name": company.company_name,
                "industry": company.industry,
                "subscription_plan": company.subscription_plan,
                "subscription_status": company.subscription_status,
                "is_active": company.is_active,
            }
            if company
            else None
        )

        data["redirect_to"] = self.get_redirect_path(
            role=role,
            is_superuser=self.user.is_superuser,
        )

        return data

    @staticmethod
    def get_redirect_path(role, is_superuser=False):
        if is_superuser:
            return "/dashboard"

        if role == "employee":
            return "/workspace"

        if role in {"admin", "owner"}:
            return "/workspace"

        return "/login"