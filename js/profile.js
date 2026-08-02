const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://gitam-tales.onrender.com'; // TODO: Update this to your deployed Render URL

document.addEventListener('DOMContentLoaded', async () => {

    const params = new URLSearchParams(window.location.search);
    const userId = params.get('id');

    const profileCard = document.getElementById('profile-card');
    const profileFeed = document.getElementById('profile-feed');
    const notFound = document.getElementById('not-found');

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
            } else {
                localStorage.clear();
            }
        } catch (e) {}
    }

    updateHeader(currentUser);

    if (currentUser && userId === currentUser.id.toString()) {
        window.location.href = 'dashboard.html';
        return;
    }

    if (!userId) {
        window.location.href = 'discover.html';
        return;
    }

    // ─── Inject Comment Modal ──────────────────────────────────────────────────
    document.body.insertAdjacentHTML('beforeend', `
        <div id="comment-modal" class="fixed inset-0 z-50 hidden flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-black bg-opacity-50" id="comment-modal-backdrop"></div>
            <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style="max-height: 85vh;">
                <div class="flex justify-between items-center p-5 border-b border-gray-100 flex-shrink-0">
                    <h3 class="text-lg font-bold text-gray-900">Comments</h3>
                    <button id="close-comment-modal" class="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    `);

    // ─── Comment Modal Logic ───────────────────────────────────────────────────
    let activeTaleId = null;

    function openCommentModal(taleId) {
        activeTaleId = taleId;
        document.getElementById('comment-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        loadComments(taleId);
    }

    function closeCommentModal() {
        document.getElementById('comment-modal').classList.add('hidden');
        document.body.style.overflow = '';
        activeTaleId = null;
        const input = document.getElementById('comment-input');
        if (input) input.value = '';
        const err = document.getElementById('comment-error');
        if (err) { err.textContent = ''; err.classList.add('hidden'); }
    }

    document.getElementById('close-comment-modal').addEventListener('click', closeCommentModal);
    document.getElementById('comment-modal-backdrop').addEventListener('click', closeCommentModal);

   async function loadComments(taleId) {
        const list = document.getElementById('comments-list');
        list.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">Loading comments...</p>';

        try {
            const res = await fetch(`${API_BASE}/api/tales/${taleId}/comments`);
            const comments = await res.json();

            const countBtn = document.querySelector(`.comment-btn[data-tale-id="${taleId}"]`);
            if (countBtn) {
                const countEl = countBtn.querySelector('.comment-count');
                if (countEl) countEl.textContent = comments.filter(c => !c.parent_id).length;
            }

            if (comments.length === 0) {
                list.innerHTML = '<p class="text-center text-gray-400 text-sm py-6">No comments yet. Be the first!</p>';
                return;
            }

            // Build threaded tree
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
                                    <span class="font-semibold text-sm text-gray-900 inline-flex items-center gap-1">
                                        ${comment.name}
                                        ${comment.is_admin ? `<svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#006A60"/><path d="M6.5 12.5l3.5 3.5 7-7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
                                    </span>
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

            // Reply toggle
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

    // ─── Post / Delete Comment ─────────────────────────────────────────────────
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
                if (!res.ok) {
                    errorEl.textContent = data.error || 'Could not post comment.';
                    errorEl.classList.remove('hidden');
                    return;
                }
                input.value = '';
                await loadComments(activeTaleId);
                updateCommentCount(activeTaleId, 1);
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
            if (!confirm('Delete this comment?')) return;
            try {
                const res = await fetch(`${API_BASE}/api/tales/${taleId}/comments/${commentId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    document.getElementById(`comment-${commentId}`)?.remove();
                    updateCommentCount(taleId, -1);
                    const list = document.getElementById('comments-list');
                    if (list.children.length === 0) {
                        list.innerHTML = '<p class="text-center text-gray-400 text-sm py-6">No comments yet. Be the first!</p>';
                    }
                }
            } catch (err) { console.error('Delete comment failed:', err); }
        }
    });

    function updateCommentCount(taleId, delta) {
        const btn = document.querySelector(`.comment-btn[data-tale-id="${taleId}"]`);
        if (!btn) return;
        const countEl = btn.querySelector('.comment-count');
        if (!countEl) return;
        countEl.textContent = Math.max(0, (parseInt(countEl.textContent) || 0) + delta);
    }

    // ─── Fetch Public Profile ──────────────────────────────────────────────────
    try {
        const res = await fetch(`${API_BASE}/api/user/profile/${userId}`);

        if (!res.ok) {
            profileCard.classList.add('hidden');
            profileFeed.classList.add('hidden');
            notFound.classList.remove('hidden');
            return;
        }

        const data = await res.json();
        const user = data.user;
        const tales = data.tales || [];

        document.title = `${user.name || 'Profile'} - GitamTales`;

        const avatarUrl = user.profile_picture
            ? user.profile_picture
            : `https://placehold.co/100x100/e0e7ff/3730a3?text=${(user.name || 'U').charAt(0).toUpperCase()}`;

        const campusText = user.campus ? `Gitam ${user.campus}` : '';
        const branchText = user.branch
            ? (campusText ? `${user.branch} · ${campusText}` : user.branch)
            : campusText || '';

        const linkedinHTML = user.linkedin_url
            ? `<a href="${user.linkedin_url}" target="_blank" title="LinkedIn" class="text-blue-500 hover:text-blue-700 transition-colors">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
               </a>` : '';

        const githubHTML = user.github_url
            ? `<a href="${user.github_url}" target="_blank" title="GitHub" class="text-gray-600 hover:text-gray-900 transition-colors">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
               </a>` : '';

        const socialHTML = (linkedinHTML || githubHTML)
            ? `<div class="flex gap-3 mt-3">${linkedinHTML}${githubHTML}</div>` : '';

        const joinDate = new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const skillsHTML = user.skills && user.skills.trim()
            ? `<div class="mt-4">
                <p class="text-[11px] font-bold text-[#6b7280] uppercase tracking-widest mb-2">Skills</p>
                <div class="flex flex-wrap gap-2">
                    ${user.skills.split(',').map(s => s.trim()).filter(Boolean).map(s =>
                        `<span class="bg-[#f0faf8] text-[#006A60] border border-[#c7e8e3] px-3 py-1 rounded-full text-xs font-medium">${s}</span>`
                    ).join('')}
                </div>
               </div>` : '';

        profileCard.classList.remove('animate-pulse');
        profileCard.innerHTML = `
            <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <img src="${avatarUrl}" alt="${user.name}" class="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg flex-shrink-0">
                <div class="flex-grow text-center sm:text-left">
                    <h1 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        ${user.name || 'Gitamite'}
                        ${user.is_admin ? `<svg class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#006A60"/><path d="M6.5 12.5l3.5 3.5 7-7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
                    </h1>
                    ${branchText ? `<p class="text-gray-500 text-sm mt-1">${branchText}</p>` : ''}
                    ${user.bio ? `<p class="text-gray-600 mt-3 text-sm leading-relaxed">${user.bio}</p>` : ''}
                    ${skillsHTML}
                    ${socialHTML}
                    <div class="flex flex-wrap justify-center sm:justify-start gap-4 mt-4 pt-4 border-t border-[#e5ebe9] text-sm text-gray-500">
                        <span class="flex items-center gap-1.5">
                            <svg class="w-4 h-4 text-[#006A60]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                            </svg>
                            <strong class="text-[#292524]">${tales.length}</strong> ${tales.length === 1 ? 'Tale' : 'Tales'}
                        </span>
                    </div>
                </div>
            </div>
        `;

        // ─── Render Tales ──────────────────────────────────────────────────────
        profileFeed.innerHTML = '';

        if (tales.length === 0) {
            profileFeed.innerHTML = `
                <div class="text-center py-16 bg-white rounded-xl border border-[#d5e0dd]">
                    <div class="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg class="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                        </svg>
                    </div>
                    <p class="font-medium text-gray-500">No tales yet.</p>
                </div>`;
            return;
        }

        tales.forEach(tale => {
            profileFeed.insertAdjacentHTML('beforeend', createTaleCard(tale, user, avatarUrl));
        });

        // ─── Feed click handler ────────────────────────────────────────────────
        profileFeed.addEventListener('click', async (e) => {

            const commentBtn = e.target.closest('.comment-btn');
            if (commentBtn) {
                if (!token) { window.location.href = 'login.html'; return; }
                openCommentModal(commentBtn.dataset.taleId);
                return;
            }

            const likeBtn = e.target.closest('.like-btn');
            if (!likeBtn) return;
            if (!token) { window.location.href = 'login.html'; return; }

            const taleId = likeBtn.dataset.taleId;
            const isLiked = likeBtn.dataset.liked === 'true';
            const newLiked = !isLiked;
            const newCount = parseInt(likeBtn.dataset.count) + (newLiked ? 1 : -1);

            likeBtn.dataset.liked = newLiked;
            likeBtn.dataset.count = newCount;
            likeBtn.querySelector('.like-count').textContent = newCount;
            likeBtn.querySelector('svg').setAttribute('fill', newLiked ? 'currentColor' : 'none');
            likeBtn.className = `like-btn flex items-center gap-1.5 text-sm transition-colors duration-200 ${newLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`;

            try {
                const res = await fetch(`${API_BASE}/api/tales/${taleId}/like`, {
                    method: isLiked ? 'DELETE' : 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed');
                const data = await res.json();
                likeBtn.dataset.count = data.like_count;
                likeBtn.querySelector('.like-count').textContent = data.like_count;
            } catch (err) {
                likeBtn.dataset.liked = isLiked;
                likeBtn.dataset.count = parseInt(likeBtn.dataset.count) + (newLiked ? -1 : 1);
                likeBtn.querySelector('.like-count').textContent = likeBtn.dataset.count;
                likeBtn.querySelector('svg').setAttribute('fill', isLiked ? 'currentColor' : 'none');
                likeBtn.className = `like-btn flex items-center gap-1.5 text-sm transition-colors duration-200 ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`;
            }
        });

    } catch (err) {
        console.error('Error loading profile:', err);
        profileCard.classList.add('hidden');
        profileFeed.classList.add('hidden');
        notFound.classList.remove('hidden');
    }

    // ─── Create Tale Card ──────────────────────────────────────────────────────
    function createTaleCard(tale, user, avatarUrl) {
        let postDate = new Date(tale.created_at).toLocaleDateString();
        try {
            if (typeof dateFns !== 'undefined') {
                postDate = dateFns.formatDistanceToNow(new Date(tale.created_at), { addSuffix: true });
            }
        } catch (e) {}

        const isAdmin = user.is_admin === true;
        const today = new Date(); today.setHours(0,0,0,0);
        const eventDate = tale.event_date ? new Date(tale.event_date) : null;
        const isUpcoming = isAdmin && eventDate && eventDate > today;
        const verifiedBadge = isAdmin ? `<svg class="w-4 h-4 flex-shrink-0 inline ml-1" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#006A60"/><path d="M6.5 12.5l3.5 3.5 7-7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : '';
        const upcomingBadge = isUpcoming ? `<span class="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Upcoming</span>` : '';

        const coverImgUrl = tale.cover_image ? (tale.cover_image.startsWith('http') ? tale.cover_image : `${API_BASE}/uploads/${tale.cover_image}`) : null;
        const coverImageHTML = coverImgUrl
            ? `<img src="${coverImgUrl}" alt="Cover" class="w-full h-auto max-h-96 object-cover rounded-lg my-4 border border-[#e5ebe9]">`
            : '';

        const tagsHTML = tale.tags
            ? tale.tags.split(',').map(tag => `<span class="bg-[#f4f6f5] text-gray-600 px-3 py-1 rounded-full text-xs">#${tag.trim()}</span>`).join('')
            : '';

        // ── FIX: check both possible field names the API might return ──
        const commentCount = tale.comment_count ?? tale.comments_count ?? 0;

        return `
            <div class="tale-card-profile">
                <div class="p-5">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex items-center gap-3 min-w-0">
                            <img src="${avatarUrl}" alt="${user.name}" class="w-10 h-10 rounded-full object-cover flex-shrink-0 shadow-sm">
                           <div class="min-w-0">
                                <h4 class="font-bold text-gray-900 truncate flex items-center">${user.name || 'Gitamite'}${verifiedBadge}</h4>
                                <p class="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
                                    Posted in <span class="font-semibold text-[#006A60]">${tale.category}</span> · ${postDate}
                                    ${upcomingBadge}
                                </p>
                            </div>
                        </div>
                        <span class="gt-category-pill flex-shrink-0 ml-3">${tale.category}</span>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900 mb-2">${tale.title}</h3>
                    ${coverImageHTML}
                    <div class="prose prose-sm max-w-none text-gray-600 break-words line-clamp-3 text-sm">${tale.description || ''}</div>
                    ${tagsHTML ? `<div class="flex flex-wrap gap-2 mt-4">${tagsHTML}</div>` : ''}
                </div>
                <div class="tale-card-footer">
                    <button class="like-btn flex items-center gap-1.5 text-sm transition-colors duration-200 ${tale.user_has_liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}"
                        data-tale-id="${tale.id}" data-liked="${tale.user_has_liked ? 'true' : 'false'}" data-count="${tale.like_count || 0}"
                        ${!token ? 'title="Log in to like"' : ''}>
                        <svg class="w-4 h-4" fill="${tale.user_has_liked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                        </svg>
                        <span class="like-count">${tale.like_count || 0}</span>
                    </button>
                    <button class="comment-btn flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#006A60] transition-colors duration-200"
                        data-tale-id="${tale.id}" ${!token ? 'title="Log in to comment"' : ''}>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                        </svg>
                        <span class="comment-count">${commentCount}</span>
                    </button>
                </div>
            </div>
        `;
    }

    // ─── Update Header ─────────────────────────────────────────────────────────
    function updateHeader(user) {
        const authStatusDiv = document.getElementById('auth-status');
        if (!authStatusDiv) return;

        if (user) {
            const avatarUrl = user.profile_picture
                ? user.profile_picture
                : `https://placehold.co/40x40/e0e7ff/3730a3?text=${(user.name || 'U').charAt(0).toUpperCase()}`;

            authStatusDiv.innerHTML = `
                <div class="hidden md:flex gap-6">
                    <a href="discover.html" class="text-sm text-white/80 hover:text-white transition-colors">Discover</a>
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
                    <div id="profile-menu" class="hidden absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl py-2 z-20 border border-gray-100">
                        <a href="settings.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-[#FAF9F6]">Settings</a>
                        <hr class="my-2 border-gray-100">
                        <a href="#" id="logout-button" class="block px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium">Log Out</a>
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

        } else {
            authStatusDiv.innerHTML = `
                <div class="hidden md:flex gap-6">
                    <a href="discover.html" class="text-sm text-white/80 hover:text-white transition-colors">Discover</a>
                </div>
                <a href="login.html" class="border border-white/40 text-white text-sm px-4 py-1.5 rounded-md font-medium hover:bg-white/10 transition-colors">Log in</a>
                <a href="signup.html" class="bg-white text-[#006A60] text-sm px-4 py-1.5 rounded-md font-bold hover:bg-white/90 transition-colors shadow-sm">Sign up</a>
            `;
        }
    }
});


