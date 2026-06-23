import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'SocialMedia.settings')
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

# Імпортуємо масив маршрутів напряму
from chat_app.routing import websocket_urlpatterns


application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(
            websocket_urlpatterns 
        )
    ),
})
