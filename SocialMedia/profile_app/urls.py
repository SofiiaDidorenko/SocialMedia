from django.urls import path
from .views import SettingsView

urlpatterns = [
    path(route= "settings/", view  = SettingsView.as_view(), name = "settings")
]
