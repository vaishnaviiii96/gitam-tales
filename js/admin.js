const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://YOUR_RENDER_URL.onrender.com'; // TODO: Update this to your deployed Render URL

const token = localStorage.getItem('token');

// ── Data stores ───────────────────────────────────────────────────────────────
let allUsers    = [];
let allTales    = [];
let allComments = [];

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

    // 1. Must be logged in
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Verify admin status server-side before showing anything
    try {
        const res = await fetch(`${API_BASE}/api/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401) {
            window.location.href = 'login.html';
            return;
        }

        if (res.status === 403) {
            document.getElementById('access-denied').style.display = 'flex';
            return;
        }

        if (!res.ok) throw new Error('Server error');

        const stats = await res.json();
        document.getElementById('stat-users').textContent    = stats.total_users.toLocaleString();
        document.getElementById('stat-tales').textContent    = stats.total_tales.toLocaleString();
        document.getElementById('stat-comments').textContent = stats.total_comments.toLocaleString();

    } catch (err) {
        document.getElementById('access-denied').style.display = 'flex';
        return;
    }

    // 3. Show page
    document.getElementById('admin-content').style.display = 'block';

    // 4. Load all data
    loadUsers();
    loadTales();
    loadComments();

    // 5. Wire up tabs
    document.querySelectorAll('.gt-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // 6. Wire up search inputs
    document.getElementById('user-search').addEventListener('input', filterUsers);
    document.getElementById('user-campus-filter').addEventListener('change', filterUsers);
    document.getElementById('user-branch-filter').addEventListener('input', filterUsers);
    document.getElementById('user-year-filter').addEventListener('input', filterUsers);
    document.getElementById('tale-search').addEventListener('input', filterTales);
    document.getElementById('tale-category-filter').addEventListener('change', filterTales);
    document.getElementById('tale-date-from').addEventListener('change', filterTales);
    document.getElementById('tale-date-to').addEventListener('change', filterTales);
    document.getElementById('comment-search').addEventListener('input', filterComments);
    document.getElementById('comment-date-from').addEventListener('change', filterComments);
    document.getElementById('comment-date-to').addEventListener('change', filterComments);

    // 7. Logout
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = 'index.html';
    });

    // 8. Profile dropdown + populate avatar/name
    // Fetch fresh user data for header
    try {
        const meRes = await fetch(`${API_BASE}/api/user/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (meRes.ok) {
            const meData = await meRes.json();
            const user = meData.user;
            const avatarUrl = user.profile_picture || `https://placehold.co/40x40/004d42/ffffff?text=${(user.name || 'A').charAt(0).toUpperCase()}`;
            document.getElementById('header-avatar').src = avatarUrl;
            const nameEl = document.getElementById('header-name');
            nameEl.textContent = user.name || 'Admin';
            nameEl.style.display = 'inline';
        }
    } catch (e) {}

    document.getElementById('profile-menu-button').addEventListener('click', () => {
        const menu = document.getElementById('profile-menu');
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('profile-menu');
        const btn = document.getElementById('profile-menu-button');
        if (menu && menu.style.display !== 'none' && !btn.contains(e.target) && !menu.contains(e.target)) {
            menu.style.display = 'none';
        }
    });
});

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(name) {
    document.querySelectorAll('.gt-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.gt-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `gt-toast ${type} show`;
    setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
function showConfirm(title, sub, onConfirm) {
    const overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-sub').textContent   = sub;
    overlay.style.display = 'flex';

    const okBtn     = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');

    // Clone to remove old listeners
    const newOk     = okBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newOk.addEventListener('click', () => {
        overlay.style.display = 'none';
        onConfirm();
    });
    newCancel.addEventListener('click', () => {
        overlay.style.display = 'none';
    });
}

// ── Format date ───────────────────────────────────────────────────────────────
function fmt(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Avatar initials ───────────────────────────────────────────────────────────
function avatarHTML(name) {
    const letter = (name || 'U').charAt(0).toUpperCase();
    return `<div style="width:30px;height:30px;border-radius:50%;background:#e8f4f2;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#006A60;flex-shrink:0;">${letter}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────
async function loadUsers() {
    try {
        const res = await fetch(`${API_BASE}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        allUsers = data.users || [];
        renderUsers(allUsers);
    } catch (err) {
        console.error('Load users error:', err);
        showToast('Failed to load users', 'error');
    } finally {
        document.getElementById('users-loading').style.display = 'none';
    }
}

function renderUsers(users) {
    const tbody  = document.getElementById('users-tbody');
    const table  = document.getElementById('users-table');
    const empty  = document.getElementById('users-empty');

    if (users.length === 0) {
        table.style.display = 'none';
        empty.style.display = 'block';
        return;
    }

    table.style.display = 'table';
    empty.style.display = 'none';

    tbody.innerHTML = users.map(u => `
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:10px;">
                    ${avatarHTML(u.name)}
                    <span style="font-weight:600;color:#111827;">${u.name || '—'}</span>
                </div>
            </td>
            <td style="color:#6b7280;">${u.email}</td>
            <td>${u.branch || '—'}</td>
            <td>${u.campus || '—'}</td>
            <td style="font-weight:600;">${u.tale_count}</td>
            <td style="font-weight:600;">${u.comment_count}</td>
            <td><span class="gt-badge ${u.is_admin ? 'admin' : 'user'}">${u.is_admin ? 'Admin' : 'User'}</span></td>
            <td style="color:#9ca3af;">${fmt(u.created_at)}</td>
            <td>
                ${u.is_admin ? `<span style="font-size:12px;color:#9ca3af;">Protected</span>` : `
                    <button class="gt-delete-btn" onclick="deleteUser('${u.id}', '${(u.name || '').replace(/'/g, "\\'")}')">
                        Delete
                    </button>
                `}
            </td>
        </tr>
    `).join('');
}

function filterUsers() {
    const term   = document.getElementById('user-search').value.toLowerCase().trim();
    const campus = document.getElementById('user-campus-filter').value;
    const branch = document.getElementById('user-branch-filter').value.toLowerCase().trim();
    const year   = document.getElementById('user-year-filter').value.trim();

    renderUsers(allUsers.filter(u => {
        const matchesSearch = !term || u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term);
        const matchesCampus = !campus || u.campus === campus;
        const matchesBranch = !branch || u.branch?.toLowerCase().includes(branch);
        const matchesYear   = !year || u.year?.toString().includes(year);
        return matchesSearch && matchesCampus && matchesBranch && matchesYear;
    }));
}

