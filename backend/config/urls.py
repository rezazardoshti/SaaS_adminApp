from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/accounts/", include("apps.accounts.urls")),
    path("api/companies/", include("apps.companies.urls")),
    path("api/customers/", include("apps.customers.urls")),
    path("api/projects/", include("apps.projects.urls")),
    path("api/workplans/", include("apps.workplans.urls")),
    path("api/worktime/", include("apps.worktime.urls")),
    path("api/v1/vacations/", include("apps.vacations.urls")),
    path("api/v1/documents/", include("apps.documents.urls")),
    path("api/", include("apps.invoices.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)