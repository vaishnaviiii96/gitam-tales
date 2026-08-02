const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://YOUR_RENDER_URL.onrender.com'; // TODO: Update this to your deployed Render URL

document.addEventListener('DOMContentLoaded', async () => {

    const token = localStorage.getItem('token');
    let currentUser = null;

    if (token) {
        try {
            const res = await fetch(`${API_BASE}/api/user/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                currentUser = data.user;
                // Keep localStorage in sync with latest server data
                localStorage.setItem('user', JSON.stringify(currentUser));
            } else {
                localStorage.clear();
            }
        } catch (e) {
            console.warn('Could not verify session:', e);
        }
    }

    updateHeader(currentUser);

    const discoverFeed = document.getElementById('discover-feed');
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const noResultsMessage = document.getElementById('no-results-message');

    let allTales = [];

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

    // ─── Filter State ──────────────────────────────────────────────────────────
    let currentSort = 'newest';
    let currentCampus = '';
    let currentAdminOnly = false;

    // ─── Filter Functions ──────────────────────────────────────────────────────
    window.setSort = function(sort) {
        currentSort = sort;
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.classList.toggle('active-filter', btn.dataset.sort === sort);
        });
        fetchPublicTales();
    };
    window.setCampus = function(campus) {
    currentCampus = campus;
    document.querySelectorAll('.campus-btn').forEach(btn => {
        btn.classList.toggle('active-filter', btn.dataset.campus === campus);
    });
    fetchPublicTales();
};

    window.setAdminFilter = function() {
        currentAdminOnly = !currentAdminOnly;
        const btn = document.getElementById('admin-filter-btn');
        btn.classList.toggle('active-filter', currentAdminOnly);
        filterAndDisplay();
    };

    function initFilterButtons() {
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.classList.toggle('active-filter', btn.dataset.sort === currentSort);
        });
        document.querySelectorAll('.campus-btn').forEach(btn => {
            btn.classList.toggle('active-filter', btn.dataset.campus === currentCampus);
        });
    }

    // ─── Inject Comment Modal ──────────────────────────────────────────────────
    document.body.insertAdjacentHTML('beforeend', `
        <div id="comment-modal" class="fixed inset-0 z-[60] hidden flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-black bg-opacity-50" id="comment-modal-backdrop"></div>
            <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style="max-height: 85vh;">
                <div class="flex justify-between items-center px-5 py-4 flex-shrink-0 bg-[#006A60] rounded-t-2xl">
                    <div class="flex items-center gap-3">
                        <button id="back-to-tale-btn" class="text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20 hidden">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                            </svg>
                        </button>
                        <h3 class="text-lg font-bold text-white">Comments</h3>
                    </div>
                    <button id="close-comment-modal" class="text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div id="comments-list" class="flex-1 overflow-y-auto p-5 space-y-4">
                    <p class="text-center text-gray-400 text-sm py-4">Loading comments...</p>
                </div>
                <div class="p-4 border-t border-gray-100 flex-shrink-0">
                    ${token ? `
                        <div class="flex gap-3 items-start">
                            <img src="${currentUser?.profile_picture || `https://placehold.co/36x36/e0e7ff/3730a3?text=${(currentUser?.name || 'U').charAt(0).toUpperCase()}`}"
                                class="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-1" alt="You">
                            <div class="flex-1">
                                <textarea id="comment-input" placeholder="Write a comment..." rows="2"
                                    class="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#006A60] focus:border-transparent"></textarea>
                                <div class="flex justify-between items-center mt-2">
                                    <p id="comment-error" class="text-red-500 text-xs hidden"></p>
                                    <button id="post-comment-btn" class="ml-auto bg-[#006A60] hover:bg-[#004b44] text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">Post</button>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <p class="text-center text-sm text-gray-500">
                            <a href="login.html" class="text-[#006A60] font-semibold hover:underline">Log in</a> to leave a comment.
                        </p>
                    `}
                </div>
            </div>
        </div>

        <!-- Tale Detail Modal -->
        <div id="tale-detail-modal" class="fixed inset-0 z-50 hidden flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-black bg-opacity-60" id="tale-detail-backdrop"></div>
            <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style="max-height: 90vh;">
                <div class="flex justify-between items-center p-5 border-b border-gray-100 flex-shrink-0 bg-[#006A60] rounded-t-2xl">
                    <span id="tale-detail-category" class="text-xs font-bold text-white uppercase tracking-wider"></span>
                    <button id="close-tale-detail" class="text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div id="tale-detail-body" class="flex-1 overflow-y-auto p-6"></div>
                <div id="tale-detail-footer" class="p-4 border-t border-gray-100 flex items-center gap-4 flex-shrink-0"></div>
            </div>
        </div>
    `);

    // ─── Tale Detail Modal Logic ───────────────────────────────────────────────
    let activeTaleId = null;

    function openTaleDetail(tale) {
        const modal = document.getElementById('tale-detail-modal');
        const body = document.getElementById('tale-detail-body');
        const footer = document.getElementById('tale-detail-footer');
        const categoryEl = document.getElementById('tale-detail-category');

        categoryEl.textContent = tale.category;

        const authorName = tale.author_name || 'A Gitamite';
        const isAdmin = tale.author_is_admin === true;
        const today = new Date(); today.setHours(0,0,0,0);
        const eventDate = tale.event_date ? new Date(tale.event_date) : null;
        const isUpcoming = isAdmin && eventDate && eventDate > today;
        const authorAvatar = tale.author_avatar
            ? tale.author_avatar
            : `https://placehold.co/40x40/e0e7ff/3730a3?text=${authorName.charAt(0).toUpperCase()}`;

        let postDate = new Date(tale.created_at).toLocaleDateString();
        try {
            if (typeof dateFns !== 'undefined') {
                postDate = dateFns.formatDistanceToNow(new Date(tale.created_at), { addSuffix: true });
            }
        } catch (e) {}

        let eventDateHTML = '';
        if (tale.event_date) {
            const evDate = new Date(tale.event_date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
            eventDateHTML = `
                <div class="flex items-center gap-2 text-sm text-gray-500 mt-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    Event: ${evDate}
                </div>`;
        }

        const coverImageHTML = tale.cover_image
            ? `<img src="${API_BASE}/uploads/${tale.cover_image}" alt="Cover" class="w-full rounded-xl mb-5 object-cover max-h-80 border border-gray-100">`
            : '';

        const tagsHTML = tale.tags
            ? `<div class="flex flex-wrap gap-2 mt-5">
                ${tale.tags.split(',').map(tag => `<span class="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs">#${tag.trim()}</span>`).join('')}
               </div>`
            : '';

        body.innerHTML = `
            <div class="flex items-center gap-3 mb-5">
                <a href="profile.html?id=${tale.user_id}">
                    <img src="${authorAvatar}" alt="${authorName}" class="w-11 h-11 rounded-full object-cover shadow-sm hover:ring-2 hover:ring-[#006A60] transition">
                </a>
                <div>
                    <a href="profile.html?id=${tale.user_id}" class="font-bold text-gray-900 hover:text-[#006A60] transition">${authorName}</a>
                    <p class="text-xs text-gray-400">${postDate}</p>
                    ${eventDateHTML}
                </div>
            </div>
            <h2 class="text-2xl font-bold text-gray-900 mb-4">${tale.title}</h2>
            ${coverImageHTML}
            <div class="prose prose-sm max-w-none text-gray-700 break-words overflow-hidden">${tale.description || ''}</div>
            ${tagsHTML}
        `;

        const isLiked = tale.user_has_liked;
        footer.innerHTML = `
            <button id="modal-like-btn"
                class="flex items-center gap-1.5 text-sm transition-colors duration-200 ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}"
                data-tale-id="${tale.id}" data-liked="${isLiked ? 'true' : 'false'}" data-count="${tale.like_count || 0}">
                <svg class="w-5 h-5" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
                <span id="modal-like-count">${tale.like_count || 0}</span>
            </button>
            <button id="modal-comment-btn"
                class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#006A60] transition-colors duration-200"
                data-tale-id="${tale.id}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
                <span id="modal-comment-count">${tale.comment_count || 0}</span>
            </button>
        `;

        document.getElementById('modal-like-btn').addEventListener('click', async () => {
            if (!token) { window.location.href = 'login.html'; return; }
            const btn = document.getElementById('modal-like-btn');
            const isLikedNow = btn.dataset.liked === 'true';
            const newLiked = !isLikedNow;
            const newCount = parseInt(btn.dataset.count) + (newLiked ? 1 : -1);
            btn.dataset.liked = newLiked;
            btn.dataset.count = newCount;
            document.getElementById('modal-like-count').textContent = newCount;
            btn.querySelector('svg').setAttribute('fill', newLiked ? 'currentColor' : 'none');
            btn.className = `flex items-center gap-1.5 text-sm transition-colors duration-200 ${newLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`;
            syncCardLike(tale.id, newLiked, newCount);
            try {
                const res = await fetch(`${API_BASE}/api/tales/${tale.id}/like`, {
                    method: isLikedNow ? 'DELETE' : 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error();
                const data = await res.json();
                btn.dataset.count = data.like_count;
                document.getElementById('modal-like-count').textContent = data.like_count;
                syncCardLike(tale.id, newLiked, data.like_count);
                tale.like_count = data.like_count;
                tale.user_has_liked = newLiked;
            } catch {
                btn.dataset.liked = isLikedNow;
                btn.dataset.count = parseInt(btn.dataset.count) + (newLiked ? -1 : 1);
                document.getElementById('modal-like-count').textContent = btn.dataset.count;
                btn.querySelector('svg').setAttribute('fill', isLikedNow ? 'currentColor' : 'none');
                btn.className = `flex items-center gap-1.5 text-sm transition-colors duration-200 ${isLikedNow ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`;
                syncCardLike(tale.id, isLikedNow, parseInt(btn.dataset.count));
            }
        });

        document.getElementById('modal-comment-btn').addEventListener('click', () => {
            if (!token) { window.location.href = 'login.html'; return; }
            openCommentModal(tale.id, true);
        });

        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeTaleDetail() {
        document.getElementById('tale-detail-modal').classList.add('hidden');
        document.body.style.overflow = '';
    }

    document.getElementById('close-tale-detail').addEventListener('click', closeTaleDetail);
    document.getElementById('tale-detail-backdrop').addEventListener('click', closeTaleDetail);

    function syncCardLike(taleId, liked, count) {
        const cardBtn = document.querySelector(`.like-btn[data-tale-id="${taleId}"]`);
        if (!cardBtn) return;
        cardBtn.dataset.liked = liked;
        cardBtn.dataset.count = count;
        cardBtn.querySelector('.like-count').textContent = count;
        cardBtn.querySelector('svg').setAttribute('fill', liked ? 'currentColor' : 'none');
        cardBtn.className = `like-btn flex items-center gap-1 text-sm transition-colors duration-200 ${liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`;
    }

    // ─── Comment Modal Logic ───────────────────────────────────────────────────
    function openCommentModal(taleId, fromTaleDetail = false) {
        activeTaleId = taleId;
        document.getElementById('comment-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        loadComments(taleId);
        const backBtn = document.getElementById('back-to-tale-btn');
        if (backBtn) {
            fromTaleDetail ? backBtn.classList.remove('hidden') : backBtn.classList.add('hidden');
        }
    }

    function closeCommentModal() {
        document.getElementById('comment-modal').classList.add('hidden');
        document.body.style.overflow = '';
        if (!document.getElementById('tale-detail-modal').classList.contains('hidden')) {
            document.body.style.overflow = 'hidden';
        }
        activeTaleId = null;
        const input = document.getElementById('comment-input');
        if (input) input.value = '';
        const err = document.getElementById('comment-error');
        if (err) { err.textContent = ''; err.classList.add('hidden'); }
    }

    document.getElementById('close-comment-modal').addEventListener('click', closeCommentModal);
    document.getElementById('comment-modal-backdrop').addEventListener('click', closeCommentModal);
    document.getElementById('back-to-tale-btn').addEventListener('click', () => {
        closeCommentModal();
        const taleDetailModal = document.getElementById('tale-detail-modal');
        if (taleDetailModal) {
            taleDetailModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    });

    async function loadComments(taleId) {
        const list = document.getElementById('comments-list');
        list.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">Loading comments...</p>';
        try {
            const res = await fetch(`${API_BASE}/api/tales/${taleId}/comments`);
            const comments = await res.json();
            const topLevel = comments.filter(c => !c.parent_id);
            const cardCommentBtn = document.querySelector(`.comment-btn[data-tale-id="${taleId}"]`);
            if (cardCommentBtn) cardCommentBtn.querySelector('.comment-count').textContent = topLevel.length;
            const modalCommentCount = document.getElementById('modal-comment-count');
            if (modalCommentCount) modalCommentCount.textContent = topLevel.length;

            if (comments.length === 0) {
                list.innerHTML = '<p class="text-center text-gray-400 text-sm py-6">No comments yet. Be the first!</p>';
                return;
            }

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

            function renderComment(comment, isReply = false, parentName = '') {
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
                const repliesHTML = comment.replies?.map(r => renderComment(r, true, comment.name)).join('') || '';
                return `
                    <div class="${isReply ? 'ml-10 mt-3' : ''} flex gap-3 items-start" id="comment-${comment.id}">
                        <img src="${avatar}" alt="${comment.name}" class="${isReply ? 'w-7 h-7' : 'w-9 h-9'} rounded-full object-cover flex-shrink-0 mt-0.5">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2">
                                <div>
                                    <span class="font-semibold text-sm text-gray-900 inline-flex items-center gap-1">${comment.name}${comment.is_admin ? `<svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#006A60"/><path d="M6.5 12.5l3.5 3.5 7-7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}</span>
                                    <span class="text-xs text-gray-400 ml-2">${timeAgo}</span>
                                </div>
                                ${isOwn ? `
                                    <button class="delete-comment-btn text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                                        data-comment-id="${comment.id}" data-tale-id="${taleId}" title="Delete comment">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                        </svg>
                                    </button>
                                ` : ''}
                            </div>
                            ${isReply && parentName ? `<p class="text-xs text-[#006A60] font-medium mb-0.5">↩ replying to <span class="font-bold">@${parentName}</span></p>` : ''}
                            <p class="text-sm text-gray-700 mt-1 break-words">${comment.content}</p>
                            ${token && !isReply ? `
                                <button class="reply-btn text-xs text-gray-400 hover:text-[#006A60] mt-1 transition-colors font-medium"
                                    data-comment-id="${comment.id}" data-comment-name="${comment.name}">↩ Reply</button>
                                <div class="reply-input-wrap hidden mt-2" id="reply-wrap-${comment.id}">
                                    <div class="flex gap-2 items-start">
                                        <img src="${currentUser?.profile_picture || `https://placehold.co/28x28/e0e7ff/3730a3?text=${(currentUser?.name || 'U').charAt(0).toUpperCase()}`}"
                                            class="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-1" alt="You">
                                        <div class="flex-1">
                                            <textarea class="reply-textarea w-full border border-gray-200 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-[#006A60]"
                                                rows="2" placeholder="Replying to ${comment.name}..."></textarea>
                                            <div class="flex gap-2 mt-1 justify-end">
                                                <button class="cancel-reply-btn text-xs text-gray-400 hover:text-gray-600 px-2 py-1" data-comment-id="${comment.id}">Cancel</button>
                                                <button class="post-reply-btn text-xs bg-[#006A60] hover:bg-[#004b44] text-white px-3 py-1 rounded-lg font-semibold transition-colors"
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

            list.innerHTML = `<div class="space-y-4">${roots.map(c => renderComment(c)).join('')}</div>`;

            list.querySelectorAll('.reply-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const wrap = document.getElementById(`reply-wrap-${btn.dataset.commentId}`);
                    wrap?.classList.toggle('hidden');
                    wrap?.querySelector('.reply-textarea')?.focus();
                });
            });
            list.querySelectorAll('.cancel-reply-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const wrap = document.getElementById(`reply-wrap-${btn.dataset.commentId}`);
                    wrap?.classList.add('hidden');
                    if (wrap) wrap.querySelector('.reply-textarea').value = '';
                });
            });
            list.querySelectorAll('.post-reply-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const wrap = document.getElementById(`reply-wrap-${btn.dataset.commentId}`);
                    const textarea = wrap?.querySelector('.reply-textarea');
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
                        await loadComments(taleId);
                    } catch {
                        btn.disabled = false;
                        btn.textContent = 'Post';
                    }
                });
            });
        } catch (err) {
            list.innerHTML = '<p class="text-center text-red-400 text-sm py-4">Could not load comments.</p>';
        }
    }

    document.getElementById('comment-modal').addEventListener('click', async (e) => {
        if (e.target.closest('#post-comment-btn')) {
            const input = document.getElementById('comment-input');
            const errorEl = document.getElementById('comment-error');
            const btn = document.getElementById('post-comment-btn');
            const content = input.value.trim();
            if (!content) return;
            btn.disabled = true;
            btn.textContent = 'Posting...';
            errorEl.classList.add('hidden');
            try {
                const res = await fetch(`${API_BASE}/api/tales/${activeTaleId}/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ content })
                });
                const data = await res.json();
                if (!res.ok) { errorEl.textContent = data.error || 'Could not post comment.'; errorEl.classList.remove('hidden'); return; }
                input.value = '';
                await loadComments(activeTaleId);
            } catch (err) {
                errorEl.textContent = 'Something went wrong. Try again.';
                errorEl.classList.remove('hidden');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Post';
            }
        }

        if (e.target.closest('.delete-comment-btn')) {
            const btn = e.target.closest('.delete-comment-btn');
            const commentId = btn.dataset.commentId;
            const taleId = btn.dataset.taleId;
            try {
                const res = await fetch(`${API_BASE}/api/tales/${taleId}/comments/${commentId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    document.getElementById(`comment-${commentId}`)?.remove();
                    const list = document.getElementById('comments-list');
                    const remaining = list.querySelectorAll('[id^="comment-"]').length;
                    const cardBtn = document.querySelector(`.comment-btn[data-tale-id="${taleId}"]`);
                    if (cardBtn) cardBtn.querySelector('.comment-count').textContent = remaining;
                    const modalCount = document.getElementById('modal-comment-count');
                    if (modalCount) modalCount.textContent = remaining;
                    if (remaining === 0) list.innerHTML = '<p class="text-center text-gray-400 text-sm py-6">No comments yet. Be the first!</p>';
                }
            } catch (err) { console.error('Delete comment failed:', err); }
        }
    });

    // ─── Fetch Public Tales ────────────────────────────────────────────────────
    async function fetchPublicTales() {
        if (!discoverFeed) return;
        discoverFeed.innerHTML = createSkeletons(4);
        try {
            const params = new URLSearchParams();
            if (currentSort) params.set('sort', currentSort);
            if (currentCampus) params.set('campus', currentCampus);
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const res = await fetch(`${API_BASE}/api/tales/public?${params.toString()}`, { headers });
            if (!res.ok) throw new Error('Failed to fetch tales');
            const data = await res.json();
            allTales = data.tales || [];
const noFiltersActive = currentSort === 'newest' && !currentCampus && !currentAdminOnly;
if (noFiltersActive) shuffleArray(allTales);
            const resultsCount = document.getElementById('results-count');
            if (resultsCount) {
                resultsCount.textContent = (currentCampus || currentSort !== 'newest')
                    ? `${allTales.length} ${allTales.length === 1 ? 'story' : 'stories'} found`
                    : 'Showing all stories';
            }
            filterAndDisplay();
        } catch (error) {
            console.error('Error fetching tales:', error);
            discoverFeed.innerHTML = '<p class="text-center text-red-500 py-10">Could not load tales. Please try again.</p>';
        }
    }

    function filterAndDisplay() {
        const searchTerm = searchInput?.value.toLowerCase().trim() || '';
        const category = categoryFilter?.value || '';
        const filtered = allTales.filter(tale => {
            const matchesCategory  = !category || tale.category === category;
            const matchesSearch    = !searchTerm || (
                tale.title?.toLowerCase().includes(searchTerm) ||
                tale.description?.replace(/<[^>]+>/g, '').toLowerCase().includes(searchTerm) ||
                tale.author_name?.toLowerCase().includes(searchTerm) ||
                tale.tags?.toLowerCase().includes(searchTerm)
            );
            const matchesAdminOnly = !currentAdminOnly || tale.author_is_admin === true;
            return matchesCategory && matchesSearch && matchesAdminOnly;
        });
        displayTales(filtered);
    }

    function displayTales(tales) {
        if (!discoverFeed) return;
        discoverFeed.innerHTML = '';
        if (tales.length === 0) { noResultsMessage?.classList.remove('hidden'); return; }
        noResultsMessage?.classList.add('hidden');
        tales.forEach(tale => discoverFeed.insertAdjacentHTML('beforeend', createTaleCard(tale)));
        requestAnimationFrame(() => {
            discoverFeed.querySelectorAll('.tale-desc').forEach(el => {
                if (el.scrollHeight > el.clientHeight + 1) {
                    el.nextElementSibling?.classList.remove('hidden');
                }
            });
        });
    }

    // ─── Create Tale Card ──────────────────────────────────────────────────────
    function createTaleCard(tale) {
        const authorName = tale.author_name || 'A Gitamite';
        const authorAvatar = tale.author_avatar
            ? tale.author_avatar
            : `https://placehold.co/40x40/e0e7ff/3730a3?text=${authorName.charAt(0).toUpperCase()}`;
        let postDate = new Date(tale.created_at).toLocaleDateString();
        try {
            if (typeof dateFns !== 'undefined') {
                postDate = dateFns.formatDistanceToNow(new Date(tale.created_at), { addSuffix: true });
            }
        } catch (e) {}
        const coverImageHTML = tale.cover_image
            ? `<img src="${API_BASE}/uploads/${tale.cover_image}" alt="Cover" class="w-full h-auto max-h-60 object-cover rounded-md my-3 border border-gray-100">`
            : '';
        const tagsHTML = tale.tags
            ? tale.tags.split(',').map(tag => `<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">#${tag.trim()}</span>`).join('')
            : '';
        const isAdmin = tale.author_is_admin === true;
        const today = new Date(); today.setHours(0,0,0,0);
        const eventDate = tale.event_date ? new Date(tale.event_date) : null;
        const isUpcoming = isAdmin && eventDate && eventDate > today;
        return `
            <div class="tale-card bg-white rounded-xl shadow-sm overflow-hidden
                        cursor-pointer transition-all duration-300 ease-out
                        hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl
                        ${isAdmin ? 'border border-[#006A60]/30 bg-[#f0faf8]' : 'border border-gray-200'}"
                 data-tale-id="${tale.id}">
                <div class="p-5 tale-card-clickable">
                    <div class="flex items-center gap-3 mb-3">
                        <a href="profile.html?id=${tale.user_id}" class="flex-shrink-0" onclick="event.stopPropagation()">
                            <img src="${authorAvatar}" alt="${authorName}" class="w-9 h-9 rounded-full object-cover shadow-sm hover:ring-2 hover:ring-[#006A60] transition">
                        </a>
                        <div class="min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <a href="profile.html?id=${tale.user_id}" class="font-bold text-gray-900 text-sm hover:text-[#006A60] transition flex items-center gap-1" onclick="event.stopPropagation()">
                                    ${authorName}
                                    ${isAdmin ? `<svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#006A60"/><path d="M6.5 12.5l3.5 3.5 7-7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
                                </a>
                               ${!isAdmin && (tale.author_branch || tale.author_year) ? `<span class="text-xs text-gray-400 font-normal">${[tale.author_branch, tale.author_year].filter(Boolean).join("'")}</span>` : ''}
                            </div>
                            <p class="text-xs text-gray-400 flex items-center gap-1.5 flex-wrap">
                                <span class="font-medium text-[#006A60]">${tale.category}</span> · ${postDate}
                                ${isUpcoming ? `<span class="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Upcoming</span>` : ''}
                            </p>
                        </div>
                    </div>
                    <h3 class="text-base font-bold text-[#292524] mb-2 leading-snug">${tale.title}</h3>
                    ${coverImageHTML}
                    <div class="tale-desc text-gray-600 text-sm line-clamp-1 break-all overflow-hidden">${tale.description?.replace(/<[^>]+>/g, '') || ''}</div>
                    <span class="read-more-label text-xs text-[#006A60] font-medium mt-1 hidden">Read more...</span>
                    ${tagsHTML ? `<div class="flex flex-wrap gap-1.5 mt-3">${tagsHTML}</div>` : ''}
                </div>
                <div class="px-5 py-3 border-t flex items-center gap-4 ${isAdmin ? 'bg-[#e8f4f2] border-[#006A60]/20' : 'bg-[#FAF9F6] border-gray-100'}">
                    <button class="like-btn flex items-center gap-1 text-sm transition-colors duration-200 ${tale.user_has_liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}"
                        data-tale-id="${tale.id}" data-liked="${tale.user_has_liked ? 'true' : 'false'}" data-count="${tale.like_count || 0}"
                        ${!token ? 'title="Log in to like"' : ''}>
                        <svg class="w-4 h-4" fill="${tale.user_has_liked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                        </svg>
                        <span class="like-count">${tale.like_count || 0}</span>
                    </button>
                    <button class="comment-btn flex items-center gap-1 text-sm text-gray-400 hover:text-[#006A60] transition-colors duration-200"
                        data-tale-id="${tale.id}" ${!token ? 'title="Log in to comment"' : ''}>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                        </svg>
                        <span class="comment-count">${tale.comment_count || 0}</span>
                    </button>
                </div>
            </div>
        `;
    }

    // ─── Skeleton Loaders ──────────────────────────────────────────────────────
    function createSkeletons(count) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 animate-pulse">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0"></div>
                        <div class="flex-1 space-y-2">
                            <div class="h-3 w-24 bg-gray-200 rounded"></div>
                            <div class="h-3 w-36 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                    <div class="h-5 w-3/4 bg-gray-200 rounded mb-3"></div>
                    <div class="space-y-2">
                        <div class="h-3 w-full bg-gray-200 rounded"></div>
                        <div class="h-3 w-5/6 bg-gray-200 rounded"></div>
                    </div>
                </div>`;
        }
        return html;
    }

    // ─── Update Header ─────────────────────────────────────────────────────────
    // ✅ FIXED: Admin Panel link only shows when user.is_admin === true
    function updateHeader(user) {
        const authStatusDiv = document.getElementById('auth-status');
        if (!authStatusDiv) return;

        if (user) {
            const avatarUrl = user.profile_picture
                ? user.profile_picture
                : `https://placehold.co/40x40/e0e7ff/3730a3?text=${(user.name || 'U').charAt(0).toUpperCase()}`;

            // Only render the Admin Panel link if is_admin is true
            const adminLinkHTML = user.is_admin
                ? `<a href="admin.html" class="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#006A60] hover:bg-[#e8f4f2] rounded-lg transition-colors">
                       <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                       Admin Panel
                   </a>
                   <hr class="my-1 border-gray-100">`
                : '';

            authStatusDiv.innerHTML = `
                <div class="hidden md:flex gap-6">
    <a href="discover.html" class="text-sm text-white font-medium">Discover</a>
    <a href="dashboard.html" class="text-sm text-white/80 hover:text-white transition-colors">My Journey</a>
</div>
                <a href="notifications.html" class="relative flex items-center justify-center w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full transition-all">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                    <span id="notif-badge" class="hidden absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">0</span>
                </a>
                <div class="relative">
                    <button id="profile-menu-button" class="flex items-center gap-2 bg-white/10 hover:bg-white/20 p-1 pr-3 rounded-full transition-all">
                        <img src="${avatarUrl}" alt="Avatar" class="w-8 h-8 rounded-full object-cover">
                        <span class="hidden sm:inline font-semibold text-white text-sm">${user.name || 'User'}</span>
                    </button>
                    <div id="profile-menu" class="hidden absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl py-2 z-20 border border-gray-100">
                        <a href="settings.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-[#FAF9F6] transition-colors">Settings</a>
                        ${adminLinkHTML}
                        <hr class="my-1 border-gray-100">
                        <a href="#" id="logout-button" class="block px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors">Log Out</a>
                    </div>
                </div>
            `;

            document.getElementById('profile-menu-button')?.addEventListener('click', () => {
                document.getElementById('profile-menu')?.classList.toggle('hidden');
            });
            document.addEventListener('click', (e) => {
                const menu = document.getElementById('profile-menu');
                const btn = document.getElementById('profile-menu-button');
                if (menu && !menu.classList.contains('hidden') && !btn?.contains(e.target) && !menu.contains(e.target)) {
                    menu.classList.add('hidden');
                }
            });
            document.getElementById('logout-button')?.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.clear();
                window.location.href = 'index.html';
            });

            if (user.is_admin && !document.getElementById('admin-header-badge')) {
                const logoLink = document.querySelector('header a[href="discover.html"].text-xl');
                if (logoLink) logoLink.insertAdjacentHTML('afterend', '<span id="admin-header-badge" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:5px;letter-spacing:0.06em;text-transform:uppercase;">Admin</span>');
            }
        } else {
            authStatusDiv.innerHTML = `
                <a href="login.html" class="text-gray-600 hover:text-[#006A60] text-sm font-medium">Log In</a>
                <a href="signup.html" class="bg-[#006A60] hover:bg-[#004b44] text-white font-semibold py-2 px-4 rounded-lg text-sm">Sign Up</a>
            `;
        }
    }

    // ─── Event Listeners ───────────────────────────────────────────────────────
    let searchTimeout = null;
    searchInput?.addEventListener('input', () => {
        filterAndDisplay();
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => searchPeople(searchInput.value.trim()), 400);
    });
    categoryFilter?.addEventListener('change', filterAndDisplay);

    // ─── Feed Click Handler ────────────────────────────────────────────────────
    discoverFeed?.addEventListener('click', async (e) => {
        const commentBtn = e.target.closest('.comment-btn');
        if (commentBtn) {
            if (!token) { window.location.href = 'login.html'; return; }
            openCommentModal(commentBtn.dataset.taleId);
            return;
        }
        const likeBtn = e.target.closest('.like-btn');
        if (likeBtn) {
            if (!token) { window.location.href = 'login.html'; return; }
            const taleId = likeBtn.dataset.taleId;
            const isLiked = likeBtn.dataset.liked === 'true';
            const newLiked = !isLiked;
            const newCount = parseInt(likeBtn.dataset.count) + (newLiked ? 1 : -1);
            likeBtn.dataset.liked = newLiked;
            likeBtn.dataset.count = newCount;
            likeBtn.querySelector('.like-count').textContent = newCount;
            likeBtn.querySelector('svg').setAttribute('fill', newLiked ? 'currentColor' : 'none');
            likeBtn.className = `like-btn flex items-center gap-1 text-sm transition-colors duration-200 ${newLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`;
            try {
                const res = await fetch(`${API_BASE}/api/tales/${taleId}/like`, {
                    method: isLiked ? 'DELETE' : 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error();
                const data = await res.json();
                likeBtn.dataset.count = data.like_count;
                likeBtn.querySelector('.like-count').textContent = data.like_count;
                const tale = allTales.find(t => t.id == taleId);
                if (tale) { tale.like_count = data.like_count; tale.user_has_liked = newLiked; }
            } catch {
                likeBtn.dataset.liked = isLiked;
                likeBtn.dataset.count = parseInt(likeBtn.dataset.count) + (newLiked ? -1 : 1);
                likeBtn.querySelector('.like-count').textContent = likeBtn.dataset.count;
                likeBtn.querySelector('svg').setAttribute('fill', isLiked ? 'currentColor' : 'none');
                likeBtn.className = `like-btn flex items-center gap-1 text-sm transition-colors duration-200 ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`;
            }
            return;
        }
        const card = e.target.closest('.tale-card');
        if (card && !e.target.closest('a') && !e.target.closest('button')) {
            const taleId = card.dataset.taleId;
            const tale = allTales.find(t => t.id == taleId);
            if (tale) openTaleDetail(tale);
        }
    });

    // ─── People Search ─────────────────────────────────────────────────────────
    async function searchPeople(query) {
        const existingPeopleSection = document.getElementById('people-results');
        if (!query || query.length < 2) { existingPeopleSection?.remove(); return; }
        try {
            const res = await fetch(`${API_BASE}/api/user/search?q=${encodeURIComponent(query)}`);
            if (!res.ok) return;
            const data = await res.json();
            const users = data.users || [];
            existingPeopleSection?.remove();
            if (users.length === 0) return;
            const section = document.createElement('div');
            section.id = 'people-results';
            section.className = 'mb-6';
            section.innerHTML = `
                <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">People</h3>
                <div class="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
                    ${users.map(user => {
                        const avatar = user.profile_picture
                            ? user.profile_picture
                            : `https://placehold.co/40x40/e0e7ff/3730a3?text=${(user.name || 'U').charAt(0).toUpperCase()}`;
                        const meta = [user.branch, user.campus ? `Gitam ${user.campus}` : ''].filter(Boolean).join(' · ');
                        return `
                            <a href="profile.html?id=${user.id}" class="flex items-center gap-3 px-4 py-3 hover:bg-[#FAF9F6] transition first:rounded-t-xl last:rounded-b-xl">
                                <img src="${avatar}" alt="${user.name}" class="w-10 h-10 rounded-full object-cover flex-shrink-0">
                                <div>
                                    <p class="font-semibold text-gray-900 text-sm">${user.name}</p>
                                    ${meta ? `<p class="text-xs text-gray-500">${meta}</p>` : ''}
                                </div>
                                <svg class="w-4 h-4 text-gray-300 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                </svg>
                            </a>
                        `;
                    }).join('')}
                </div>
            `;
            discoverFeed?.insertAdjacentElement('beforebegin', section);
        } catch (err) { console.error('People search error:', err); }
    }

    // ─── Init ──────────────────────────────────────────────────────────────────
    initFilterButtons();

    fetchPublicTales().then(() => {
        const params = new URLSearchParams(window.location.search);
        const openTaleId = params.get('open_tale');
        const openCommentsId = params.get('open_comments');
        if (!openTaleId && !openCommentsId) return;
        const targetId = openTaleId || openCommentsId;
        const tale = allTales.find(t => t.id == targetId);
        if (!tale) return;
        if (openCommentsId) {
            openTaleDetail(tale);
            setTimeout(() => openCommentModal(tale.id, true), 300);
        } else {
            openTaleDetail(tale);
        }
    });
});

