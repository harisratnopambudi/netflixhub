/**
 * Netflix Access Hub - Frontend Script
 * Redesigned for modern glassmorphism UI
 */

// ============================================
// KONFIGURASI
// ============================================
const CONFIG = {
    // API URL utama
    API_URLS: [
        'https://script.google.com/macros/s/AKfycby_HdfwsgMzwLEPQ4Cb59ueHGSfBMEbn2V7EAcYUJsBs6lHzemZ3k7ANOZ6Y0iM8TxZ/exec',
    ]
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
    loadingState: document.getElementById('loading-state'),
    emptyState: document.getElementById('empty-state'),

    statusText: document.getElementById('status-text'),
    statusDot: document.getElementById('status-dot'),
    statusIndicator: document.getElementById('status-indicator'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message'),
    refreshBtn: document.getElementById('refresh-btn'),
    refreshIcon: document.getElementById('refresh-icon'),
};

// ============================================
// Main Functions
// ============================================

/**
 * Fetch data dari Google Apps Script dengan fallback ke backup API
 */
async function fetchData() {
    showLoading();

    // Add spinning animation to refresh icon
    if (elements.refreshIcon) {
        elements.refreshIcon.classList.add('animate-spin');
    }

    let lastError = null;

    // Coba semua API URLs berurutan
    for (let i = 0; i < CONFIG.API_URLS.length; i++) {
        const apiUrl = CONFIG.API_URLS[i];

        try {
            console.log(`Mencoba API ${i + 1}/${CONFIG.API_URLS.length}...`);

            const response = await fetch(apiUrl);
            const result = await response.json();

            if (!result.success) {
                // Jika error quota, coba API berikutnya
                if (result.error && result.error.includes('too many times')) {
                    console.warn(`API ${i + 1} limit tercapai, mencoba backup...`);
                    lastError = new Error(result.error);
                    continue;
                }
                throw new Error(result.error || 'Gagal memuat data');
            }

            // Sukses!
            allData = result.data;
            renderCards(allData);
            updateStatus('online', CONFIG.API_URLS.length > 1 ? `Online (API ${i + 1})` : 'Online');

            // Remove spinning animation
            if (elements.refreshIcon) {
                elements.refreshIcon.classList.remove('animate-spin');
            }
            return;

        } catch (error) {
            console.error(`API ${i + 1} error:`, error);
            lastError = error;
        }
    }

    // Semua API gagal
    console.error('Semua API gagal:', lastError);
    updateStatus('error', 'Offline');

    if (lastError && lastError.message.includes('too many times')) {
        showToast('Semua API mencapai batas harian. Coba lagi besok.', true);
    } else {
        showToast('Gagal memuat data. Cek console untuk detail.', true);
    }

    showEmpty();

    if (elements.refreshIcon) {
        elements.refreshIcon.classList.remove('animate-spin');
    }
}

/**
 * Update status indicator
 */
function updateStatus(status, text) {
    if (elements.statusText) {
        elements.statusText.textContent = text;
    }
    if (elements.statusDot) {
        elements.statusDot.classList.remove('bg-green-500', 'bg-red-500', 'bg-yellow-500');
        if (status === 'online') {
            elements.statusDot.classList.add('bg-green-500');
            if (elements.statusText) elements.statusText.classList.remove('text-red-500', 'text-yellow-500');
            if (elements.statusText) elements.statusText.classList.add('text-green-500');
        } else if (status === 'error') {
            elements.statusDot.classList.add('bg-red-500');
            if (elements.statusText) elements.statusText.classList.remove('text-green-500', 'text-yellow-500');
            if (elements.statusText) elements.statusText.classList.add('text-red-500');
        }
    }
}

const LOADING_MESSAGES = [
    "Lagi nyiapin popcorn, tunggu bentar ya... 🍿",
    "Sabar, lagi nyari remote yang nyelip di sofa... 🛋️",
    "Siapin posisi rebahan paling nyaman dulu... 🛌",
    "Lagi loading... jangan di-skip kayak intro series ya! ⏩",
    "Bentar, lagi nego sama sinyal internet... 📡",
    "Sabar ya, daripada nunggu kepastian dari dia... 🤪",
    "Lagi manasin mesin server, biar ngebut... 🔥",
    "Tahan napas... eh jangan deng, nanti pingsan. Tunggu ya! 😮‍💨",
    "Mencari hilal data Netflix... 🔭",
    "Loading... semoga lebih cepet dari kurir paket 📦",
    "Lagi nyeduh kopi buat servernya... ☕",
    "Jangan kedip, nanti ketinggalan... (canda deng, masih loading) 👁️",
    "Sabar, orang sabar disayang Tuhan (dan pacar orang)... 🤭",
    "Lagi download kesabaran ekstra... ⏳",
    "Bentar, adminnya lagi ke kamar mandi... 🚽",
    "Data lagi OTW, naik ojek online... 🛵",
    "Lagi ngitung kancing... satu, dua, tiga... 👕",
    "Menunggu itu berat, biar aku saja (server)... 🏋️",
    "Lagi briefing sama semut-semut kabel... 🐜",
    "Tenang, ini bukan nge-lag, cuma lagi estetik... ✨"
];

/**
 * Show loading state
 */
function showLoading() {
    if (elements.loadingState) {
        // Randomize text
        const msgElement = elements.loadingState.querySelector('p');
        if (msgElement) {
            msgElement.textContent = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
        }
        elements.loadingState.classList.remove('hidden');
        elements.loadingState.classList.add('flex');
    }
    if (elements.emptyState) {
        elements.emptyState.classList.add('hidden');
    }
    // Clear existing cards except loading
    const cards = elements.cardsContainer.querySelectorAll('.group');
    cards.forEach(card => card.remove());
}

/**
 * Show empty state
 */
function showEmpty() {
    if (elements.loadingState) {
        elements.loadingState.classList.add('hidden');
        elements.loadingState.classList.remove('flex');
    }
    if (elements.emptyState) {
        elements.emptyState.classList.remove('hidden');
    }
    // Clear cards
    const cards = elements.cardsContainer.querySelectorAll('.group');
    cards.forEach(card => card.remove());
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

    // Filter and add Household Confirm links
    if (data.householdConfirmLinks) {
        data.householdConfirmLinks.forEach(item => {
            const account = item.account || extractEmail(item.from);
            cards.push({
                type: 'householdConfirm',
                account: account,
                fullEmail: item.to || '',
                subject: item.subject || 'Konfirmasi Update Rumah Netflix',
                link: item.link,
                requester: item.requester || (account.toLowerCase().includes('2') ? { name: 'Cecilia', device: 'Samsung - Smart TV' } : null),
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

    // Sort by date (newest first) and limit to 4 cards
    cards.sort((a, b) => b.sortDate - a.sortDate);
    const displayCards = cards.slice(0, 10);

    // Hide loading state
    if (elements.loadingState) {
        elements.loadingState.classList.add('hidden');
        elements.loadingState.classList.remove('flex');
    }

    if (displayCards.length === 0) {
        showEmpty();
        return;
    }

    if (elements.emptyState) {
        elements.emptyState.classList.add('hidden');
    }

    // Clear existing cards
    const existingCards = elements.cardsContainer.querySelectorAll('.group');
    existingCards.forEach(card => card.remove());

    // Render new cards
    displayCards.forEach(card => {
        let cardHtml;
        if (card.type === 'otp') {
            cardHtml = createOTPCard(card);
        } else if (card.type === 'tempAccess') {
            cardHtml = createTempAccessCard(card);
        } else if (card.type === 'householdConfirm') {
            cardHtml = createHouseholdConfirmCard(card);
        } else {
            cardHtml = createHouseholdCard(card);
        }
        elements.cardsContainer.insertAdjacentHTML('beforeend', cardHtml);
    });


}



/**
 * Create OTP card HTML - Horizontal compact layout
 */
function createOTPCard(item) {
    const timeAgo = formatTimeAgo(item.date);
    const accountDisplay = formatAccountName(item.account);
    const maskedEmail = maskEmail(item.fullEmail || item.account);

    return `
        <div class="group relative bg-surface-dark rounded-lg border border-white/5 border-l-4 border-l-primary shadow-lg overflow-hidden hover:bg-surface-hover transition-all duration-300 card-glow-red">
            <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20 pointer-events-none"></div>
            <div class="p-3 relative z-10">
                <div class="flex items-center justify-between gap-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-[10px] font-bold text-primary tracking-widest uppercase">OTP</span>
                            <span class="px-1.5 py-0.5 rounded text-[8px] font-bold text-white bg-gradient-to-r from-purple-700 to-indigo-600 border border-white/10">
                                ${escapeHtml(accountDisplay)}
                            </span>
                            <span class="text-[9px] text-netflix-gray/60">${timeAgo}</span>
                        </div>
                        <div class="text-[11px] text-netflix-gray truncate">${maskedEmail}</div>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="font-mono text-xl font-bold tracking-wider text-white">
                            ${formatOTPCode(item.code)}
                        </div>
                        <button onclick="copyOTP('${item.code}')" class="p-2 bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20 hover:border-primary rounded-md transition-all duration-200 active:scale-95">
                            <span class="material-symbols-outlined text-[16px]">content_copy</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Create Temporary Access card HTML - Horizontal compact layout
 */
function createTempAccessCard(item) {
    const timeAgo = formatTimeAgo(item.date);

    let badgeDisplay = formatAccountName(item.account);
    let deviceInfo = '';

    if (item.requester) {
        badgeDisplay = item.requester.name;
        if (item.requester.device) {
            deviceInfo = `dari ${item.requester.device}`;
        }
    }

    return `
        <div class="group relative bg-surface-dark rounded-lg border border-white/5 border-l-4 border-l-amber-500 shadow-lg overflow-hidden hover:bg-surface-hover transition-all duration-300 card-glow-amber">
            <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20 pointer-events-none"></div>
            <div class="p-3 relative z-10">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-[10px] font-bold text-amber-500 tracking-widest uppercase">TEMPORARY ACCESS</span>
                            <span class="text-[9px] text-netflix-gray/60">${timeAgo}</span>
                        </div>
                        <div class="text-xs font-semibold text-white truncate">${escapeHtml(badgeDisplay)}</div>
                        ${deviceInfo ? `<div class="text-[10px] text-netflix-gray truncate">${escapeHtml(deviceInfo)}</div>` : ''}
                        <div class="mt-1 text-[9px] text-amber-500/80 italic animate-pulse">* Link kadaluwarsa dlm 15 menit</div>
                    </div>
                    <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5 px-2 py-2 bg-amber-500/10 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-500/20 hover:border-amber-600 rounded-md transition-all duration-200 text-xs font-semibold active:scale-95 whitespace-nowrap">
                        <span class="material-symbols-outlined text-[16px]">bolt</span>
                        Buka
                    </a>
                </div>
            </div>
        </div>
    `;
}

/**
 * Create Household Confirm card HTML - Horizontal compact layout
 */

function createHouseholdConfirmCard(item) {
    const timeAgo = formatTimeAgo(item.date);

    // Default fallback
    let mainText = formatAccountName(item.account);
    let subText = '';

    // If requester info is present, use it
    if (item.requester) {
        mainText = item.requester.name;
        if (item.requester.device) {
            subText = `dari ${item.requester.device}`;
        }
    }

    return `
        <div class="group relative bg-surface-dark rounded-lg border border-white/5 border-l-4 border-l-green-500 shadow-lg overflow-hidden hover:bg-surface-hover transition-all duration-300 card-glow-green">
            <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20 pointer-events-none"></div>
            <div class="p-3 relative z-10">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-[10px] font-bold text-green-500 tracking-widest uppercase">UPDATE HOUSEHOLD</span>
                            <span class="text-[9px] text-netflix-gray/60">${timeAgo}</span>
                        </div>
                        <div class="text-xs font-semibold text-white truncate">${escapeHtml(mainText)}</div>
                        ${subText ? `<div class="text-[10px] text-netflix-gray truncate">${escapeHtml(subText)}</div>` : ''}
                        
                        <div class="mt-1 text-[9px] text-amber-500/80 italic animate-pulse">
                            * Link akan kedaluwarsa setelah 15 menit.
                        </div>
                    </div>
                    
                    <a href="${item.link}" target="_blank" rel="noopener noreferrer" 
                       class="flex items-center gap-1.5 px-3 py-2 bg-green-500/10 hover:bg-green-600 text-green-400 hover:text-white border border-green-500/20 hover:border-green-600 rounded-md transition-all duration-200 text-xs font-semibold active:scale-95 whitespace-nowrap">
                        <span class="material-symbols-outlined text-[16px]">check_circle</span>
                        Ya, Itu Saya
                    </a>
                </div>
            </div>
        </div>
    `;
}

/**
 * Create Household card HTML - Horizontal compact layout
 */
function createHouseholdCard(item) {
    const timeAgo = formatTimeAgo(item.date);
    const accountDisplay = formatAccountName(item.account);

    return `
        <div class="group relative bg-surface-dark rounded-lg border border-white/5 border-l-4 border-l-blue-500 shadow-lg overflow-hidden hover:bg-surface-hover transition-all duration-300 card-glow-blue">
            <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20 pointer-events-none"></div>
            <div class="p-3 relative z-10">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-[10px] font-bold text-blue-500 tracking-widest uppercase">HOUSEHOLD</span>
                            <span class="text-[9px] text-netflix-gray/60">${timeAgo}</span>
                        </div>
                        <div class="text-xs font-semibold text-white truncate">${escapeHtml(accountDisplay)}</div>
                    </div>
                    <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5 px-2 py-2 bg-blue-500/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 hover:border-blue-600 rounded-md transition-all duration-200 text-xs font-semibold active:scale-95 whitespace-nowrap">
                        <span class="material-symbols-outlined text-[16px]">open_in_new</span>
                        Buka
                    </a>
                </div>
            </div>
        </div>
    `;
}

/**
 * Format account name for display
 */
function formatAccountName(account) {
    if (!account) return 'Unknown';

    try {
        // Handle matches like "netflix1", "user+netflix1", "netflix-1", etc.
        const match = account.match(/(?:^|\+|\.|_)(netflix)(\d+)/i);
        if (match && match[2]) {
            return `Akun ${match[2]}`;
        }

        // Just in case it's just "netflix2" without separator (handled by above but being safe)
        // or other variations. The above regex expects a separator or start of line.
        // Let's make it simpler and more robust: find "netflix" followed by digits.
        const simpleMatch = account.match(/netflix(\d+)/i);
        if (simpleMatch) {
            return `Akun ${simpleMatch[1]}`;
        }

    } catch (e) {
        console.error('Error formatting account name:', e);
    }

    if (account.includes('@')) {
        return account.split('@')[0];
    }

    return account;
}

/**
 * Format OTP code with space in middle
 */
function formatOTPCode(code) {
    if (!code) return '--- ---';
    const cleanCode = code.replace(/\s/g, '');
    if (cleanCode.length === 6) {
        return cleanCode.slice(0, 3) + ' ' + cleanCode.slice(3);
    }
    return code;
}

/**
 * Mask email for privacy
 */
function maskEmail(email) {
    if (!email) return 'Perangkat Baru';

    const atIndex = email.indexOf('@');
    if (atIndex === -1) return email;

    const domain = email.substring(atIndex);
    return `<span class="blur-[4px] select-none">xxxxxx</span>${domain}`;
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
    if (diffMins < 60) return `${diffMins} menit yang lalu`;
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    if (diffDays < 7) return `${diffDays} hari yang lalu`;

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
    const toast = elements.toast;
    const toastMessage = elements.toastMessage;

    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;

    // Update toast styling based on error state
    const iconContainer = toast.querySelector('div:first-child');
    const icon = toast.querySelector('.material-symbols-outlined');

    if (isError) {
        toast.classList.remove('border-l-green-500');
        toast.classList.add('border-l-red-500');
        if (iconContainer) {
            iconContainer.classList.remove('bg-green-500/20', 'text-green-500');
            iconContainer.classList.add('bg-red-500/20', 'text-red-500');
        }
        if (icon) icon.textContent = 'error';
    } else {
        toast.classList.remove('border-l-red-500');
        toast.classList.add('border-l-green-500');
        if (iconContainer) {
            iconContainer.classList.remove('bg-red-500/20', 'text-red-500');
            iconContainer.classList.add('bg-green-500/20', 'text-green-500');
        }
        if (icon) icon.textContent = 'check';
    }

    // Show toast
    toast.classList.remove('translate-y-24', 'opacity-0');

    // Auto hide after 3 seconds
    setTimeout(() => {
        hideToast();
    }, 3000);
}

/**
 * Hide toast notification
 */
function hideToast() {
    if (elements.toast) {
        elements.toast.classList.add('translate-y-24', 'opacity-0');
    }
}

// ============================================
// Initialize
// ============================================

// Check if API URLs are configured
if (CONFIG.API_URLS.length === 0 || CONFIG.API_URLS[0].includes('PASTE_YOUR')) {
    updateStatus('error', 'Not Configured');
    if (elements.loadingState) {
        elements.loadingState.innerHTML = `
            <span class="material-symbols-outlined text-5xl text-amber-500 mb-4">warning</span>
            <p class="text-netflix-gray text-center">⚠️ API URL belum dikonfigurasi.<br>Buka <strong>script.js</strong> dan tambahkan URL di <code>API_URLS</code>.</p>
        `;
    }
} else {
    // Initial fetch when page loads
    fetchData();
    // Start testimonial rotator
    startTestimonialRotator();
}

/**
 * Start Random Testimonial Rotator
 */
function startTestimonialRotator() {
    const container = document.getElementById('testimonial-container');
    if (!container) return;

    const testimonials = [
        { name: "Andi", quote: "Fitur Auto OTP-nya juara! Ga perlu nunggu lama buat login." },
        { name: "Budi", quote: "Sangat membantu banget. Mau nonton jadi gampang, ga perlu chat admin minta kode." },
        { name: "Citra", quote: "Tampilannya keren dan mudah dipahami. Netflix Access Hub emang top!" },
        { name: "Deni", quote: "Ga nyesel langganan di sini. Fast respon dan sistemnya stabil." },
        { name: "Eka", quote: "Suka banget sama fitur pengingat tagihannya. Jadi ga pernah lupa perpanjang." },
        { name: "Fajar", quote: "Awalnya ragu, tapi setelah coba ternyata worth it banget. Recommended!" },
        { name: "Gita", quote: "Solusi terbaik buat anak kosan. Sharing account jadi ga ribet." },
        { name: "Hendra", quote: "Prosesnya cepet, ga pake lama. OTP langsung muncul di dashboard sini." },
        { name: "Indah", quote: "Customer servicenya ramah, kalau ada kendala household cepet beres." },
        { name: "Joko", quote: "Tampilan dark mode-nya nyaman di mata. UX-nya juga oke." },
        { name: "Kartika", quote: "Udah 3 bulan langganan dan lancar jaya. Semoga terus dipertahankan kualitasnya." },
        { name: "Lukman", quote: "Simpel tapi powerful. Tinggal klik copy, langsung bisa login Netflix." },
        { name: "Maya", quote: "Enak banget sekarang, mau login di TV tinggal ambil kode sendiri." },
        { name: "Nanda", quote: "Sistem yang solid. Akun aman dan privasi terjaga." },
        { name: "Oki", quote: "Buat yang cari sharing account Netflix yang trusted, ini pilihan paling tepat sih." },
        { name: "Putri", quote: "Suka sama desainnya yang clean. Ga bikin bingung pas cari kode OTP." },
        { name: "Rizky", quote: "Auto OTP-nya bener-bener life saver. Dulu harus nunggu admin bales chat, sekarang mandiri." },
        { name: "Siti", quote: "Harganya terjangkau dengan fitur segudang. Mantap!" },
        { name: "Tono", quote: "Ga ada lagi drama lupa bayar berkat fitur reminder otomatis di WA." },
        { name: "Wulan", quote: "Update terus fiturnya. Adminnya juga responsif kalo ada kendala di TV." },
        { name: "Adit", quote: "Dashboardnya user friendly banget, pemula langsung paham cara pakainya." },
        { name: "Bayu", quote: "Fitur household update-nya ngebantu banget pas kena limit device." },
        { name: "Candra", quote: "Loadingnya cepet, ga berat di browser. Nyari kode ga pake loading lama." },
        { name: "Dewi", quote: "Suka sama fitur copy OTP-nya, praktis tinggal klik trus paste." },
        { name: "Erwin", quote: "Pengalaman sharing account paling smooth yang pernah gue coba." },
        { name: "Fifi", quote: "Notifikasi WhatsApp-nya gercep, jadi tau kapan harus bayar perpanjangan." },
        { name: "Gilang", quote: "Gampang banget nemu kode buat akun saya, ga pusing cari di antara banyak chat." },
        { name: "Hana", quote: "Jarang banget down, pas mau nonton weekend selalu aman." },
        { name: "Iwan", quote: "Tampilan responsif, dibuka di HP sambil tiduran juga enak." },
        { name: "Juli", quote: "Data aman, ga takut akun bermasalah." },
        { name: "Kiki", quote: "Desain UI-nya modern, berasa pake aplikasi premium." },
        { name: "Lina", quote: "Suka sama animasi transisinya, bikin web kerasa smooth." },
        { name: "Miko", quote: "Panduannya lengkap, ga bingung cara update household." },
        { name: "Nina", quote: "Integrasi sama WhatsApp-nya seamless banget." },
        { name: "Oscar", quote: "Warna dark mode-nya pas, ga bikin sakit mata kalo buka malem-malem." },
        { name: "Panji", quote: "Sistem loginnya aman, tenang makenya." },
        { name: "Qori", quote: "Bikin pengalaman nonton jadi lebih efisien, ga buang waktu urus login." },
        { name: "Rani", quote: "Simple, Elegan, Fungsional. Tiga kata buat web ini." },
        { name: "Sony", quote: "Ga perlu ribet chat admin manual minta OTP lagi." },
        { name: "Tia", quote: "Recommended banget buat yang mau langganan sharing account anti ribet." },
        { name: "Umar", quote: "Semoga kedepannya ada aplikasi mobile-nya juga!" }
    ];

    let currentIndex = Math.floor(Math.random() * testimonials.length);

    function updateTestimonial() {
        // Fade out
        container.style.opacity = '0';
        container.style.transform = 'translateY(10px)';

        setTimeout(() => {
            const t = testimonials[currentIndex];

            const html = `
                <!-- Background decoration -->
                <div class="absolute -top-10 -right-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all duration-500"></div>
                
                <div class="relative z-10 flex flex-col items-center text-center">
                    <span class="material-symbols-outlined text-3xl text-primary/40 mb-2">format_quote</span>
                    
                    <blockquote class="text-white text-base md:text-lg font-medium italic mb-4 min-h-[3rem] flex items-center justify-center px-4 leading-relaxed">
                        "${t.quote}"
                    </blockquote>
                    
                    <div class="flex items-center gap-2 opacity-80">
                         <div class="h-px w-6 bg-white/10"></div>
                         <span class="text-netflix-gray text-xs font-bold uppercase tracking-wider">${t.name}</span>
                         <div class="h-px w-6 bg-white/10"></div>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Fade in
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';

            // Next index
            currentIndex = (currentIndex + 1) % testimonials.length;
        }, 300); // Wait for fade out
    }

    // Set styles for transition
    container.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out';

    // Initial call
    updateTestimonial();

    // Interval
    setInterval(updateTestimonial, 5000);
}
