document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('post-modal');
    const createBtn = document.getElementById('create-post-btn');
    const closeBtn = document.getElementById('close-modal');
    const cancelBtn = document.getElementById('cancel-post');
    const postForm = document.getElementById('post-form');
    const imageInput = document.getElementById('image-input');
    const imageUploadArea = document.getElementById('image-upload-area');
    const imagesPreview = document.getElementById('images-preview');

    // Открыть модал
    createBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    // Закрыть модал
    const closeModal = () => {
        modal.style.display = 'none';
        postForm.reset();
        imagesPreview.innerHTML = '';
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Предпросмотр изображений
    imageInput.addEventListener('change', (e) => {
        imagesPreview.innerHTML = '';
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
                imagesPreview.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
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
