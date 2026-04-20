from django.contrib import admin
from django.urls import path, include
from .views import PostsView

urlpatterns = [
    path('posts/', PostsView.as_view(), name='posts')
]