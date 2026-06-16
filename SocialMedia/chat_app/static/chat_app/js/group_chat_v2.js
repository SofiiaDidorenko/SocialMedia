document.addEventListener('DOMContentLoaded', function() {
    const groupModal = document.getElementById('group-modal');
    const openModalBtn = document.getElementById('open-group-modal') || document.querySelector('.create-group-btn-main');
    const closeStep1Btn = document.getElementById('close-group-modal');
    const closeStep2Btn = document.getElementById('close-group-name-modal');
    const cancelBtn = document.getElementById('cancel-group-modal');
    const mainForm = document.getElementById('group-chat-main-form');
    const stepUsers = document.getElementById('group-step-users');
    const stepName = document.getElementById('group-step-name');
    const nextStepBtn = document.getElementById('next-group-step');
    const backStepBtn = document.getElementById('back-group-step');
    const submitBtn = document.getElementById('create-group');
    const searchInput = document.getElementById('search-group-friends');
    const friendRows = document.querySelectorAll('.modal-friend-item-row');
    const checkboxes = document.querySelectorAll('.group-user-checkbox');
    const selectedCountSpan = document.getElementById('selected-count');
    const selectedUsersList = document.getElementById('selected-users-list');
    const groupNameInput = document.getElementById('group-name');
    const avatarInput = document.getElementById('group-avatar-upload');
    const avatarPreview = document.getElementById('group-avatar-preview-circle');

    const welcomeScreen = document.getElementById("chat-welcome-screen");
    const activeScreen = document.getElementById("chat-active-screen");
    const chatWindowContainer = document.getElementById("chat-window-container");
    const chatActiveName = document.getElementById("chat-active-name");
    const chatActiveAvatar = document.getElementById("chat-active-avatar");
    const messagesDisplayArea = document.getElementById("messages-display-area");
    const messageTextInput = document.getElementById("message-text-input");
    const sendMsgBtn = document.getElementById("send-msg-btn");

    const csrfMeta = document.querySelector("meta[name=csrf-token]");
    const csrfToken = csrfMeta ? csrfMeta.content : null;

    let ws = null;
    let activeChatId = null;
    let currentPage = 1;
    let isLoading = false;
    let hasNext = false;
    let observer = null;

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
            console.error("Не вдалося завантажити повідомлення:", error);
        } finally {
            isLoading = false;
        }
    }

    function startObserver() {
        const sentinel = document.getElementById("messages-load-sentinel");
        if (!sentinel) return;

        observer = new IntersectionObserver(async (entries) => {
            if (entries[0].isIntersecting && hasNext && !isLoading) {
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
            
            // 1. АВТО-ОНОВЛЕННЯ СТРІЧКИ ПОВІДОМЛЕНЬ (Додаємо нове повідомлення в кінець чату)
            if (messagesDisplayArea) {
                const noMsgText = messagesDisplayArea.querySelector(".no-messages-yet");
                if (noMsgText) noMsgText.remove();

                const node = renderMessage(eventData);
                if (node) {
                    messagesDisplayArea.appendChild(node);
                    // Автоматичний скролл вниз, щоб користувач одразу бачив нове повідомлення
                    messagesDisplayArea.scrollTop = messagesDisplayArea.scrollHeight;
                }
            }
            
            // ЗАХИСТ: Зчитуємо дані з будь-якого формату відповіді сервера Django
            const senderId = eventData.sender_id || eventData.senderId;
            const textContent = eventData.text || eventData.message || "";
            const timeContent = eventData.time || eventData.created_at || "Зараз";
            const senderName = eventData.sender_name || eventData.sender || "";

            // 2. АВТО-ОНОВЛЕННЯ САЙДБАРУ (Оновлюємо текст і час останнього повідомлення на льоту)
            // Шукаємо плашку за data-chat-id (для груп)
            const chatRow = document.querySelector(`.chat-group-button[data-chat-id="${chatId}"]`);
            if (chatRow) {
                const previewText = chatRow.querySelector('.chat-user-message');
                const previewTime = chatRow.querySelector('.chat-user-time');
                
                const isMe = eventData.is_me || (senderId && Number(senderId) === Number(window.currentUserId)); 

                if (previewText) {
                    // Якщо пише інший учасник групи, робимо формат "Ім'я: текст"
                    if (!isMe && senderName) {
                        previewText.textContent = `${senderName}: ${textContent}`;
                    } else {
                        previewText.textContent = textContent;
                    }
                }
                if (previewTime) {
                    previewTime.textContent = timeContent;
                }

                // 3. АВТО-ПІДНЯТТЯ ЧАТУ ВГОРУ (Переносимо активний чат на самий верх списку)
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


    window.connectWebSocket = connectWebSocket;

    function buildAlphabeticalSections() {
        const friendsListContainer = document.querySelector('.modal-friends-list');
        if (!friendsListContainer) return;

        // Збираємо всі рядки друзів, які вивів Django
        const rows = Array.from(friendsListContainer.querySelectorAll('.modal-friend-item-row'));
        if (rows.length === 0) return;

        // Сортуємо рядки за алфавітом (враховуючи українську/англійську мови)
        rows.sort((a, b) => {
            const nameA = a.getAttribute('data-friend-name').trim();
            const nameB = b.getAttribute('data-friend-name').trim();
            return nameA.localeCompare(nameB);
        });

        // Очищаємо контейнер, щоб розставити елементи наново разом із літерами
        friendsListContainer.innerHTML = '';

        let currentLetter = '';

        rows.forEach(row => {
            const name = row.getAttribute('data-friend-name').trim();
            if (!name) return;

            // Беремо першу літеру імені у верхньому регістрі
            const firstLetter = name.charAt(0).toUpperCase();

            // Якщо це нова літера — створюємо для неї блок-заголовок
            if (firstLetter !== currentLetter) {
                currentLetter = firstLetter;

                const letterHeading = document.createElement('div');
                letterHeading.className = 'friends-alphabet-letter';
                letterHeading.textContent = currentLetter;
                
                // Стилізуємо літеру-роздільник під макет
                letterHeading.style.cssText = "font-size: 12px; font-weight: 700; color: #8c8c8c; padding: 12px 0 6px 0; margin-top: 4px; border-bottom: 1px solid #f2f2f7; width: 100%; font-family: sans-serif;";
                
                friendsListContainer.appendChild(letterHeading);
            }

            // Додаємо сам рядок друга під своєю літерою
            friendsListContainer.appendChild(row);
        });
    }

    // Запускаємо групування за алфавітом відразу при завантаженні сторінки
    buildAlphabeticalSections();


        function sendMessage() {
        if (!messageTextInput || !ws || ws.readyState !== WebSocket.OPEN) return;
        const messageText = messageTextInput.value.trim();
        if (messageText === "") return;
        ws.send(JSON.stringify({'message': messageText}));
        messageTextInput.value = "";
    }

    if (sendMsgBtn) {
        sendMsgBtn.addEventListener("click", sendMessage);
    }
    if (messageTextInput) {
        messageTextInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                sendMessage();
            }
        });
    }

    function renderMessage(data) {
        if (!messagesDisplayArea || !data) return null;

        const isMe = data.is_me || (data.sender_id && Number(data.sender_id) === Number(window.currentUserId)); 
        const rowDiv = document.createElement("div");

        if (isMe) {
            rowDiv.className = "msg-row msg-row--me";
            rowDiv.innerHTML = `
                <div class="msg-bubble msg-bubble--me">
                    <div class="msg-text">${data.text || data.message || ""}</div>
                    <div class="msg-meta">
                        <span class="msg-time">${data.time || ""}</span>
                        <span class="msg-status-check">✓</span>
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
                    <span class="msg-author-name">${senderName}</span>
                    <div class="msg-bubble msg-bubble--friend">
                        <div class="msg-text">${data.text || data.message || ""}</div>
                        <div class="msg-meta">
                            <span class="msg-time">${data.time || ""}</span>
                            <span class="msg-status-check">✓</span>
                        </div>
                    </div>
                </div>
            `;
        }

        return rowDiv;
    }

    async function openGroupChat(chatId, groupTitle, customAvatarUrl = null) {
        if (!chatId || !csrfToken) return;

        if (welcomeScreen) welcomeScreen.style.display = "none";
        if (activeScreen) activeScreen.style.display = "flex";
        if (chatWindowContainer) chatWindowContainer.classList.remove("empty-chat-state");
        
        if (chatActiveName) chatActiveName.textContent = groupTitle;

        if (chatActiveAvatar) {
            const oldTextAvatar = chatActiveAvatar.parentElement.querySelector(".group-text-avatar-header");
            if (oldTextAvatar) oldTextAvatar.remove();

            if (customAvatarUrl) {
                chatActiveAvatar.src = customAvatarUrl;
                chatActiveAvatar.style.display = "block";
            } else {
                chatActiveAvatar.style.display = "none";

                const initials = groupTitle ? groupTitle.substring(0, 2).toUpperCase() : "GR";

                const textAvatar = document.createElement("div");
                textAvatar.className = "group-text-avatar-header";
                textAvatar.textContent = initials;
                
                textAvatar.style.cssText = "width: 40px; height: 40px; border-radius: 50%; background-color: #4e4359; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; flex-shrink: 0;";

                chatActiveAvatar.after(textAvatar);
            }
        }

        activeChatId = chatId;
        window.activeChatId = chatId;
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
        connectWebSocket(chatId);
    }
    window.openGroupChat = openGroupChat;

    if (openModalBtn && groupModal) {
        openModalBtn.addEventListener('click', function() {
            groupModal.style.display = 'flex';
            if (typeof resetModal === 'function') resetModal();
        });
    }

    [closeStep1Btn, closeStep2Btn, cancelBtn].forEach(btn => {
        if (btn) btn.addEventListener('click', () => {
            groupModal.style.display = 'none';
        });
    });

    if (groupModal) {
        groupModal.addEventListener('click', (e) => {
            if (e.target === groupModal) groupModal.style.display = 'none';
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase().trim();
            const friendsListContainer = document.querySelector('.modal-friends-list');
            if (!friendsListContainer) return;

            if (typeof friendRows !== 'undefined') {
                friendRows.forEach(row => {
                    const name = row.getAttribute('data-friend-name').toLowerCase();
                    row.style.display = name.includes(query) ? 'flex' : 'none';
                });
            }

            const letters = friendsListContainer.querySelectorAll('.friends-alphabet-letter');
            letters.forEach(letter => {
                let hasVisibleFriends = false;
                let nextEl = letter.nextElementSibling;

                while (nextEl && !nextEl.classList.contains('friends-alphabet-letter')) {
                    if (nextEl.style.display === 'flex') {
                        hasVisibleFriends = true;
                        break;
                    }
                    nextEl = nextEl.nextElementSibling;
                }

                letter.style.display = hasVisibleFriends ? 'block' : 'none';
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
                if (!row) return;
                
                const name = row.getAttribute('data-friend-name');
                const avatarImg = row.querySelector('.friend-item-avatar');
                const avatarSrc = avatarImg ? avatarImg.getAttribute('src') : ''; 

                const participantItem = document.createElement('div');
                // 🌟 ВСТАНОВЛЮЄМО ТОЙ САМИЙ КЛАС, ЩО Й ПРИ СТВОРЕННІ ГРУПИ
                participantItem.className = 'final-participant-item';
                
                let avatarHTML = '';
                if (!avatarSrc || avatarSrc.includes('User1.png') || avatarSrc === '') {
                    const initials = name ? name.substring(0, 2).toUpperCase() : "UN";
                    avatarHTML = `<div class="participant-text-avatar">${initials}</div>`;
                } else {
                    avatarHTML = `<img src="${avatarSrc}" class="participant-avatar" alt="Avatar">`;
                }
                participantItem.innerHTML = `
                    <div class="participant-left-side">
                        ${avatarHTML}
                        <span class="participant-name">${name}</span>
                    </div>
                    <button type="button" class="remove-participant-btn" data-user-id="${cb.value}"></button>
                `;
                
                selectedUsersList.appendChild(participantItem);
            }
        });
        selectedUsersList.querySelectorAll('.remove-participant-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const userId = this.getAttribute('data-user-id');
                const checkbox = document.getElementById(`chk-friend-${userId}`);
                if (checkbox) {
                    checkbox.checked = false;
                    // Перераховуємо лічильник "Вибрано: Х"
                    if (typeof updateSelectedCounter === 'function') updateSelectedCounter();
                    // Перемальовуємо цей список заново
                    renderFinalParticipants();
                }
            });
        });
    }


    if (groupNameInput) groupNameInput.addEventListener('input', validateFormStep2);

    function validateFormStep2() {
        if (submitBtn && groupNameInput) {
            submitBtn.disabled = groupNameInput.value.trim() === '';
        }
    }

    if (avatarInput && avatarPreview) {
        avatarInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    avatarPreview.className = 'group-avatar-preview-circle';
                    avatarPreview.style.backgroundImage = `url('${e.target.result}')`;
                    avatarPreview.style.backgroundSize = 'cover';
                    avatarPreview.style.backgroundPosition = 'center';
                    avatarPreview.textContent = '';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (submitBtn && mainForm) {
        submitBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (groupNameInput && groupNameInput.value.trim() !== '') {
                mainForm.requestSubmit();
            }
        });
    }

        if (mainForm && !mainForm.dataset.submitListenerAttached) {
        mainForm.dataset.submitListenerAttached = "true";

        mainForm.addEventListener('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            if (groupNameInput && groupNameInput.value.trim() === '') return;
            const formData = new FormData(mainForm);
            
            fetch(mainForm.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => {
                if (!response.ok) throw new Error('Помилка сервера');
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    groupModal.style.display = 'none';
                    const newChatId = data.chatId || data.chat_id;
                    const groupTitle = data.group_name || data.name || groupNameInput.value.trim();
                    const avatarUrl = data.avatar_url || null;
                    const initials = data.initials || (groupTitle ? groupTitle.substring(0, 2).toUpperCase() : "GR");

                    resetModal();

                    if (newChatId) {
                        const groupList = document.getElementById('group-list') || document.querySelector('.contacts-list');
                        const emptyText = document.getElementById('group-empty');
                        if (emptyText) emptyText.remove();
                        
                        if (groupList) {
                            const existingRow = groupList.querySelector(`[data-chat-id="${newChatId}"]`) || groupList.querySelector(`[data-chat-user="${newChatId}"]`);
                            if (existingRow) existingRow.remove();

                            const newBtn = document.createElement('button');
                            newBtn.type = 'button';
                            newBtn.className = 'chat-group-button select';
                            newBtn.setAttribute('data-chat-id', newChatId);
                            newBtn.setAttribute('data-chat-title', groupTitle);
                            newBtn.style.cssText = "width: 100%; display: flex; align-items: center; gap: 12px; padding: 8px; border: none; background: none; border-radius: 12px; cursor: pointer; text-align: left; transition: background 0.2s;";
                            
                            const avatarHTML = avatarUrl ? 
                                `<img src="${avatarUrl}" alt="Group" class="chat-user-avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;">` : 
                                `<div class="group-text-avatar" style="width: 40px; height: 40px; border-radius: 50%; background-color: #4e4359; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; flex-shrink: 0;">${initials}</div>`;
                            
                            newBtn.innerHTML = `
                                ${avatarHTML} 
                                <div class="chat-user-info" style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0;"> 
                                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;"> 
                                        <span class="chat-user-name" style="font-weight: 600; font-size: 13px; color: #1a1a1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 4px;">${groupTitle}</span> 
                                        <span class="chat-user-time" style="font-size: 11px; color: #8c8c8c; font-weight: 400; white-space: nowrap;">Зараз</span> 
                                    </div> 
                                    <div class="chat-user-message" style="font-size: 12px; color: #6c757d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 400;">Групу створено</div> 
                                </div>
                            `;
                            
                            document.querySelectorAll('.chat-group-button, .chat-user-button').forEach(b => b.classList.remove('select'));
                            if (groupList.firstChild) {
                                groupList.insertBefore(newBtn, groupList.firstChild);
                            } else {
                                groupList.appendChild(newBtn);
                            }
                        }
                        openGroupChat(newChatId, groupTitle, avatarUrl);
                    } else {
                        window.location.reload();
                    }
                } else {
                    alert('Помилка збереження групи');
                }
            })
            .catch(error => {
                console.error('Помилка:', error);
                alert('Не вдалося зберегти групу.');
            });
        });
    }

    document.addEventListener('click', function(event) {
        const button = event.target.closest('.chat-group-button');
        if (!button) return;
        event.preventDefault();
        document.querySelectorAll('.chat-group-button, .chat-user-button').forEach(b => b.classList.remove('select'));
        button.classList.add('select');
        const chatId = button.getAttribute('data-chat-id');
        const groupTitle = button.getAttribute('data-chat-title');
        const imgEl = button.querySelector('img.chat-user-avatar');
        const avatarUrl = imgEl ? imgEl.src : null;
        openGroupChat(chatId, groupTitle, avatarUrl);
    });

    function resetModal() {
        if (searchInput) searchInput.value = '';
        if (groupNameInput) groupNameInput.value = '';
        if (typeof friendRows !== 'undefined') friendRows.forEach(row => row.style.display = 'flex');
        checkboxes.forEach(cb => cb.checked = false);
        if (avatarPreview) {
            avatarPreview.style.backgroundImage = 'none';
            avatarPreview.className = 'group-avatar-preview-default';
            avatarPreview.textContent = 'NG';
        }
        if (avatarInput) avatarInput.value = '';
        updateSelectedCounter();
        if (stepUsers) stepUsers.style.display = 'block';
        if (stepName) stepName.style.display = 'none';
    }
});
