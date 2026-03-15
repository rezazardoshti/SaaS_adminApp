from django.urls import include, path

from .views import (
    CompanyActivateView,
    CompanyDeactivateView,
    CompanyDeleteView,
    CompanyListCreateView,
    CompanyRetrieveUpdateView,
)

urlpatterns = [
    path("", CompanyListCreateView.as_view(), name="company-list-create"),
    path("<int:pk>/", CompanyRetrieveUpdateView.as_view(), name="company-detail"),
    path("<int:pk>/activate/", CompanyActivateView.as_view(), name="company-activate"),
    path("<int:pk>/deactivate/", CompanyDeactivateView.as_view(), name="company-deactivate"),
    path("<int:pk>/delete/", CompanyDeleteView.as_view(), name="company-delete"),

    # Memberships
    path("memberships/", include("apps.companies.membership_urls")),
]