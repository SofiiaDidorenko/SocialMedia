from django.contrib import admin
from django.urls import path

from .views import HomeView
app_name = 'home_app' 
urlpatterns = [
    path('home/', HomeView.as_view(), name='home')
]
