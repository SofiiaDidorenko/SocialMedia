from django.urls import path
from .views import (ChatView,ChatWithView,CreateGroupChatView,GetMessageView,GetOnlineStatusesView,SendMessageWithImagesView,UpdateGroupChatView, MarkChatAsReadView)  

urlpatterns = [
    # Главная страница чатов
    path("chat/", ChatView.as_view(), name="chat"),
    
    # Маршрут для инициализации/открытия личного чата
    path("chat_with/<int:userId>/", ChatWithView.as_view(), name="chat_with"),
    path("chat/mark_read/<int:chat_id>/", MarkChatAsReadView.as_view(), name="mark_read"),
    # Загрузка пагинации истории сообщений
    path("<int:chat_id>/messages/", GetMessageView.as_view(), name="message_history"),
    
    # Создание группового чата
    path("create_group_chat/", CreateGroupChatView.as_view(), name="create_group_chat"),
    
    # 🌟 Обработчик редактирования/обновления данных группы админом
    path("chat/<int:chat_id>/update_group/", UpdateGroupChatView.as_view(), name="update_group"),
    
    # АПИ для онлайн статусов
    path("api/online-statuses/", GetOnlineStatusesView.as_view(), name="online_statuses"),
    
    # Обработчик отправки картинок с предпросмотра
    path("<int:chat_id>/send_message_with_images/", SendMessageWithImagesView.as_view(), name="send_message_with_images"),
]
