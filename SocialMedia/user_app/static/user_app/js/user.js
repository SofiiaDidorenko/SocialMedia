document.addEventListener('DOMContentLoaded', function() {
    const regContainer = document.getElementById('register-container');
    const loginContainer = document.getElementById('login-container');
    const confirmContainer = document.getElementById('confirm-email-container');

    const regButtons = document.querySelectorAll('.register-select');
    const loginButtons = document.querySelectorAll('.login-select');

    function switchForm(target) {
        // Жестко скрываем всё
        if (regContainer) regContainer.style.display = 'none';
        if (loginContainer) loginContainer.style.display = 'none';
        if (confirmContainer) confirmContainer.style.display = 'none';

        if (target === 'login') {
            if (loginContainer) loginContainer.style.display = 'block';
            loginButtons.forEach(b => b.classList.add('select'));
            regButtons.forEach(b => b.classList.remove('select'));
        } else {
            if (regContainer) regContainer.style.display = 'block';
            regButtons.forEach(b => b.classList.add('select'));
            loginButtons.forEach(b => b.classList.remove('select'));
        }
    }

    loginButtons.forEach(btn => btn.onclick = () => switchForm('login'));
    regButtons.forEach(btn => btn.onclick = () => switchForm('register'));

    // Инициализация (по умолчанию регистрация)
    switchForm('register');
});






