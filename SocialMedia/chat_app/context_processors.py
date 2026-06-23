from django.utils import timezone
from django.db.models import Max
from chat_app.models import Chat, Message 

def sidebar_chats_processor(request):
    if not request.user.is_authenticated:
        return {}

    try:
        # Сортируем чаты по времени последнего сообщения и берем первые 3
        active_chats = Chat.objects.filter(users=request.user).annotate(
            last_msg_time=Max("messages__created_at")
        ).order_by("-last_msg_time")[:3]

        recent_chats_list = []
        for chat in active_chats:
            last_message = chat.messages.order_by("-created_at").first()
            
            # Пропускаем группы, если нам нужны строго ЛИЧНЫЕ чаты один-на-один
            if chat.is_group:
                continue
                
            # Находим собеседника
            friend = chat.users.exclude(id=request.user.id).first()
            if not friend:
                continue
                
            username = f"{friend.first_name} {friend.last_name}".strip() or friend.username
            avatar_url = friend.avatar.url if getattr(friend, 'avatar', None) else "/static/icons/User1.png"

            recent_chats_list.append({
                "id": chat.id,
                "username": username,
                "avatar_url": avatar_url,
                "last_message": last_message.text if last_message else "Немає повідомлень",
                "last_time": timezone.localtime(last_message.created_at).strftime("%H:%M") if last_message else ""
            })

        return {"sidebar_recent_chats": recent_chats_list}
        
    except Exception:
        return {"sidebar_recent_chats": []}
