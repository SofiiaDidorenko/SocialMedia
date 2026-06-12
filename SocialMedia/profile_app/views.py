from django.shortcuts import render
from django.views.generic.base import TemplateView

# Create your views here.

class SettingsView(TemplateView):
    template_name = 'profile_app/settings.html'