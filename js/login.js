const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://YOUR_RENDER_URL.onrender.com'; // TODO: Update this to your deployed Render URL

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    // --- Element Selections ---
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitButton = loginForm.querySelector('button[type="submit"]');
    const formMessage = document.getElementById('form-message');

    // --- Forgot Password Modal Elements ---
    const forgotPasswordLink = document.getElementById('forgot-password');
    const forgotPasswordModal = document.getElementById('forgot-password-modal');
    const closeForgotModal = document.getElementById('close-forgot-modal');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const forgotEmailInput = document.getElementById('forgot-email');
    const forgotFormMessage = document.getElementById('forgot-form-message');
    const forgotSuccessMessage = document.getElementById('forgot-success-message');

    // --- Password Visibility Toggle ---
    const eyeIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.432 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`;
    const eyeSlashIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L6.228 6.228" /></svg>`;

    document.querySelectorAll('[data-toggle-password]').forEach(button => {
        button.addEventListener('click', () => {
            const field = document.getElementById(button.getAttribute('data-toggle-password'));
            if (!field) return;
            if (field.type === 'password') {
                field.type = 'text';
                button.innerHTML = eyeSlashIconSVG;
            } else {
                field.type = 'password';
                button.innerHTML = eyeIconSVG;
            }
        });
    });

    // --- Google Login (placeholder - will be wired up when integrated with parent project) ---
    const googleBtn = document.getElementById('google-login-btn');
    googleBtn?.addEventListener('click', () => {
        if (formMessage) {
            formMessage.textContent = 'Google login will be available soon.';
            formMessage.className = 'text-center text-sm text-gray-500';
        }
    });

    // --- Forgot Password Modal ---
    forgotPasswordLink?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!forgotPasswordModal) return;
        forgotPasswordForm?.classList.remove('hidden');
        forgotSuccessMessage?.classList.add('hidden');
        if (forgotFormMessage) forgotFormMessage.textContent = '';
        if (forgotEmailInput) forgotEmailInput.value = '';
        forgotPasswordModal.classList.remove('hidden');
    });

    closeForgotModal?.addEventListener('click', () => forgotPasswordModal?.classList.add('hidden'));
    forgotPasswordModal?.addEventListener('click', (e) => {
        if (e.target === forgotPasswordModal) forgotPasswordModal.classList.add('hidden');
    });

    // Forgot password form submission — calls your backend
    forgotPasswordForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = forgotEmailInput?.value.trim();
        if (!email) {
            if (forgotFormMessage) forgotFormMessage.textContent = 'Please enter your email.';
            return;
        }

        const submitBtn = forgotPasswordForm.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending...'; }
        if (forgotFormMessage) forgotFormMessage.textContent = '';

        try {
            const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            // Always show success to avoid email enumeration
            forgotPasswordForm.classList.add('hidden');
            forgotSuccessMessage?.classList.remove('hidden');

        } catch (err) {
            console.error('Forgot password error:', err);
            // Still show success message for security
            forgotPasswordForm.classList.add('hidden');
            forgotSuccessMessage?.classList.remove('hidden');
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send Reset Link'; }
        }
    });

    // --- Main Login Form Submission ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput?.value.trim();
        const password = passwordInput?.value;

        if (!email || !password) {
            if (formMessage) {
                formMessage.textContent = 'Please fill in all fields.';
                formMessage.className = 'text-center text-sm text-red-500';
            }
            return;
        }

        try {
            if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Logging In...'; }
            if (formMessage) formMessage.textContent = '';

            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                if (formMessage) {
                    formMessage.textContent = data.error || 'Login failed. Please try again.';
                    formMessage.className = 'text-center text-sm text-red-500';
                }
            } else {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                if (formMessage) {
                    formMessage.textContent = 'Login successful! Redirecting...';
                    formMessage.className = 'text-center text-sm text-green-600';
                }

                setTimeout(() => {
    window.location.href = 'discover.html';
}, 1000);
            }

        } catch (err) {
            if (formMessage) {
                formMessage.textContent = 'Could not connect to server. Please try again.';
                formMessage.className = 'text-center text-sm text-red-500';
            }
            console.error('Login error:', err);
        } finally {
            if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Log In'; }
        }
    });
});

