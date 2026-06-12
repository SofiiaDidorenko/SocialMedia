from posts_app.models import Post
import json
import random
from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic import TemplateView, View
from django.contrib.auth import login, get_user_model, logout
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.mail import send_mail
from django.http import HttpRequest, JsonResponse
from django.urls import reverse_lazy
from django.db import models

from .forms import RegisterForm, ConfirmEmailForm, LoginForm
from .utils.friend_queries import get_user_by_section
from .utils.friends_actions import friend_request, friend_reject, friend_accept, friend_delete
from django.http import Http404
from .models import Friendship

User = get_user_model()

class UserProfileView(LoginRequiredMixin, TemplateView):
    template_name = 'user_app/particles/friends_account.html' 

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        username_param = self.kwargs.get('username')
        
        if not username_param or username_param in ['None', 'none', 'null', '']:
            raise Http404("Некоректний ідентифікатор користувача")
        profile_user = None
        try:
            profile_user = User.objects.get(username=username_param)
        except User.DoesNotExist:
            if username_param.isdigit():
                profile_user = get_object_or_404(User, id=int(username_param))
            else:
                profile_user = User.objects.filter(email=username_param).first()
                
        if not profile_user:
            profile_user = get_object_or_404(User, username=username_param)

        context['profile_user'] = profile_user
        
        current_user = self.request.user
        
        friendship = Friendship.objects.filter(
            (models.Q(from_user=current_user, to_user=profile_user) | 
             models.Q(from_user=profile_user, to_user=current_user))
        ).first()
        
        if friendship:
            if friendship.status == 'accepted':
                context['friendship_status'] = 'friends'
            elif friendship.status == 'pending':
                if friendship.from_user == current_user:
                    context['friendship_status'] = 'sent'
                else:
                    context['friendship_status'] = 'received'
        else:
            context['friendship_status'] = 'none'

        try:
            user_posts = profile_user.posts.all().order_by('-created_at')
            context['posts'] = user_posts
            context['posts_count'] = user_posts.count()
        except AttributeError:
            try:
                user_posts = Post.objects.filter(author=profile_user).order_by('-created_at')
                context['posts'] = user_posts
                context['posts_count'] = user_posts.count()
            except ImportError:
                context['posts'] = []
                context['posts_count'] = 0

        try:
            context['friends_count'] = get_user_by_section(profile_user, 'friends').count()
        except Exception:
            context['friends_count'] = 222

        context['followers_count'] = "12.1K"
        return context



class UserTemplateView(LoginRequiredMixin, TemplateView):
    template_name = 'user_app/user.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.request.user
        
        context['profile_user'] = user
        context['friendship_status'] = 'self'
        context['show_details_modal'] = (user.username == user.email)
        context['friends_count'] = get_user_by_section(user, 'friends').count()
        
        try:
            context['posts_count'] = user.posts.count()
        except AttributeError:
            context['posts_count'] = 3
            
        context['followers_count'] = "12.1K"
        return context


class HandleFriendshipView(LoginRequiredMixin, View):
    def post(self, request):
        from .models import Friendship
        
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'error': 'Некоректні дані'}, status=400)
            
        target_user_id = data.get('user_id')
        action = data.get('action')
        
        if not target_user_id or not action:
            return JsonResponse({'success': False, 'error': 'Відсутні параметри'}, status=400)
            
        try:
            target_user = User.objects.get(id=target_user_id)
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Користувача не знайдено'}, status=404)
            
        current_user = request.user
        
        if action == 'send':
            Friendship.objects.get_or_create(from_user=current_user, to_user=target_user, status='pending')
            return JsonResponse({'success': True})
            
        elif action == 'accept':
            friendship = Friendship.objects.filter(from_user=target_user, to_user=current_user, status='pending').first()
            if friendship:
                friendship.status = 'accepted'
                friendship.save()
                return JsonResponse({'success': True})
            return JsonResponse({'success': False, 'error': 'Запит не знайдено'}, status=404)
            
        elif action == 'reject_or_delete':
            Friendship.objects.filter(
                models.Q(from_user=current_user, to_user=target_user) | 
                models.Q(from_user=target_user, to_user=current_user)
            ).delete()
            return JsonResponse({'success': True})
            
        return JsonResponse({'success': False, 'error': 'Невідома дія'}, status=400)


