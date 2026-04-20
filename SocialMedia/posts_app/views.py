from django.shortcuts import render
from django.http import HttpRequest
from django.views.generic import TemplateView
# Create your views here.
class PostsView(TemplateView):
    template_name = 'post_app/post.html'