document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.getElementById('logout-button');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            // Получаем токен из мета-тега (он должен быть в блоке {% block meta %})
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
            const logoutUrl = this.getAttribute('data-url');
            const authUrl = this.getAttribute('data-auth-url');

            if (!csrfToken) {
                console.error("CSRF token not found! Add <meta name='csrf-token' content='{{ csrf_token }}'> to your page.");
                return;
            }

            try {
                const response = await fetch(logoutUrl, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                if (response.ok) {
                    // Переходим на страницу авторизации
                    window.location.href = authUrl;
                }
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }
});

const logoutBtn = document.getElementById('force-logout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
        // Отримуємо URL прямо з атрибута кнопки
        const logoutUrl = this.getAttribute('data-url');
        if (logoutUrl) {
            window.location.href = logoutUrl;
        }
    });
}