const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://YOUR_RENDER_URL.onrender.com'; // TODO: Update this to your deployed Render URL

document.addEventListener('DOMContentLoaded', async () => {

    // --- SESSION CHECK & REDIRECT ---
    const token = localStorage.getItem('token');
    if (token) {
        // Verify token is still valid
        try {
            const res = await fetch(`${API_BASE}/api/user/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                window.location.href = 'dashboard.html';
                return;
            } else {
                // Token invalid, clear it
                localStorage.clear();
            }
        } catch (e) {
            // Server unreachable, still show homepage
            localStorage.clear();
        }
    }

    // --- Show page (was hidden to prevent flash) ---
    document.body.style.opacity = 1;

    // --- Setup ---
    setupHomepage();
    await loadCounters();
    await loadDiscoverTalesPreview();
    setupModalControls();
});


/**
 * Basic homepage setup (mobile menu, year).
 */
function setupHomepage() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenuNav = document.getElementById('mobile-menu');
    mobileMenuButton?.addEventListener('click', () => mobileMenuNav?.classList.toggle('hidden'));

    const yearSpan = document.getElementById('year');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

    document.querySelectorAll('.counter-number').forEach(el => el.textContent = '0');
}


/**
 * Fetches real counts from backend and animates the counters.
 */
async function loadCounters() {
    try {
        const res = await fetch(`${API_BASE}/api/tales/counts`);
        if (!res.ok) return;
        const data = await res.json();

        const talesCounter = document.getElementById('total-tales-counter');
        const usersCounter = document.getElementById('active-users-counter');

        if (talesCounter) talesCounter.setAttribute('data-target', String(data.total_tales || 0));
        if (usersCounter) usersCounter.setAttribute('data-target', String(data.total_users || 0));

    } catch (err) {
        console.warn('Could not load counters:', err);
    }

    // Animate counters when section is visible
    function animateCounter(element) {
        const target = parseInt(element.getAttribute('data-target')) || 0;
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                element.textContent = target.toLocaleString();
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current).toLocaleString();
            }
        }, 16);
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                document.querySelectorAll('.counter-number').forEach(animateCounter);
                observer.disconnect();
            }
        });
    });

    const heroSection = document.querySelector('section');
    if (heroSection) observer.observe(heroSection);
}


/**
 * Sets up listeners to close the tale detail modal.
 */
function setupModalControls() {
    const taleModal = document.getElementById('tale-detail-modal');
    const closeModalButton = document.getElementById('close-tale-modal');

    closeModalButton?.addEventListener('click', () => taleModal?.classList.add('hidden'));
    taleModal?.addEventListener('click', (event) => {
        if (event.target === taleModal) taleModal.classList.add('hidden');
    });
}


/**
 * Populates and shows the modal with tale details.
 */
function showTaleInModal(tale) {
    const modalBody = document.getElementById('modal-body-content');
    const taleModal = document.getElementById('tale-detail-modal');
    const modalTitle = document.getElementById('modal-title');

    if (!modalBody || !taleModal || !tale) return;

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
        ? `<img src="${API_BASE}/uploads/${tale.cover_image}" alt="Cover" class="w-full rounded-lg my-4 object-cover max-h-80">`
        : '';

    if (modalTitle) modalTitle.textContent = tale.title || 'Tale Details';

    modalBody.innerHTML = `
        <span class="inline-block bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">${tale.category || ''}</span>
        <h2 class="text-2xl font-bold text-gray-900 mb-4">${tale.title || 'Untitled'}</h2>
        <div class="flex items-center space-x-3 mb-4">
            <img src="${authorAvatar}" alt="${authorName}" class="w-10 h-10 rounded-full object-cover">
            <div>
                <p class="font-semibold text-[#292524]">${authorName}</p>
                <p class="text-sm text-gray-500">Posted ${postDate}</p>
            </div>
        </div>
        ${coverImageHTML}
        <div class="prose prose-sm max-w-none text-gray-700 mt-4 break-words">${tale.description || 'No description provided.'}</div>
    `;

    taleModal.classList.remove('hidden');
}


// --- Discover Preview Carousel ---
let allPreviewTales = [];
let currentPreviewPage = 0;
const TALES_PER_PAGE = 4;

/**
 * Loads tales for the homepage carousel preview from our backend.
 */
async function loadDiscoverTalesPreview() {
    const discoverGrid = document.getElementById('discover-grid');
    const prevButton = document.getElementById('prev-tale');
    const nextButton = document.getElementById('next-tale');
    if (!discoverGrid) return;

    try {
        const res = await fetch(`${API_BASE}/api/tales/public?limit=12`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();

        allPreviewTales = data.tales || [];
        displayPreviewPage(0);

        if (allPreviewTales.length > TALES_PER_PAGE && prevButton && nextButton) {
            prevButton.classList.remove('hidden');
            nextButton.classList.remove('hidden');

            // Replace buttons to remove old listeners
            const newPrev = prevButton.cloneNode(true);
            const newNext = nextButton.cloneNode(true);
            prevButton.parentNode?.replaceChild(newPrev, prevButton);
            nextButton.parentNode?.replaceChild(newNext, nextButton);

            newPrev.addEventListener('click', () => {
                currentPreviewPage = Math.max(0, currentPreviewPage - 1);
                displayPreviewPage(currentPreviewPage);
            });
            newNext.addEventListener('click', () => {
                const maxPage = Math.ceil(allPreviewTales.length / TALES_PER_PAGE) - 1;
                currentPreviewPage = Math.min(maxPage, currentPreviewPage + 1);
                displayPreviewPage(currentPreviewPage);
            });
        } else {
            prevButton?.classList.add('hidden');
            nextButton?.classList.add('hidden');
        }

        // Click on card to open modal
        discoverGrid.addEventListener('click', (event) => {
            const card = event.target.closest('.discover-card');
            if (card && card.dataset.taleId) {
                const tale = allPreviewTales.find(t => String(t.id) === card.dataset.taleId);
                if (tale) showTaleInModal(tale);
            }
        });

    } catch (error) {
        console.error('Error fetching preview tales:', error);
        if (discoverGrid) {
            discoverGrid.innerHTML = `<p class="text-center text-gray-500 col-span-full">Could not load journeys.</p>`;
        }
    }
}


/**
 * Displays a specific page of tales in the preview grid.
 */
function displayPreviewPage(pageIndex) {
    const discoverGrid = document.getElementById('discover-grid');
    const prevButton = document.getElementById('prev-tale');
    const nextButton = document.getElementById('next-tale');
    if (!discoverGrid) return;

    const start = pageIndex * TALES_PER_PAGE;
    const talesToShow = allPreviewTales.slice(start, start + TALES_PER_PAGE);

    discoverGrid.innerHTML = '';

    if (talesToShow.length === 0 && pageIndex === 0) {
        discoverGrid.innerHTML = `<p class="text-center text-gray-500 col-span-full">No journeys posted yet.</p>`;
    } else {
        talesToShow.forEach(tale => {
            discoverGrid.insertAdjacentHTML('beforeend', createDiscoverCard(tale));
        });
        // Fill empty slots to keep grid layout
        for (let i = talesToShow.length; i < TALES_PER_PAGE; i++) {
            discoverGrid.insertAdjacentHTML('beforeend', '<div class="hidden lg:block"></div>');
        }
    }

    const maxPage = Math.ceil(allPreviewTales.length / TALES_PER_PAGE) - 1;
    if (prevButton) prevButton.disabled = pageIndex === 0;
    if (nextButton) nextButton.disabled = pageIndex >= maxPage || allPreviewTales.length <= TALES_PER_PAGE;
}


/**
 * Creates HTML for a single tale card on the homepage preview.
 */
function createDiscoverCard(tale) {
    const authorName = tale.author_name || 'A Gitamite';
    const authorBranch = tale.author_branch || 'Gitam Student';
    const authorAvatar = tale.author_avatar
        ? tale.author_avatar
        : `https://placehold.co/40x40/e0e7ff/3730a3?text=${authorName.charAt(0).toUpperCase()}`;
    const coverImage = tale.cover_image
        ? `${API_BASE}/uploads/${tale.cover_image}`
        : `https://placehold.co/600x400/007367/ffffff?text=${encodeURIComponent(tale.category || 'Tale')}`;

    return `
        <div class="bg-white rounded-lg overflow-hidden border border-gray-200 transition-all duration-300 ease-in-out hover:shadow-xl hover:-translate-y-1 cursor-pointer discover-card flex flex-col"
             data-tale-id="${tale.id}">
            <img src="${coverImage}" alt="${tale.title || 'Tale'}" class="w-full h-48 object-cover pointer-events-none">
            <div class="p-6 pointer-events-none flex flex-col flex-grow">
                <p class="text-sm font-semibold text-[#006A60] mb-1">${tale.category || 'Uncategorized'}</p>
                <h3 class="text-lg font-bold text-gray-900 mb-2 truncate" title="${tale.title}">${tale.title || 'Untitled Tale'}</h3>
                <div class="mt-auto flex items-center pt-3 border-t border-gray-100">
                    <img src="${authorAvatar}" alt="${authorName}" class="w-10 h-10 rounded-full mr-3 border-2 border-white shadow-sm flex-shrink-0 object-cover">
                    <div class="min-w-0">
                        <p class="font-semibold text-[#292524] truncate">${authorName}</p>
                        <p class="text-sm text-gray-500">${authorBranch}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

