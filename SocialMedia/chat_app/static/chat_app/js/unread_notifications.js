document.addEventListener("DOMContentLoaded", () => {
    window.unreadWs = null;

    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    function connectUnreadWS() {
        if (window.unreadWs) window.unreadWs.close();
        
        const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        window.unreadWs = new WebSocket(`${protocol}${window.location.host}/ws/unread/`);
        
        window.unreadWs.onmessage = function(event) {
            try {
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

                if (data.chats && Array.isArray(data.chats)) {
                    processAllUnreadData(data.chats, data.total_unread);
                }

            } catch (error) {
                console.error("Помилка обробки unread сокету:", error);
            }
        };
        
        window.unreadWs.onclose = () => { 
            setTimeout(connectUnreadWS, 3000); 
        };
    }

    connectUnreadWS();
    function processAllUnreadData(chatsList, totalUnread) {
        const globalHeaderBadge = document.getElementById("global-chats-badge") 
                               || document.querySelector(".nav-links .unread-badge-counter");

        if (globalHeaderBadge) {
            const totalCount = Number(totalUnread) || 0;
            globalHeaderBadge.setAttribute("data-raw-count", String(totalCount));
            
            if (totalCount > 0) {
                if (globalHeaderBadge.tagName !== "IMG") {
                    globalHeaderBadge.textContent = totalCount > 99 ? "99+" : String(totalCount);
                }
                globalHeaderBadge.style.display = "inline-flex";
            } else {
                if (globalHeaderBadge.tagName !== "IMG") {
                    globalHeaderBadge.textContent = "";
                }
                globalHeaderBadge.style.display = "none";
            }
        }

        let totalPersonalSum = 0;
        let totalGroupsSum = 0;

        chatsList.forEach(chatData => {
            const chatId = chatData.chat_id;
            const isGroup = chatData.is_group;
            const count = Number(chatData.unread_count) || 0;

            if (isGroup) {
                totalGroupsSum += count;
            } else {
                totalPersonalSum += count;
            }

            const chatRow = document.querySelector(`.chat-side .chat-group-button[data-chat-id="${chatId}"]`)
                         || document.querySelector(`.chat-side .chat-user-button[data-chat-id="${chatId}"]`);

            if (chatRow) {
                if (window.activeChatId && String(window.activeChatId) === String(chatId)) {
                    chatRow.classList.remove('has-unread');
                    const unreadDot = chatRow.querySelector(".unread-dot");
                    if (unreadDot) unreadDot.style.display = "none";
                    const btnBadge = chatRow.querySelector(".unread-badge-counter");
                    if (btnBadge) {
                        btnBadge.textContent = "";
                        btnBadge.style.display = "none";
                        btnBadge.removeAttribute("data-raw-count");
                    }
                    return;
                }

                if (count > 0) {
                    chatRow.classList.add('has-unread');
                    const unreadDot = chatRow.querySelector(".unread-dot");
                    if (unreadDot) unreadDot.style.display = "block";
                } else {
                    chatRow.classList.remove('has-unread');
                    const unreadDot = chatRow.querySelector(".unread-dot");
                    if (unreadDot) unreadDot.style.display = "none";
                }

                const btnBadge = chatRow.querySelector(".unread-badge-counter");
                if (btnBadge) {
                    btnBadge.setAttribute("data-raw-count", String(count));
                    if (count > 0) {
                        btnBadge.textContent = count > 99 ? "99+" : String(count);
                        btnBadge.style.display = "inline-flex";
                    } else {
                        btnBadge.textContent = "";
                        btnBadge.style.display = "none";
                    }
                }
            }
        });

        const personalHeaderBadge = document.getElementById("section-messages-badge");
        if (personalHeaderBadge) {
            personalHeaderBadge.setAttribute("data-raw-count", String(totalPersonalSum));
            if (totalPersonalSum > 0) {
                personalHeaderBadge.textContent = totalPersonalSum > 99 ? "99+" : String(totalPersonalSum);
                personalHeaderBadge.style.display = "inline-flex";
            } else {
                personalHeaderBadge.textContent = "";
                personalHeaderBadge.style.display = "none";
            }
        }

        const groupsHeaderBadge = document.getElementById("section-groups-badge");
        if (groupsHeaderBadge) {
            groupsHeaderBadge.setAttribute("data-raw-count", String(totalGroupsSum));
            if (totalGroupsSum > 0) {
                groupsHeaderBadge.textContent = totalGroupsSum > 99 ? "99+" : String(totalGroupsSum);
                groupsHeaderBadge.style.display = "inline-flex";
            } else {
                groupsHeaderBadge.textContent = "";
                groupsHeaderBadge.style.display = "none";
            }
        }
    }
});
