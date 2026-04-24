document.addEventListener('DOMContentLoaded', function() {
    // 1. Элементы интерфейса
    const regContainer = document.getElementById('register-container');
    const loginContainer = document.getElementById('login-container');
    const confirmContainer = document.getElementById('confirm-email-container');

    const regButtons = document.querySelectorAll('.register-select');
    const loginButtons = document.querySelectorAll('.login-select');
    const backBtn = document.getElementById('back');

    // Форма регистрации
    const registerForm = regContainer?.querySelector('form');
    // Поля ввода кода (6 цифр)
    const codeInputs = document.querySelectorAll('.code-input');

    /**
     * Переключает видимость между формами
     */
    function switchForm(target) {
        // Скрываем все блоки
        [regContainer, loginContainer, confirmContainer].forEach(div => {
            if (div) div.style.display = 'none';
        });

        if (target === 'login') {
            if (loginContainer) loginContainer.style.display = 'block';
            loginButtons.forEach(b => b.classList.add('select'));
            regButtons.forEach(b => b.classList.remove('select'));
        } 
        else if (target === 'register') {
            if (regContainer) regContainer.style.display = 'block';
            regButtons.forEach(b => b.classList.add('select'));
            loginButtons.forEach(b => b.classList.remove('select'));
        } 
        else if (target === 'confirm') {
            if (confirmContainer) confirmContainer.style.display = 'block';
        }
    }

    /**
     * Обработка отправки регистрации через AJAX
     */
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault(); // Запрещаем перезагрузку страницы

            const formData = new FormData(registerForm);
            const actionUrl = registerForm.getAttribute('action') || window.location.href;

            try {
                const response = await fetch(actionUrl, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                if (response.ok) {
                    // Если сервер ответил 201 Created (как в вашем View)
                    switchForm('confirm');
                } else {
                    const data = await response.json();
                    console.error('Ошибки валидации:', data.errors);
                    alert('Ошибка при регистрации. Проверьте введенные данные.');
                }
            } catch (error) {
                console.error('Ошибка сети:', error);
                alert('Не удалось связаться с сервером.');
            }
        };
    }

    /**
     * Логика авто-перехода фокуса для 6 ячеек кода
     */
    codeInputs.forEach((input, index) => {
        // Когда вводим символ
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < codeInputs.length - 1) {
                codeInputs[index + 1].focus(); // Прыгаем вперед
            }
        });

        // Когда стираем (Backspace)
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                codeInputs[index - 1].focus(); // Прыгаем назад
            }
        });
    });

    // Навигация (клики по кнопкам)
    loginButtons.forEach(btn => btn.onclick = () => switchForm('login'));
    regButtons.forEach(btn => btn.onclick = () => switchForm('register'));
    if (backBtn) backBtn.onclick = () => switchForm('register');

    // Устанавливаем начальное состояние
    switchForm('register');
});







