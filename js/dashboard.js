const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://YOUR_RENDER_URL.onrender.com'; // TODO: Update this to your deployed Render URL

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    let currentUser = null;
    let allTales = [];
    let activeDashboardTaleId = null;

    // --- Success Modal Helper ---
    function showSuccessModal(title, message) {
        const modal = document.getElementById('success-modal');
        const titleEl = document.getElementById('success-modal-title');
        const msgEl = document.getElementById('success-modal-message');

        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;

        // Reset animations
        const circle = modal?.querySelector('.gt-checkmark-circle');
        const check = modal?.querySelector('.gt-checkmark-check');
        if (circle) { circle.style.animation = 'none'; circle.offsetHeight; circle.style.animation = ''; }
        if (check) { check.style.animation = 'none'; check.offsetHeight; check.style.animation = ''; }

        modal?.classList.remove('hidden');
        setTimeout(() => modal?.classList.add('hidden'), 2000);
    }

    // --- Page Elements ---
    const profileMenuButton = document.getElementById('profile-menu-button');
    const profileMenu = document.getElementById('profile-menu');
    const logoutButton = document.getElementById('logout-button');
    const sidebarProfileContent = document.getElementById('sidebar-profile-content');
    const timelineFeed = document.getElementById('timeline-feed');
    const searchInput = document.querySelector('input[type="search"]');

    // --- Load User Profile ---
    async function loadUserProfile() {
        try {
            const res = await fetch(`${API_BASE}/api/user/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                localStorage.clear();
                window.location.href = 'login.html';
                return;
            }

            const data = await res.json();
            currentUser = data.user;

            const displayName = currentUser.name || 'User';
            const avatarUrl = currentUser.profile_picture
                ? currentUser.profile_picture
                : `https://placehold.co/100x100/e0e7ff/3730a3?text=${displayName.charAt(0).toUpperCase()}`;

            // --- Update Header ---
            const headerAvatarSkeleton = document.getElementById('header-avatar-skeleton');
            const headerNameSkeleton = document.getElementById('header-name-skeleton');

            if (headerAvatarSkeleton) {
                headerAvatarSkeleton.outerHTML = `<img src="${avatarUrl}" alt="Avatar" class="w-8 h-8 rounded-full object-cover">`;
            }
            if (headerNameSkeleton) {
                headerNameSkeleton.outerHTML = `<span class="hidden sm:inline font-semibold text-white text-sm">${displayName}</span>`;
            }

            // --- Update Sidebar ---
            if (sidebarProfileContent) {
                const campusText = currentUser.campus ? `Gitam ${currentUser.campus}` : '';
                const branchAndCampus = currentUser.branch
                    ? (campusText ? `${currentUser.branch} - ${campusText}` : currentUser.branch)
                    : (campusText || 'Branch not set');

                const linkedinHTML = currentUser.linkedin_url
                    ? `<a href="${currentUser.linkedin_url}" target="_blank" class="text-blue-600 hover:underline text-sm">LinkedIn</a>`
                    : '';
                const githubHTML = currentUser.github_url
                    ? `<a href="${currentUser.github_url}" target="_blank" class="text-gray-700 hover:underline text-sm">GitHub</a>`
                    : '';
                const socialLinks = (linkedinHTML || githubHTML)
                    ? `<div class="flex justify-center gap-3 mt-3">${linkedinHTML}${githubHTML}</div>`
                    : '';

                const skillsHTML = currentUser.skills && currentUser.skills.trim()
                    ? `<div class="flex flex-wrap gap-2 mt-3">
                        ${currentUser.skills.split(',').map(s => s.trim()).filter(Boolean).map(s =>
                            `<span class="bg-[#f0faf8] text-[#006A60] border border-[#c7e8e3] px-3 py-1 rounded-full text-xs font-medium">${s}</span>`
                        ).join('')}
                       </div>`
                    : `<p class="text-xs text-gray-400 mt-2"><a href="settings.html" class="text-[#006A60] hover:underline">Add your skills</a></p>`;

                sidebarProfileContent.innerHTML = `
                    <img src="${avatarUrl}" alt="Avatar" class="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-white shadow-lg object-cover">
                    <h2 class="text-2xl font-bold text-gray-900 truncate">${displayName}</h2>
                    <p class="text-gray-500 text-sm">${branchAndCampus}</p>
                    <p class="text-sm text-gray-600 mt-3 px-2 break-words">${currentUser.bio || 'No bio yet. <a href="settings.html" class="text-[#006A60] hover:underline">Add one!</a>'}</p>
                    ${socialLinks}
                `;
                
            }

            // --- Update Create Bar Avatar ---
            const createBarSkeleton = document.getElementById('create-bar-avatar-skeleton');
            if (createBarSkeleton) {
                createBarSkeleton.outerHTML = `<img src="${avatarUrl}" alt="Avatar" class="w-10 h-10 rounded-full flex-shrink-0 object-cover">`;
            }

            // --- Update Create Bar Text ---
            const addTaleButton = document.getElementById('add-tale-button');
            if (addTaleButton) {
                addTaleButton.textContent = `What's new on your journey, ${displayName}?`;
            }

            if (currentUser.is_admin && !document.getElementById('admin-header-badge')) {
                const logoLink = document.querySelector('header a[href="discover.html"].text-xl');
                if (logoLink) logoLink.insertAdjacentHTML('afterend', '<span id="admin-header-badge" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:5px;letter-spacing:0.06em;text-transform:uppercase;">Admin</span>');
            }

            // Show Admin Panel link if admin
            const adminLink = document.getElementById('admin-nav-link');
            if (adminLink && currentUser.is_admin) {
                adminLink.classList.remove('hidden');
                adminLink.classList.add('flex');
            }

            await loadTales();

        } catch (err) {
            console.error('Error loading profile:', err);
            localStorage.clear();
            window.location.href = 'login.html';
        }
    }

    // --- Load Tales ---
    async function loadTales() {
        try {
            const res = await fetch(`${API_BASE}/api/tales/user`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                allTales = data.tales || [];
                renderTales(allTales);
                updateSidebarCounts(allTales);
            }
        } catch (err) {
            console.error('Error loading tales:', err);
        }
    }

    // --- Update Sidebar Counts ---
    function updateSidebarCounts(tales) {
        const talesCountEl = document.getElementById('tales-count');
        if (talesCountEl) talesCountEl.textContent = tales.length;

        // Sum up likes if available
        const totalLikes = tales.reduce((sum, t) => sum + (t.like_count || 0), 0);
        const likesCountEl = document.getElementById('likes-count');
        if (likesCountEl) likesCountEl.textContent = totalLikes;
    }

    // --- Render Tales ---
    function renderTales(tales) {
        // Remove existing tale cards (keep the create bar)
        const existingCards = timelineFeed.querySelectorAll('.tale-card');
        existingCards.forEach(card => card.remove());

        if (tales.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'tale-card text-center py-16 text-gray-500';
            empty.innerHTML = `
                <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
                <p class="text-lg font-medium">No tales yet!</p>
                <p class="text-sm mt-1">Click the bar above to share your first tale.</p>
            `;
            timelineFeed.appendChild(empty);
            return;
        }

        tales.forEach(tale => {
            const card = createTaleCard(tale);
            timelineFeed.appendChild(card);
        });
    }

    // --- Create Tale Card ---
    function createTaleCard(tale) {
        const card = document.createElement('div');
        card.className = 'tale-card bg-white p-6 rounded-xl shadow-md border border-gray-200 mb-6';
        card.dataset.taleId = tale.id;

        const displayName = currentUser.name || 'User';
        const avatarUrl = currentUser.profile_picture
            ? currentUser.profile_picture
            : `https://placehold.co/40x40/e0e7ff/3730a3?text=${displayName.charAt(0).toUpperCase()}`;

        let postDate = new Date(tale.created_at).toLocaleDateString();
        try {
            if (typeof dateFns !== 'undefined') {
                postDate = dateFns.formatDistanceToNow(new Date(tale.created_at), { addSuffix: true });
            }
        } catch (e) {}

        const coverImgUrl = tale.cover_image ? (tale.cover_image.startsWith('http') ? tale.cover_image : `${API_BASE}/uploads/${tale.cover_image}`) : null;
        const coverImageHTML = coverImgUrl
            ? `<img src="${coverImgUrl}" alt="Cover" class="w-full rounded-lg mb-4 object-cover max-h-96">`
            : '';

        const tagsHTML = tale.tags
            ? tale.tags.split(',').map(tag => `<span class="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs">#${tag.trim()}</span>`).join('')
            : '';

       const eventDateStr = tale.event_date
            ? new Date(tale.event_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
            : null;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const eventDateObj = tale.event_date ? new Date(tale.event_date) : null;
        const isUpcoming = eventDateObj && eventDateObj > today;

        card.innerHTML = `
            <div class="flex items-center mb-4">
                <img src="${avatarUrl}" alt="Avatar" class="w-10 h-10 rounded-full mr-3 object-cover flex-shrink-0">
                <div class="flex-grow min-w-0">
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <h3 class="font-bold text-[#292524] flex items-center gap-1">${displayName}${currentUser.is_admin ? `<svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#006A60"/><path d="M6.5 12.5l3.5 3.5 7-7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}</h3>
                            <p class="text-xs text-gray-400 mt-0.5">${postDate}</p>
                        </div>
                        <div class="text-right flex-shrink-0">
                            ${eventDateStr ? `<p class="text-xs text-[#006A60] font-medium whitespace-nowrap flex items-center gap-1.5">📅 ${eventDateStr}${isUpcoming ? `<span class="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Upcoming</span>` : ''}</p>` : '<p class="text-xs text-gray-300 whitespace-nowrap">No event date</p>'}
                            <span class="gt-category-pill mt-1 inline-block">${tale.category}</span>
                        </div>
                    </div>
                </div>
                <div class="relative">
                    <button class="tale-options-btn text-gray-400 hover:text-gray-600 p-1 rounded-full" title="Options">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
                        </svg>
                    </button>
                    <div class="tale-options-menu hidden absolute right-0 mt-1 w-36 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-100">
                        <button class="edit-tale-btn w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Edit</button>
                        <button class="delete-tale-btn w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">Delete</button>
                    </div>
                </div>
            </div>
            <h2 class="text-xl font-bold text-gray-900 mb-3">${tale.title}</h2>
            ${coverImageHTML}
           <div class="text-gray-700 mb-4 prose prose-sm max-w-none break-all overflow-hidden">${tale.description || ''}</div>
            ${tagsHTML ? `<div class="flex flex-wrap gap-2 mb-4">${tagsHTML}</div>` : ''}
            <div class="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                <button class="dashboard-like-btn flex items-center gap-1 text-sm transition-colors duration-200 ${tale.user_has_liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}"
                    data-tale-id="${tale.id}"
                    data-liked="${tale.user_has_liked ? 'true' : 'false'}"
                    data-count="${tale.like_count || 0}">
                    <svg class="w-4 h-4" fill="${tale.user_has_liked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                    </svg>
                    <span class="like-count">${tale.like_count || 0} ${(tale.like_count || 0) === 1 ? 'like' : 'likes'}</span>
                </button>
                <button class="dashboard-comment-btn flex items-center gap-1 text-sm text-gray-400 hover:text-[#006A60] transition-colors duration-200"
                    data-tale-id="${tale.id}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                    </svg>
                    <span class="dashboard-comment-count">${tale.comment_count || 0}</span>
                </button>
            </div>
        `;

        // --- Options Menu Toggle ---
        const optionsBtn = card.querySelector('.tale-options-btn');
        const optionsMenu = card.querySelector('.tale-options-menu');
        optionsBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.tale-options-menu').forEach(m => {
                if (m !== optionsMenu) m.classList.add('hidden');
            });
            optionsMenu?.classList.toggle('hidden');
        });

        // --- Edit Tale ---
        card.querySelector('.edit-tale-btn')?.addEventListener('click', () => {
            optionsMenu?.classList.add('hidden');
            openEditModal(tale);
        });

        // --- Delete Tale ---
        card.querySelector('.delete-tale-btn')?.addEventListener('click', async () => {
            optionsMenu?.classList.add('hidden');
            await deleteTale(tale.id, card);
        });

        return card;
    }

    // --- Delete Tale ---
    async function deleteTale(taleId, cardElement) {
        try {
            const res = await fetch(`${API_BASE}/api/tales/${taleId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                cardElement.remove();
                allTales = allTales.filter(t => t.id !== taleId);
                updateSidebarCounts(allTales);
                if (allTales.length === 0) renderTales([]);
                showSuccessModal('Deleted!', 'Tale removed successfully');
            } else {
                alert('Failed to delete tale. Please try again.');
            }
        } catch (err) {
            console.error('Delete error:', err);
            alert('Error deleting tale.');
        }
    }

    // --- Open Edit Modal ---
    function openEditModal(tale) {
        const modal = document.getElementById('add-tale-modal');
        const modalTitle = modal?.querySelector('h3');
        const editTaleId = document.getElementById('edit-tale-id');
        const titleInput = document.getElementById('tale-title');
        const categorySelect = document.getElementById('tale-category');
        const tagsInput = document.getElementById('tale-tags');
        const submitBtn = document.getElementById('submit-tale-button');

        if (modalTitle) modalTitle.textContent = 'Edit Tale';
        if (editTaleId) editTaleId.value = tale.id;
        if (titleInput) titleInput.value = tale.title || '';
        if (categorySelect) categorySelect.value = tale.category || 'Projects';
        if (tagsInput) tagsInput.value = tale.tags || '';
        if (submitBtn) submitBtn.textContent = 'Save Changes';

        if (quill && tale.description) quill.root.innerHTML = tale.description;

        // Pre-fill event date if it exists
        const eventDateInput = document.getElementById('event-date');
        if (eventDateInput) {
            if (tale.event_date) {
                const d = new Date(tale.event_date);
                // Format as YYYY-MM-DDThh:mm for datetime-local input
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const hh = String(d.getHours()).padStart(2, '0');
                const min = String(d.getMinutes()).padStart(2, '0');
                eventDateInput.value = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
            } else {
                eventDateInput.value = '';
            }
        }

        // Show existing cover image preview
        const coverPreviewWrap = document.getElementById('cover-image-preview-wrap');
        const coverPreviewImg = document.getElementById('cover-image-preview');
        if (tale.cover_image) {
            const coverImgUrl = tale.cover_image.startsWith('http') ? tale.cover_image : `${API_BASE}/uploads/${tale.cover_image}`;
            if (!coverPreviewWrap) {
                const coverInput = document.getElementById('cover-image');
                const previewDiv = document.createElement('div');
                previewDiv.id = 'cover-image-preview-wrap';
                previewDiv.className = 'mt-2';
                previewDiv.innerHTML = `<p class="text-xs text-gray-400 mb-1">Current image:</p><img id="cover-image-preview" src="${coverImgUrl}" class="w-full max-h-40 object-cover rounded-lg border border-gray-200">`;
                coverInput?.insertAdjacentElement('afterend', previewDiv);
            } else {
                coverPreviewWrap.classList.remove('hidden');
                if (coverPreviewImg) coverPreviewImg.src = coverImgUrl;
            }
        } else {
            document.getElementById('cover-image-preview-wrap')?.classList.add('hidden');
        }

        modal?.classList.remove('hidden');
    }

    // --- Search ---
    searchInput?.addEventListener('input', () => {
        const term = searchInput.value.toLowerCase().trim();
        if (!term) {
            renderTales(allTales);
            return;
        }
        const filtered = allTales.filter(tale =>
            tale.title?.toLowerCase().includes(term) ||
            tale.description?.replace(/<[^>]+>/g, '').toLowerCase().includes(term) ||
            tale.category?.toLowerCase().includes(term) ||
            tale.tags?.toLowerCase().includes(term)
        );
        renderTales(filtered);
    });

    // --- Profile Menu ---
    profileMenuButton?.addEventListener('click', () => profileMenu?.classList.toggle('hidden'));
    document.addEventListener('click', (e) => {
        // Close profile menu
        if (profileMenu && !profileMenu.classList.contains('hidden') &&
            profileMenuButton && !profileMenuButton.contains(e.target) &&
            !profileMenu.contains(e.target)) {
            profileMenu.classList.add('hidden');
        }
        // Close all tale options menus
        if (!e.target.closest('.tale-options-btn')) {
            document.querySelectorAll('.tale-options-menu').forEach(m => m.classList.add('hidden'));
        }
    });

    // --- Logout ---
    logoutButton?.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = 'index.html';
    });

    // --- Modal Controls ---
    const addTaleButton = document.getElementById('add-tale-button');
    const addTaleModal = document.getElementById('add-tale-modal');
    const closeModalButton = document.getElementById('close-modal-button');

    addTaleButton?.addEventListener('click', () => {
        // Reset modal to "create" mode
        const modalTitle = addTaleModal?.querySelector('h3');
        const editTaleId = document.getElementById('edit-tale-id');
        const submitBtn = document.getElementById('submit-tale-button');
        if (modalTitle) modalTitle.textContent = 'Create a New Tale';
        if (editTaleId) editTaleId.value = '';
        if (submitBtn) submitBtn.textContent = 'Post Tale';
        document.getElementById('tale-form')?.reset();
        if (quill) quill.setContents([]);

        // Auto-fill today's date
        const eventDateInput = document.getElementById('event-date');
        if (eventDateInput) {
            const now = new Date();
            const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
            eventDateInput.value = local.toISOString().slice(0, 16);
        }

        addTaleModal?.classList.remove('hidden');
    });

    closeModalButton?.addEventListener('click', () => addTaleModal?.classList.add('hidden'));
    addTaleModal?.addEventListener('click', (e) => {
        if (e.target === addTaleModal) addTaleModal.classList.add('hidden');
    });

    // --- Initialize Quill ---
    let quill;
    if (document.getElementById('description-editor')) {
        quill = new Quill('#description-editor', {
            theme: 'snow',
            placeholder: 'Share your tale...',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline'],
                    ['link'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['clean']
                ]
            }
        });
    }

    // --- Tale Form Submission (Create & Edit) ---
    const taleForm = document.getElementById('tale-form');
    const submitTaleButton = document.getElementById('submit-tale-button');

    taleForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const editTaleId = document.getElementById('edit-tale-id')?.value;
        const isEditing = !!editTaleId;

        const title = document.getElementById('tale-title')?.value.trim();
        const category = document.getElementById('tale-category')?.value;
        const eventDate = document.getElementById('event-date')?.value;
        const createdAt = document.getElementById('created-at-date')?.value;
        const tags = document.getElementById('tale-tags')?.value;
        const coverImage = document.getElementById('cover-image')?.files[0];
        const description = quill?.root.innerHTML || '';

        if (!title) {
            alert('Please enter a title.');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('category', category);
        formData.append('description', description);
        formData.append('tags', tags);
        if (eventDate) formData.append('event_date', eventDate);
        if (createdAt) formData.append('created_at', createdAt);
        if (coverImage) formData.append('cover_image', coverImage);

        try {
            if (submitTaleButton) { submitTaleButton.disabled = true; submitTaleButton.textContent = isEditing ? 'Saving...' : 'Posting...'; }

            const url = isEditing ? `${API_BASE}/api/tales/${editTaleId}` : `${API_BASE}/api/tales`;
            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (res.ok) {
                addTaleModal?.classList.add('hidden');
                showSuccessModal('Success!', isEditing ? 'Tale updated successfully' : 'Tale posted successfully');
                setTimeout(() => {
                    taleForm.reset();
                    if (quill) quill.setContents([]);
                    window.location.reload();
                }, 2000);
            } else {
                const err = await res.json();
                alert('Error: ' + (err.message || 'Something went wrong.'));
            }
        } catch (err) {
            console.error('Submit error:', err);
            alert('Error submitting tale. Please try again.');
        } finally {
            if (submitTaleButton) { submitTaleButton.disabled = false; submitTaleButton.textContent = isEditing ? 'Save Changes' : 'Post Tale'; }
        }
    });
    // --- Dashboard Like Button Handler ---
    timelineFeed?.addEventListener('click', async (e) => {
        const btn = e.target.closest('.dashboard-like-btn');
        if (!btn) return;

        const taleId = btn.dataset.taleId;
        const isLiked = btn.dataset.liked === 'true';
        const method = isLiked ? 'DELETE' : 'POST';

        // Optimistic update
        const newLiked = !isLiked;
        const newCount = parseInt(btn.dataset.count) + (newLiked ? 1 : -1);
        btn.dataset.liked = newLiked;
        btn.dataset.count = newCount;
        btn.querySelector('.like-count').textContent = `${newCount} ${newCount === 1 ? 'like' : 'likes'}`;
        btn.querySelector('svg').setAttribute('fill', newLiked ? 'currentColor' : 'none');
        btn.className = `dashboard-like-btn flex items-center gap-1 text-sm transition-colors duration-200 ${newLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`;

        try {
            const res = await fetch(`${API_BASE}/api/tales/${taleId}/like`, {
                method,
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed');

            const data = await res.json();
            btn.dataset.count = data.like_count;
            btn.querySelector('.like-count').textContent = `${data.like_count} ${data.like_count === 1 ? 'like' : 'likes'}`;

            // Update sidebar count
            allTales = allTales.map(t => t.id === parseInt(taleId) ? { ...t, like_count: data.like_count } : t);
            updateSidebarCounts(allTales);

        } catch (err) {
            // Revert on failure
            btn.dataset.liked = isLiked;
            btn.dataset.count = parseInt(btn.dataset.count) + (newLiked ? -1 : 1);
            btn.querySelector('.like-count').textContent = `${btn.dataset.count} ${btn.dataset.count === 1 ? 'like' : 'likes'}`;
            btn.querySelector('svg').setAttribute('fill', isLiked ? 'currentColor' : 'none');
            btn.className = `dashboard-like-btn flex items-center gap-1 text-sm transition-colors duration-200 ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`;
            console.error('Like error:', err);
        }
    });
// --- Inject Dashboard Comment Modal ---
    document.body.insertAdjacentHTML('beforeend', `
        <div id="dashboard-comment-modal" class="fixed inset-0 z-[60] hidden flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-black bg-opacity-50" id="dashboard-comment-backdrop"></div>
            <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style="max-height: 85vh;">
                <div class="flex justify-between items-center px-5 py-4 flex-shrink-0 bg-[#006A60] rounded-t-2xl">
                    <h3 class="text-lg font-bold text-white">Comments</h3>
                    <button id="close-dashboard-comment-modal" class="text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div id="dashboard-comments-list" class="flex-1 overflow-y-auto p-5 space-y-4">
                    <p class="text-center text-gray-400 text-sm py-4">Loading comments...</p>
                </div>
                <div class="p-4 border-t border-gray-100 flex-shrink-0">
                    <div class="flex gap-3 items-start">
                        <div id="dashboard-comment-avatar" class="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-1 bg-gray-200"></div>
                        <div class="flex-1">
                            <textarea id="dashboard-comment-input" placeholder="Write a comment..." rows="2"
                                class="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#006A60] focus:border-transparent"></textarea>
                            <div class="flex justify-between items-center mt-2">
                                <p id="dashboard-comment-error" class="text-red-500 text-xs hidden"></p>
                                <button id="dashboard-post-comment-btn" class="ml-auto bg-[#006A60] hover:bg-[#004b44] text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">Post</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `);

    // --- Dashboard Comment Modal Logic ---
    function openDashboardCommentModal(taleId) {
        activeDashboardTaleId = taleId;
        const modal = document.getElementById('dashboard-comment-modal');
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Set avatar
        const avatarEl = document.getElementById('dashboard-comment-avatar');
        if (avatarEl && currentUser) {
            const avatarUrl = currentUser.profile_picture
                ? currentUser.profile_picture
                : `https://placehold.co/36x36/e0e7ff/3730a3?text=${(currentUser.name || 'U').charAt(0).toUpperCase()}`;
            avatarEl.outerHTML = `<img id="dashboard-comment-avatar" src="${avatarUrl}" class="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-1" alt="You">`;
        }

        loadDashboardComments(taleId);
    }

    function closeDashboardCommentModal() {
        document.getElementById('dashboard-comment-modal').classList.add('hidden');
        document.body.style.overflow = '';
        activeDashboardTaleId = null;
        const input = document.getElementById('dashboard-comment-input');
        if (input) input.value = '';
    }

    document.getElementById('close-dashboard-comment-modal').addEventListener('click', closeDashboardCommentModal);
    document.getElementById('dashboard-comment-backdrop').addEventListener('click', closeDashboardCommentModal);

    async function loadDashboardComments(taleId) {
        const list = document.getElementById('dashboard-comments-list');
        list.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">Loading comments...</p>';

        try {
            const res = await fetch(`${API_BASE}/api/tales/${taleId}/comments`);
            const comments = await res.json();

            // Update count on card
            const countEl = document.querySelector(`.dashboard-comment-btn[data-tale-id="${taleId}"] .dashboard-comment-count`);
            const topLevel = comments.filter(c => !c.parent_id);
            if (countEl) countEl.textContent = topLevel.length;

            if (comments.length === 0) {
                list.innerHTML = '<p class="text-center text-gray-400 text-sm py-6">No comments yet. Be the first!</p>';
                return;
            }

            // Build tree
            const commentMap = {};
            comments.forEach(c => { commentMap[c.id] = { ...c, replies: [] }; });
            const roots = [];
            comments.forEach(c => {
                if (c.parent_id && commentMap[c.parent_id]) {
                    commentMap[c.parent_id].replies.push(commentMap[c.id]);
                } else {
                    roots.push(commentMap[c.id]);
                }
            });

            function renderDashboardComment(comment, isReply = false, parentName = '') {
                const avatar = comment.profile_picture
                    ? comment.profile_picture
                    : `https://placehold.co/36x36/e0e7ff/3730a3?text=${(comment.name || 'U').charAt(0).toUpperCase()}`;

                let timeAgo = new Date(comment.created_at).toLocaleDateString();
                try {
                    if (typeof dateFns !== 'undefined') {
                        timeAgo = dateFns.formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });
                    }
                } catch (e) {}

                const isOwn = currentUser && (currentUser.id === comment.user_id);
                const repliesHTML = comment.replies?.map(r => renderDashboardComment(r, true, comment.name)).join('') || '';

                return `
                    <div class="${isReply ? 'ml-10 mt-3' : ''} flex gap-3 items-start" id="dashboard-comment-${comment.id}">
                        <img src="${avatar}" alt="${comment.name}" class="${isReply ? 'w-7 h-7' : 'w-9 h-9'} rounded-full object-cover flex-shrink-0 mt-0.5">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2">
                                <div>
                                    <span class="font-semibold text-sm text-gray-900 inline-flex items-center gap-1">${comment.name}${comment.is_admin ? `<svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#006A60"/><path d="M6.5 12.5l3.5 3.5 7-7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}</span>
                                    <span class="text-xs text-gray-400 ml-2">${timeAgo}</span>
                                </div>
                                ${isOwn ? `
                                    <button class="dashboard-delete-comment-btn text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                                        data-comment-id="${comment.id}" data-tale-id="${taleId}">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                        </svg>
                                    </button>
                                ` : ''}
                            </div>
                            ${isReply && parentName ? `<p class="text-xs text-[#006A60] font-medium mb-0.5">↩ replying to <span class="font-bold">@${parentName}</span></p>` : ''}
                            <p class="text-sm text-gray-700 mt-1 break-words">${comment.content}</p>
                            ${!isReply ? `
                                <button class="dashboard-reply-btn text-xs text-gray-400 hover:text-[#006A60] mt-1 transition-colors font-medium"
                                    data-comment-id="${comment.id}" data-comment-name="${comment.name}">
                                    ↩ Reply
                                </button>
                                <div class="dashboard-reply-wrap hidden mt-2" id="dashboard-reply-wrap-${comment.id}">
                                    <div class="flex gap-2 items-start">
                                        <img src="${currentUser?.profile_picture || `https://placehold.co/28x28/e0e7ff/3730a3?text=${(currentUser?.name || 'U').charAt(0).toUpperCase()}`}"
                                            class="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-1" alt="You">
                                        <div class="flex-1">
                                            <textarea class="dashboard-reply-textarea w-full border border-gray-200 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-[#006A60]"
                                                rows="2" placeholder="Replying to @${comment.name}..."></textarea>
                                            <div class="flex gap-2 mt-1 justify-end">
                                                <button class="dashboard-cancel-reply text-xs text-gray-400 hover:text-gray-600 px-2 py-1" data-comment-id="${comment.id}">Cancel</button>
                                                <button class="dashboard-post-reply text-xs bg-[#006A60] hover:bg-[#004b44] text-white px-3 py-1 rounded-lg font-semibold transition-colors"
                                                    data-comment-id="${comment.id}" data-tale-id="${taleId}">Post</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                            ${repliesHTML ? `<div class="mt-2 space-y-2">${repliesHTML}</div>` : ''}
                        </div>
                    </div>
                `;
            }

            list.innerHTML = `<div class="space-y-4">${roots.map(c => renderDashboardComment(c)).join('')}</div>`;

            // Reply toggle
            list.querySelectorAll('.dashboard-reply-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const wrap = document.getElementById(`dashboard-reply-wrap-${btn.dataset.commentId}`);
                    wrap?.classList.toggle('hidden');
                    wrap?.querySelector('.dashboard-reply-textarea')?.focus();
                });
            });

            // Cancel reply
            list.querySelectorAll('.dashboard-cancel-reply').forEach(btn => {
                btn.addEventListener('click', () => {
                    const wrap = document.getElementById(`dashboard-reply-wrap-${btn.dataset.commentId}`);
                    wrap?.classList.add('hidden');
                    if (wrap) wrap.querySelector('.dashboard-reply-textarea').value = '';
                });
            });

            // Post reply
            list.querySelectorAll('.dashboard-post-reply').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const wrap = document.getElementById(`dashboard-reply-wrap-${btn.dataset.commentId}`);
                    const textarea = wrap?.querySelector('.dashboard-reply-textarea');
                    const content = textarea?.value.trim();
                    if (!content) return;
                    btn.disabled = true;
                    btn.textContent = 'Posting...';
                    try {
                        const res = await fetch(`${API_BASE}/api/tales/${btn.dataset.taleId}/comments`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ content, parent_id: parseInt(btn.dataset.commentId) })
                        });
                        if (!res.ok) throw new Error();
                        await loadDashboardComments(taleId);
                    } catch {
                        btn.disabled = false;
                        btn.textContent = 'Post';
                    }
                });
            });

            // Delete comment
            list.querySelectorAll('.dashboard-delete-comment-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    try {
                        const res = await fetch(`${API_BASE}/api/tales/${btn.dataset.taleId}/comments/${btn.dataset.commentId}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (res.ok) {
                            await loadDashboardComments(taleId);
                            closeDashboardCommentModal();
                            showSuccessModal('Deleted!', 'Comment removed successfully');
                            setTimeout(() => openDashboardCommentModal(taleId), 2000);
                        }
                    } catch (err) { console.error('Delete comment error:', err); }
                });
            });

        } catch (err) {
            list.innerHTML = '<p class="text-center text-red-400 text-sm py-4">Could not load comments.</p>';
        }
    }

    // Post comment handler
    document.getElementById('dashboard-post-comment-btn').addEventListener('click', async () => {
        const input = document.getElementById('dashboard-comment-input');
        const errorEl = document.getElementById('dashboard-comment-error');
        const btn = document.getElementById('dashboard-post-comment-btn');
        const content = input.value.trim();
        if (!content) return;
        btn.disabled = true;
        btn.textContent = 'Posting...';
        errorEl.classList.add('hidden');
        try {
            const res = await fetch(`${API_BASE}/api/tales/${activeDashboardTaleId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ content })
            });
            const data = await res.json();
            if (!res.ok) { errorEl.textContent = data.error || 'Could not post.'; errorEl.classList.remove('hidden'); return; }
            input.value = '';
            await loadDashboardComments(activeDashboardTaleId);
        } catch {
            errorEl.textContent = 'Something went wrong.';
            errorEl.classList.remove('hidden');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Post';
        }
    });

    // Comment button click on cards
    timelineFeed.addEventListener('click', (e) => {
        const commentBtn = e.target.closest('.dashboard-comment-btn');
        if (commentBtn) openDashboardCommentModal(commentBtn.dataset.taleId);
    }, true);

    // --- Initial Load ---
    await loadUserProfile();
});

