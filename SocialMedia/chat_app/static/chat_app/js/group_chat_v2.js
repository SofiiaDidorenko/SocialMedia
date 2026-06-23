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
    const messagesDisplayArea = document.getElementById("messages-display-area");

    const csrfMeta = document.querySelector("meta[name=csrf-token]");
    const csrfToken = csrfMeta ? csrfMeta.content : null;
    let isSubmittingGroup = false;

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
                if (typeof window.renderMessage === 'function') {
                    const node = window.renderMessage(msg);
                    if (node) fragment.appendChild(node);
                }
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
            if (entries[0].isIntersecting && window.hasNext && !window.isLoading) {
                await loadMessages(true);
            }
        }, { root: messagesDisplayArea, threshold: 0.1 });
        window.observer.observe(sentinel);
    }
    window.startObserver = startObserver;

    if (openModalBtn && groupModal) {
        openModalBtn.addEventListener('click', function() {
            groupModal.style.display = 'flex';
            resetModal();
        });
    }

    [closeStep1Btn, closeStep2Btn, cancelBtn].forEach(btn => {
        if (btn) btn.addEventListener('click', () => { groupModal.style.display = 'none'; });
    });

    if (groupModal) {
        groupModal.addEventListener('click', (e) => { 
            if (e.target === groupModal) groupModal.style.display = 'none'; 
        });
    }

    function buildAlphabeticalSections() {
        const friendsListContainer = document.querySelector('.modal-friends-list');
        if (!friendsListContainer) return;
        const rows = Array.from(friendsListContainer.querySelectorAll('.modal-friend-item-row'));
        if (rows.length === 0) return;
        
        rows.sort((a, b) => a.getAttribute('data-friend-name').trim().localeCompare(b.getAttribute('data-friend-name').trim()));
        friendsListContainer.innerHTML = '';
        let currentLetter = '';
        
        rows.forEach(row => {
            const name = row.getAttribute('data-friend-name').trim();
            if (!name) return;
            const firstLetter = name.charAt(0).toUpperCase();
            if (firstLetter !== currentLetter) {
                currentLetter = firstLetter;
                const letterHeading = document.createElement('div');
                letterHeading.className = 'friends-alphabet-letter';
                letterHeading.textContent = currentLetter;
                letterHeading.style.cssText = "font-size: 12px; font-weight: 700; color: #8c8c8c; padding: 12px 0 6px 0; margin-top: 4px; border-bottom: 1px solid #f2f2f7; width: 100%; font-family: sans-serif;";
                friendsListContainer.appendChild(letterHeading);
            }
            friendsListContainer.appendChild(row);
        });
    }
    buildAlphabeticalSections();

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase().trim();
            friendRows.forEach(row => {
                const name = row.getAttribute('data-friend-name').toLowerCase();
                row.style.display = name.includes(query) ? 'flex' : 'none';
            });

            const letters = document.querySelectorAll('.friends-alphabet-letter');
            letters.forEach(letter => {
                let next = letter.nextElementSibling;
                let hasVisibleFriends = false;
                while (next && !next.classList.contains('friends-alphabet-letter')) {
                    if (next.classList.contains('modal-friend-item-row') && next.style.display !== 'none') {
                        hasVisibleFriends = true;
                        break;
                    }
                    next = next.nextElementSibling;
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
    // --- БЛОК 3: НАВІГАЦІЯ ПО КРОКАХ ТА КАРТКИ УЧАСНИКІВ НА КРОЦІ 2 ---
    if (nextStepBtn) {
        nextStepBtn.addEventListener('click', function() {
            const checkedCheckboxes = document.querySelectorAll('.group-user-checkbox:checked');
            
            // 🌟 ГАРАНТОВАНО ВИПРАВЛЕНО БАГ: Правильно беремо елемент за індексом [0] з масиву NodeList
            if (checkedCheckboxes.length === 1) {
                const singleUserId = checkedCheckboxes[0].value;
                if (groupModal) groupModal.style.display = 'none';
                resetModal();
                if (typeof window.openChatWithUser === 'function') {
                    window.openChatWithUser(singleUserId);
                }
                return;
            }

            // Якщо обрано більше 1 учасника — переходимо на другий крок форми
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
                const avatarSrc = row.querySelector('.friend-item-avatar')?.getAttribute('src') || ''; 
                const participantItem = document.createElement('div');
                participantItem.className = 'final-participant-item';
                
                // Генеруємо зображення або текстову заглушку аватара
                let avatarHTML = (!avatarSrc || avatarSrc.includes('User1.png')) ? 
                    `<div class="participant-text-avatar">${name ? name.substring(0, 2).toUpperCase() : "UN"}</div>` : 
                    `<img src="${avatarSrc}" class="participant-avatar" alt="Avatar">`;
                
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

        // Слухачі видалення людей зі списку учасників Кроку 2
        selectedUsersList.querySelectorAll('.remove-participant-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const userId = this.getAttribute('data-user-id');
                let checkbox = document.getElementById(`chk-friend-${userId}`);
                if (!checkbox) {
                    checkbox = Array.from(checkboxes).find(cb => cb.value === userId);
                }
                if (checkbox) { 
                    checkbox.checked = false; 
                    updateSelectedCounter(); 
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
            // Зчитуємо перший обраний файл
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
    // --- БЛОК 4: АСИНХРОННА ВІДПРАВКА ДАНИХ ТА СКИДАННЯ МОДАЛКИ ---
    
    // Функція додавання щойно створеної групи у лівий список
    function ensureGroupButtonInList(data) {
        const groupList = document.getElementById('group-list');
        if (!groupList) return;

        let groupButton = groupList.querySelector(`.chat-group-button[data-chat-id="${data.chatId}"]`);
        
        if (!groupButton) {
            const emptyText = document.getElementById('group-empty');
            if (emptyText) emptyText.remove();

            groupButton = document.createElement('button');
            groupButton.type = 'button';
            groupButton.className = 'chat-group-button';
            groupButton.setAttribute('data-chat-id', data.chatId);
            groupButton.setAttribute('data-chat-title', data.group_name);

            let avatarHTML = data.avatar_url 
                ? `<img src="${data.avatar_url}" alt="Group" class="chat-user-avatar">` 
                : `<div class="group-text-avatar">${data.initials || "GR"}</div>`;

            groupButton.innerHTML = `
                ${avatarHTML}
                <div class="chat-user-info">
                    <div class="chat-user-meta">
                        <span class="chat-user-name">${data.group_name}</span>
                        <span class="chat-user-time"></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 8px;">
                        <p class="chat-user-message" style="margin: 0; flex-grow: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            Немає повідомлень
                        </p>
                        <span class="unread-badge-counter" 
                              id="unread-group-${data.chatId}"
                              data-raw-count="0"
                              style="display: none; font-size: 11px; background-color: #7a6682; color: #fff; padding: 2px 6px; border-radius: 10px; font-weight: 600; min-width: 18px; text-align: center;">
                            0
                        </span>
                    </div>
                </div>
            `;

            groupList.insertBefore(groupButton, groupList.firstChild);
        }

        document.querySelectorAll('.chat-group-button, .chat-user-button').forEach(b => b.classList.remove('select'));
        groupButton.classList.add('select');
    }

    if (mainForm) {
        mainForm.addEventListener('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            if (groupNameInput && groupNameInput.value.trim() === '') return;
            
            const checkedCheckboxes = document.querySelectorAll('.group-user-checkbox:checked');
            
            // 🌟 ГАРАНТОВАНО ВИПРАВЛЕНО БАГ: Додано індекс [0] для поодинокого вибору при відправці форми
            if (checkedCheckboxes.length === 1) {
                const singleUserId = checkedCheckboxes[0].value;
                if (groupModal) groupModal.style.display = 'none';
                resetModal();
                if (typeof window.openChatWithUser === 'function') window.openChatWithUser(singleUserId);
                return;
            }

            if (isSubmittingGroup) return;
            isSubmittingGroup = true;
            
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
                isSubmittingGroup = false;
                if (data.success) {
                    if (groupModal) groupModal.style.display = 'none';
                    resetModal();
                    
                    // Динамічно додаємо групу в лівий список
                    ensureGroupButtonInList(data);

                    // Миттєво відкриваємо створений чат
                    if (typeof window.openChatWithUser === 'function') {
                        window.openChatWithUser(data.chatId);
                    }
                }
            })
            .catch(err => { 
                console.error(err);
                isSubmittingGroup = false; 
            });
        });
    }

    if (submitBtn && mainForm) {
        submitBtn.addEventListener('click', function(e) { 
            e.preventDefault(); 
            const event = new Event('submit', { cancelable: true, bubbles: true });
            mainForm.dispatchEvent(event);
        });
    }

    function resetModal() {
        if (searchInput) searchInput.value = '';
        if (groupNameInput) groupNameInput.value = '';
        friendRows.forEach(row => row.style.display = 'flex');
        document.querySelectorAll('.friends-alphabet-letter').forEach(l => l.style.display = 'block');
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
}); // Фінальне закриття DOMContentLoaded для всього файлу group_chat_v2.js
