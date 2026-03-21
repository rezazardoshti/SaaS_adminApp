from django.contrib.auth import password_validation
from django.db import transaction
from rest_framework import serializers

from apps.companies.models import Company, CompanyMembership
from .models import User


class UserListSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "is_active",
            "is_email_verified",
            "created_at",
        )
        read_only_fields = fields


class UserDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "gender",
            "phone",
            "birth_date",
            "profile_image",
            "document",
            "street",
            "postal_code",
            "city",
            "country",
            "emergency_contact_person",
            "emergency_contact_phone",
            "notes",
            "is_active",
            "is_staff",
            "is_superuser",
            "is_email_verified",
            "email_verified_at",
            "last_login",
            "last_login_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "is_staff",
            "is_superuser",
            "is_email_verified",
            "email_verified_at",
            "last_login",
            "last_login_at",
            "created_at",
            "updated_at",
        )


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = (
            "email",
            "first_name",
            "last_name",
            "gender",
            "phone",
            "birth_date",
            "profile_image",
            "document",
            "street",
            "postal_code",
            "city",
            "country",
            "emergency_contact_person",
            "emergency_contact_phone",
            "notes",
            "password",
            "password_confirm",
        )

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError(
                "Ein Benutzer mit dieser E-Mail existiert bereits."
            )
        return email

    def validate(self, attrs):
        password = attrs.get("password")
        password_confirm = attrs.get("password_confirm")

        if password != password_confirm:
            raise serializers.ValidationError(
                {"password_confirm": "Die Passwörter stimmen nicht überein."}
            )

        password_validation.validate_password(password)
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user = User.objects.create_user(password=password, **validated_data)
        return user


class OwnerRegisterSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(max_length=255, write_only=True)
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = (
            "email",
            "first_name",
            "last_name",
            "phone",
            "company_name",
            "password",
            "password_confirm",
        )

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError(
                "Ein Benutzer mit dieser E-Mail existiert bereits."
            )
        return email

    def validate_company_name(self, value):
        company_name = value.strip()
        if not company_name:
            raise serializers.ValidationError("Firmenname darf nicht leer sein.")
        return company_name

    def validate(self, attrs):
        password = attrs.get("password")
        password_confirm = attrs.get("password_confirm")

        if password != password_confirm:
            raise serializers.ValidationError(
                {"password_confirm": "Die Passwörter stimmen nicht überein."}
            )

        password_validation.validate_password(password)
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        company_name = validated_data.pop("company_name").strip()
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")

        if "email" in validated_data:
            validated_data["email"] = validated_data["email"].strip().lower()

        if "first_name" in validated_data and validated_data["first_name"]:
            validated_data["first_name"] = validated_data["first_name"].strip()

        if "last_name" in validated_data and validated_data["last_name"]:
            validated_data["last_name"] = validated_data["last_name"].strip()

        if "phone" in validated_data and validated_data["phone"]:
            validated_data["phone"] = validated_data["phone"].strip()

        user = User.objects.create_user(password=password, **validated_data)

        company = Company.objects.create(
            company_name=company_name,
            owner_user=user,
            email=user.email,
            billing_email=user.email,
        )

        CompanyMembership.objects.create(
            company=company,
            user=user,
            role=CompanyMembership.Role.OWNER,
            is_active=True,
        )

        user.registered_company = company
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "first_name",
            "last_name",
            "gender",
            "phone",
            "birth_date",
            "profile_image",
            "document",
            "street",
            "postal_code",
            "city",
            "country",
            "emergency_contact_person",
            "emergency_contact_phone",
            "notes",
        )

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.full_clean()
        instance.save()
        return instance


class MeSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "gender",
            "phone",
            "birth_date",
            "profile_image",
            "street",
            "postal_code",
            "city",
            "country",
            "emergency_contact_person",
            "emergency_contact_phone",
            "is_active",
            "is_email_verified",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "email",
            "is_active",
            "is_email_verified",
            "created_at",
            "updated_at",
        )


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Das aktuelle Passwort ist falsch.")
        return value

    def validate(self, attrs):
        new_password = attrs.get("new_password")
        new_password_confirm = attrs.get("new_password_confirm")

        if new_password != new_password_confirm:
            raise serializers.ValidationError(
                {"new_password_confirm": "Die neuen Passwörter stimmen nicht überein."}
            )

        password_validation.validate_password(
            new_password,
            self.context["request"].user,
        )
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password", "updated_at"])
        return user