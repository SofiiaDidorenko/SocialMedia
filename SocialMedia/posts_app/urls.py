from django.contrib import admin
from django.urls import path, include

from .views import PostsView, add_tag_ajax, delete_post_ajax

urlpatterns = [
    path('posts/', PostsView.as_view(), name='posts'),
    path('add_tag/', add_tag_ajax, name='add_tag'),
    path('delete_post/<int:pk>/', delete_post_ajax, name='delete_post'),
]
