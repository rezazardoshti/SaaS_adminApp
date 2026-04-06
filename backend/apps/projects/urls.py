from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ProjectTypeViewSet, ProjectViewSet

router = DefaultRouter()
router.register(r"project-types", ProjectTypeViewSet, basename="project-type")
router.register(r"", ProjectViewSet, basename="project")

urlpatterns = [
    path("", include(router.urls)),
]