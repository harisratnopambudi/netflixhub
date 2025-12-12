/**
 * Netflix Access Hub - Frontend Script
 */

// ============================================
// KONFIGURASI
// ============================================
const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycby_HdfwsgMzwLEPQ4Cb59ueHGSfBMEbn2V7EAcYUJsBs6lHzemZ3k7ANOZ6Y0iM8TxZ/exec',
    REFRESH_INTERVAL: 30000, // 30 detik
};

// ============================================
// State
// ============================================
let allData = { otpCodes: [], householdLinks: [] };

// ============================================
// DOM Elements
// ============================================
const elements = {
    cardsContainer: document.getElementById('cards-container'),
    emptyState: document.getElementById('empty-state'),
    modeText: document.getElementById('mode-text'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message'),
};

// ============================================
// Main Functions
// ============================================

/**
 * Fetch data dari Google Apps Script
 */
async function fetchData() {
    try {
        showLoading();

        const response = await fetch(CONFIG.API_URL);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Gagal memuat data');
        }

        allData = result.data;
        renderCards(allData);
        elements.modeText.textContent = 'Online';

    } catch (error) {
        console.error('Fetch error:', error);
        elements.modeText.textContent = 'Error';
        showToast('Gagal memuat data. Cek console untuk detail.', true);
        showEmpty();
    }
}

/**
 * Show loading state
 */
