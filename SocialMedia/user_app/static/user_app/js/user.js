document.addEventListener('DOMContentLoaded', function() {
    // 1. Функція для отримання CSRF-токену
    const getCsrfToken = () => document.querySelector('meta[name="csrf-token"]')?.content;

    // 2. Словник основних контейнерів форм
    const containers = {
        register: document.getElementById('register-container'),
        login: document.getElementById('login-container'),
        confirm: document.getElementById('confirm-email-container')
    };

    const modal = document.getElementById('details-modal');
    const regButtons = document.querySelectorAll('.register-select');
    const loginButtons = document.querySelectorAll('.login-select');
    const backBtn = document.getElementById('back');
    const codeInputs = document.querySelectorAll('.code-input');
    const logoutBtn = document.getElementById('logout-btn');

    /**
     * ПЕРЕМИКАЧ ФОРМ ТА ПІДСВІЧУВАННЯ
     * Тепер функція примусово керує класом .select для обох груп кнопок
     */
    function switchForm(target) {
        Object.keys(containers).forEach(key => {
            if (containers[key]) {
                containers[key].style.display = (key === target) ? 'block' : 'none';
            }
        });

        // Керування класом підсвічування .select
        loginButtons.forEach(b => b.classList.toggle('select', target === 'login'));
        regButtons.forEach(b => b.classList.toggle('select', target === 'register'));

        if (target !== 'none' && modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
    }

    // Встановлюємо початковий стан (якщо ми на сторінці auth)
    if (containers.login) {
        switchForm('login'); 
    }

    // --- ОБРОБКА ВИХОДУ (LOGOUT) ---
    if (logoutBtn) {
        logoutBtn.onclick = function() {
            // Отримуємо URL з атрибуту (якщо ви додали data-url) або використовуємо прямий шлях
            const logoutUrl = this.getAttribute('data-url') || '/logout/';
            window.location.href = logoutUrl;
        };
    }

    // --- ОБРОБКА ФОРМИ ВХОДУ ---
    const loginForm = containers.login?.querySelector('form');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            try {
                const response = await fetch(loginForm.action, {
                    method: 'POST',
                    body: new FormData(loginForm),
                    headers: { 
                        'X-CSRFToken': getCsrfToken(), 
                        'X-Requested-With': 'XMLHttpRequest' 
                    }
                });
                const data = await response.json();
                
                if (response.ok && data.success) {
                    // Завжди йдемо за редиректом від Django (на сторінку /user/)
                    window.location.href = data.redirect_url;
                } else {
                    alert('Помилка входу. Перевірте пошту та пароль.');
                }
            } catch (err) {
                console.error("Login error:", err);
            }
        };
    }

    // --- ОБРОБКА ФОРМИ РЕЄСТРАЦІЇ ---
    const registerForm = containers.register?.querySelector('form');
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const response = await fetch(registerForm.action, {
                method: 'POST',
                body: new FormData(registerForm),
                headers: { 
                    'X-CSRFToken': getCsrfToken(), 
                    'X-Requested-With': 'XMLHttpRequest' 
                }
            });
            if (response.ok) {
                switchForm('confirm');
            } else {
                const data = await response.json();
                alert(data.errors ? 'Перевірте правильність даних' : 'Помилка реєстрації');
            }
        };
    }

    // --- ОБРОБКА ПІДТВЕРДЖЕННЯ КОДУ ---
    const confirmForm = containers.confirm?.querySelector('form');
    if (confirmForm) {
        confirmForm.onsubmit = async (e) => {
            e.preventDefault();
            const response = await fetch(confirmForm.action, {
                method: 'POST',
                body: new FormData(confirmForm),
                headers: { 
                    'X-CSRFToken': getCsrfToken(), 
                    'X-Requested-With': 'XMLHttpRequest' 
                }
            });
            const data = await response.json();
            if (response.ok && data.action === 'show_login') {
                switchForm('login');
            } else {
                alert(data.error || 'Невірний код');
            }
        };
    }

    // --- КЕРУВАННЯ КОД-ІНПУТАМИ ---
    codeInputs.forEach((input, index) => {
        input.addEventListener('input', () => {
            if (input.value.length === 1 && codeInputs[index + 1]) {
                codeInputs[index + 1].focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && codeInputs[index - 1]) {
                codeInputs[index - 1].focus();
            }
        });
    });

    // Навігація кнопками Select
    loginButtons.forEach(btn => btn.onclick = () => switchForm('login'));
    regButtons.forEach(btn => btn.onclick = () => switchForm('register'));
    if (backBtn) backBtn.onclick = () => switchForm('register');
});

/**
 * Глобальна функція для збереження профілю (викликається через onsubmit в HTML)
 */
window.saveProfile = async function(e, formElement) {
    e.preventDefault();
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    
    try {
        const response = await fetch(formElement.action, {
            method: 'POST',
            body: new FormData(formElement),
            headers: { 
                'X-CSRFToken': csrfToken, 
                'X-Requested-With': 'XMLHttpRequest' 
            }
        });
        
        const data = await response.json();
        if (response.ok && data.success) {
            window.location.href = data.redirect_url;
        } else {
            alert(data.error || 'Цей нікнейм вже зайнятий або дані невірні');
        }
    } catch (err) {
        console.error("Profile save error:", err);
    }
    return false;
};