import json
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone
from django.db.models import Count, Q, OuterRef, Subquery
from django.db import transaction
from .models import Chat, Message


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.chat_id = self.scope["url_route"]["kwargs"]["chat_id"]
        self.room_group_name = f"chat_{self.chat_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        text = data.get("message", data.get("text", "")).strip()
        images = data.get("images", [])
        user = self.scope["user"]

        display_name = f"{user.first_name} {user.last_name}".strip()
        if not display_name:
            display_name = user.username

        current_time = timezone.localtime(timezone.now()).strftime("%H:%M")

        if images:
            sender_avatar_url = user.avatar.url if getattr(user, 'avatar', None) else "/static/icons/User1.png"
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "message": text,
                    "text": text,
                    "sender_id": user.id,
                    "sender_name": display_name,
                    "sender_avatar": sender_avatar_url,
                    "time": data.get("time", current_time),
                    "images": images,
                    "chat_id": self.chat_id
                },
            )

            await self.notify_unread(
                chat_id=self.chat_id,
                sender_id=user.id,
                text=text if text else "📷 Фотографія",
                sender_name=display_name,
                time=data.get("time", current_time)
            )
            return

        if not text:
            return
            
        message_data = await self.save_message(text)
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "message": message_data["text"],
                "text": message_data["text"],
                "sender_id": message_data["sender_id"],
                "sender_name": message_data["sender_name"],
                "sender_avatar": message_data["sender_avatar"],
                "time": message_data["time"],
                "images": [],
                "chat_id": int(self.chat_id)
            },
        )

        await self.notify_unread(
            chat_id=int(self.chat_id),
            sender_id=int(message_data["sender_id"]),
            text=message_data["text"],
            sender_name=message_data["sender_name"],
            time=message_data["time"]
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "message": event.get("message", ""),
            "text": event.get("text", event.get("message", "")),
            "sender_id": event.get("sender_id"),
            "sender_name": event.get("sender_name", "Учасник"),
            "sender_avatar": event.get("sender_avatar", "/static/icons/User1.png"),
            "time": event.get("time", ""),
            "images": event.get("images", []),
            "chat_id": event.get("chat_id", self.chat_id)
        }))

    async def notify_unread(self, chat_id, sender_id, text, sender_name, time):
        users = await self.get_chat_users(chat_id)
        for user_id in users:
            if int(user_id) != int(sender_id):
                await self.channel_layer.group_send(
                    f"unread_{user_id}",
                    {
                        "type": "new_message_notification",
                        "chat_id": chat_id,
                        "text": text,
                        "sender_id": sender_id,
                        "sender_name": sender_name,
                        "time": time,
                    }
                )

    @database_sync_to_async
    def get_chat_users(self, chat_id):
        try:
            chat = Chat.objects.get(id=chat_id)
            return list(chat.users.values_list('id', flat=True))
        except Chat.DoesNotExist:
            return []

    @database_sync_to_async
    def save_message(self, text):
        user = self.scope["user"]
        message = Message.objects.create(chat_id=self.scope["url_route"]["kwargs"]["chat_id"], sender=user, text=text)
        message.readers.add(user)
        
        local_time = timezone.localtime(message.created_at)
        display_name = f"{user.first_name} {user.last_name}".strip()
        if not display_name:
            display_name = user.username

        avatar_url = user.avatar.url if getattr(user, 'avatar', None) else "/static/icons/User1.png"

        return {
            "text": message.text, 
            "sender_id": user.id,
            "sender_name": display_name,
            "sender_avatar": avatar_url,
            "time": local_time.strftime("%H:%M")
        }


class UnreadMessageConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        self.room_group_name = f"unread_{self.user.id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        await self.send_unread_message()
        
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def send_unread_message(self):
        data = await self.get_unread_data()
        await self.send(text_data=json.dumps(data))
        
    async def new_message_notification(self, event):
        data = await self.get_unread_data()
        data["chat_id"] = event.get("chat_id")
        data["text"] = event.get("text")
        data["sender_name"] = event.get("sender_name")
        data["sender_id"] = event.get("sender_id")
        data["time"] = event.get("time")
        await self.send(text_data=json.dumps(data))
        
    @database_sync_to_async
    def get_unread_data(self):
        user = self.user
        
        # Використовуємо READ UNCOMMITTED або очищення кешу запитів всередині ізольованої транзакції
        with transaction.atomic():
            last_msg_text = Message.objects.filter(chat_id=OuterRef('pk')).order_by('-created_at', '-id').values('text')[:1]
            last_msg_time = Message.objects.filter(chat_id=OuterRef('pk')).order_by('-created_at', '-id').values('created_at')[:1]
            
            chats = Chat.objects.filter(users=user).annotate(
                unread_cnt=Count(
                    'messages',
                    filter=~Q(messages__sender=user) & ~Q(messages__readers=user),
                    distinct=True
                ),
                last_text=Subquery(last_msg_text),
                last_time_raw=Subquery(last_msg_time)
            ).order_by('-messages__created_at').distinct()
            
            result = []
            total = 0
            for chat in chats:
                if chat.unread_cnt:
                    total += chat.unread_cnt
                formatted_time = ""
                if chat.last_time_raw:
                    formatted_time = timezone.localtime(chat.last_time_raw).strftime('%H:%M')
                result.append({
                    'chat_id': chat.id,
                    'is_group': chat.is_group,
                    'unread_count': chat.unread_cnt,
                    'last_message': chat.last_text if chat.last_text else '',
                    'last_time': formatted_time,
                })
            return {'total_unread': total, 'chats': result}
