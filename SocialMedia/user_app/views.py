import random
from django.shortcuts import render
from django.views.generic import TemplateView, View
from django.contrib.auth import login, get_user_model
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.mail import send_mail
from django.http import HttpRequest, JsonResponse
from django.urls import reverse_lazy
from .forms import RegisterForm, ConfirmEmailForm, LoginForm
from django.contrib.auth import logout
from django.shortcuts import redirect
from django.views import View

User = get_user_model()


class LogoutView(View):
    def dispatch(self, request, *args, **kwargs):
        logout(request)  # Видаляє сесію та очищує auth_user_id
        return redirect('auth')

class AuthTemplateView(TemplateView):
    """Відображає сторінку з формами реєстрації та входу."""
    template_name = 'user_app/auth.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['register_form'] = RegisterForm()
        context['login_form'] = LoginForm()
        context['confirm_email_form'] = ConfirmEmailForm()
        return context

class RegisterView(View):
    """Приймає дані реєстрації та надсилає код підтвердження."""
    def post(self, request: HttpRequest):
        form = RegisterForm(request.POST)
        if form.is_valid():
            # Зберігаємо дані у сесії тимчасово до підтвердження коду
            request.session['register_data'] = form.cleaned_data
            confirm_code = '{:06d}'.format(random.randint(0, 999999))
            request.session['confirm_code'] = confirm_code
            
            send_mail(
                'Код підтвердження World IT',
                f'Ваш код для реєстрації: {confirm_code}',
                'noreply@worldit.com',
                [form.cleaned_data['email']],
                fail_silently=False,
            )
            return JsonResponse({'message': 'Код надіслано на пошту'}, status=200)
        
        return JsonResponse({'errors': form.errors.get_json_data()}, status=400)

class ConfirmCodeView(View):
    """Перевіряє код із пошти та створює користувача."""
    def post(self, request: HttpRequest):
        # Збираємо код з 6 окремих інпутів
        user_code = "".join([request.POST.get(f'code{i}', '') for i in range(1, 7)])
        server_code = request.session.get('confirm_code')
        reg_data = request.session.get('register_data')

        if not server_code or not reg_data:
            return JsonResponse({'error': 'Сесія закінчилася. Спробуйте ще раз.'}, status=400)

        if user_code == server_code:
            # Створюємо користувача (username спочатку дорівнює email)
            User.objects.create_user(
                username=reg_data['email'], 
                email=reg_data['email'],
                password=reg_data['password']
            )
            # Очищуємо сесію
            del request.session['confirm_code']
            del request.session['register_data']
            
            return JsonResponse({'success': True, 'action': 'show_login'}, status=200)
        
        return JsonResponse({'error': 'Невірний код підтвердження'}, status=400)

class LoginView(View):
    """Авторизація користувача."""
    def post(self, request: HttpRequest):
        form = LoginForm(request=request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            
            # Якщо username все ще пошта — значить користувач новий і не заповнив профіль
            is_new = (user.username == user.email)
            
            return JsonResponse({
                "success": True,
                "is_new_user": is_new,
                "redirect_url": str(reverse_lazy('user')) # Перенаправлення за замовчуванням
            })
        
        return JsonResponse({"success": False, "errors": form.errors.get_json_data()}, status=400)

class UpdateProfileDetailsView(LoginRequiredMixin, View):
    """Оновлення нікнейму та імені після першого входу."""
    def post(self, request):
        nickname = request.POST.get('nickname', '').strip()
        author_name = request.POST.get('author_name', '').strip()
        
        if not nickname or not author_name:
            return JsonResponse({'success': False, 'error': 'Всі поля обов’язкові'}, status=400)

        # Перевіряємо, чи не зайнятий нікнейм іншим користувачем
        if User.objects.filter(username=nickname).exclude(pk=request.user.pk).exists():
            return JsonResponse({'success': False, 'error': 'Цей нікнейм вже зайнятий'}, status=400)

        user = request.user
        user.username = nickname  # Тепер username стає унікальним ніком замість пошти
        user.first_name = author_name
        user.save()
        
        return JsonResponse({
            'success': True,
            'redirect_url': str(reverse_lazy('user'))
        })

class UserTemplateView(LoginRequiredMixin, TemplateView):
    """Особистий кабінет / Налаштування."""
    template_name = 'user_app/user.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # Якщо username == email, JS на сторінці відкриє модальне вікно
        context['show_details_modal'] = (self.request.user.username == self.request.user.email)
        return context

class PersonalInfoTemplateView(LoginRequiredMixin, TemplateView):
    template_name = 'user_app/personal_info.html' # Переконайтеся, що такий файл існує

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # Додаткова логіка, якщо потрібно
        return context
    
class AlbumTemplateView(TemplateView):
    template_name = 'user_app/album.html' # Переконайтеся, що такий файл існує
