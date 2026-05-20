document.addEventListener('DOMContentLoaded', () => {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    const containerSection = document.querySelector('.friends-container-section');
    const actionUrl = containerSection?.getAttribute('data-action-url') || '/friends/action/'; // Перевір URL
    
    const sections = {
        requests: document.getElementById('sec-requests') || document.querySelector('.requests-section'),
        recommendations: document.getElementById('sec-recommendations') || document.querySelector('.recommendations-section'),
        friends: document.getElementById('sec-friends') || document.querySelector('.friends-section')
    };
    
    const seeAllButtons = {
        requests: document.querySelector('.requests-section .see-all-btn'),
        recommendations: document.querySelector('.recommendations-section .see-all-btn'),
        friends: document.querySelector('.friends-section .see-all-btn')
    };
    
    const sidebarLinks = document.querySelectorAll('.friends-panel p, .friends-panel a, .sidebar-nav-link');
    const mainHeaderLink = document.querySelector('.sidebar-main-link');

    function showAllSections() {
        Object.keys(sections).forEach(key => {
            if (sections[key]) {
                sections[key].classList.remove('hidden-section', 'expanded-view');
            }
            if (seeAllButtons[key]) {
                seeAllButtons[key].textContent = 'Дивитись всі';
                seeAllButtons[key].classList.remove('back-state');
            }
        });
        sidebarLinks.forEach(link => link.classList.remove('active-link'));
        if (mainHeaderLink) mainHeaderLink.classList.add('active-link');
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
            if (seeAllButtons[key]) {
                seeAllButtons[key].textContent = isTarget ? 'Назад' : 'Дивитись всі';
                seeAllButtons[key].classList.toggle('back-state', isTarget);
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
            const target = link.getAttribute('data-target') || link.getAttribute('data-go');
            if (target && sections[target]) switchToSection(target);
        });
    });

    if (mainHeaderLink) mainHeaderLink.onclick = showAllSections;


    async function sendFriendAction(userId, action, cardElement) {
        try {
            const response = await fetch(actionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ user_id: userId, action: action })
            });

            const data = await response.json();

            if (response.ok) {
                if (action === 'accept') {
                    moveCardToFriendsBlock(cardElement);
                } else {

                    cardElement.style.transition = 'all 0.3s ease';
                    cardElement.style.opacity = '0';
                    cardElement.style.transform = 'scale(0.9)';
                    setTimeout(() => {
                        cardElement.remove();

                        if (action === 'delete') window.location.reload();
                    }, 300);
                }
            }
        } catch (error) {
            console.error('Помилка AJAX:', error);
        }
    }

    function moveCardToFriendsBlock(cardElement) {
        const friendsContainer = document.querySelector('.friends-section .cards-container');
        if (!friendsContainer) {
            cardElement.remove();
            return;
        }

        cardElement.style.opacity = '0';
        setTimeout(() => {
            const buttons = cardElement.querySelector('.buttons-container');
            if (buttons) {
                buttons.innerHTML = `
                    <button class="msg-btn">Повідомлення</button>
                    <button class="remove-friend-btn friend-btn" data-id="${cardElement.dataset.userId}" data-action="delete">Видалити</button>
                `;
            }
            friendsContainer.appendChild(cardElement);
            cardElement.style.opacity = '1';
        }, 250);
    }


    const mainContainer = containerSection || document.body;

    mainContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        const card = btn.closest('.friend-card');
        const userId = card?.getAttribute('data-user-id');
        if (!userId) return;


        if (btn.classList.contains('add-btn')) {
            sendFriendAction(userId, 'send', card);
            btn.textContent = 'Очікування';
            btn.disabled = true;
        } 
        else if (btn.classList.contains('accept-btn')) {
            sendFriendAction(userId, 'accept', card);
        } 
        else if (btn.classList.contains('reject-btn') || btn.classList.contains('remove-rec-btn')) {
            sendFriendAction(userId, 'reject_or_delete', card);
        }
        else if (btn.classList.contains('remove-friend-btn')) {

            sendFriendAction(userId, 'delete', card);
        }
    });
});