class FriendActionView(LoginRequiredMixin, View):
    def post(self, request):
        data = json.loads(request.body)
        action = data.get('action')
        target_id = data.get('user_id')
        
        other_user = User.objects.get(id=target_id)

        if action == 'request':
            result = friend_request(request.user, other_user)
        elif action == 'accept':
            result = friend_accept(other_user, request.user) 
        elif action == 'reject':
            result = friend_reject(other_user, request.user)
        elif action == 'delete':
            result = friend_delete(request.user, other_user)
        else:
            return JsonResponse({'error': 'Unknown action'}, status=400)
            
        return JsonResponse(result)


class FriendTemplateView(LoginRequiredMixin, TemplateView):
    template_name = 'user_app/friends.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.request.user
        
        context['friend_requests'] = get_user_by_section(user, 'requests')
        context['recommendations'] = get_user_by_section(user, 'recommendations')
        context['friends'] = get_user_by_section(user, 'friends')
        return context


class LogoutView(View):
    def dispatch(self, request, *args, **kwargs):
        logout(request)  
        return redirect('auth')


class AuthTemplateView(TemplateView):
    template_name = 'user_app/auth.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['register_form'] = RegisterForm()
        context['login_form'] = LoginForm()
        context['confirm_email_form'] = ConfirmEmailForm()
        return context
    
class RegisterView(View):
    def post(self, request: HttpRequest):
        form = RegisterForm(request.POST)
        if form.is_valid():
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
    def post(self, request: HttpRequest):
        # Спочатку перевіряємо, чи надіслав наш новий JavaScript вже повністю зібраний код
        user_code = request.POST.get('code', '').strip()

        # Якщо новий параметр порожній, використовуємо твій старий цикл як запасний варіант
        if not user_code:
            user_code = "".join([request.POST.get(f'code{i}', '') for i in range(1, 7)]).strip()

        server_code = request.session.get('confirm_code')
        reg_data = request.session.get('register_data')

        print(f"[DEBUG] Отримано код від користувача: '{user_code}', Очікуваний код на сервері: '{server_code}'")

        if not server_code or not reg_data:
            return JsonResponse({'error': 'Сесія закінчилася або дані реєстрації відсутні. Спробуйте ще раз.'}, status=400)

        # Перевіряємо відповідність кодів
        if user_code == str(server_code):
            # Створюємо користувача в базі даних
            User.objects.create_user(
                username=reg_data['email'], 
                email=reg_data['email'],
                password=reg_data['password']
            )
            # Очищаємо дані сесії після успішної реєстрації
            del request.session['confirm_code']
            del request.session['register_data']
            return JsonResponse({'success': True, 'action': 'show_login'}, status=200)
            
        return JsonResponse({'error': 'Невірний код підтвердження'}, status=400)



class LoginView(View):
    def post(self, request: HttpRequest):
        form = LoginForm(request=request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            is_new = (user.username == user.email)
            return JsonResponse({
                "success": True,
                "is_new_user": is_new,
                "redirect_url": str(reverse_lazy('user')) 
            })
        return JsonResponse({"success": False, "errors": form.errors.get_json_data()}, status=400)


class UpdateProfileDetailsView(LoginRequiredMixin, View):
    def post(self, request):
        nickname = request.POST.get('nickname', '').strip()
        author_name = request.POST.get('author_name', '').strip()
        
        if not nickname or not author_name:
            return JsonResponse({'success': False, 'error': 'Всі поля обов’язкові'}, status=400)

        if User.objects.filter(username=nickname).exclude(pk=request.user.pk).exists():
            return JsonResponse({'success': False, 'error': 'Цей нікнейм вже зайнятий'}, status=400)

        user = request.user
        user.username = nickname  
        user.first_name = author_name
        user.save()
        return JsonResponse({'success': True, 'redirect_url': str(reverse_lazy('user'))})


class PersonalInfoTemplateView(LoginRequiredMixin, TemplateView):
    template_name = 'user_app/personal_info.html'


class AlbumTemplateView(TemplateView):
    template_name = 'user_app/album.html'
