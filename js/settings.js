const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://YOUR_RENDER_URL.onrender.com'; // TODO: Update this to your deployed Render URL

document.addEventListener('DOMContentLoaded', async () => {

    const token = localStorage.getItem('token');
    if (!token) { window.location.href = 'login.html'; return; }

    // ── Load user ─────────────────────────────────────────────────────────────
    let currentUser = null;
    try {
        const res = await fetch(`${API_BASE}/api/user/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) { localStorage.clear(); window.location.href = 'login.html'; return; }
        const data = await res.json();
        currentUser = data.user;
        localStorage.setItem('user', JSON.stringify(currentUser));
    } catch (err) {
        console.error('Error loading user:', err);
        return;
    }

    // ── Update header ─────────────────────────────────────────────────────────
    const headerName   = document.getElementById('header-name');
    const headerAvatar = document.getElementById('header-avatar');
    if (headerName) headerName.textContent = currentUser.name || 'User';
    if (headerAvatar && currentUser.profile_picture) headerAvatar.src = currentUser.profile_picture;
    // Dropdown
    if (currentUser.is_admin && !document.getElementById('admin-header-badge')) {
        const logoLink = document.querySelector('header a[href="discover.html"].text-xl');
        if (logoLink) logoLink.insertAdjacentHTML('afterend', '<span id="admin-header-badge" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:5px;letter-spacing:0.06em;text-transform:uppercase;">Admin</span>');
    }

    const adminNavLink = document.getElementById('admin-nav-link');
    if (adminNavLink && currentUser.is_admin) {
        adminNavLink.classList.remove('hidden');
        adminNavLink.classList.add('flex');
    }
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

    // ── Route to correct form ─────────────────────────────────────────────────
    const subtitle = document.getElementById('settings-subtitle');
    if (currentUser.is_admin) {
        subtitle.textContent = 'Manage your admin account settings.';
        document.getElementById('admin-settings-form').classList.remove('hidden');
        initAdminForm(currentUser);
    } else {
        subtitle.textContent = 'This information will be displayed publicly on your profile.';
        document.getElementById('settings-form').classList.remove('hidden');
        initUserForm(currentUser);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN FORM
    // ─────────────────────────────────────────────────────────────────────────
    function initAdminForm(user) {
        const form            = document.getElementById('admin-settings-form');
        const nameInput       = document.getElementById('admin-name');
        const formMessage     = document.getElementById('admin-form-message');
        const avatarPreview   = document.getElementById('admin-avatar-preview');
        const changePicBtn    = document.getElementById('admin-change-picture-btn');
        const avatarInput     = document.getElementById('admin-avatar-input');

        // Populate
        document.getElementById('admin-name').value   = user.name || '';
document.getElementById('admin-campus').value = user.campus || '';
document.getElementById('admin-bio').value    = user.bio || '';
        if (user.profile_picture) avatarPreview.src = user.profile_picture;

        // Profile picture
        changePicBtn?.addEventListener('click', () => avatarInput?.click());
        avatarInput?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
            if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB.'); return; }

            const reader = new FileReader();
            reader.onload = async (ev) => {
                const base64 = ev.target.result;
                avatarPreview.src = base64;
                try {
                    const res = await fetch(`${API_BASE}/api/user/profile-picture`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ profile_picture: base64 })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        localStorage.setItem('user', JSON.stringify(data.user));
                        showMsg(formMessage, 'Profile picture updated!', 'success');
                    } else {
                        showMsg(formMessage, data.error || 'Could not update picture.', 'error');
                    }
                } catch { showMsg(formMessage, 'Upload failed.', 'error'); }
            };
            reader.readAsDataURL(file);
        });

        // Save
        // Save
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();

            if (!name) { showMsg(formMessage, 'Name is required.', 'error'); return; }

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
            formMessage.textContent = '';

        
        
            try {
                // 1. Save name via existing profile endpoint
                const profileRes = await fetch(`${API_BASE}/api/user/profile`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
    name,
    campus: document.getElementById('admin-campus').value || '',
    bio:    document.getElementById('admin-bio').value.trim() || ''
})
                });
                const profileData = await profileRes.json();
                if (!profileRes.ok) { showMsg(formMessage, profileData.error || 'Failed to update name.', 'error'); return; }
                localStorage.setItem('user', JSON.stringify(profileData.user));
                if (headerName) headerName.textContent = name;

                

                showMsg(formMessage, 'Settings saved successfully!', 'success');
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
            } catch { showMsg(formMessage, 'Something went wrong. Try again.', 'error'); }
            finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Changes';
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // USER FORM (unchanged logic, just moved here)
    // ─────────────────────────────────────────────────────────────────────────
    function initUserForm(user) {
        const form          = document.getElementById('settings-form');
        const nameInput     = document.getElementById('full-name');
        const branchInput   = document.getElementById('branch');
        const yearInput     = document.getElementById('year');
        const bioInput      = document.getElementById('bio');
        const linkedinInput = document.getElementById('linkedin-url');
        const githubInput   = document.getElementById('github-url');
        const campusSelect  = document.getElementById('campus');
        const formMessage   = document.getElementById('form-message');
        const skillsContainer = document.getElementById('skills-container');
        const skillsInput   = document.getElementById('skills-input');
        const skillsHidden  = document.getElementById('skills-hidden');
        const avatarPreview = document.getElementById('avatar-preview');
        const changePicBtn  = document.getElementById('change-picture-button');
        const avatarUpload  = document.getElementById('avatar-upload-input');
        let skillsArray = [];

        // Populate
        if (nameInput)     nameInput.value     = user.name || '';
        if (branchInput)   branchInput.value   = user.branch || '';
        if (yearInput)     yearInput.value      = user.year || '';
        if (bioInput)      bioInput.value       = user.bio || '';
        if (linkedinInput) linkedinInput.value  = user.linkedin_url || '';
        if (githubInput)   githubInput.value    = user.github_url || '';
        if (campusSelect)  campusSelect.value   = user.campus || '';
        if (avatarPreview && user.profile_picture) avatarPreview.src = user.profile_picture;

        if (user.skills && user.skills.trim()) {
            skillsArray = user.skills.split(',').map(s => s.trim()).filter(Boolean);
            renderSkills();
        }

        // Profile picture
        changePicBtn?.addEventListener('click', () => avatarUpload?.click());
        avatarUpload?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) { alert('Please select an image file (PNG, JPG, or GIF).'); return; }
            if (file.size > 5 * 1024 * 1024) { alert('Image size must be less than 5MB.'); return; }
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const base64 = ev.target.result;
                if (avatarPreview) avatarPreview.src = base64;
                try {
                    const res = await fetch(`${API_BASE}/api/user/profile-picture`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ profile_picture: base64 })
                    });
                    const data = await res.json();
                    if (res.ok) { localStorage.setItem('user', JSON.stringify(data.user)); alert('Profile picture updated!'); }
                    else { alert(`Error: ${data.error || 'Could not update picture.'}`); }
                } catch { alert('Failed to upload profile picture.'); }
            };
            reader.readAsDataURL(file);
        });

        // Save
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = nameInput?.value.trim() || '';
            const branch = branchInput?.value.trim() || '';
            const year = yearInput?.value || '';
            const campus = campusSelect?.value || '';

            if (!name) { showMsg(formMessage, 'Name is required.', 'error'); return; }
            if (!branch) { showMsg(formMessage, 'Branch is required.', 'error'); return; }
            if (!year) { showMsg(formMessage, 'Graduation year is required.', 'error'); return; }
            if (!campus) { showMsg(formMessage, 'Campus is required.', 'error'); return; }

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
            formMessage.textContent = '';

            try {
                const res = await fetch(`${API_BASE}/api/user/profile`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        name,
                        branch:       branchInput?.value.trim() || '',
                        year:         yearInput?.value || '',
                        bio:          bioInput?.value.trim() || '',
                        campus:       campusSelect?.value || '',
                        linkedin_url: linkedinInput?.value.trim() || '',
                        github_url:   githubInput?.value.trim() || '',
                        skills:       skillsHidden?.value || ''
                    })
                });
                const data = await res.json();
                if (res.ok) {
                    localStorage.setItem('user', JSON.stringify(data.user));
                    showMsg(formMessage, 'Profile updated successfully!', 'success');
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
                } else {
                    showMsg(formMessage, data.error || 'Failed to update profile.', 'error');
                }
            } catch { showMsg(formMessage, 'Something went wrong. Please try again.', 'error'); }
            finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Changes';
            }
        });

        // Skills tag input
        function renderSkills() {
            if (!skillsContainer || !skillsInput) return;
            skillsContainer.querySelectorAll('.skill-chip').forEach(c => c.remove());
            skillsArray.forEach((skill, index) => {
                const chip = document.createElement('span');
                chip.className = 'skill-chip flex items-center gap-1 bg-[#f0faf8] text-[#006A60] border border-[#c7e8e3] px-3 py-1 rounded-full text-xs font-medium';
                chip.innerHTML = `${skill} <button type="button" data-index="${index}" class="ml-1 text-[#006A60]/60 hover:text-red-500 font-bold leading-none">&times;</button>`;
                skillsContainer.insertBefore(chip, skillsInput);
            });
            if (skillsHidden) skillsHidden.value = skillsArray.join(', ');
        }

        function addSkill(value) {
            const trimmed = value.trim().replace(/,+$/, '');
            if (trimmed && !skillsArray.includes(trimmed)) { skillsArray.push(trimmed); renderSkills(); }
            if (skillsInput) skillsInput.value = '';
        }

        skillsInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill(skillsInput.value); }
            if (e.key === 'Backspace' && skillsInput.value === '' && skillsArray.length > 0) { skillsArray.pop(); renderSkills(); }
        });
        skillsInput?.addEventListener('blur', () => { if (skillsInput.value.trim()) addSkill(skillsInput.value); });
        skillsContainer?.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && e.target.dataset.index !== undefined) {
                skillsArray.splice(parseInt(e.target.dataset.index), 1);
                renderSkills();
            }
            skillsInput?.focus();
        });
    }

    // ── Shared helper ─────────────────────────────────────────────────────────
    function showMsg(el, msg, type) {
        if (!el) return;
        el.textContent = msg;
        el.className = `text-sm font-medium ${type === 'success' ? 'text-green-600' : 'text-red-500'}`;
    }
});

