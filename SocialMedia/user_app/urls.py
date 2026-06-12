from django.urls import path
from .views import (
    AuthTemplateView, FriendActionView, HandleFriendshipView, UserTemplateView, PersonalInfoTemplateView, 
    AlbumTemplateView, RegisterView, LoginView, 
    ConfirmCodeView, UpdateProfileDetailsView, LogoutView, FriendTemplateView, UserProfileView
)

urlpatterns = [
    path('auth/', AuthTemplateView.as_view(), name='auth'),
    path('user/', UserTemplateView.as_view(), name='user'),
    
    path('profile/<str:username>/', UserProfileView.as_view(), name='user_profile'),
    path('profile/<str:username>', UserProfileView.as_view()), 
    
    path('personal-info/', PersonalInfoTemplateView.as_view(), name='personal_info'),
    path('album/', AlbumTemplateView.as_view(), name='album'),
    path('register/', RegisterView.as_view(), name='register'),
    path('confirm-code/', ConfirmCodeView.as_view(), name='confirm_code'), 
    path('login/', LoginView.as_view(), name='login_view'),
    path('update-profile/', UpdateProfileDetailsView.as_view(), name='update_profile'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('friends/', FriendTemplateView.as_view(), name='friends'),
    path('api/friendship/handle/', HandleFriendshipView.as_view(), name='handle_friendship'),
    path('friends/action/', FriendActionView.as_view(), name='friend_action'),
]
