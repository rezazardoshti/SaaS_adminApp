from rest_framework.routers import DefaultRouter

from .views import VacationBalanceViewSet, VacationRequestViewSet

app_name = "vacations"

router = DefaultRouter()
router.register("requests", VacationRequestViewSet, basename="vacation-request")
router.register("balances", VacationBalanceViewSet, basename="vacation-balance")

urlpatterns = router.urls