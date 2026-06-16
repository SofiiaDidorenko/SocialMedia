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

    const groupModal = document.getElementById('group-modal');
    const openModalBtn = document.getElementById('open-group-modal-btn') || document.querySelector('.open-modal-btn');
    const mainForm = document.getElementById('group-chat-main-form');
    const stepUsers = document.getElementById('group-step-users');
    const stepName = document.getElementById('group-step-name');
    const nextStepBtn = document.getElementById('next-group-step');
    const backStepBtn = document.getElementById('back-group-step');
    const groupNameInput = document.getElementById('group-name');
    const submitBtn = document.getElementById('create-group');
    const selectedCountSpan = document.getElementById('selected-count');
    const selectedUsersList = document.getElementById('selected-users-list');
    const searchInput = document.getElementById('search-group-friends');
    const checkboxes = document.querySelectorAll('.group-user-checkbox');
    const friendRows = document.querySelectorAll('.modal-friend-item-row');
    const avatarInput = document.getElementById('group-avatar-upload');
    const avatarPreview = document.getElementById('group-avatar-preview-circle');

    async function openChatWithUser(userId) {
        if (!userId || userId === "undefined" || userId === "null" || !csrfToken) return;
        try {
            const response = await fetch(`/chat_with/${userId}/`, {
                method: "POST",
                headers: { 'X-CSRFToken': csrfToken, 'Content-Type': 'application/json' }
            });
            if (!response.ok) return;
            const data = await response.json();
            if (!data.success) return;

            if (welcomeScreen) welcomeScreen.style.display = "none";
            if (activeScreen) activeScreen.style.display = "flex";
            if (chatWindowContainer) chatWindowContainer.classList.remove("empty-chat-state");
            if (chatActiveName) chatActiveName.textContent = data.username;
            
            if (chatActiveAvatar) {
                const oldTextAvatar = chatActiveAvatar.parentElement.querySelector(".group-text-avatar-header");
                if (oldTextAvatar) oldTextAvatar.remove();
                if (data.avatar_url) {
                    chatActiveAvatar.src = data.avatar_url;
                    chatActiveAvatar.style.display = "block";
                } else {
                    chatActiveAvatar.style.display = "none";
                    const initials = data.initials || (data.username ? data.username.substring(0, 2).toUpperCase() : "CH");
                    const textAvatar = document.createElement("div");
                    textAvatar.className = "group-text-avatar-header";
                    textAvatar.textContent = initials;
                    textAvatar.style.cssText = "width: 40px; height: 40px; border-radius: 50%; background-color: #4e4359; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; flex-shrink: 0;";
                    chatActiveAvatar.after(textAvatar);
                }
            }

            window.activeChatId = data.chatId;
            window.activeChatAdminId = data.adminId;
            window.activeChatUsersList = data.usersList || [];
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
            await loadMessages(false);
            startObserver();
            connectWebSocket(data.chatId);
        } catch (error) {
            console.error(error);
        }
    }
    window.openChatWithUser = openChatWithUser;
    async function loadMessages(prerend = false) {
        if (!activeChatId || isLoading) return;
        isLoading = true;
        try {
            const response = await fetch(`/${activeChatId}/messages/?page=${currentPage}`, {
                headers: { "X-Requested-With": "XMLHttpRequest" }
            });
            if (!response.ok) throw new Error("Помилка завантаження");
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
            console.error(error);
        } finally {
            isLoading = false;
        }
    }

    function startObserver() {
        const sentinel = document.getElementById("messages-load-sentinel");
        if (!sentinel) return;
        observer = new IntersectionObserver(async (entries) => {
            if (entries.isIntersecting && hasNext && !isLoading) await loadMessages(true);
        }, { root: messagesDisplayArea, threshold: 0.1 });
        observer.observe(sentinel);
    }

    function connectWebSocket(chatId) {
        if (ws) ws.close();
        const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
        ws = new WebSocket(`${protocol}${window.location.host}/chat/${chatId}/`);
        ws.onmessage = (event) => {
            const eventData = JSON.parse(event.data);
            if (messagesDisplayArea) {
                const noMsg = messagesDisplayArea.querySelector(".no-messages-yet");
                if (noMsg) noMsg.remove();
                const node = renderMessage(eventData);
                if (node) {
                    messagesDisplayArea.appendChild(node);
                    messagesDisplayArea.scrollTop = messagesDisplayArea.scrollHeight;
                }
            }
        };
    }

    function renderMessage(data) {
        if (!messagesDisplayArea || !data) return null;
        const isMe = data.is_me || (data.sender_id && Number(data.sender_id) === Number(window.currentUserId)); 
        const rowDiv = document.createElement("div");
        const messageText = (data.text || data.message || "").trim();

        let imagesHtml = "";
        if (data.images && data.images.length > 0) {
            imagesHtml = `<div class="msg-attached-images">`;
            data.images.forEach(imgUrl => { imagesHtml += `<img src="${imgUrl}" alt="Media">`; });
            imagesHtml += `</div>`;
        }

        let bubbleHtml = messageText !== "" ? `
            <div class="msg-bubble ${isMe ? 'msg-bubble--me' : 'msg-bubble--friend'}">
                <div class="msg-text">${messageText}</div>
                <div class="msg-meta"><span class="msg-time">${data.time || ""}</span>${isMe ? '<span class="msg-status-check">✓</span>' : ''}</div>
            </div>` : `
            <div class="msg-meta-only-media"><span class="msg-time">${data.time || ""}</span>${isMe ? '<span class="msg-status-check">✓</span>' : ''}</div>`;

        if (isMe) {
            rowDiv.className = "msg-row msg-row--me";
            rowDiv.innerHTML = `<div class="msg-body-container">${imagesHtml}${bubbleHtml}</div>`;
        } else {
            rowDiv.className = "msg-row msg-row--friend";
            const avatarSrc = data.sender_avatar || "/static/icons/User1.png";
            rowDiv.innerHTML = `
                <img src="${avatarSrc}" class="msg-author-avatar" alt="Avatar">
                <div class="msg-body-wrapper">
                    <span class="msg-author-name">${data.sender_name || "Учасник"}</span>
                    <div class="msg-body-container">${imagesHtml}${bubbleHtml}</div>
                </div>`;
        }
        return rowDiv;
    }

    function sendMessage() {
        if (!messageTextInput || !ws || ws.readyState !== WebSocket.OPEN) return;
        const messageText = messageTextInput.value.trim();
        if (messageText === "") return;
        ws.send(JSON.stringify({'message': messageText}));
        messageTextInput.value = "";
    }

    if (sendMsgBtn) sendMsgBtn.addEventListener("click", sendMessage);
    if (messageTextInput) {
        messageTextInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        });
    }
    if (openModalBtn && groupModal) {
        openModalBtn.addEventListener('click', function() {
            groupModal.style.display = 'flex';
            resetModal();
        });
    }

    document.querySelectorAll('.close-modal-btn, .cancel-btn').forEach(btn => {
        if (btn) btn.addEventListener('click', () => { if (groupModal) groupModal.style.display = 'none'; });
    });

    if (groupModal) {
        groupModal.addEventListener('click', (e) => { if (e.target === groupModal) groupModal.style.display = 'none'; });
    }

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase().trim();
            friendRows.forEach(row => {
                const name = row.getAttribute('data-friend-name').toLowerCase();
                row.style.display = name.includes(query) ? 'flex' : 'none';
            });
        });
    }

    checkboxes.forEach(cb => cb.addEventListener('change', updateSelectedCounter));

    function updateSelectedCounter() {
        const checkedCount = document.querySelectorAll('.group-user-checkbox:checked').length;
        if (selectedCountSpan) selectedCountSpan.textContent = checkedCount;
        if (nextStepBtn) nextStepBtn.disabled = checkedCount === 0;
    }

    if (nextStepBtn) {
        nextStepBtn.addEventListener('click', function() {
            if (stepUsers) stepUsers.style.display = 'none';
            if (stepName) stepName.style.display = 'block';
            renderFinalParticipants();
            validateFormStep2();
        });
    }

    if (backStepBtn) {
        backStepBtn.addEventListener('click', function() {
            if (stepName) stepName.style.display = 'none';
            if (stepUsers) stepUsers.style.display = 'block';
        });
    }

    function renderFinalParticipants() {
        if (!selectedUsersList) return;
        selectedUsersList.innerHTML = ''; 
        checkboxes.forEach(cb => {
            if (cb.checked) {
                const row = cb.closest('.modal-friend-item-row');
                const name = row.getAttribute('data-friend-name');
                const avatarImg = row.querySelector('.friend-item-avatar');
                const avatarSrc = avatarImg ? avatarImg.getAttribute('src') : ''; 

                const participantItem = document.createElement('div');
                participantItem.className = 'final-participant-item';
                let avatarHTML = avatarToHTML(avatarSrc, name);

                participantItem.innerHTML = `
                    <div class="participant-left-side">${avatarHTML}<span class="participant-name">${name}</span></div>
                    <button type="button" class="remove-participant-btn" data-user-id="${cb.value}"></button>`;
                selectedUsersList.appendChild(participantItem);
            }
        });

        selectedUsersList.querySelectorAll('.remove-participant-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const userId = this.getAttribute('data-user-id');
                const checkbox = document.getElementById(`chk-friend-${userId}`);
                if (checkbox) { checkbox.checked = false; updateSelectedCounter(); renderFinalParticipants(); }
            });
        });
    }

    function avatarToHTML(src, name) {
        if (!src || src.includes('User1.png') || src === '') {
            return `<div class="participant-text-avatar">${name ? name.substring(0, 2).toUpperCase() : "UN"}</div>`;
        }
        return `<img src="${src}" class="participant-avatar">`;
    }
    if (groupNameInput) groupNameInput.addEventListener('input', validateFormStep2);
    function validateFormStep2() { if (submitBtn && groupNameInput) submitBtn.disabled = groupNameInput.value.trim() === ''; }

    if (avatarInput && avatarPreview) {
        avatarInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    avatarPreview.className = 'group-avatar-preview-circle';
                    avatarPreview.style.backgroundImage = `url('${e.target.result}')`;
                    avatarPreview.style.backgroundSize = 'cover';
                    avatarPreview.style.backgroundPosition = 'center';
                    avatarPreview.textContent = '';
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    }

    // 🌟 ФИКС: Защитный флаг от параллельной отправки дубликатов
    let isSubmitting = false;

    if (mainForm && !mainForm.dataset.submitListenerAttached) {
        mainForm.dataset.submitListenerAttached = "true";

        mainForm.addEventListener('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();

            if (groupNameInput && groupNameInput.value.trim() === '') return;
            
            // 🌟 ФИКС: Если форма уже отправляется — мгновенно сбрасываем остальные 3 вызова
            if (isSubmitting) return; 
            isSubmitting = true;

            if (submitBtn) submitBtn.disabled = true;
            
            fetch(mainForm.action, {
                method: 'POST',
                body: new FormData(mainForm),
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            })
            .then(res => {
                if (!res.ok) throw new Error('Помилка сервера');
                return res.json();
            })
            .then(data => {
                // Размораживаем флаг после ответа сервера
                isSubmitting = false; 
                
                if (data.success) {
                    if (groupModal) groupModal.style.display = 'none';
                    resetModal();
                    
                    const groupList = document.getElementById('group-list') || document.querySelector('.contacts-list');
                    if (groupList) {
                        const existingRow = groupList.querySelector(`[data-chat-id="${data.chatId}"]`) || groupList.querySelector(`[data-chat-user="${data.chatId}"]`);
                        if (existingRow) existingRow.remove();

                        const newBtn = document.createElement('button');
                        newBtn.type = 'button';
                        newBtn.className = 'chat-group-button select';
                        newBtn.setAttribute('data-chat-id', data.chatId);
                        newBtn.setAttribute('data-chat-title', data.name);
                        newBtn.style.cssText = "width: 100%; display: flex; align-items: center; gap: 12px; padding: 8px; border: none; background: none; border-radius: 12px; cursor: pointer; text-align: left; transition: background 0.2s;";
                        
                        const avatarHTML = data.avatar_url ? 
                            `<img src="${data.avatar_url}" alt="Group" class="chat-user-avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;">` : 
                            `<div class="group-text-avatar" style="width: 40px; height: 40px; border-radius: 50%; background-color: #4e4359; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; flex-shrink: 0;">${data.initials}</div>`;
                        
                        newBtn.innerHTML = `
                            ${avatarHTML} 
                            <div class="chat-user-info" style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0;"> 
                                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;"> 
                                    <span class="chat-user-name" style="font-weight: 600; font-size: 13px; color: #1a1a1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 4px;">${data.name}</span> 
                                    <span class="chat-user-time" style="font-size: 11px; color: #8c8c8c; font-weight: 400; white-space: nowrap;">Зараз</span> 
                                </div> 
                                <div class="chat-user-message" style="font-size: 12px; color: #6c757d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 400;">Групу створено</div> 
                            </div>`;
                        
                        document.querySelectorAll('.chat-group-button, .chat-user-button').forEach(b => b.classList.remove('select'));
                        if (groupList.firstChild) { groupList.insertBefore(newBtn, groupList.firstChild); } else { groupList.appendChild(newBtn); }
                    }
                    openChatWithUser(data.chatId);
                }
            })
            .catch(error => {
                isSubmitting = false;
                if (submitBtn) submitBtn.disabled = false;
                console.error('Помилка:', error);
                alert('Не вдалося зберегти групу.');
            });
        });
    }

    if (submitBtn && mainForm) {
        // Очищаем старые триггеры клика, вешаем один чистый
        submitBtn.onclick = function(e) {
            e.preventDefault();
            if (groupNameInput && groupNameInput.value.trim() !== '') {
                mainForm.requestSubmit();
            }
        };
    }

    document.addEventListener('click', function(event) {
        const button = event.target.closest('.chat-group-button');
        if (!button) return;
        event.preventDefault();
        document.querySelectorAll('.chat-group-button, .chat-user-button').forEach(b => b.classList.remove('select'));
        button.classList.add('select');
        openChatWithUser(button.getAttribute('data-chat-id'));
    });

    function resetModal() {
        if (searchInput) searchInput.value = '';
        if (groupNameInput) groupNameInput.value = '';
        friendRows.forEach(row => row.style.display = 'flex');
        checkboxes.forEach(cb => cb.checked = false);
        if (avatarPreview) { avatarPreview.style.backgroundImage = 'none'; avatarPreview.className = 'group-avatar-preview-default'; avatarPreview.textContent = 'NG'; }
        if (avatarInput) avatarInput.value = '';
        updateSelectedCounter();
        if (stepUsers) stepUsers.style.display = 'block';
        if (stepName) stepName.style.display = 'none';
    }

    function updateOnlineStatuses() {
        fetch("/api/online-statuses/").then(res => res.json()).then(data => {
            const onlineUsers = data.online_users || [];
            document.querySelectorAll(".chat-user-button").forEach(button => {
                const userId = parseInt(button.getAttribute("data-chat-user"));
                const badge = button.querySelector(".status-badge");
                if (badge && !isNaN(userId)) {
                    if (onlineUsers.includes(userId)) { badge.classList.remove("offline"); badge.classList.add("online"); } 
                    else { badge.classList.remove("online"); badge.classList.add("offline"); }
                }
            });
        });
    }
    updateOnlineStatuses();
    setInterval(updateOnlineStatuses, 5000);
});
