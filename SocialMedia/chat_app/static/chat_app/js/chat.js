document.addEventListener("DOMContentLoaded", () => {
    window.ws = null;
    window.activeChatId = null;
    window.activeChatIsGroup = false; 
    window.activeChatAdminId = false;
    window.activeChatUsersList = [];  
    window.currentPage = 1;
    window.isLoading = false;
    window.hasNext = false;
    window.observer = null;
    
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

    function ensureUserButtonInList(data, friendId) {
        const contactsList = document.querySelector('aside .contacts-list');
        if (!contactsList) return;

        let chatButton = contactsList.querySelector(`.chat-user-button[data-chat-user="${friendId}"]`);
        
        if (!chatButton) {
            const noChatsText = contactsList.querySelector('.no-chats-yet-text');
            if (noChatsText) noChatsText.remove();

            chatButton = document.createElement('button');
            chatButton.type = 'button';
            chatButton.className = 'chat-user-button';
            chatButton.setAttribute('data-chat-id', data.chatId); 
            chatButton.setAttribute('data-chat-user', friendId);
            chatButton.setAttribute('data-chat-username', data.username);
            chatButton.style.cssText = "width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px; border: none; background: none; border-radius: 12px; cursor: pointer; text-align: left; transition: background 0.2s;";

            let avatarHTML = '';
            if (data.avatar_url && data.avatar_url !== "/static/icons/User1.png") {
                avatarHTML = `<img src="${data.avatar_url}" alt="User" class="chat-user-avatar" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover;">`;
            } else {
                avatarHTML = `
                    <div class="chat-user-avatar personal-text-avatar" style="width: 44px; height: 44px; border-radius: 50%; background-color: #4e4359; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; flex-shrink: 0;">
                        ${data.initials || "UN"}
                    </div>
                `;
            }

            chatButton.innerHTML = `
                <div class="avatar-wrapper" style="position: relative; flex-shrink: 0;">
                    ${avatarHTML}
                    <span class="status-badge offline" style="display: none !important;"></span>
                    <span class="unread-dot" style="display: none;"></span>
                </div>
                <div class="chat-user-info" style="display: flex; justify-content: space-between; min-width: 0; flex-grow: 1; gap: 8px;">
                    <div class="chat-user-meta">
                        <span class="chat-user-name" style="font-weight: 600; font-size: 14px; color: #1a1a1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${data.username}</span>
                        <span class="chat-time" data-chat-time-id="${friendId}"></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 8px;">
                        <p class="chat-last-msg" data-chat-preview-id="${friendId}" style="margin: 0; flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Немає повідомлень</p>
                        <span class="unread-badge-counter" data-raw-count="0" style="display: none;">0</span>
                    </div>
                </div>
            `;

            contactsList.insertBefore(chatButton, contactsList.firstChild);
        }

        document.querySelectorAll('aside .chat-group-button, aside .chat-user-button').forEach(b => b.classList.remove('select'));
        chatButton.classList.add('select');
        chatButton.classList.remove('has-unread'); 
        const uDot = chatButton.querySelector('.unread-dot');
        if (uDot) uDot.style.display = 'none';
        
        if (typeof window.updateOnlineStatuses === 'function') window.updateOnlineStatuses();
    }
    async function openChatWithUser(idSelector) {
        if (!idSelector || idSelector === "undefined" || idSelector === "null" || !csrfToken) return;
        try {
            const response = await fetch(`/chat_with/${idSelector}/`, {
                method: "POST",
                headers: { 'X-CSRFToken': csrfToken, 'Content-Type': 'application/json' }
            });
            if (!response.ok) return;
            const data = await response.json();
            if (!data.success) return;

            if (!data.is_group) {
                ensureUserButtonInList(data, idSelector);
            } else {
                const groupBtn = document.querySelector(`aside .chat-group-button[data-chat-id="${idSelector}"]`);
                if (groupBtn) {
                    document.querySelectorAll('aside .chat-group-button, aside .chat-user-button').forEach(b => b.classList.remove('select'));
                    groupBtn.classList.add('select');
                    groupBtn.classList.remove('has-unread'); 
                    const guDot = groupBtn.querySelector('.unread-dot');
                    if (guDot) guDot.style.display = 'none';
                }
            }

            if (welcomeScreen) welcomeScreen.style.display = "none";
            if (activeScreen) activeScreen.style.display = "flex";
            if (chatWindowContainer) chatWindowContainer.classList.remove("empty-chat-state");
            if (chatActiveName) chatActiveName.textContent = data.username;
            
            if (chatActiveAvatar) {
                const oldTextAvatar = chatActiveAvatar.parentElement.querySelector(".group-text-avatar-header");
                if (oldTextAvatar) oldTextAvatar.remove();
                
                if (data.avatar_url && data.avatar_url !== "/static/icons/User1.png") {
                    chatActiveAvatar.src = data.avatar_url;
                    chatActiveAvatar.style.display = "block";
                } else if (data.initials) {
                    chatActiveAvatar.style.display = "none";
                    const textAvatar = document.createElement("div");
                    textAvatar.className = "group-text-avatar-header";
                    textAvatar.textContent = data.initials;
                    textAvatar.style.cssText = "width: 40px; height: 40px; border-radius: 50%; background-color: #4e4359; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; flex-shrink: 0;";
                    chatActiveAvatar.after(textAvatar);
                } else {
                    chatActiveAvatar.src = "/static/icons/User1.png";
                    chatActiveAvatar.style.display = "block";
                }
            }

            const chatActiveCount = document.getElementById("chat-active-count");
            if (chatActiveCount) {
                if (data.is_group && data.groupMeta) {
                    chatActiveCount.textContent = `${data.groupMeta.total_count} учасників, ${data.groupMeta.online_count} в мережі`;
                    chatActiveCount.style.display = "block";
                } else {
                    chatActiveCount.style.display = "none";
                    chatActiveCount.textContent = "";
                }
            }

            window.activeChatId = data.chatId;
            window.activeChatIsGroup = data.is_group; 
            window.activeChatAdminId = data.adminId ? data.adminId : false;
            window.activeChatUsersList = data.usersList || [];
            window.currentPage = 1;
            window.hasNext = false;

            if (messagesDisplayArea) {
                messagesDisplayArea.innerHTML = "";
                const sentinel = document.createElement("div");
                sentinel.id = "messages-load-sentinel";
                sentinel.style.cssText = "width: 100%; height: 1px; clear: both;";
                messagesDisplayArea.appendChild(sentinel);
            }
            
            if (window.observer) window.observer.disconnect();
            
            await loadMessages(false);
            startObserver();
            connectWebSocket(data.chatId);
        } catch (error) {
            console.error(error);
        }
    }
    window.openChatWithUser = openChatWithUser;

    async function loadMessages(prerend = false) {
        if (!window.activeChatId || window.isLoading) return;
        window.isLoading = true;
        try {
            const response = await fetch(`/${window.activeChatId}/messages/?page=${window.currentPage}`, {
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
            window.hasNext = data.has_next;
            window.currentPage++;
        } catch (error) {
            console.error(error);
        } finally {
            window.isLoading = false;
        }
    }
    window.loadMessages = loadMessages;

    function startObserver() {
        const sentinel = document.getElementById("messages-load-sentinel");
        if (!sentinel) return;
        window.observer = new IntersectionObserver(async (entries) => {
            if (entries.isIntersecting && window.hasNext && !window.isLoading) {
                await loadMessages(true);
            }
        }, { root: messagesDisplayArea, threshold: 0.1 });
        window.observer.observe(sentinel);
    }
    window.startObserver = startObserver;
    function connectWebSocket(chatId) {
        if (window.ws) window.ws.close();
        const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
        window.ws = new WebSocket(`${protocol}${window.location.host}/chat/${chatId}/`);
        
        window.ws.onmessage = function(event) {
            const eventData = JSON.parse(event.data);
            const msgSenderId = Number(eventData.sender_id);
            const currentUserId = Number(window.currentUserId);
            const incomingChatId = Number(eventData.chat_id || chatId);

            if (eventData.type === "connection_established" || eventData.type === "pong") return;

            if (incomingChatId === Number(window.activeChatId)) {
                if (messagesDisplayArea) {
                    const noMsg = messagesDisplayArea.querySelector(".no-messages-yet");
                    if (noMsg) noMsg.remove();
                    const node = renderMessage(eventData);
                    if (node) {
                        messagesDisplayArea.appendChild(node);
                        messagesDisplayArea.scrollTop = messagesDisplayArea.scrollHeight;
                    }
                }
                
                fetch(`/chat/mark_read/${incomingChatId}/`, { method: 'POST', headers: { 'X-CSRFToken': csrfToken } })
                    .catch(err => console.warn(err));
            }
            bumpChatInList(incomingChatId, eventData, msgSenderId, currentUserId);
        };
    }
    window.connectWebSocket = connectWebSocket;

    function formatBadgeCount(count) {
        const value = Number(count) || 0;
        return value > 99 ? '99+' : String(value);
    }

    function applyBadgeText(badge, count) {
        if (!badge) return;
        badge.textContent = formatBadgeCount(count);
        badge.setAttribute('data-raw-count', String(count));
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }

    function updateGlobalUnreadCounters() {
        let totalUnread = 0;
        
        document.querySelectorAll('aside .unread-badge-counter').forEach(b => {
            if (b.id !== 'section-messages-badge' && b.id !== 'global-chats-badge' && b.id !== 'section-groups-badge') {
                const rawCount = b.getAttribute('data-raw-count') ? Number(b.getAttribute('data-raw-count')) : Number(b.textContent) || 0;
                totalUnread += rawCount;
            }
        });

        const sectionHeaderBadge = document.getElementById('section-messages-badge');
        const globalTabBadge = document.getElementById('global-chats-badge') || document.querySelector('.nav-links .unread-badge-counter');

        if (totalUnread > 0) {
            if (sectionHeaderBadge) applyBadgeText(sectionHeaderBadge, totalUnread);
            if (globalTabBadge) applyBadgeText(globalTabBadge, totalUnread);
        } else {
            if (sectionHeaderBadge) { sectionHeaderBadge.textContent = ''; sectionHeaderBadge.style.display = 'none'; }
            if (globalTabBadge) { globalTabBadge.textContent = ''; globalTabBadge.style.display = 'none'; }
        }
    }
    window.updateGlobalUnreadCounters = updateGlobalUnreadCounters;

    function bumpChatInList(incomingChatId, eventData, msgSenderId, currentUserId) {
        const chatRow = document.querySelector(`aside .chat-user-button[data-chat-id="${incomingChatId}"]`)
                     || document.querySelector(`aside .chat-group-button[data-chat-id="${incomingChatId}"]`);

        if (chatRow) {
            const textContent = eventData.text || eventData.message || "";
            const timeContent = eventData.time || "";

            const previewText = chatRow.querySelector('.chat-last-msg') || chatRow.querySelector('.chat-user-message');
            const previewTime = chatRow.querySelector('.chat-time') || chatRow.querySelector('.chat-user-time');
            
            if (previewText) previewText.textContent = textContent;
            if (previewTime) previewTime.textContent = timeContent;

            const parentList = chatRow.parentElement;
            if (parentList && parentList.firstChild !== chatRow) {
                parentList.insertBefore(chatRow, parentList.firstChild);
            }

            if (msgSenderId !== currentUserId && incomingChatId !== Number(window.activeChatId)) {
                chatRow.classList.add('has-unread');

                const unreadDot = chatRow.querySelector(".unread-dot");
                if (unreadDot) unreadDot.style.display = "block";

                let badge = chatRow.querySelector('.unread-badge-counter');
                if (badge) {
                    let currentCount = badge.getAttribute('data-raw-count') ? Number(badge.getAttribute('data-raw-count')) : Number(badge.textContent) || 0;
                    applyBadgeText(badge, currentCount + 1);
                }
                updateGlobalUnreadCounters();
            }
        }
    }
    window.bumpChatInList = bumpChatInList;

    function renderMessage(data) {
        if (!messagesDisplayArea || !data) return null;
        const isMe = data.is_me || (data.sender_id && Number(data.sender_id) === Number(window.currentUserId)); 
        const rowDiv = document.createElement("div");
        const messageText = (data.text || data.message || "").trim();

        let imagesHtml = "";
        if (data.images && data.images.length > 0) {
            imagesHtml = `<div class="msg-attached-images">`;
            data.images.forEach(imgUrl => { imagesHtml += `<img src="${imgUrl}" alt="Attached Image">`; });
            imagesHtml += `</div>`;
        }

        const textHtml = messageText ? `<div class="msg-text">${messageText}</div>` : '';

        if (isMe) {
            rowDiv.className = "msg-row msg-row--me";
            rowDiv.innerHTML = `
                <div class="msg-body-wrapper">
                    <div class="msg-bubble msg-bubble--me">
                        ${imagesHtml}
                        ${textHtml}
                        <div class="msg-meta">
                            <span class="msg-time">${data.time || ""}</span>
                            <span class="msg-status-check">✓</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            rowDiv.className = "msg-row msg-row--friend";
            const avatarSrc = data.sender_avatar || "/static/icons/User1.png";
            const senderName = data.sender_name || data.sender || "Учасник";
            rowDiv.innerHTML = `
                <img src="${avatarSrc}" class="msg-author-avatar" alt="Avatar">
                <div class="msg-body-wrapper">
                    <div class="msg-bubble msg-bubble--friend" style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
                        <span class="msg-author-name" style="display: block; font-weight: 600; font-size: 13px; color: #5d4257; margin-bottom: 2px;">${senderName}</span>
                        ${imagesHtml}
                        <div style="display: flex; align-items: flex-end; justify-content: space-between; width: 100%; gap: 16px;">
                            ${textHtml}
                            <div class="msg-meta" style="flex-shrink: 0; display: flex; align-items: center; gap: 4px; margin-left: auto;">
                                <span class="msg-time">${data.time || ""}</span>
                                <span class="msg-status-check">✓</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        return rowDiv;
    }
    window.renderMessage = renderMessage;
    async function sendMessage() {
        if (!messageTextInput || !window.activeChatId) return;
        const messageText = messageTextInput.value.trim();
        if (messageText === "" && selectedFiles.length === 0) return;

        if (selectedFiles.length === 0 && window.ws && window.ws.readyState === WebSocket.OPEN) {
            window.ws.send(JSON.stringify({ 'message': messageText }));
            messageTextInput.value = "";
            return;
        }

        const formData = new FormData();
        formData.append("text", messageText);
        selectedFiles.forEach(file => { formData.append("images", file); });

        try {
            messageTextInput.value = "";
            imagePreviewContainer.innerHTML = "";
            imagePreviewContainer.style.display = "none";
            selectedFiles = [];
            if (chatFileInput) chatFileInput.value = "";

            const response = await fetch(`/${window.activeChatId}/send_message_with_images/`, {
                method: "POST",
                headers: { 'X-CSRFToken': csrfToken },
                body: formData
            });
            if (!response.ok) throw new Error("Помилка відправки файлів на сервер");
        } catch (error) {
            console.error(error);
        }
    }

    if (sendMsgBtn) sendMsgBtn.addEventListener("click", sendMessage);
    if (messageTextInput) {
        messageTextInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        });
    }

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
                    previewItem.innerHTML = `<img src="${event.target.result}" alt="Preview"><button type="button" class="preview-remove-btn">&times;</button>`;
                    previewItem.querySelector(".preview-remove-btn").addEventListener("click", () => {
                        selectedFiles = selectedFiles.filter(f => f !== file);
                        previewItem.remove();
                        if (selectedFiles.length === 0) imagePreviewContainer.style.display = "none";
                    });
                    imagePreviewContainer.appendChild(previewItem);
                };
                reader.readAsDataURL(file);
            });
            if (selectedFiles.length > 0) imagePreviewContainer.style.display = "flex";
        });
    }

    document.addEventListener('click', function(event) {
        if (event.target.closest('#open-group-modal') || event.target.closest('.create-group-btn-main')) {
            return; 
        }

        const groupButton = event.target.closest('aside .chat-group-button');
        const userButton = event.target.closest('aside .chat-user-button');
        const contactsButton = event.target.closest('.chat-contacts-wrapper .chat-user-button');
        const button = groupButton || userButton || contactsButton;
        
        if (!button) return;

        const isFromContacts = !!event.target.closest('.chat-contacts-wrapper');
        event.preventDefault();

        const isGroup = !!groupButton;
        const chatId = isGroup ? button.getAttribute('data-chat-id') : button.getAttribute('data-chat-user');
        
        const realChatDatabaseId = button.getAttribute('data-chat-id');

        if (!isFromContacts && window.activeChatId && String(window.activeChatId) === String(chatId) && window.activeChatIsGroup === isGroup) {
            return;
        }
        
        document.querySelectorAll('aside .chat-group-button, aside .chat-user-button').forEach(b => b.classList.remove('select'));
        
        if (!isFromContacts) {
            button.classList.add('select');
            button.classList.remove('has-unread');
            const uDot = button.querySelector('.unread-dot');
            if (uDot) uDot.style.display = 'none';
        }

        const badge = button.querySelector('.unread-badge-counter');
        
        if (badge && !isFromContacts && realChatDatabaseId && realChatDatabaseId !== "None" && realChatDatabaseId !== "") {
            badge.textContent = '';
            badge.style.display = 'none';
            badge.removeAttribute('data-raw-count');
            updateGlobalUnreadCounters();
            
            fetch(`/chat/mark_read/${realChatDatabaseId}/`, {
                method: 'POST',
                headers: { 'X-CSRFToken': csrfToken }
            }).catch(err => console.warn("Не вдалося оновити статус прочитання:", err));
        }
        
        openChatWithUser(chatId);
    });

    function updateOnlineStatuses() {
        if (document.hidden) return;

        fetch("/api/online-statuses/")
            .then(res => { if (!res.ok) throw new Error(); return res.json(); })
            .then(data => {
                const onlineUsers = data.online_users || [];
                
                document.querySelectorAll('aside .chat-user-button, .chat-contacts-wrapper .chat-user-button').forEach(button => {
                    const userId = parseInt(button.getAttribute("data-chat-user"));
                    const badge = button.querySelector(".status-badge");
                    if (!badge) return; 
                    if (!isNaN(userId)) {
                        if (onlineUsers.includes(userId)) { 
                            badge.classList.remove("offline"); badge.classList.add("online"); 
                        } else { 
                            badge.classList.remove("online"); badge.classList.add("offline"); 
                        }
                    }
                });

                if (window.activeChatIsGroup && window.activeChatUsersList && window.activeChatUsersList.length > 0) {
                    const chatActiveCount = document.getElementById("chat-active-count");
                    if (chatActiveCount) {
                        const totalCount = window.activeChatUsersList.length;
                        let onlineCount = window.activeChatUsersList.filter(id => onlineUsers.includes(Number(id))).length;
                        if (window.activeChatUsersList.includes(Number(window.currentUserId))) { onlineCount += 1; }
                        chatActiveCount.textContent = `${totalCount} учасників, ${onlineCount} в мережі`;
                    }
                }
            })
            .catch(() => console.warn("Не вдалося синхронізувати online-статуси"));
    }

    function connectUnreadWS() {
        const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
        const wsUnread = new WebSocket(`${protocol}${location.host}/ws/unread/`);
        
        wsUnread.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (Notification.permission === 'granted' && document.hidden) {
                new Notification(data.sender_name || 'Нове повідомлення', {
                    body: data.text || 'Вам прийшло нове повідомлення',
                    icon: '/static/icons/chat.svg'
                });
            }
            if (typeof window.bumpChatInList === 'function' && data.chat_id) {
                window.bumpChatInList(data.chat_id, data, data.sender_id, Number(window.currentUserId));
            }
            if (typeof window.updateGlobalUnreadCounters === 'function') {
                window.updateGlobalUnreadCounters();
            }
        };
        
        wsUnread.onclose = () => { setTimeout(connectUnreadWS, 3000); };
    }

    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    connectUnreadWS();
    updateOnlineStatuses();
    setInterval(updateOnlineStatuses, 5000);

});
