document.addEventListener("DOMContentLoaded", () => {
    let ws = null;
    let activeChatId = null;
    let currentPage = 1;
    let isLoading = false;
    let hasNext = false;
    let observer = null;
    let selectedFiles = [];

    const csrfMeta = document.querySelector("meta[name=csrf-token]");
    const csrfToken = csrfMeta ? csrfMeta.content : null;

    const welcomeScreen = document.getElementById("chat-welcome-screen");
    const activeScreen = document.getElementById("chat-active-screen");
    const chatWindowContainer = document.getElementById("chat-window-container");
    const chatActiveName = document.getElementById("chat-active-name");
    const chatActiveAvatar = document.getElementById("chat-active-avatar");
    const messagesDisplayArea = document.getElementById("messages-display-area");
    const messageTextInput = document.getElementById("message-text-input");
    const sendMsgBtn = document.getElementById("send-msg-btn");
    
    const chatFileInput = document.getElementById("chat-file-input");
    const imagePreviewContainer = document.getElementById("image-preview-container");

    async function openChatWithUser(userId) {
        if (!userId || userId === "undefined" || userId === "null" || !csrfToken) return;

        try {
            console.log("Надсилаємо запит для користувача з ID:", userId);
            const response = await fetch(`/chat_with/${userId}/`, {
                method: "POST",
                headers: { 
                    'X-CSRFToken': csrfToken,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                console.error(`Сервер повернув помилку з кодом: ${response.status}`);
                return;
            }
            
            const data = await response.json();
            if (!data.success) {
                console.error("Помилка бекенду:", data.error);
                return;
            }

            if (welcomeScreen) welcomeScreen.style.display = "none";
            if (activeScreen) activeScreen.style.display = "flex";
            if (chatWindowContainer) chatWindowContainer.classList.remove("empty-chat-state");
            
            if (chatActiveName) chatActiveName.textContent = data.username;
            if (chatActiveAvatar) {
                chatActiveAvatar.src = data.avatar_url ? data.avatar_url : "/static/icons/User1.png";
            }

            activeChatId = data.chatId;
            currentPage = 1;
            hasNext = false;

            if (messagesDisplayArea) {
                messagesDisplayArea.innerHTML = "";
                const sentinel = document.createElement("div");
                sentinel.id = "messages-load-sentinel";
                sentinel.style.cssText = "width: 100%; height: 1px; clear: both;";
                messagesDisplayArea.appendChild(sentinel);
            }

            if (observer) observer.disconnect();

            const sidebarContainer = document.querySelector(".chat-side .contacts-list") || document.querySelector(".chat-sidebar .contacts-list") || document.querySelector(".contacts-list");
            
            if (sidebarContainer) {
                const existingSidebarRow = sidebarContainer.querySelector(`.chat-user-button[data-chat-user="${userId}"]`);
                
                if (!existingSidebarRow) {
                    const newChatBtn = document.createElement("button");
                    newChatBtn.type = "button";
                    newChatBtn.className = "chat-user-button select";
                    newChatBtn.setAttribute("data-chat-user", userId);
                    newChatBtn.setAttribute("data-chat-username", data.username);
                    
                    const avatarSrc = data.avatar_url ? data.avatar_url : "/static/icons/User1.png";
                    
                    newChatBtn.innerHTML = `
                        <div class="avatar-wrapper">
                            <img src="${avatarSrc}" alt="User">
                            <span class="status-badge offline"></span>
                        </div>
                        <div class="chat-user-info">
                            <div class="chat-user-meta">
                                <span class="chat-user-name">${data.username}</span>
                                <span class="chat-time" data-chat-time-id="${userId}">--:--</span>
                            </div>
                            <p class="chat-last-msg" data-chat-preview-id="${userId}">Немає повідомлень</p>
                        </div>
                    `;
                    
                    if (sidebarContainer.firstChild) {
                        sidebarContainer.insertBefore(newChatBtn, sidebarContainer.firstChild);
                    } else {
                        sidebarContainer.appendChild(newChatBtn);
                    }
                    
                    const emptyText = sidebarContainer.querySelector(".no-chats-yet-text");
                    if (emptyText) emptyText.remove();
                }
            }

            await loadMessages(false);
            startObserver();
            connectWebSocket(data.chatId);

        } catch (error) {
            console.error("Помилка fetch-запиту:", error);
        }
    }
    async function loadMessages(prerend = false) {
        if (!activeChatId || isLoading) return;
        isLoading = true;

        try {
            const response = await fetch(`/${activeChatId}/messages/?page=${currentPage}`, {
                headers: { "X-Requested-With": "XMLHttpRequest" }
            });
            
            if (!response.ok) throw new Error("Помилка завантаження історії");
            
            const data = await response.json();
            const oldHeight = messagesDisplayArea.scrollHeight;
            const fragment = document.createDocumentFragment();

            data.messages.forEach((msg) => {
                const node = renderMessage(msg);
                if (node) fragment.appendChild(node);
            });

            const sentinel = document.getElementById("messages-load-sentinel");

            if (prerend) {
                if (sentinel) sentinel.after(fragment);
                messagesDisplayArea.scrollTop = messagesDisplayArea.scrollHeight - oldHeight;
            } else {
                messagesDisplayArea.appendChild(fragment);
                messagesDisplayArea.scrollTop = messagesDisplayArea.scrollHeight;
            }

            hasNext = data.has_next;
            currentPage++;

        } catch (error) {
            console.error("Помилка завантаження історії повідомлень:", error);
        } finally {
            isLoading = false;
        }
    }

    function startObserver() {
        const sentinel = document.getElementById("messages-load-sentinel");
        if (!sentinel) return;

        observer = new IntersectionObserver(async (entries) => {
            if (entries.isIntersecting && hasNext && !isLoading) {
                await loadMessages(true);
            }
        }, {
            root: messagesDisplayArea,
            threshold: 0.1
        });

        observer.observe(sentinel);
    }

    function connectWebSocket(chatId) {
        if (ws) {
            ws.close();
        }
        
        const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
        const url = `${protocol}${window.location.host}/chat/${chatId}/`;
        
        console.log("Підключення до сокету:", url);
        ws = new WebSocket(url);
        
        ws.onopen = () => {
            console.log("Сокет успішно з'єднано.");
        };

        ws.onmessage = (event) => {
            const eventData = JSON.parse(event.data);
            
            if (messagesDisplayArea) {
                const noMsgText = messagesDisplayArea.querySelector(".no-messages-yet");
                if (noMsgText) noMsgText.remove();

                const node = renderMessage(eventData);
                if (node) {
                    messagesDisplayArea.appendChild(node);
                    messagesDisplayArea.scrollTop = messagesDisplayArea.scrollHeight;
                }
            }
            
            const senderId = eventData.sender_id;
            const textContent = eventData.text || eventData.message || "";
            const timeContent = eventData.time || "";
            
            const targetUserId = (Number(senderId) === Number(window.currentUserId)) ? 
            document.querySelector('.chat-user-button[data-chat-user].select')?.getAttribute('data-chat-user') || senderId : senderId;

            const previewText = document.querySelector(`[data-chat-preview-id="${targetUserId}"]`);
            const previewTime = document.querySelector(`[data-chat-time-id="${targetUserId}"]`);
            
            const chatRow = document.querySelector(`.chat-side .chat-user-button[data-chat-user="${targetUserId}"]`) || 
            document.querySelector(`.chat-sidebar .chat-user-button[data-chat-user="${targetUserId}"]`);

            if (previewText) previewText.textContent = textContent;
            if (previewTime) previewTime.textContent = timeContent;
            if (chatRow) {
                const parentList = chatRow.parentElement;
                if (parentList && parentList.firstChild !== chatRow) {
                    parentList.insertBefore(chatRow, parentList.firstChild);
                }
            }
        };

        ws.onclose = () => {
            console.log("Сокет відключено.");
        };
    }

    function renderMessage(data) {
        if (!messagesDisplayArea || !data) return null;

        const isMe = data.is_me || (data.sender_id && Number(data.sender_id) === Number(window.currentUserId)); 
        const rowDiv = document.createElement("div");
        
        const messageText = (data.text || data.message || "").trim();

        // Формируем блок картинок вне текстовой капсулы
        let imagesHtml = "";
        if (data.images && data.images.length > 0) {
            imagesHtml = `<div class="msg-attached-images">`;
            data.images.forEach(imgUrl => {
                imagesHtml += `<img src="${imgUrl}" alt="Attached Image">`;
            });
            imagesHtml += `</div>`;
        }

        // Рендер пузыря, только если текст присутствует
        let bubbleHtml = "";
        if (messageText !== "") {
            bubbleHtml = `
                <div class="msg-bubble ${isMe ? 'msg-bubble--me' : 'msg-bubble--friend'}">
                    <div class="msg-text">${messageText}</div>
                    <div class="msg-meta">
                        <span class="msg-time">${data.time || ""}</span>
                        ${isMe ? '<span class="msg-status-check">✓</span>' : ''}
                    </div>
                </div>
            `;
        } else {
            // Если текста нет — рендерим только аккуратные часики под медиафайлом
            bubbleHtml = `
                <div class="msg-meta-only-media">
                    <span class="msg-time">${data.time || ""}</span>
                    ${isMe ? '<span class="msg-status-check">✓</span>' : ''}
                </div>
            `;
        }

        if (isMe) {
            rowDiv.className = "msg-row msg-row--me";
            rowDiv.innerHTML = `
                <div class="msg-body-container">
                    ${imagesHtml}
                    ${bubbleHtml}
                </div>
            `;
        } else {
            rowDiv.className = "msg-row msg-row--friend";
            const avatarSrc = chatActiveAvatar ? chatActiveAvatar.src : "/static/icons/User1.png";
            const senderName = data.sender_name || data.sender || chatActiveName.textContent || "Друг";
            
            rowDiv.innerHTML = `
                <img src="${avatarSrc}" class="msg-author-avatar" alt="Avatar">
                <div class="msg-body-wrapper">
                    <span class="msg-author-name">${senderName}</span>
                    <div class="msg-body-container">
                        ${imagesHtml}
                        ${bubbleHtml}
                    </div>
                </div>
            `;
        }

        return rowDiv;
    }
    // 🌟 Логика выбора картинок и отрисовки предпросмотра внутри капсулы поля ввода
    if (chatFileInput) {
        chatFileInput.addEventListener("change", (e) => {
            const files = Array.from(e.target.files);
            
            files.forEach(file => {
                if (!file.type.startsWith("image/")) return;
                selectedFiles.push(file);

                const reader = new FileReader();
                reader.onload = (event) => {
                    const previewItem = document.createElement("div");
                    previewItem.className = "preview-item";
                    
                    previewItem.innerHTML = `
                        <img src="${event.target.result}" alt="Preview">
                        <button type="button" class="preview-remove-btn">&times;</button>
                    `;

                    // Удаление картинки из превью по клику на крестик
                    previewItem.querySelector(".preview-remove-btn").addEventListener("click", () => {
                        selectedFiles = selectedFiles.filter(f => f !== file);
                        previewItem.remove();
                        if (selectedFiles.length === 0) {
                            imagePreviewContainer.style.display = "none";
                        }
                    });

                    imagePreviewContainer.appendChild(previewItem);
                };
                reader.readAsDataURL(file);
            });

            if (selectedFiles.length > 0) {
                imagePreviewContainer.style.display = "flex";
            }
        });
    }

    // 🌟 Отправка сообщения (Текст, Картинки или всё вместе)
    async function sendMessage() {
        if (!messageTextInput || !activeChatId) return;
        const messageText = messageTextInput.value.trim();
        
        if (messageText === "" && selectedFiles.length === 0) return;

        // Если картинок нет, отправляем обычный текст по WebSocket
        if (selectedFiles.length === 0 && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 'message': messageText }));
            messageTextInput.value = "";
            return;
        }

        // Если есть картинки, отправляем FormData POST-запросом на сервер
        const formData = new FormData();
        formData.append("text", messageText);
        selectedFiles.forEach(file => {
            formData.append("images", file);
        });

        try {
            // Очищаем форму на фронтенде перед отправкой
            messageTextInput.value = "";
            imagePreviewContainer.innerHTML = "";
            imagePreviewContainer.style.display = "none";
            selectedFiles = [];
            if (chatFileInput) chatFileInput.value = "";

            const response = await fetch(`/${activeChatId}/send_message_with_images/`, {
                method: "POST",
                headers: { 'X-CSRFToken': csrfToken },
                body: formData
            });

            if (!response.ok) throw new Error("Помилка відправки файлів");
            
            const data = await response.json();
            
            // Отправляем массив сохраненных сервером URL-ссылок в сокет для мгновенной рассылки
            if (ws && ws.readyState === WebSocket.OPEN && data.success) {
                ws.send(JSON.stringify({
                    'message': data.message.text,
                    'text': data.message.text,
                    'sender_id': window.currentUserId,
                    'time': data.message.time,
                    'images': data.message.images // Массив URL изображений из базы данных
                }));
            }

        } catch (error) {
            console.error("Не вдалося надіслати повідомлення з картинками:", error);
        }
    }

    if (sendMsgBtn) {
        sendMsgBtn.addEventListener("click", sendMessage);
    }
    if (messageTextInput) {
        messageTextInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // Фоновое обновление онлайн-статусов пользователей
    function updateOnlineStatuses() {
        fetch("/api/online-statuses/")
            .then(response => response.json())
            .then(data => {
                const onlineUsers = data.online_users || [];
                document.querySelectorAll(".chat-user-button").forEach(button => {
                    const userId = parseInt(button.getAttribute("data-chat-user"));
                    const badge = button.querySelector(".status-badge");
                    if (badge && !isNaN(userId)) {
                        if (onlineUsers.includes(userId)) {
                            badge.classList.remove("offline");
                            badge.classList.add("online");
                        } else {
                            badge.classList.remove("online");
                            badge.classList.add("offline");
                        }
                    }
                });
            })
            .catch(error => console.error("Помилка оновлення статусів:", error));
    }

    updateOnlineStatuses();
    setInterval(updateOnlineStatuses, 5000);

    // Слушатель клика для выбора активного чата в боковой панели
    document.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-chat-user]');
        if (button) {
            event.preventDefault();
            document.querySelectorAll('[data-chat-user]').forEach(b => b.classList.remove('select'));
            button.classList.add('select');
            const userId = button.getAttribute('data-chat-user');
            await openChatWithUser(userId);
        }
    });
});
