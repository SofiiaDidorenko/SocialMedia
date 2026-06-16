import datetime
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.paginator import Paginator
from django.http import HttpRequest, JsonResponse
from django.views import View
from django.views.generic import TemplateView
from django.db.models import OuterRef, Subquery
from django.contrib.sessions.models import Session
from django.utils import timezone

from user_app.models import User
from user_app.utils.friend_queries import get_user_by_section

from .forms import GroupSelectUsersForm, GroupDetailsForm
from .models import Chat, Message, MessageImage


class ChatView(LoginRequiredMixin, TemplateView):
    login_url = "auth"
    template_name = "chat_app/chat.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.request.user
        
        self.request.session['last_activity'] = timezone.now().isoformat()
        self.request.session.modified = True
        self.request.session.save()
        
        all_friends = get_user_by_section(user, "friends")
        context["friends"] = all_friends.exclude(first_name="", last_name="", email="")
        
        last_message_text = Message.objects.filter(
            chat_id=OuterRef('pk')
        ).order_by('-created_at', '-id').values('text')[:1]
        
        last_message_time = Message.objects.filter(
            chat_id=OuterRef('pk')
        ).order_by('-created_at', '-id').values('created_at')[:1]

        group_chats_query = Chat.objects.filter(
            users=user, 
            is_group=True
        ).annotate(
            last_msg_text=Subquery(last_message_text),
            last_msg_time=Subquery(last_message_time)
        ).order_by('-last_msg_time', 'id')

        group_chats_with_data = []
        for chat in group_chats_query:
            words = chat.name.split() if chat.name else []
            if len(words) >= 2:
                initials = f"{words[0][0]}{words[1][0]}".upper()
            elif len(words) == 1:
                initials = words[0][:2].upper() if len(words[0]) > 1 else words[0][0].upper()
            else:
                initials = "CH"

            group_chats_with_data.append({
                'chat': chat,
                'name': chat.name,
                'avatar_url': chat.avatar.url if getattr(chat, 'avatar', None) else None,
                'initials': initials,
                'last_message': chat.last_msg_text or "Немає повідомлень",
                'last_time': chat.last_msg_time.strftime("%H:%M") if chat.last_msg_time else ""
            })
        
        context["group_chats"] = group_chats_with_data
        
        personal_chats = Chat.objects.filter(
            users=user, 
            is_group=False
        ).annotate(
            last_msg_text=Subquery(last_message_text),
            last_msg_time=Subquery(last_message_time)
        ).order_by('-last_msg_time', 'id')

        chats_with_data = []
        for chat in personal_chats:
            friend = chat.users.exclude(id=user.id).first()
            if friend:
                display_name = f"{friend.first_name} {friend.last_name}".strip()
                if not display_name:
                    display_name = friend.username
                
                chats_with_data.append({
                    'chat': chat,
                    'friend_id': friend.id,
                    'username': display_name,
                    'avatar_url': friend.avatar.url if getattr(friend, 'avatar', None) else "/static/icons/User1.png",
                    'last_message': chat.last_msg_text or "Немає повідомлень",
                    'last_time': chat.last_msg_time.strftime("%H:%M") if chat.last_msg_time else ""
                })

        context["personal_chats"] = chats_with_data
        context['group_users_form'] = GroupSelectUsersForm(user=user)
        context['group_details_form'] = GroupDetailsForm()
        
        return context


class GetOnlineStatusesView(LoginRequiredMixin, View):
    def get(self, request):
        active_sessions = Session.objects.filter(expire_date__gte=timezone.now())
        online_user_ids = []
        now = timezone.now()
        five_minutes_ago = now - datetime.timedelta(minutes=5)
        
        for session in active_sessions:
            data = session.get_decoded()
            user_id = data.get('_auth_user_id')
            last_activity_str = data.get('last_activity')
            
            if user_id and last_activity_str:
                try:
                    last_activity = timezone.datetime.fromisoformat(last_activity_str)
                    if last_activity >= five_minutes_ago:
                        online_user_ids.append(int(user_id))
                except (ValueError, TypeError):
                    continue
                    
        friends = get_user_by_section(request.user, "friends")
        online_friend_ids = list(friends.filter(id__in=online_user_ids).values_list('id', flat=True))
        
        return JsonResponse({"online_users": online_friend_ids})
class ChatWithView(LoginRequiredMixin, View):
    login_url = "auth"

    def post(self, request, userId):
        # 1. Проверяем, заходит ли пользователь в групповой чат (userId в данном случае равен chat_id группы)
        group_chat = Chat.objects.filter(id=userId, is_group=True, users=request.user).first()
        
        if group_chat:
            avatar_url = group_chat.avatar.url if getattr(group_chat, 'avatar', None) else None
            user_ids_list = list(group_chat.users.values_list('id', flat=True))
            
            return JsonResponse({
                "success": True,
                "chatId": group_chat.id,
                "username": group_chat.name,
                "avatar_url": avatar_url,
                "adminId": group_chat.admin.id if group_chat.admin else None,  # 👑 Точный ID админа группы
                "usersList": user_ids_list
            })

        # 2. Если это не группа, открываем или создаем обычный личный чат с другом
        try:
            other_user = User.objects.get(id=userId)
        except User.DoesNotExist:
            return JsonResponse({"success": False, "error": "Чат або користувача не знайдено"}, status=444)

        friends = get_user_by_section(request.user, "friends")
        if other_user not in friends:
            return JsonResponse({"success": False, "error": "Користувач не є вашим другом"}, status=403)
            
        chat_ids = Chat.objects.filter(users=request.user, is_group=False).values_list("id", flat=True)
        chat = Chat.objects.filter(id__in=chat_ids, users=other_user, is_group=False).first()
        
        if chat is None:
            chat = Chat.objects.create(is_group=False)
            chat.users.add(request.user, other_user)
            
        display_name = f"{other_user.first_name} {other_user.last_name}".strip()
        if not display_name:
            display_name = other_user.username

        avatar_url = other_user.avatar.url if getattr(other_user, 'avatar', None) else "/static/icons/User1.png"
        user_ids_list = [request.user.id, other_user.id]

        return JsonResponse({
            "success": True, 
            "chatId": chat.id, 
            "username": display_name,
            "avatar_url": avatar_url,
            "adminId": None,  
            "usersList": user_ids_list
        })



