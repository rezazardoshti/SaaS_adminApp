# apps/workplans/urls.py

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import WorkPlanItemViewSet, WorkPlanViewSet


router = DefaultRouter()
router.register(r"plans", WorkPlanViewSet, basename="workplan")
router.register(r"items", WorkPlanItemViewSet, basename="workplan-item")


urlpatterns = [
    path("", include(router.urls)),
]