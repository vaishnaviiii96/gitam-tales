(async function () {
    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000'
        : 'https://YOUR_RENDER_URL.onrender.com'; // TODO: Update this to your deployed Render URL

    const token = localStorage.getItem('token');
    if (!token) return;

    async function applyBadge() {
        try {
            const res = await fetch(`${API_BASE}/api/notifications`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) return;

            const notifications = await res.json();
            const unreadCount = notifications.filter(n => !n.is_read).length;
            if (unreadCount === 0) return;

            document.querySelectorAll('#notif-badge').forEach(badge => {
                badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                badge.classList.remove('hidden');
                badge.classList.add('flex');
            });
        } catch (e) {}
    }

    // Run immediately for pages where header is static (dashboard, settings)
    applyBadge();

    // Also run after a short delay for pages where header is rebuilt by JS (discover, profile)
    setTimeout(applyBadge, 1000);
})();

