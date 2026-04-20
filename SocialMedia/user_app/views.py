from django.shortcuts import render
from django.views.generic.base import TemplateView
from django.views import View
from django.http import HttpRequest, JsonResponse
from .forms import RegisterForm
# Create your views here.
class AuthTemplateView(TemplateView):
    template_name = 'user_app/auth.html'
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['register_form'] = RegisterForm()
        return context

class UserTemplateView(TemplateView):
    template_name = 'user_app/user.html'
class PersonalInfoTemplateView(TemplateView):
    template_name = 'user_app/personal_info.html'
class AlbumTemplateView(TemplateView):
    template_name = 'user_app/album.html'
    
class RegisterView(View):
    def post(self, request: HttpRequest):
        form = RegisterForm(request.POST)
        if form.is_valid():
            form.save()
            return JsonResponse(
                {'message': 'User created'}, status=201
            )
        return JsonResponse(
            {'errors': form.errors.get_json_data()}, status=400
        )