function showLoading() {
    elements.cardsContainer.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Memuat data dari Gmail...</p>
        </div>
    `;
    elements.emptyState.style.display = 'none';
}

/**
 * Show empty state
 */
function showEmpty() {
    elements.cardsContainer.innerHTML = '';
    elements.emptyState.style.display = 'block';
}

/**
 * Render cards based on data
 */
function renderCards(data, searchQuery = '') {
    const cards = [];

    // Filter and add OTP codes
    data.otpCodes.forEach(otp => {
        const account = otp.account || extractEmail(otp.from);
        cards.push({
            type: 'otp',
            account: account,
            fullEmail: otp.to || '',
            subject: otp.subject || 'Your Netflix Verification Code',
            code: otp.code,
            date: otp.date,
            sortDate: new Date(otp.date)
        });
    });

    // Filter and add Temporary Access Links
    if (data.tempAccessLinks) {
        data.tempAccessLinks.forEach(item => {
            const account = item.account || extractEmail(item.from);
            cards.push({
                type: 'tempAccess',
                account: account,
                fullEmail: item.to || '',
                subject: item.subject || 'Kode akses sementara',
                link: item.link,
                requester: item.requester,
                date: item.date,
                sortDate: new Date(item.date)
            });
        });
    }

    // Filter and add Household links
    data.householdLinks.forEach(item => {
        const account = item.account || extractEmail(item.from);
        cards.push({
            type: 'household',
            account: account,
            fullEmail: item.to || '',
            subject: item.subject || 'How to update your Netflix Household',
            link: item.link,
            date: item.date,
            sortDate: new Date(item.date)
        });
    });

    // Sort by date (newest first) and limit to 5 cards
    cards.sort((a, b) => b.sortDate - a.sortDate);
    const displayCards = cards.slice(0, 5);

    if (displayCards.length === 0) {
        showEmpty();
        return;
    }

    elements.emptyState.style.display = 'none';
    elements.cardsContainer.innerHTML = displayCards.map(card => {
        if (card.type === 'otp') {
            return createOTPCard(card);
        } else if (card.type === 'tempAccess') {
            return createTempAccessCard(card);
        } else {
            return createHouseholdCard(card);
        }
    }).join('');
}

/**
 * Create OTP card HTML
 */
function createOTPCard(item) {
    const timeAgo = formatTimeAgo(item.date);
    const accountDisplay = formatAccountName(item.account);

    return `
        <div class="email-card">
            <div class="card-content">
                <div class="card-header">
                    <span class="card-label">Login Code</span>
                    <span class="account-badge">${escapeHtml(accountDisplay)}</span>
                    <span class="card-time">${timeAgo}</span>
                </div>
                <div class="card-email">Akun: ${maskEmail(item.fullEmail || item.account)}</div>
                <div class="card-subject">${escapeHtml(item.subject)}</div>
            </div>
            <div class="otp-display" onclick="copyOTP('${item.code}')">
                <span class="otp-code">${item.code}</span>
                <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
            </div>
        </div>
    `;
}

/**
 * Create Temporary Access card HTML
 */
function createTempAccessCard(item) {
    const timeAgo = formatTimeAgo(item.date);

    // Untuk temp access, tampilkan nama peminta di badge, bukan pemilik akun
    const badgeDisplay = item.requester ? item.requester.name : formatAccountName(item.account);

    // Format requester info
    let requesterText = 'Permintaan kode akses sementara';
    if (item.requester) {
        requesterText = `Diminta oleh ${item.requester.name} dari ${item.requester.device}`;
    }

    return `
        <div class="email-card temp-access">
            <div class="card-content">
                <div class="card-header">
                    <span class="card-label">Akses Sementara</span>
                    <span class="account-badge">${escapeHtml(badgeDisplay)}</span>
                    <span class="card-time">${timeAgo}</span>
                </div>
                <div class="card-email">Akun: ${maskEmail(item.fullEmail || item.account)}</div>
                <div class="card-subject">${escapeHtml(requesterText)}</div>
            </div>
            <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="temp-access-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                Dapatkan Kode
            </a>
        </div>
    `;
}

/**
 * Create Household card HTML
 */
function createHouseholdCard(item) {
    const timeAgo = formatTimeAgo(item.date);
    const accountDisplay = formatAccountName(item.account);
    // Shorten subject
    let displaySubject = item.subject;
    if (displaySubject.length > 40) {
        displaySubject = displaySubject.substring(0, 40) + '...';
    }

    return `
        <div class="email-card household">
            <div class="card-content">
                <div class="card-header">
                    <span class="card-label">Household Update</span>
                    <span class="account-badge">${escapeHtml(accountDisplay)}</span>
                    <span class="card-time">${timeAgo}</span>
                </div>
                <div class="card-email">Akun: ${maskEmail(item.fullEmail || item.account)}</div>
                <div class="card-subject">Important: <a href="${item.link}" target="_blank">${escapeHtml(displaySubject)}</a></div>
            </div>
            <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="household-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3"/>
                </svg>
                Update Household
            </a>
        </div>
    `;
}

/**
 * Format account name for display
 * Converts "netflix1" to "Netflix 1" etc.
 */
function formatAccountName(account) {
    if (!account) return 'Unknown';

    // Check if it's a suffix like "netflix1" or "netflix2"
    const match = account.match(/^(netflix)(\d+)$/i);
    if (match) {
        return `Netflix ${match[2]}`;
    }

    // If it's a full email, shorten it
    if (account.includes('@')) {
        return account.split('@')[0];
    }

    return account;
}

/**
 * Mask email for privacy with CSS blur
 * Returns HTML with blurred portion - uses placeholder text
 */
function maskEmail(email) {
    if (!email) return '';

    // Extract parts
    const atIndex = email.indexOf('@');
    if (atIndex === -1) return email;

    const localPart = email.substring(0, atIndex);
    const domain = email.substring(atIndex);

    // Generate placeholder text (same length as original, but random-looking)
    const placeholder = '●●●●●●●●';

    // Check if there's a + suffix
    const plusIndex = localPart.indexOf('+');

    if (plusIndex !== -1) {
        // Has suffix like +netflix1 - keep suffix visible
        const suffix = localPart.substring(plusIndex);
        return `<span class="blur-text">${placeholder}</span>${suffix}${domain}`;
    } else {
        // No suffix, blur with placeholder
        return `<span class="blur-text">${placeholder}</span>${domain}`;
    }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Extract email from "Name <email>" format
 */
function extractEmail(from) {
    const match = from.match(/<(.+?)>/);
    if (match) {
        return match[1];
    }
    // If no angle brackets, return as-is (might already be just email)
    return from;
}

/**
 * Copy OTP to clipboard
 */
async function copyOTP(code) {
    try {
        await navigator.clipboard.writeText(code);
        showToast(`Kode OTP ${code} berhasil disalin!`);
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast(`Kode OTP ${code} berhasil disalin!`);
    }
}

/**
 * Format time ago
 */
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short'
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show toast notification
 */
function showToast(message, isError = false) {
    elements.toastMessage.textContent = message;
    elements.toast.classList.remove('error');

    if (isError) {
        elements.toast.classList.add('error');
    }

    elements.toast.classList.add('show');

    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// ============================================
// Initialize
// ============================================

// Check if API URL is configured
if (CONFIG.API_URL.includes('PASTE_YOUR')) {
    elements.modeText.textContent = 'Not Configured';
    elements.cardsContainer.innerHTML = `
        <div class="empty-state">
            <p>⚠️ API URL belum dikonfigurasi. Buka <strong>script.js</strong> dan ganti <code>API_URL</code>.</p>
        </div>
    `;
} else {
    // Initial fetch
    fetchData();

    // Auto-refresh
    setInterval(fetchData, CONFIG.REFRESH_INTERVAL);
}
