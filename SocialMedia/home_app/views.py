from django.shortcuts import render
from django.http import HttpRequest
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
# Create your views here.
class HomeView(LoginRequiredMixin, TemplateView):
    template_name = 'home_app/home.html'