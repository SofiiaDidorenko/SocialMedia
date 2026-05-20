document.addEventListener('DOMContentLoaded', function() {
    let currentPage = 1;
    let isLoading = false;
    let hasMorePosts = true;
    let selectedFiles = [];

    const loaderLine = document.getElementById('postLoaderLine');
    const postList = document.querySelector('.posts-list');
    const postModal = document.getElementById('post-modal');
    const tagModal = document.getElementById('tag-modal');
    const openPostBtn = document.getElementById('quick-create-trigger');
    const openTagBtn = document.getElementById('open-tag-modal');
    const closePostBtn = document.getElementById('close-post-modal');
    const closeTagBtn = document.getElementById('close-tag-modal');
    const cancelTagBtn = document.getElementById('cancel-tag');
    const tagCloseX = document.querySelector('.tag-close-x');
    const saveTagBtn = document.getElementById('save-tag-btn');
    const postForm = document.getElementById('create-post-form');
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.getElementById('image-preview-container');
    const tagsCont = document.getElementById('tags-container');
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

    const toggleM = (m, show) => {
        if (!m) return;
        m.style.display = show ? 'flex' : 'none';
        document.body.style.overflow = (show) ? 'hidden' : 'auto';
    };

    const closeTagHandler = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        toggleM(tagModal, false);
    };


    if (fileInput) {
        fileInput.onchange = (e) => {
            Array.from(e.target.files).forEach(file => {

                const fileId = Date.now() + Math.random();
                file.tempId = fileId; 
                
                selectedFiles.push(file);

                const rd = new FileReader();
                rd.onload = (ev) => {
                    const d = document.createElement('div');
                    d.className = 'image-preview-item';
                    d.innerHTML = `
                        <img src="${ev.target.result}" class="preview-img">
                        <button type="button" class="remove-photo-btn" data-id="${fileId}">
                            <img src="/static/icons/trash.png" style="width:14px; height:14px;">
                        </button>
                    `;
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
                const fileId = parseFloat(btn.dataset.id);
                selectedFiles = selectedFiles.filter(f => f.tempId !== fileId);
                btn.parentElement.remove();
            }
        };
    }
    if (postForm) {
        postForm.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(postForm);
            document.querySelectorAll('.tag-badge.active').forEach(t => {
                fd.append('tags', t.dataset.id);
            });
            fd.delete('image'); 
            selectedFiles.forEach(f => fd.append('image', f)); 

            try {
                const res = await fetch(window.location.pathname, { 
                    method: 'POST', 
                    body: fd, 
                    headers: { 'X-CSRFToken': csrfToken } 
                });
                
                if (res.ok) {
                    window.location.reload();
                } else {
                    alert('Помилка при збереженні поста');
                }
            } catch (err) { console.error('Помилка отправки:', err); }
        };
    }
    if (loaderLine && postList) {
        const observer = new IntersectionObserver(async (entries) => {
            if (entries[0].isIntersecting && !isLoading && hasMorePosts){
                isLoading = true;
                currentPage++;
                let path = window.location.pathname;

                try {
                    const response = await fetch(`${path}?page=${currentPage}`, {
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    });
                    const htmlText = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlText, 'text/html');
                    const newPosts = doc.querySelectorAll('.posts-list .post-card');
                    
                    if (newPosts.length > 0) {
                        newPosts.forEach(post => loaderLine.insertAdjacentHTML('beforebegin', post.outerHTML));
                    } else {
                        hasMorePosts = false;
                        observer.disconnect();
                        loaderLine.remove();
                    }
                } catch (err) { console.error('Error loading posts:', err); }
                finally { isLoading = false; }
            }
        }, { rootMargin: '300px' });
        observer.observe(loaderLine);
    }

  
    if (openPostBtn) openPostBtn.onclick = (e) => { e.preventDefault(); toggleM(postModal, true); };
    if (openTagBtn) openTagBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); toggleM(tagModal, true); };
    if (closePostBtn) closePostBtn.onclick = (e) => { e.preventDefault(); toggleM(postModal, false); };
    if (closeTagBtn) closeTagBtn.onclick = closeTagHandler;
    if (cancelTagBtn) cancelTagBtn.onclick = closeTagHandler;
    if (tagCloseX) tagCloseX.onclick = closeTagHandler;

    window.onclick = (e) => { 
        if (e.target === tagModal) toggleM(tagModal, false);
        else if (e.target === postModal) toggleM(postModal, false);
    };

    if (tagsCont) {
        tagsCont.onclick = (e) => { 
            if (e.target.classList.contains('tag-badge')) e.target.classList.toggle('active'); 
        };
    }

    if (saveTagBtn) {
        saveTagBtn.onclick = async (e) => {
            const input = document.getElementById('new-tag-input');
            const val = input.value.replace('#', '').trim();
            if (!val) return;
            try {
                const res = await fetch('/add_tag/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
                    body: JSON.stringify({ name: val })
                });
                if (res.ok) {
                    const data = await res.json();
                    const badge = document.createElement('div');
                    badge.className = 'tag-badge active';
                    badge.dataset.id = data.id;
                    badge.textContent = '#' + data.name;
                    tagsCont.insertBefore(badge, openTagBtn);
                    toggleM(tagModal, false);
                    input.value = '';
                }
            } catch (err) { console.error('Error adding tag:', err); }
        };
    }
});