function deleteUser(id, name) {
    showConfirm(
        `Delete "${name}"?`,
        'This will permanently delete their account, all their tales, comments, and likes. This cannot be undone.',
        async () => {
            try {
                const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!res.ok) { showToast(data.error || 'Delete failed', 'error'); return; }

                allUsers = allUsers.filter(u => u.id.toString() !== id.toString());
                // Also remove their tales and comments from local stores
                const taleIds = allTales.filter(t => t.author_email === allUsers.find(u=>u.id===id)?.email).map(t=>t.id);
                allTales    = allTales.filter(t => !taleIds.includes(t.id));
                allComments = allComments.filter(c => c.author_email !== allUsers.find(u=>u.id===id)?.email);

                renderUsers(allUsers);
                renderTales(allTales);
                renderComments(allComments);

                // Update stats
                const su = document.getElementById('stat-users');
                su.textContent = (parseInt(su.textContent.replace(/,/g,'')) - 1).toLocaleString();

                showToast(`"${name}" deleted successfully`);
            } catch (err) {
                showToast('Something went wrong', 'error');
            }
        }
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TALES
// ─────────────────────────────────────────────────────────────────────────────
async function loadTales() {
    try {
        const res = await fetch(`${API_BASE}/api/admin/tales`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        allTales = data.tales || [];
        renderTales(allTales);
    } catch (err) {
        console.error('Load tales error:', err);
        showToast('Failed to load tales', 'error');
    } finally {
        document.getElementById('tales-loading').style.display = 'none';
    }
}

function renderTales(tales) {
    const tbody = document.getElementById('tales-tbody');
    const table = document.getElementById('tales-table');
    const empty = document.getElementById('tales-empty');

    if (tales.length === 0) {
        table.style.display = 'none';
        empty.style.display = 'block';
        return;
    }

    table.style.display = 'table';
    empty.style.display = 'none';

    tbody.innerHTML = tales.map(t => `
        <tr>
            <td>
                <div class="gt-truncate" title="${t.title}" style="font-weight:600;color:#111827;max-width:240px;">${t.title}</div>
            </td>
            <td><span class="gt-badge category">${t.category}</span></td>
            <td>
                <div style="display:flex;align-items:center;gap:8px;">
                    ${avatarHTML(t.author_name)}
                    <div>
                        <div style="font-weight:600;font-size:12px;color:#111827;">${t.author_name}</div>
                        <div style="font-size:11px;color:#9ca3af;">${t.author_email}</div>
                    </div>
                </div>
            </td>
            <td style="font-weight:600;">
                <span style="display:flex;align-items:center;gap:4px;">
                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24" style="color:#ef4444;"><path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/></svg>
                    ${t.like_count}
                </span>
            </td>
            <td style="font-weight:600;">${t.comment_count}</td>
            <td style="color:#9ca3af;">${fmt(t.created_at)}</td>
            <td>
                <button class="gt-delete-btn" onclick="deleteTale(${t.id}, '${(t.title || '').replace(/'/g, "\\'")}')">
                    Delete
                </button>
            </td>
        </tr>
    `).join('');
}

function filterTales() {
    const term     = document.getElementById('tale-search').value.toLowerCase().trim();
    const category = document.getElementById('tale-category-filter').value;
    const dateFrom = document.getElementById('tale-date-from').value;
    const dateTo   = document.getElementById('tale-date-to').value;

    renderTales(allTales.filter(t => {
        const matchesSearch   = !term || t.title?.toLowerCase().includes(term) || t.author_name?.toLowerCase().includes(term) || t.author_email?.toLowerCase().includes(term);
        const matchesCategory = !category || t.category === category;
        const postedDate      = new Date(t.created_at);
        const matchesFrom     = !dateFrom || postedDate >= new Date(dateFrom);
        const matchesTo       = !dateTo || postedDate <= new Date(dateTo + 'T23:59:59');
        return matchesSearch && matchesCategory && matchesFrom && matchesTo;
    }));
}

function deleteTale(id, title) {
    showConfirm(
        `Delete tale?`,
        `"${title}" will be permanently deleted along with all its comments and likes.`,
        async () => {
            try {
                const res = await fetch(`${API_BASE}/api/admin/tales/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!res.ok) { showToast(data.error || 'Delete failed', 'error'); return; }

                allTales    = allTales.filter(t => t.id !== id);
                allComments = allComments.filter(c => c.tale_id !== id);

                renderTales(allTales);
                renderComments(allComments);

                const st = document.getElementById('stat-tales');
                st.textContent = (parseInt(st.textContent.replace(/,/g,'')) - 1).toLocaleString();

                showToast('Tale deleted successfully');
            } catch (err) {
                showToast('Something went wrong', 'error');
            }
        }
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMENTS
// ─────────────────────────────────────────────────────────────────────────────
async function loadComments() {
    try {
        const res = await fetch(`${API_BASE}/api/admin/comments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        allComments = data.comments || [];
        renderComments(allComments);
    } catch (err) {
        console.error('Load comments error:', err);
        showToast('Failed to load comments', 'error');
    } finally {
        document.getElementById('comments-loading').style.display = 'none';
    }
}

function renderComments(comments) {
    const tbody = document.getElementById('comments-tbody');
    const table = document.getElementById('comments-table');
    const empty = document.getElementById('comments-empty');

    if (comments.length === 0) {
        table.style.display = 'none';
        empty.style.display = 'block';
        return;
    }

    table.style.display = 'table';
    empty.style.display = 'none';

    tbody.innerHTML = comments.map(c => `
        <tr>
            <td>
                <div class="gt-truncate" title="${c.content}" style="max-width:280px;color:#374151;">${c.content}</div>
            </td>
            <td>
                <div style="display:flex;align-items:center;gap:8px;">
                    ${avatarHTML(c.author_name)}
                    <div>
                        <div style="font-weight:600;font-size:12px;color:#111827;">${c.author_name}</div>
                        <div style="font-size:11px;color:#9ca3af;">${c.author_email}</div>
                    </div>
                </div>
            </td>
            <td>
                <div class="gt-truncate" style="max-width:180px;font-size:12px;color:#6b7280;" title="${c.tale_title}">${c.tale_title}</div>
            </td>
            <td style="color:#9ca3af;">${fmt(c.created_at)}</td>
            <td>
                <button class="gt-delete-btn" onclick="deleteComment(${c.id}, '${(c.author_name || '').replace(/'/g, "\\'")}')">
                    Delete
                </button>
            </td>
        </tr>
    `).join('');
}

function filterComments() {
    const term     = document.getElementById('comment-search').value.toLowerCase().trim();
    const dateFrom = document.getElementById('comment-date-from').value;
    const dateTo   = document.getElementById('comment-date-to').value;

    renderComments(allComments.filter(c => {
        const matchesSearch = !term || c.content?.toLowerCase().includes(term) || c.author_name?.toLowerCase().includes(term) || c.author_email?.toLowerCase().includes(term) || c.tale_title?.toLowerCase().includes(term);
        const postedDate    = new Date(c.created_at);
        const matchesFrom   = !dateFrom || postedDate >= new Date(dateFrom);
        const matchesTo     = !dateTo || postedDate <= new Date(dateTo + 'T23:59:59');
        return matchesSearch && matchesFrom && matchesTo;
    }));
}

function deleteComment(id, authorName) {
    showConfirm(
        `Delete comment?`,
        `This comment by "${authorName}" will be permanently deleted.`,
        async () => {
            try {
                // Find tale_id for this comment
                const comment = allComments.find(c => c.id === id);
                const res = await fetch(`${API_BASE}/api/admin/comments/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!res.ok) { showToast(data.error || 'Delete failed', 'error'); return; }

                allComments = allComments.filter(c => c.id !== id);
                renderComments(allComments);

                const sc = document.getElementById('stat-comments');
                sc.textContent = (parseInt(sc.textContent.replace(/,/g,'')) - 1).toLocaleString();

                showToast('Comment deleted successfully');
            } catch (err) {
                showToast('Something went wrong', 'error');
            }
        }
    );
}

