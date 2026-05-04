document.addEventListener('DOMContentLoaded', function() {
    console.log('JS загружен');
    
    const modal = document.getElementById('post-modal');
    const createBtn = document.getElementById('create-post-btn');
    const closeBtn = document.getElementById('close-modal');
    const cancelBtn = document.getElementById('cancel-post');
    const postForm = document.getElementById('post-form');
    const imageInput = document.getElementById('image-input');
    const imageUploadArea = document.getElementById('image-upload-area');
    const imagesPreview = document.getElementById('images-preview');

    console.log('Modal:', modal);
    console.log('CreateBtn:', createBtn);

    if (!createBtn) {
        console.error('Кнопка создания поста не найдена!');
        return;
    }

    // Открыть модал
    createBtn.addEventListener('click', () => {
        console.log('Клик по кнопке');
        if (modal) {
            modal.style.display = 'flex';
        }
    });

    // Закрыть модал
    const closeModal = () => {
        if (modal) modal.style.display = 'none';
        if (postForm) postForm.reset();
        if (imagesPreview) imagesPreview.innerHTML = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    // Предпросмотр изображений
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            if (imagesPreview) imagesPreview.innerHTML = '';
            Array.from(e.target.files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = document.createElement('div');
                    img.className = 'image-preview-item';
                    img.innerHTML = `
                        <img src="${event.target.result}" alt="preview">
                        <button type="button" class="delete-image">&times;</button>
                    `;
                    img.querySelector('.delete-image').addEventListener('click', () => {
                        img.remove();
                        imageInput.value = '';
                    });
                    if (imagesPreview) imagesPreview.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
        });
    }

    // Отправить форму
    if (postForm) {
        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
            const formData = new FormData(postForm);
            
            try {
                const response = await fetch('{% url "create_post" %}', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-CSRFToken': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    closeModal();
                    location.reload();
                } else {
                    alert('Помилка при створенні поста');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Помилка сервера');
            }
        });
    }
});

    // Отправить форму
    postForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
        const formData = new FormData(postForm);
        
        try {
            const response = await fetch('{% url "create_post" %}', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                closeModal();
                location.reload();
            } else {
                alert('Помилка при створенні поста');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Помилка сервера');
        }
    });
});
