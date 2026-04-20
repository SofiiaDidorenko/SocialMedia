
from django.urls import path
from .views import AuthTemplateView, UserTemplateView, PersonalInfoTemplateView, AlbumTemplateView, RegisterView

urlpatterns = [
    path(route= 'auth/', view= AuthTemplateView.as_view(), name= 'auth'),
    path(route= 'user/', view= UserTemplateView.as_view(), name= 'user'),
    path(route= 'personal-info/', view= PersonalInfoTemplateView.as_view(), name= 'personal_info'),
    path(route= 'album/', view= AlbumTemplateView.as_view(), name= 'album'),
    path(route= 'register/', view= RegisterView.as_view(), name= 'register'),
    #path(route= 'register/', view= '', name= 'register'),
   #path(route= 'login/', view= '', name= 'login'),
   #path(route= 'confirm-email/', view= '', name= 'confirm-email'),
]

