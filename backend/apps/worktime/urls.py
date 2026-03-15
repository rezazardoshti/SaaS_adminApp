# apps/worktime/urls.py

from rest_framework.routers import DefaultRouter

from .views import WorkTimeEntryViewSet

router = DefaultRouter()
router.register(r"entries", WorkTimeEntryViewSet, basename="worktime-entry")

urlpatterns = router.urls