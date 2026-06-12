document.addEventListener('DOMContentLoaded', function() {
    let currentPage = 1;
    let isLoading = false;
    let hasMorePosts = true;
    let selectedFiles = [];

    const getCsrf = () => document.querySelector('[name=csrfmiddlewaretoken]')?.value || document.querySelector('meta[name="csrf-token"]')?.content;
    
    const regCont = document.getElementById('register-container');
    const logCont = document.getElementById('login-container');
    const confCont = document.getElementById('confirm-email-container');
    const postModal = document.getElementById('post-modal');
    const tagModal = document.getElementById('tag-modal');
    
    const loaderLine = document.getElementById('postLoaderLine');
    const postList = document.querySelector('.posts-list');
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.getElementById('image-preview-container');

    // ВИПРАВЛЕНО: Фокусуємося строго на ПЕРШИЙ елемент списку [0]
    const clearCodeInputs = () => {
        const codeInputs = document.querySelectorAll('.code-input');
        codeInputs.forEach(input => {
            input.value = '';
        });
        if (codeInputs.length > 0) {
            setTimeout(() => codeInputs[0].focus(), 100);
        }
    };

    const toggleM = (m, show) => {
        if (m) m.style.display = show ? 'flex' : 'none';
        document.body.style.overflow = show ? 'hidden' : 'auto';
    };

    const switchAuth = (mode) => {
        if (regCont) regCont.style.display = mode === 'reg' ? 'block' : 'none';
        if (logCont) logCont.style.display = mode === 'log' ? 'block' : 'none';
        if (confCont) confCont.style.display = mode === 'conf' ? 'block' : 'none';
        
        document.querySelectorAll('.register-select').forEach(b => b.classList.toggle('select', mode === 'reg'));
        document.querySelectorAll('.login-select').forEach(b => b.classList.toggle('select', mode === 'log'));

        // АВТОФОКУС: Коли відкривається вікно коду, автоматично фокусуємося на першу комірку
        if (mode === 'conf') {
            setTimeout(() => {
                const firstInput = document.querySelector('.code-input');
                if (firstInput) firstInput.focus();
            }, 150);
        }
    };

    document.querySelectorAll('.login-select').forEach(b => b.onclick = () => switchAuth('log'));
    document.querySelectorAll('.register-select').forEach(b => b.onclick = () => switchAuth('reg'));
    
    if (document.getElementById('back')) {
        document.getElementById('back').onclick = () => {
            clearCodeInputs();
            switchAuth('reg');
        };
    }

    const sendForm = async (form, onSuccess) => {
        if (!form) return;
        form.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            if (form.closest('#confirm-email-container')) {
                let fullCode = "";
                document.querySelectorAll('.code-input').forEach(input => {
                    fullCode += input.value;
                });
                fd.append('code', fullCode);
            }

            try {
                const res = await fetch(form.action, {
                    method: 'POST',
                    body: fd,
                    headers: { 'X-CSRFToken': getCsrf(), 'X-Requested-With': 'XMLHttpRequest' }
                });
                const data = await res.json();
                onSuccess(res, data);
            } catch (err) { console.error(err); }
        };
    };

    sendForm(logCont?.querySelector('form'), (res, data) => {
        if (res.ok && data.success) window.location.href = data.redirect_url;
        else alert('Помилка входу');
    });

    sendForm(regCont?.querySelector('form'), (res) => {
        if (res.ok) {
            clearCodeInputs(); 
            switchAuth('conf');
        }
        else alert('Помилка реєстрації');
    });

    sendForm(confCont?.querySelector('form'), (res, data) => {
        if (res.ok && data.action === 'show_login') switchAuth('log');
        else alert(data.error || 'Невірний код');
    });

    if (fileInput) {
        fileInput.onchange = (e) => {
            Array.from(e.target.files).forEach(file => {
                const fId = Date.now() + Math.random();
                file.tempId = fId;
                selectedFiles.push(file);
                const rd = new FileReader();
                rd.onload = (ev) => {
                    const d = document.createElement('div');
                    d.className = 'image-preview-item';
                    d.innerHTML = `
                        <img src="${ev.target.result}" class="preview-img">
                        <button type="button" class="remove-photo-btn" data-id="${fId}">
                            <img src="/static/icons/trash.png">
                        </button>`;
                    previewContainer.appendChild(d);
                };
                rd.readAsDataURL(file);
            });
            fileInput.value = '';
        };
    }

    if (previewContainer) {
        previewContainer.onclick = (e) => {
            const btn = e.target.closest('.remove-photo-btn');
            if (btn) {
                const id = parseFloat(btn.dataset.id);
                selectedFiles = selectedFiles.filter(f => f.tempId !== id);
                btn.parentElement.remove();
            }
        };
    }

    if (loaderLine && postList) {
        const obs = new IntersectionObserver(async (entries) => {
            if (entries.isIntersecting && !isLoading && hasMorePosts) {
                isLoading = true;
                currentPage++;
                const res = await fetch(`${window.location.pathname}?page=${currentPage}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
                const html = await res.text();
                const newPosts = new DOMParser().parseFromString(html, 'text/html').querySelectorAll('.post-card');
                if (newPosts.length) newPosts.forEach(p => loaderLine.insertAdjacentHTML('beforebegin', p.outerHTML));
                else { hasMorePosts = false; obs.disconnect(); loaderLine.remove(); }
                isLoading = false;
            }
        }, { rootMargin: '300px' });
        obs.observe(loaderLine);
    }

    // ВИПРАВЛЕНО: Повністю безпечна логіка введення без блокування системних клавіш
    const codeInputs = document.querySelectorAll('.code-input');
    
    codeInputs.forEach((input, i) => {
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('maxlength', '1');

        input.oninput = (e) => {
            const cleanValue = input.value.replace(/[^0-9]/g, '');
            input.value = cleanValue;
            
            if (cleanValue && codeInputs[i + 1]) {
                setTimeout(() => codeInputs[i + 1].focus(), 10);
            }
        };

        input.onkeydown = (e) => {
            if (e.key === 'Backspace') {
                if (input.value) {
                    input.value = '';
                } else if (codeInputs[i - 1]) {
                    e.preventDefault(); // Скасовуємо системний Backspace ТІЛЬКИ для стрибка назад
                    codeInputs[i - 1].value = '';
                    codeInputs[i - 1].focus();
                }
            } else if (e.key === 'ArrowLeft' && codeInputs[i - 1]) {
                codeInputs[i - 1].focus();
            } else if (e.key === 'ArrowRight' && codeInputs[i + 1]) {
                codeInputs[i + 1].focus();
            }
        };

        input.onpaste = (e) => {
            e.preventDefault();
            const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim().replace(/[^0-9]/g, '');
            if (pasteData) {
                codeInputs.forEach((inp, idx) => {
                    if (pasteData[idx]) inp.value = pasteData[idx];
                });
                const nextFocusIdx = Math.min(pasteData.length, codeInputs.length - 1);
                if (codeInputs[nextFocusIdx]) codeInputs[nextFocusIdx].focus();
            }
        };
    });
});

window.saveProfile = async function(e, form) {
    e.preventDefault();
    try {
        const res = await fetch(form.action, {
            method: 'POST',
            body: new FormData(form),
            headers: { 'X-CSRFToken': form.querySelector('[name=csrfmiddlewaretoken]')?.value, 'X-Requested-With': 'XMLHttpRequest' }
        });
        const data = await res.json();
        if (res.ok && data.success) window.location.href = data.redirect_url;
        else alert(data.error || 'Помилка');
    } catch (err) { console.error(err); }
    return false;
};