class GetMessageView(LoginRequiredMixin, View): 
    def get(self, request, chat_id):
        if not Chat.objects.filter(id=chat_id, users=request.user).exists():
            return JsonResponse({"success": False}, status=403)
            
        messages_in_chat = Message.objects.filter(chat_id=chat_id).select_related("sender").order_by("-created_at", "-id") 
        page_object = Paginator(messages_in_chat, 10).get_page(request.GET.get("page", 1))
        messages = list(page_object.object_list)[::-1]
        
        return JsonResponse({
            "messages": [{
                "id": message.id,
                "text": message.text,
                "sender": message.sender.username,
                "sender_id": message.sender.id,
                "time": message.created_at.strftime("%H:%M")
            } for message in messages],
            "has_next": page_object.has_next()
        })


class CreateGroupChatView(LoginRequiredMixin, View):
    def post(self, request):
        form = GroupDetailsForm(request.POST, request.FILES)
        if form.is_valid():
            user_ids = request.POST.getlist('selected_users')
            if not user_ids:
                return JsonResponse({'success': False, 'error': 'Будь ласка, оберіть хоча б одного учасника.'}, status=400)
            
            chat = form.save(commit=False)
            chat.is_group = True
            chat.admin = request.user
            chat.save()
            chat.users.add(request.user)
            
            for u_id in user_ids:
                try:
                    friend = User.objects.get(id=u_id)
                    chat.users.add(friend)
                except User.DoesNotExist:
                    continue
            
            words = chat.name.split() if chat.name else []
            if len(words) >= 2:
                initials = f"{words[0][0]}{words[1][0]}".upper()
            elif len(words) == 1:
                initials = words[0][:2].upper() if len(words[0]) > 1 else words[0][0].upper()
            else:
                initials = "CH"

            return JsonResponse({
                'success': True,
                'chatId': chat.id,
                'name': chat.name,
                'avatar_url': chat.avatar.url if getattr(chat, 'avatar', None) else None,
                'initials': initials,
                'last_message': "Немає повідомлень",
                'last_time': timezone.localtime(timezone.now()).strftime("%H:%M")
            }, status=200)
        return JsonResponse({'success': False, 'error': 'Некоректні дані форми.'}, status=400)


class UpdateGroupChatView(LoginRequiredMixin, View):
    def post(self, request, chat_id):
        try:
            chat = Chat.objects.get(id=chat_id, admin=request.user, is_group=True)
        except Chat.DoesNotExist:
            return JsonResponse({"success": False, "error": "Групу не знайдено або ви не є її адміном"}, status=444)

        form = GroupDetailsForm(request.POST, request.FILES, instance=chat)
        if form.is_valid():
            chat = form.save()
            user_ids = request.POST.getlist('selected_users')
            
            chat.users.clear()
            chat.users.add(request.user)
            for u_id in user_ids:
                try:
                    friend = User.objects.get(id=u_id)
                    chat.users.add(friend)
                except User.DoesNotExist:
                    continue
            
            words = chat.name.split() if chat.name else []
            if len(words) >= 2:
                initials = f"{words[0][0]}{words[1][0]}".upper()
            elif len(words) == 1:
                initials = words[0][:2].upper() if len(words[0]) > 1 else words[0][0].upper()
            else:
                initials = "CH"

            return JsonResponse({
                'success': True,
                'chatId': chat.id,
                'name': chat.name,
                'avatar_url': chat.avatar.url if getattr(chat, 'avatar', None) else None,
                'initials': initials
            }, status=200)
        return JsonResponse({'success': False, 'error': 'Некоректні дані форми.'}, status=400)


class SendMessageWithImagesView(LoginRequiredMixin, View):
    def post(self, request, chat_id):
        try:
            chat = Chat.objects.get(id=chat_id, users=request.user)
        except Chat.DoesNotExist:
            return JsonResponse({"success": False, "error": "Чат не знайдено"}, status=404)

        text_content = request.POST.get("text", "").strip()
        uploaded_images = request.FILES.getlist("images")

        if not text_content and not uploaded_images:
            return JsonResponse({"success": False, "error": "Повідомлення порожнє"}, status=400)

        message = Message.objects.create(
            chat=chat,
            sender=request.user,
            text=text_content
        )

        saved_image_urls = []
        for image_file in uploaded_images:
            img_obj = MessageImage.objects.create(
                message=message,
                image=image_file
            )
            saved_image_urls.append(img_obj.image.url)

        return JsonResponse({
            "success": True,
            "message": {
                "id": message.id,
                "text": message.text,
                "time": message.created_at.strftime("%H:%M"),
                "images": saved_image_urls
            }
        })
