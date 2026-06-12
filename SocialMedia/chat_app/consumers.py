import json
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone
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
        images = data.get("images", [])  # 🌟 Получаем массив картинок от JS

        # 🌟 Если картинки уже есть в запросе, значит fetch их сохранил, повторно в БД не пишем
        if images:
            user = self.scope["user"]
            display_name = f"{user.first_name} {user.last_name}".strip()
            if not display_name:
                display_name = user.username
                
            current_time = timezone.localtime(timezone.now()).strftime("%H:%M")
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "message": text,
                    "text": text,
                    "sender_id": user.id,
                    "sender_name": display_name,
                    "time": data.get("time", current_time),
                    "images": images  # 🌟 Передаем массив картинок в группу
                },
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
                "time": message_data["time"],
                "images": []  # Обычное сообщение без картинок
            },
        )

    async def chat_message(self, event):
        # 🌟 Отправляем клиентам через WebSocket полный набор данных вместе с картинками
        await self.send(text_data=json.dumps({
            "message": event["message"],
            "text": event["text"],
            "sender_id": event["sender_id"],
            "sender_name": event["sender_name"],
            "time": event["time"],
            "images": event.get("images", [])  # 🌟 Пушим массив на фронтенд
        }))

    @database_sync_to_async
    def save_message(self, text):
        user = self.scope["user"]
        message = Message.objects.create(chat_id=self.chat_id, sender=user, text=text)
        local_time = timezone.localtime(message.created_at)
        
        display_name = f"{user.first_name} {user.last_name}".strip()
        if not display_name:
            display_name = user.username

        return {
            "text": message.text, 
            "sender_id": user.id,
            "sender_name": display_name,
            "time": local_time.strftime("%H:%M")
        }
