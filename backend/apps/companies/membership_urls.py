from django.urls import path

from .membership_views import (
    MembershipActivateView,
    MembershipDeactivateView,
    MembershipListCreateView,
    MembershipRetrieveUpdateView,
    MyMembershipListView,
)

urlpatterns = [
    path("", MembershipListCreateView.as_view(), name="membership-list-create"),
    path("mine/", MyMembershipListView.as_view(), name="membership-mine"),
    path("<int:pk>/", MembershipRetrieveUpdateView.as_view(), name="membership-detail"),
    path("<int:pk>/activate/", MembershipActivateView.as_view(), name="membership-activate"),
    path("<int:pk>/deactivate/", MembershipDeactivateView.as_view(), name="membership-deactivate"),
]