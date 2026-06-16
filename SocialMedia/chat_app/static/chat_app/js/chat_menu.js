document.addEventListener('DOMContentLoaded', function() {
    const activeScreen = document.getElementById('chat-active-screen');
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    
    if (activeScreen) {
        activeScreen.addEventListener('click', async function(e) {
            const menuTrigger = e.target.closest('.post-menu-trigger');
            
            if (menuTrigger) {
                e.stopPropagation();
                const currentMenu = menuTrigger.closest('.card-options').querySelector('.post-context-menu');
                
                if (currentMenu) {
                    document.querySelectorAll('.post-context-menu').forEach(menu => {
                        if (menu !== currentMenu) menu.style.display = 'none';
                    });

                    const isAdmin = Number(window.activeChatAdminId) === Number(window.currentUserId);
                    
                    const adminElements = currentMenu.querySelectorAll('.admin-only');
                    const memberElements = currentMenu.querySelectorAll('.member-only');

                    adminElements.forEach(el => el.style.setProperty('display', isAdmin ? 'flex' : 'none', 'important'));
                    memberElements.forEach(el => el.style.setProperty('display', !isAdmin ? 'flex' : 'none', 'important'));
                    
                    if (currentMenu.style.display === 'none' || currentMenu.style.display === '') {
                        currentMenu.style.display = 'flex';
                    } else {
                        currentMenu.style.display = 'none';
                    }
                }
                return;
            }

            const mediaBtn = e.target.closest('.open-media');
            const editGroupBtn = e.target.closest('.edit-group-btn');
            const deleteChatBtn = e.target.closest('.delete-chat-btn');
            const leaveGroupBtn = e.target.closest('.leave-group-btn');

            if (editGroupBtn) {
                e.stopPropagation();
                editGroupBtn.closest('.post-context-menu').style.display = 'none';

                const chatId = window.activeChatId;
                const chatName = document.getElementById('chat-active-name')?.textContent || '';
                const chatAvatar = document.getElementById('chat-active-avatar')?.src || '';

                const groupModal = document.getElementById('group-modal');
                const stepUsersBlock = document.getElementById('group-step-users');
                const stepNameBlock = document.getElementById('group-step-name');
                const nameInput = document.getElementById('group-name');
                const avatarPreviewCircle = document.getElementById('group-avatar-preview-circle');
                const submitBtn = document.getElementById('create-group');

                if (groupModal) {
                    groupModal.style.display = 'flex';
                    if (stepUsersBlock) stepUsersBlock.style.display = 'none';
                    if (stepNameBlock) stepNameBlock.style.display = 'block';
                    if (nameInput) nameInput.value = chatName;

                    if (submitBtn) {
                        submitBtn.textContent = 'Зберегти зміни';
                        submitBtn.disabled = false;
                    }

                    if (avatarPreviewCircle) {
                        if (chatAvatar && !chatAvatar.includes('User1.png') && !e.target.closest('.group-text-avatar-header')) {
                            avatarPreviewCircle.className = 'group-avatar-preview-circle';
                            avatarPreviewCircle.style.backgroundImage = `url('${chatAvatar}')`;
                            avatarPreviewCircle.style.backgroundSize = 'cover';
                            avatarPreviewCircle.style.backgroundPosition = 'center';
                            avatarPreviewCircle.textContent = '';
                        } else {
                            avatarPreviewCircle.className = 'group-avatar-preview-circle group-avatar-preview-default';
                            avatarPreviewCircle.style.backgroundImage = 'none';
                            avatarPreviewCircle.textContent = 'NG';
                        }
                    }

                    let selectedCount = 0;
                    const chatUsers = window.activeChatUsersList || [];
                    document.querySelectorAll('.group-user-checkbox').forEach(checkbox => {
                        const userId = parseInt(checkbox.value);
                        if (chatUsers.includes(userId)) {
                            checkbox.checked = true;
                            selectedCount++;
                        } else {
                            checkbox.checked = false;
                        }
                    });

                    const countSpan = document.getElementById('selected-count');
                    if (countSpan) countSpan.textContent = selectedCount;
                    if (typeof renderFinalParticipants === 'function') {
                        renderFinalParticipants();
                    } else {
                        const participantsList = document.getElementById('selected-users-list');
                        if (participantsList) {
                            participantsList.innerHTML = '';
                            document.querySelectorAll('.group-user-checkbox:checked').forEach(cb => {
                                const row = cb.closest('.modal-friend-item-row');
                                if (row) {
                                    const avatar = row.querySelector('.friend-item-avatar')?.src || '/static/icons/User1.png';
                                    const name = row.querySelector('.friend-item-name')?.textContent.trim() || '';
                                    
                                    const userBadge = document.createElement('div');
                                    userBadge.style.cssText = 'display:flex; flex-direction:column; align-items:center; text-align:center; width:60px;';
                                    userBadge.innerHTML = `
                                        <img src="${avatar}" style="width:34px; height:34px; border-radius:50%; object-fit:cover;">
                                        <span style="font-size:11px; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</span>
                                    `;
                                    participantsList.appendChild(userBadge);
                                }
                            });
                        }
                    }

                    groupModal.setAttribute('data-edit-chat-id', chatId);
                    const mainForm = document.getElementById('group-chat-main-form');
                    if (mainForm) {
                        mainForm.action = `/chat/${chatId}/update_group/`;
                    }
                }
            }

            if (mediaBtn) {
                e.stopPropagation();
                mediaBtn.closest('.post-context-menu').style.display = 'none';
                console.log('Відкрити медіа:', window.activeChatId);
            }

            if (deleteChatBtn) {
                e.stopPropagation();
                deleteChatBtn.closest('.post-context-menu').style.display = 'none';
                
                if (confirm('Ви впевнені, що хочете видалити цю групу разом з усіма повідомленнями?')) {
                    try {
                        const response = await fetch(`/delete_chat/${window.activeChatId}/`, {
                            method: 'POST',
                            headers: { 'X-CSRFToken': csrfToken, 'X-Requested-With': 'XMLHttpRequest' }
                        });
                        const result = await response.json();
                        if (response.ok && result.success) window.location.reload();
                    } catch (err) {
                        console.error('Помилка видалення чату:', err);
                    }
                }
            }

            if (leaveGroupBtn) {
                e.stopPropagation();
                leaveGroupBtn.closest('.post-context-menu').style.display = 'none';

                if (confirm('Ви впевнені, що хочете вийти з цієї групи?')) {
                    try {
                        const response = await fetch(`/leave_group/${window.activeChatId}/`, {
                            method: 'POST',
                            headers: { 'X-CSRFToken': csrfToken, 'X-Requested-With': 'XMLHttpRequest' }
                        });
                        const result = await response.json();
                        if (response.ok && result.success) window.location.reload();
                    } catch (err) {
                        console.error('Помилка виходу з групи:', err);
                    }
                }
            }
        });
    }

    window.addEventListener('click', function() {
        document.querySelectorAll('.post-context-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    });
});
 