document.addEventListener('DOMContentLoaded', function() {
    const postsContainer = document.querySelector('.posts-list');
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    
    if (postsContainer) {
        postsContainer.addEventListener('click', async function(e) {
            const menuTrigger = e.target.closest('.post-menu-trigger');
            
            if (menuTrigger) {
                e.stopPropagation();
                const currentMenu = menuTrigger.closest('.card-options').querySelector('.post-context-menu');
                
                if (currentMenu) {
                    document.querySelectorAll('.post-context-menu').forEach(menu => {
                        if (menu !== currentMenu) {
                            menu.style.display = 'none';
                            const parentCard = menu.closest('.post-card');
                            if (parentCard) parentCard.style.zIndex = '';
                        }
                    });
                    
                    const postCard = menuTrigger.closest('.post-card');
                    
                    if (currentMenu.style.display === 'none' || currentMenu.style.display === '') {
                        currentMenu.style.display = 'flex';
                        if (postCard) postCard.style.zIndex = '9999';
                    } else {
                        currentMenu.style.display = 'none';
                        if (postCard) postCard.style.zIndex = '';
                    }
                }
                return;
            }

            const editBtn = e.target.closest('.edit-post');
            const deleteBtn = e.target.closest('.delete-post');

            if (editBtn) {
                e.stopPropagation();
                const postId = editBtn.dataset.id;
                console.log('Редактировать пост с ID:', postId);
                editBtn.closest('.post-context-menu').style.display = 'none';
            }

            if (deleteBtn) {
                e.stopPropagation();
                const postId = deleteBtn.dataset.id;
                const postCard = deleteBtn.closest('.post-card');
                
                deleteBtn.closest('.post-context-menu').style.display = 'none';
                if (postCard) postCard.style.zIndex = '';
                
                try {
                    const response = await fetch(`/delete_post/${postId}/`, {
                        method: 'POST',
                        headers: {
                            'X-CSRFToken': csrfToken,
                            'X-Requested-With': 'XMLHttpRequest',
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok && result.success) {
                        postCard.style.transition = 'all 0.4s ease';
                        postCard.style.opacity = '0';
                        postCard.style.transform = 'translateY(20px)';
                        setTimeout(() => postCard.remove(), 400);
                    }
                } catch (err) {
                    console.error('Ошибка AJAX удаления:', err);
                }
            }
        });
    }

    window.addEventListener('click', function() {
        document.querySelectorAll('.post-context-menu').forEach(menu => {
            menu.style.display = 'none';
            const parentCard = menu.closest('.post-card');
            if (parentCard) parentCard.style.zIndex = '';
        });
    });
});
