import datetime
import json
from django.contrib.auth import get_user_model
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.paginator import Paginator
from django.http import HttpRequest, JsonResponse
from django.views import View
from django.views.generic import TemplateView
from django.db.models import OuterRef, Subquery, Count, Q
from django.contrib.sessions.models import Session
from django.utils import timezone
from user_app.utils.friend_queries import get_user_by_section
from .forms import GroupSelectUsersForm, GroupDetailsForm
from .models import Chat, Message, MessageImage

User = get_user_model()

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

        def format_chat_time(dt):
            if not dt:
                return ""
            local_dt = timezone.localtime(dt) if timezone.is_aware(dt) else dt
            local_now = timezone.localtime(timezone.now()) if timezone.is_aware(timezone.now()) else timezone.now()
            if local_dt.date() == local_now.date():
                return local_dt.strftime("%H:%M")
            return local_dt.strftime("%d.%m.%y")

        group_chats_query = Chat.objects.filter(
            users=user, 
            is_group=True
        ).annotate(
            last_msg_text=Subquery(last_message_text),
            last_msg_time=Subquery(last_message_time),
            unread_cnt=Count(
                'messages', 
                filter=~Q(messages__sender=user) & ~Q(messages__readers=user),
                distinct=True
            )
        ).order_by('-last_msg_time', 'id')

        group_chats_with_data = []
        for chat_obj in group_chats_query:
            words = chat_obj.name.split() if chat_obj.name else []
            if len(words) >= 2:
                initials = f"{words[0][0]}{words[1][0]}".upper()
            elif len(words) == 1:
                initials = words[0][:2].upper()
            else:
                initials = "GR"

            group_chats_with_data.append({
                'chat': chat_obj,
                'name': chat_obj.name,
                'avatar_url': chat_obj.avatar.url if getattr(chat_obj, 'avatar', None) else None,
                'initials': initials,
                'last_message': chat_obj.last_msg_text or "Немає повідомлень",
                'last_time': format_chat_time(chat_obj.last_msg_time),
                'unread_count': chat_obj.unread_cnt
            })
        
        context["group_chats"] = group_chats_with_data
        personal_chats = Chat.objects.filter(
            users=user, 
            is_group=False
        ).annotate(
            last_msg_text=Subquery(last_message_text),
            last_msg_time=Subquery(last_message_time),
            unread_cnt=Count(
                'messages', 
                filter=~Q(messages__sender=user) & ~Q(messages__readers=user),
                distinct=True
            )
        ).order_by('-last_msg_time', 'id')

        chats_with_data = []
        for chat_obj in personal_chats:
            friend = chat_obj.users.exclude(id=user.id).first()
            display_name = "Діалог"
            if friend:
                display_name = f"{friend.first_name} {friend.last_name}".strip()
                if not display_name:
                    display_name = friend.username
                
            words = display_name.split() if display_name else []
            if len(words) >= 2:
                initials = f"{words[0][0]}{words[1][0]}".upper()
            elif len(words) == 1:
                initials = words[0][:2].upper()
            else:
                initials = "CH"
                
            chats_with_data.append({
                'chat': chat_obj,
                'friend_id': friend.id if friend else None,
                'username': display_name,
                'initials': initials,
                'avatar_url': friend.avatar.url if (friend and getattr(friend, 'avatar', None)) else "/static/icons/User1.png",
                'last_message': chat_obj.last_msg_text or "Немає повідомлень",
                'last_time': format_chat_time(chat_obj.last_msg_time),
                'unread_count': chat_obj.unread_cnt
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
                    
        return JsonResponse({"online_users": online_user_ids})

class ChatWithView(LoginRequiredMixin, View):
    login_url = "auth"

    def post(self, request, userId):
        chat_obj = Chat.objects.filter(id=userId, is_group=True, users=request.user).first()
        
        if not chat_obj:
            try:
                other_user = User.objects.get(id=userId)
            except User.DoesNotExist:
                return JsonResponse({"success": False, "error": "Чат або користувача не знайдено"}, status=404)

            chat_ids = Chat.objects.filter(users=request.user, is_group=False).values_list("id", flat=True)
            chat_obj = Chat.objects.filter(id__in=chat_ids, users=other_user, is_group=False).first()
            
            if chat_obj is None:
                chat_obj = Chat.objects.create(is_group=False)
                chat_obj.users.add(request.user, other_user)

        group_meta = None
        if chat_obj.is_group:
            active_sessions = Session.objects.filter(expire_date__gte=timezone.now())
            online_global_ids = set()
            five_minutes_ago = timezone.now() - datetime.timedelta(minutes=5)
            
            for session in active_sessions:
                s_data = session.get_decoded()
                u_id = s_data.get('_auth_user_id')
                last_act = s_data.get('last_activity')
                if u_id and last_act:
                    try:
                        last_activity_dt = timezone.datetime.fromisoformat(last_act)
                        if last_activity_dt >= five_minutes_ago:
                            online_global_ids.add(int(u_id))
                    except (ValueError, TypeError):
                        continue

            total_participants = chat_obj.users.count()
            online_participants = chat_obj.users.filter(id__in=online_global_ids).count()
            
            group_meta = {
                "total_count": total_participants,
                "online_count": online_participants
            }

        avatar_url = chat_obj.avatar.url if getattr(chat_obj, 'avatar', None) else "/static/icons/User1.png"
        
        if chat_obj.is_group:
            display_name = chat_obj.name
            words = chat_obj.name.split() if chat_obj.name else []
            initials = "".join([w.upper() for w in words[:2]]) if words else "GR"
        else:
            friend = chat_obj.users.exclude(id=request.user.id).first()
            display_name = f"{friend.first_name} {friend.last_name}".strip() if friend else "Діалог"
            if not display_name:
                display_name = friend.username if friend else "Діалог"
            initials = display_name[:2].upper() if len(display_name) > 1 else display_name.upper()

        user_ids_list = list(chat_obj.users.values_list('id', flat=True))
        
        return JsonResponse({
            "success": True,
            "chatId": chat_obj.id,
            "is_group": chat_obj.is_group,
            "username": display_name,
            "avatar_url": avatar_url,
            "initials": initials,
            "adminId": chat_obj.admin.id if getattr(chat_obj, 'admin', None) else None,
            "usersList": user_ids_list,
            "groupMeta": group_meta
        })
class GetMessageView(LoginRequiredMixin, View): 
    def get(self, request, chat_id):
        if not Chat.objects.filter(id=chat_id, users=request.user).exists():
            return JsonResponse({"success": False}, status=403)
            
        messages_in_chat = Message.objects.filter(chat_id=chat_id).select_related("sender").prefetch_related("images").order_by("-created_at", "-id") 
        page_object = Paginator(messages_in_chat, 10).get_page(request.GET.get("page", 1))
        messages = list(page_object.object_list)[::-1]
        
        return JsonResponse({
            "messages": [{
                "id": message.id,
                "text": message.text,
                "sender": f"{message.sender.first_name} {message.sender.last_name}".strip() or message.sender.username,
                "sender_id": message.sender.id,
                "sender_avatar": message.sender.avatar.url if getattr(message.sender, 'avatar', None) else "/static/icons/User1.png",
                "time": timezone.localtime(message.created_at).strftime("%H:%M"),
                "images": [img.image.url for img in message.images.all()]
            } for message in messages],
            "has_next": page_object.has_next()
        })

class CreateGroupChatView(LoginRequiredMixin, View):
    def post(self, request, *args, **kwargs):
        user_ids = request.POST.getlist("selected_users")
        if not user_ids and request.body:
            try:
                data = json.loads(request.body)
                user_ids = data.get("selected_users", []) or data.get("users", [])
            except json.JSONDecodeError:
                pass

        try:
            user_ids = [int(uid) for uid in user_ids if int(uid) != request.user.id]
        except (ValueError, TypeError):
            return JsonResponse({"success": False, "error": "Некоректні ID учасників"}, status=400)

        if len(user_ids) <= 1:
            if len(user_ids) == 1:
                friend_id = user_ids[0]
            else:
                return JsonResponse({"success": False, "error": "Не вибрано жодного учасника"}, status=400)

            existing_chat = Chat.objects.filter(is_group=False, users=request.user).filter(users__id=friend_id).first()
            if existing_chat:
                return JsonResponse({"success": True, "chatId": existing_chat.id, "is_group": False})
            
            new_personal_chat = Chat.objects.create(is_group=False)
            new_personal_chat.users.add(request.user, friend_id)
            return JsonResponse({"success": True, "chatId": new_personal_chat.id, "is_group": False})

        group_name = request.POST.get("name", "").strip()
        if not group_name:
            group_name = f"Група {request.user.username}"

        group_chat = Chat.objects.create(is_group=True, name=group_name, admin=request.user)
        group_chat.users.add(request.user)
        for uid in user_ids:
            group_chat.users.add(uid)

        if "avatar" in request.FILES:
            group_chat.avatar = request.FILES["avatar"]
            group_chat.save()

        avatar_url = group_chat.avatar.url if getattr(group_chat, 'avatar', None) else None
        words = group_chat.name.split()
        initials = "".join([w.upper() for w in words[:2]]) if words else "GR"

        return JsonResponse({
            "success": True,
            "chatId": group_chat.id,
            "is_group": True,
            "group_name": group_chat.name,
            "avatar_url": avatar_url,
            "initials": initials
        })

class UpdateGroupChatView(LoginRequiredMixin, View):
    def post(self, request, chat_id):
        try:
            chat = Chat.objects.get(id=chat_id, admin=request.user, is_group=True)
        except Chat.DoesNotExist:
            return JsonResponse({"success": False, "error": "Групу не знайдено або ви не є її адміном"}, status=403)

        form = GroupDetailsForm(request.POST, request.FILES, instance=chat)
        if form.is_valid():
            chat = form.save()
            raw_user_ids = request.POST.getlist('selected_users')
            
            valid_user_ids = []
            for u_id in raw_user_ids:
                try:
                    uid_int = int(u_id)
                    if uid_int != request.user.id:
                        valid_user_ids.append(uid_int)
                except (ValueError, TypeError):
                    continue
            
            existing_users = list(User.objects.filter(id__in=valid_user_ids).values_list('id', flat=True))
            existing_users.append(request.user.id)
            chat.users.set(existing_users)
            
            words = chat.name.split() if chat.name else []
            if len(words) >= 2:
                initials = f"{words[0][0]}{words[1][0]}".upper()
            elif len(words) == 1:
                initials = words[0][:2].upper()
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
                "sender_id": request.user.id,
                "sender_name": f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username,
                "sender_avatar": request.user.avatar.url if getattr(request.user, 'avatar', None) else "/static/icons/User1.png",
                "time": timezone.localtime(message.created_at).strftime("%H:%M"),
                "images": saved_image_urls
            }
        })

class MarkChatAsReadView(LoginRequiredMixin, View):
    def post(self, request, chat_id):
        try:
            chat_obj = Chat.objects.get(id=chat_id, users=request.user)
        except Chat.DoesNotExist:
            return JsonResponse({"success": False, "error": "Чат не знайдено"}, status=404)

        unread_messages = Message.objects.filter(chat=chat_obj).exclude(sender=request.user).exclude(readers=request.user)
        
        if unread_messages.exists():
            MessageReadersMap = Message.readers.through
            links = [MessageReadersMap(message_id=msg.id, user_id=request.user.id) for msg in unread_messages]
            MessageReadersMap.objects.bulk_create(links, ignore_conflicts=True)

        return JsonResponse({"success": True})
