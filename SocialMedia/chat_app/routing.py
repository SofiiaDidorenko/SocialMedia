from django.urls import path
from . import consumers

websocket_urlpatterns = [
    # Зверніть увагу на префікс ws/ та регулярний вираз!
    path('chat/<int:chat_id>/', consumers.ChatConsumer.as_asgi()),
    path('ws/unread/', consumers.UnreadMessageConsumer.as_asgi()),
]
