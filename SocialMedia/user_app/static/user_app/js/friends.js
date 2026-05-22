document.addEventListener('DOMContentLoaded', () => {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') 
                      || document.querySelector('[name=csrfmiddlewaretoken]')?.value;

    // --- ЛОГИКА БОКОВОЙ ПАНЕЛИ ПРОФИЛЯ (ДЛЯ ДРУГА) ---
    const actionsBlock = document.getElementById('friend-actions-block');
    if (actionsBlock) {
        actionsBlock.addEventListener('click', async (e) => {
            const button = e.target.closest('.btn-sidebar-action');
            if (!button) return;

            const userId = button.getAttribute('data-user-id');
            const action = button.getAttribute('data-action');
            if (!userId || !action) return;

            try {
                const response = await fetch('/api/friendship/handle/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({ 'user_id': userId, 'action': action })
                });

                if (!response.ok) throw new Error('Помилка сервера');
                const data = await response.json();

                if (data.success) {
                    if (action === 'send' || action === 'accept') {
                        window.location.href = '/friends/';
                    } else if (action === 'reject_or_delete') {
                        actionsBlock.innerHTML = '<span class="status-rejected">Видалено</span>';
                    }
                } else {
                    alert('Помилка: ' + (data.error || 'Невідома помилка'));
                }
            } catch (error) {
                console.error('AJAX Error:', error);
                alert('Не вдалося виконати операцію.');
            }
        });
    }

    // --- ЛОГИКА ТАБОВ И ВКЛАДОК НА СТРАНИЦЕ СПИСКОВ ---
    const sections = {
        requests: document.getElementById('sec-requests') || document.querySelector('.requests-section'),
        recommendations: document.getElementById('sec-recommendations') || document.querySelector('.recommendations-section'),
        friends: document.getElementById('sec-friends') || document.querySelector('.friends-section')
    };
    
    const seeAllButtons = {
        requests: document.querySelector('#sec-requests .see-all-btn') || document.querySelector('[data-target="requests"]'),
        recommendations: document.querySelector('#sec-recommendations .see-all-btn') || document.querySelector('[data-target="recommendations"]'),
        friends: document.querySelector('#sec-friends .see-all-btn') || document.querySelector('[data-target="friends"]')
    };
    
    const sidebarLinks = document.querySelectorAll('.friends-panel p, .friends-panel a, .sidebar-nav-link');
    const mainHeaderLink = document.querySelector('.sidebar-main-link');

    function showAllSections() {
        Object.keys(sections).forEach(key => {
            if (sections[key]) sections[key].classList.remove('hidden-section', 'expanded-view');
            const btn = seeAllButtons[key];
            if (btn && btn.classList.contains('see-all-btn')) {
                btn.textContent = 'Дивитись всі';
                btn.classList.remove('back-state');
            }
        });
        sidebarLinks.forEach(link => link.classList.remove('active-link'));
        if (mainHeaderLink) mainHeaderLink.add('active-link');
    }

    function switchToSection(targetKey) {
        const currentBtn = seeAllButtons[targetKey];
        if (currentBtn?.classList.contains('back-state')) {
            showAllSections();
            return;
        }
        Object.keys(sections).forEach(key => {
            const isTarget = (key === targetKey);
            if (sections[key]) {
                sections[key].classList.toggle('hidden-section', !isTarget);
                sections[key].classList.toggle('expanded-view', isTarget);
            }
            const btn = seeAllButtons[key];
            if (btn && btn.classList.contains('see-all-btn')) {
                btn.textContent = isTarget ? 'Назад' : 'Дивитись всі';
                btn.classList.toggle('back-state', isTarget);
            }
        });
    }

    Object.keys(seeAllButtons).forEach(key => {
        seeAllButtons[key]?.addEventListener('click', (e) => {
            e.preventDefault();
            switchToSection(key);
        });
    });

    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            if (target === 'main') showAllSections();
            else if (target && sections[target]) switchToSection(target);
        });
    });

    if (mainHeaderLink) mainHeaderLink.onclick = showAllSections;

    // --- ОБРАБОТКА ДЕЙСТВИЙ ВНУТРИ СПИСКОВ ДРУЗЕЙ ---
    const containerSection = document.querySelector('.friends-container-section');
    if (containerSection) {
        containerSection.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            const card = e.target.closest('.friend-card');
            const linkWrapper = e.target.closest('a');
            
            if (!card) return;
            
            const userId = card.getAttribute('data-user-id') || btn?.getAttribute('data-id');
            const username = card.getAttribute('data-username');

            // ЕСЛИ КЛИКНУЛИ ПО КНОПКЕ
            if (btn) {
                // Всегда отменяем стандартное поведение ссылки для точечной обработки в JS
                e.preventDefault();
                e.stopPropagation();

                // ИСПРАВЛЕНО: Кнопки "Додати" или "Підтвердити" принудительно перенаправляют в профиль
                if (btn.classList.contains('add-btn') || btn.classList.contains('accept-btn')) {
                    if (username) {
                        window.location.href = `/profile/${username}/`;
                    } else {
                        console.error('Атрибут data-username не знайдено на карточці!');
                    }
                    return;
                }

                // Кнопки удаления ("Видалити" или "Приховати") работают на месте в фоне через AJAX
                if (btn.classList.contains('reject-btn') || btn.classList.contains('remove-rec-btn') || btn.classList.contains('remove-friend-btn')) {
                    try {
                        const response = await fetch('/api/friendship/handle/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': csrfToken,
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            body: JSON.stringify({ user_id: userId, action: 'reject_or_delete' })
                        });
                        
                        if (response.ok) {
                            const elementToAnimate = linkWrapper || card;
                            elementToAnimate.style.transition = 'all 0.3s ease';
                            elementToAnimate.style.opacity = '0';
                            elementToAnimate.style.transform = 'scale(0.9)';
                            setTimeout(() => {
                                elementToAnimate.remove();
                            }, 300);
                        }
                    } catch (err) {
                        console.error('Не вдалося виконати видалення:', err);
                    }
                }
            } 
            // ЕСЛИ КЛИКНУЛИ ПРОСТО ПО КАРТОЧКЕ (НА ФОН, ИМЯ ИЛИ АВАТАР)
            else {
                if (username) {
                    window.location.href = `/profile/${username}/`;
                }
            }
        });
    }
});
