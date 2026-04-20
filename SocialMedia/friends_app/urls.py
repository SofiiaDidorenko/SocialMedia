from django.contrib import admin
from django.urls import path, include

from .views import FriendsView, FriendRequestsView, FriendMainView, RecommendationsView, AllFriendsView

urlpatterns = [
    path('friends/', FriendsView.as_view(), name='friends'),
    path('requets/', FriendRequestsView.as_view(), name='friend_requests'),
    path('main/', FriendMainView.as_view(), name='friend_main'),
    path('recommendations/', RecommendationsView.as_view(), name='recommendations'),
    path('all/', AllFriendsView.as_view(), name='all_friends'),
]
