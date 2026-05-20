document.addEventListener('DOMContentLoaded', function() {
    const postModal = document.getElementById('post-modal');
    const quickInput = document.getElementById('quick-create-trigger-input');
    const quickBtn = document.getElementById('quick-create-trigger');
    const quickEmoji = document.getElementById('quick-emoji-trigger');

    const openModalHandler = (e) => {
        if (!postModal) return;
        e.preventDefault();
        postModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    if (quickInput) quickInput.onclick = openModalHandler;
    if (quickBtn) quickBtn.onclick = openModalHandler;
    if (quickEmoji) quickEmoji.onclick = openModalHandler;
});
