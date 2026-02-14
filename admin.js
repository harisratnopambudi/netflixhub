/**
 * Netflix Access Hub - Admin Script
 */

// ============================================
// KONFIGURASI
// ============================================
const ADMIN_CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycby_HdfwsgMzwLEPQ4Cb59ueHGSfBMEbn2V7EAcYUJsBs6lHzemZ3k7ANOZ6Y0iM8TxZ/exec',
    SESSION_KEY: 'netflix_admin_session'
};

// Konfigurasi WhatsApp Fonnte
const FONNTE_CONFIG = {
    API_URL: 'https://api.fonnte.com/send',
    TOKEN: 'xWdz6BLu6RxaBKfCkCAWS4wayMZSGa',
    // Pengaturan pengingat otomatis
    AUTO_REMINDER: {
        enabled: false, // DISABLED: Karena sudah pindah ke Server-Side (Google Apps Script)
        // daysBeforeDue tidak lagi digunakan karena logika diubah menjadi H sampai H+5
        reminderKey: 'netflix_last_reminder' // Key localStorage untuk tracking
    }
};

// ============================================
// DOM Elements
// ============================================
const adminElements = {
    loginSection: document.getElementById('login-section'),
    dashboardSection: document.getElementById('dashboard-section'),
    passwordInput: document.getElementById('password-input'),
    loginBtn: document.getElementById('login-btn'),
    loginText: document.getElementById('login-text'),
    loginSpinner: document.getElementById('login-spinner'),
    loginError: document.getElementById('login-error'),
    logoutBtn: document.getElementById('logout-btn'),
    subscriptionsContainer: document.getElementById('subscriptions-container'),
    modalOverlay: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    memberForm: document.getElementById('member-form'),
    memberId: document.getElementById('member-id'),
    memberSlotNumber: document.getElementById('member-slot-number'),
    memberIsSlotOwner: document.getElementById('member-is-slot-owner'),
    memberEmail: document.getElementById('member-email'),
    memberName: document.getElementById('member-name'),
    memberPhone: document.getElementById('member-phone'),
    memberPin: document.getElementById('member-pin'),
    memberDue: document.getElementById('member-due'),
    memberNotes: document.getElementById('member-notes'),
    slotSelectionGroup: document.getElementById('slot-selection-group'),
    slotOptions: document.getElementById('slot-options'),
    pinGroup: document.getElementById('pin-group'),
    pinHint: document.getElementById('pin-hint'),
    submitBtn: document.getElementById('submit-btn'),
    submitText: document.getElementById('submit-text'),
    submitSpinner: document.getElementById('submit-spinner'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message')
};

// ============================================
// Payment Tracking Logic
// ============================================

function openPaymentModal(email) {
    const overlay = document.getElementById('payment-modal-overlay');
    const emailInput = document.getElementById('payment-email');
    const dateInput = document.getElementById('payment-date');

    emailInput.value = email;

    // Check if there's an existing value
    const savedDate = localStorage.getItem(`netflix_payment_${email}`);
    if (savedDate) {
        dateInput.value = savedDate;
    } else {
        dateInput.valueAsDate = new Date(); // Default today
    }

    overlay.classList.add('show');
}

function closePaymentModal() {
    const overlay = document.getElementById('payment-modal-overlay');
    overlay.classList.remove('show');
}

function handlePaymentSubmit(event) {
    event.preventDefault();

    const email = document.getElementById('payment-email').value;
    const date = document.getElementById('payment-date').value;

    if (email && date) {
        localStorage.setItem(`netflix_payment_${email}`, date);
        closePaymentModal();
        renderSubscriptions(); // Refresh UI
        showToast('Info pembayaran disimpan');
    }
}

// ============================================
// Revenue Stats
// ============================================
// ============================================
// State
// ============================================
let subscriptions = [];
let isEditing = false;
let currentView = 'list';
let calendarDate = new Date();
let netflixPassword = '';

// ============================================
// Authentication
// ============================================

async function handleLogin(event) {
    event.preventDefault();

    const password = adminElements.passwordInput.value;
    if (!password) return;

    // Show loading
    adminElements.loginBtn.disabled = true;
    adminElements.loginText.style.display = 'none';
    adminElements.loginSpinner.style.display = 'block';
    adminElements.loginError.textContent = '';

    try {
        const response = await fetch(`${ADMIN_CONFIG.API_URL}?action=verifyPassword&password=${encodeURIComponent(password)}`);
        const result = await response.json();

        if (result.success && result.valid) {
            // Login success
            sessionStorage.setItem(ADMIN_CONFIG.SESSION_KEY, 'true');
            showDashboard();
            loadSubscriptions();
        } else {
            adminElements.loginError.textContent = 'Password salah!';
        }
    } catch (error) {
        console.error('Login error:', error);
        adminElements.loginError.textContent = 'Gagal terhubung ke server';
    } finally {
        adminElements.loginBtn.disabled = false;
        adminElements.loginText.style.display = 'block';
        adminElements.loginSpinner.style.display = 'none';
    }
}

function logout() {
    sessionStorage.removeItem(ADMIN_CONFIG.SESSION_KEY);
    showLogin();
}

function showLogin() {
    adminElements.loginSection.style.display = 'flex';
    adminElements.dashboardSection.style.display = 'none';
    adminElements.logoutBtn.style.display = 'none';
    adminElements.passwordInput.value = '';
    adminElements.loginError.textContent = '';
}

function showDashboard() {
    adminElements.loginSection.style.display = 'none';
    adminElements.dashboardSection.style.display = 'block';
    adminElements.logoutBtn.style.display = 'flex';
    loadConfig();
}

// ============================================
// Subscriptions CRUD
// ============================================

async function loadConfig() {
    try {
        const response = await fetch(`${ADMIN_CONFIG.API_URL}?action=getConfig`);
        const result = await response.json();
        if (result.success) {
            netflixPassword = result.netflixPassword || '';
        }
    } catch (error) {
        console.error('Failed to load config:', error);
    }
}

async function loadSubscriptions() {
    adminElements.subscriptionsContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-netflix-gray">
            <div class="w-8 h-8 border-3 border-white/10 border-t-primary rounded-full spinner mb-3"></div>
            <p class="text-sm">Memuat data...</p>
        </div>
    `;

    try {
        const response = await fetch(`${ADMIN_CONFIG.API_URL}?action=getSubscriptions`);
        const result = await response.json();

        if (result.success) {
            subscriptions = result.data || [];
            renderSubscriptions();
        } else {
            throw new Error(result.error || 'Gagal memuat data');
        }
    } catch (error) {
        console.error('Load error:', error);
        adminElements.subscriptionsContainer.innerHTML = `
            <div class="text-center py-12 text-netflix-gray">
                <p class="text-sm">⚠️ Gagal memuat data. <a href="#" onclick="loadSubscriptions()" class="text-primary hover:underline">Coba lagi</a></p>
            </div>
        `;
    }
}

function updateRevenueStats() {
    const totalMembers = subscriptions.length;
    const privateMembers = subscriptions.filter(s => s.profileType !== 'sharing').length;
    const sharingMembers = subscriptions.filter(s => s.profileType === 'sharing').length;

    // Calculate total income
    let totalIncome = 0;
    const uniqueEmails = new Set();

    subscriptions.forEach(sub => {
        const isSharing = sub.profileType === 'sharing';
        // Use custom price if available, otherwise default
        const price = sub.price || (isSharing ? 25000 : 50000);
        totalIncome += parseInt(price);
        uniqueEmails.add(sub.email);
    });

    // Calculate total cost (186k per unique email)
    const totalCost = uniqueEmails.size * 186000;
    const netProfit = totalIncome - totalCost;

    // Format currency
    const formatRp = (num) => {
        const absVal = Math.abs(num).toLocaleString('id-ID');
        return num < 0 ? '-Rp' + absVal : 'Rp' + absVal;
    };

    // Update UI
    const statTotalEl = document.getElementById('stat-total-members');
    const statPrivateEl = document.getElementById('stat-private');
    const statSharingEl = document.getElementById('stat-sharing');
    const statIncomeEl = document.getElementById('stat-income');
    const statProfitEl = document.getElementById('stat-profit');

    if (statTotalEl) statTotalEl.textContent = totalMembers;
    if (statPrivateEl) statPrivateEl.textContent = privateMembers;
    if (statSharingEl) statSharingEl.textContent = sharingMembers;
    if (statIncomeEl) statIncomeEl.textContent = formatRp(totalIncome);

    if (statProfitEl) {
        statProfitEl.textContent = formatRp(netProfit);
        // Color coding for global profit
        statProfitEl.style.color = netProfit >= 0 ? '#3b82f6' : '#ef4444';
    }
}

function renderSubscriptions() {
    // Update revenue stats
    updateRevenueStats();

    if (subscriptions.length === 0) {
        adminElements.subscriptionsContainer.innerHTML = `
            <div class="text-center py-12 text-netflix-gray">
                <p class="text-sm">Belum ada data member. Klik "Tambah" untuk menambahkan.</p>
            </div>
        `;
        return;
    }

    // Group subscriptions by email
    const grouped = {};
    subscriptions.forEach(sub => {
        if (!grouped[sub.email]) {
            grouped[sub.email] = [];
        }
        grouped[sub.email].push(sub);
    });

    // Sort each group by due date (closest first)
    Object.keys(grouped).forEach(email => {
        grouped[email].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    });

    // Sort emails ascending
    const sortedEmails = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

    // Render grouped view
    let html = '';
    sortedEmails.forEach(email => {
        const profiles = grouped[email];
        const groupType = profiles[0]?.profileType || 'private';
        const isSharing = groupType === 'sharing';
        const typeBadgeClass = isSharing ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-500/20 text-purple-400';
        const typeBadgeText = isSharing ? 'SHARING' : 'PRIVATE';

        // Calculate group revenue
        let groupRevenue = 0;
        profiles.forEach(p => {
            const price = p.price || (p.profileType === 'sharing' ? 25000 : 50000);
            groupRevenue += parseInt(price);
        });

        const paymentKey = `netflix_payment_${email}`;
        const lastPaymentDate = localStorage.getItem(paymentKey);
        const subscriptionCost = 186000;

        let paymentBadge = '';
        if (lastPaymentDate) {
            const formattedPaymentDate = new Date(lastPaymentDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            paymentBadge = `
                <button onclick="openPaymentModal('${email}')" class="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 text-[10px] rounded hover:bg-green-500/30">
                    ✓ ${formattedPaymentDate}
                </button>
            `;
        } else {
            paymentBadge = `
                <button onclick="openPaymentModal('${email}')" class="px-2 py-1 bg-primary/20 text-primary text-[10px] rounded hover:bg-primary/30">
                    + Bayar
                </button>
            `;
        }

        const netProfit = groupRevenue - subscriptionCost;
        const formatMoney = (n) => {
            const abs = Math.abs(n).toLocaleString('id-ID');
            return n < 0 ? `-Rp${abs}` : `Rp${abs}`;
        };

        const profitColorClass = netProfit >= 0 ? 'text-green-400' : 'text-red-400';

        html += `
            <div class="bg-surface-dark rounded-lg border border-white/5 overflow-hidden">
                <div class="p-3 border-b border-white/5">
                    <!-- Row 1: Email & Badge -->
                    <div class="flex items-center gap-2 mb-2">
                        <img src="https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico" class="w-4 h-4" alt="">
                        <span class="text-sm font-medium truncate flex-1">${escapeHtml(email)}</span>
                        <span class="px-1.5 py-0.5 ${typeBadgeClass} text-[9px] font-bold rounded">${typeBadgeText}</span>
                        <span class="text-[10px] text-netflix-gray">${profiles.length} slot</span>
                    </div>
                    <!-- Row 2: Stats -->
                    <div class="flex items-center justify-between gap-2 text-[10px] bg-black/20 rounded-md px-2 py-1.5">
                        <div class="flex items-center gap-4">
                            <div><span class="text-netflix-gray">Omzet:</span> <span class="font-semibold text-white">${formatMoney(groupRevenue)}</span></div>
                            <div><span class="text-netflix-gray">Biaya:</span> <span class="font-semibold text-red-400">-Rp186.000</span></div>
                            <div><span class="text-netflix-gray">Profit:</span> <span class="font-semibold ${profitColorClass}">${formatMoney(netProfit)}</span></div>
                        </div>
                        ${paymentBadge}
                    </div>
                </div>
                <div>
                    <div class="p-3 flex items-center justify-between gap-3 bg-white/5 border-b border-white/5 text-[10px] text-netflix-gray uppercase tracking-wider font-semibold">
                        <div class="flex-1">Nama Profil</div>
                        <div class="w-20 text-center">Tempo</div>
                        <div class="w-14 text-center">Status</div>
                        <div class="w-28 text-center">Aksi</div>
                    </div>
                    <div class="divide-y divide-white/5">
                        ${profiles.map(sub => createSubscriptionRow(sub)).join('')}
                    </div>
                </div>
            </div>
        `;
    });

    adminElements.subscriptionsContainer.innerHTML = html;
}

function createSubscriptionRow(sub) {
    const dueInfo = getDueInfo(sub.dueDate);
    const isPastDue = dueInfo.class === 'due-overdue' || dueInfo.class === 'due-today';
    const isSharing = sub.profileType === 'sharing';
    const isOwner = sub.isSlotOwner !== false && sub.isSlotOwner !== 'false';

    let slotBadge = '';
    if (isSharing) {
        const slotNum = sub.slotNumber || 1;
        const ownerText = isOwner ? ' · Owner' : '';
        slotBadge = `<span class="ml-1.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] rounded">P${slotNum}${ownerText}</span>`;
    }

    const displayName = escapeHtml(sub.profileName);
    const statusBadge = isPastDue
        ? `<button onclick="markAsPaid('${sub.id}')" class="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded hover:bg-red-500/30">Belum</button>`
        : `<span class="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded">Lunas</span>`;

    return `
        <div class="p-3 flex items-center justify-between gap-3 hover:bg-white/5 ${isPastDue ? 'bg-red-500/5' : ''}">
            <div class="flex items-center gap-2 min-w-0 flex-1">
                <img src="https://netflix.com/favicon.ico" class="w-4 h-4" alt="">
                <span class="text-sm font-medium whitespace-normal break-words leading-tight">${displayName}</span>
                ${slotBadge}
            </div>
            <div class="text-[10px] text-netflix-gray w-20 text-center">${formatDate(sub.dueDate)}</div>
            <div class="w-14 text-center">${statusBadge}</div>
            <div class="flex items-center justify-center gap-0.5 w-28">
                <button onclick="showInfo('${sub.id}')" class="p-1.5 text-netflix-gray hover:text-blue-400 hover:bg-blue-500/10 rounded" title="Info">
                    <span class="material-symbols-outlined text-[16px]">info</span>
                </button>
                <button onclick="editMember('${sub.id}')" class="p-1.5 text-netflix-gray hover:text-amber-400 hover:bg-amber-500/10 rounded" title="Edit">
                    <span class="material-symbols-outlined text-[16px]">edit</span>
                </button>
                <button onclick="deleteMember('${sub.id}')" class="p-1.5 text-netflix-gray hover:text-red-400 hover:bg-red-500/10 rounded" title="Hapus">
                    <span class="material-symbols-outlined text-[16px]">delete</span>
                </button>
                <button onclick="shareWhatsApp('${sub.id}')" class="p-1.5 text-netflix-gray hover:text-green-400 hover:bg-green-500/10 rounded" title="WhatsApp">
                    <span class="material-symbols-outlined text-[16px]">share</span>
                </button>
            </div>
        </div>
    `;
}

function getDueInfo(dateString) {
    if (!dateString) return { text: '-', class: '' };
    const due = new Date(dateString);
    if (isNaN(due.getTime())) return { text: '-', class: '' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { text: `Lewat ${Math.abs(diffDays)} hari`, class: 'due-overdue' };
    } else if (diffDays === 0) {
        return { text: 'Hari ini!', class: 'due-today' };
    } else if (diffDays <= 3) {
        return { text: `${diffDays} hari lagi`, class: 'due-soon' };
    } else if (diffDays <= 5) {
        return { text: `${diffDays} hari lagi`, class: 'due-normal' };
    } else {
        return { text: 'Dibayar', class: 'due-paid' };
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Return original if invalid
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ============================================
// Modal Operations
// ============================================

function showAddModal() {
    isEditing = false;
    adminElements.modalTitle.textContent = 'Tambah Member';
    adminElements.memberForm.reset();
    adminElements.memberId.value = '';
    adminElements.memberSlotNumber.value = '';
    adminElements.memberIsSlotOwner.value = '';
    adminElements.memberDue.value = getDefaultDueDate();
    // Reset to private type
    document.querySelector('input[name="profile-type"][value="private"]').checked = true;
    toggleProfileType();
    adminElements.modalOverlay.classList.add('show');
}

function toggleProfileType() {
    const isSharing = document.querySelector('input[name="profile-type"]:checked').value === 'sharing';

    // Show/hide slot selection
    if (adminElements.slotSelectionGroup) {
        adminElements.slotSelectionGroup.style.display = isSharing ? 'block' : 'none';
    }

    if (isSharing) {
        populateSlotOptions();
    } else {
        // Private mode - show PIN, reset slot values
        showPinInput(true);
        adminElements.memberSlotNumber.value = '';
        adminElements.memberIsSlotOwner.value = 'true';
    }
}

function populateSlotOptions() {
    const email = adminElements.memberEmail.value;

    // Get sharing subscriptions for this email
    const sharingMembers = subscriptions.filter(s =>
        s.email === email && s.profileType === 'sharing'
    );

    // Group by slotNumber
    const slots = {};
    sharingMembers.forEach(m => {
        const slot = m.slotNumber || 1;
        if (!slots[slot]) {
            slots[slot] = [];
        }
        slots[slot].push(m);
    });

    // Find available slots (slots with only 1 member)
    const availableSlots = [];
    const fullSlots = [];

    Object.keys(slots).forEach(slotNum => {
        const members = slots[slotNum];
        if (members.length === 1) {
            availableSlots.push({
                slotNumber: parseInt(slotNum),
                owner: members.find(m => m.isSlotOwner) || members[0]
            });
        } else {
            fullSlots.push({
                slotNumber: parseInt(slotNum),
                members: members
            });
        }
    });

    // Determine next slot number
    const maxSlot = Math.max(0, ...Object.keys(slots).map(n => parseInt(n)));
    const nextSlotNumber = maxSlot + 1;

    // Build slot options HTML
    let html = '';

    // Available slots (can join)
    availableSlots.forEach(slot => {
        html += `
            <label class="slot-option available">
                <input type="radio" name="slot-selection" value="${slot.slotNumber}" 
                    data-is-owner="false" onchange="handleSlotSelect()">
                <div class="slot-card">
                    <span class="slot-number">Slot ${slot.slotNumber}</span>
                    <span class="slot-members">${escapeHtml(slot.owner.profileName)}</span>
                    <span class="slot-status available">1 TERSEDIA</span>
                </div>
            </label>
        `;
    });

    // Full slots (info only, disabled)
    fullSlots.forEach(slot => {
        const names = slot.members.map(m => m.profileName).join(' & ');
        html += `
            <label class="slot-option full disabled">
                <input type="radio" name="slot-selection" disabled>
                <div class="slot-card">
                    <span class="slot-number">Slot ${slot.slotNumber}</span>
                    <span class="slot-members">${escapeHtml(names)}</span>
                    <span class="slot-status full">PENUH</span>
                </div>
            </label>
        `;
    });

    // New slot option
    html += `
        <label class="slot-option new">
            <input type="radio" name="slot-selection" value="${nextSlotNumber}" 
                data-is-owner="true" onchange="handleSlotSelect()" checked>
            <div class="slot-card">
                <span class="slot-number">+ Slot Baru</span>
                <span class="slot-members">Buat slot baru (Slot ${nextSlotNumber})</span>
                <span class="slot-status new">OWNER</span>
            </div>
        </label>
    `;

    adminElements.slotOptions.innerHTML = html;
    handleSlotSelect(); // Initialize based on default selection
}

function handleSlotSelect() {
    const selected = document.querySelector('input[name="slot-selection"]:checked');
    if (!selected) return;

    const slotNumber = selected.value;
    const isOwner = selected.dataset.isOwner === 'true';

    adminElements.memberSlotNumber.value = slotNumber;
    adminElements.memberIsSlotOwner.value = isOwner;

    showPinInput(isOwner);
}

function showPinInput(show) {
    const pinInput = adminElements.memberPin;
    const pinHint = adminElements.pinHint;

    if (show) {
        pinInput.style.display = 'block';
        pinInput.disabled = false;
        if (pinHint) pinHint.style.display = 'none';
    } else {
        pinInput.style.display = 'none';
        pinInput.disabled = true;
        pinInput.value = '';
        if (pinHint) pinHint.style.display = 'block';
    }
}

function editMember(id) {
    const member = subscriptions.find(s => s.id === id);
    if (!member) return;

    isEditing = true;
    adminElements.modalTitle.textContent = 'Edit Member';
    adminElements.memberId.value = member.id;
    adminElements.memberEmail.value = member.email;
    adminElements.memberName.value = member.profileName || '';
    adminElements.memberPhone.value = member.phone || '';
    adminElements.memberPin.value = member.pin || '';
    adminElements.memberDue.value = member.dueDate;
    adminElements.memberNotes.value = member.notes || '';
    adminElements.memberSlotNumber.value = member.slotNumber || '';
    adminElements.memberIsSlotOwner.value = member.isSlotOwner || 'true';

    // Set profile type
    const profileType = member.profileType || 'private';
    document.querySelector(`input[name="profile-type"][value="${profileType}"]`).checked = true;

    // For editing, hide slot selection (can't change slot)
    if (adminElements.slotSelectionGroup) {
        adminElements.slotSelectionGroup.style.display = 'none';
    }

    // Show/hide PIN based on isSlotOwner
    const isOwner = member.isSlotOwner !== false && member.isSlotOwner !== 'false';
    showPinInput(isOwner || profileType === 'private');

    adminElements.modalOverlay.classList.add('show');
}

function closeModal() {
    adminElements.modalOverlay.classList.remove('show');
}

function getDefaultDueDate() {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().split('T')[0];
}

async function handleSubmit(event) {
    event.preventDefault();

    const profileType = document.querySelector('input[name="profile-type"]:checked').value;
    const price = profileType === 'sharing' ? 25000 : 50000;

    const data = {
        id: adminElements.memberId.value || generateId(),
        email: adminElements.memberEmail.value,
        profileName: adminElements.memberName.value,
        phone: adminElements.memberPhone.value,
        pin: adminElements.memberPin.value,
        dueDate: adminElements.memberDue.value,
        notes: adminElements.memberNotes.value,
        profileType: profileType,
        slotNumber: adminElements.memberSlotNumber.value || '',
        isSlotOwner: adminElements.memberIsSlotOwner.value || 'true',
        price: price
    };

    // Show loading
    adminElements.submitBtn.disabled = true;
    adminElements.submitText.style.display = 'none';
    adminElements.submitSpinner.style.display = 'block';

    try {
        const action = isEditing ? 'updateSubscription' : 'addSubscription';
        // Use GET with URL params to avoid CORS issues
        const params = new URLSearchParams({
            action: action,
            id: data.id,
            email: data.email,
            name: data.profileName,
            phone: data.phone || '',
            pin: data.pin || '',
            dueDate: data.dueDate,
            notes: data.notes || '',
            profileType: data.profileType,
            slotNumber: data.slotNumber || '',
            isSlotOwner: data.isSlotOwner || 'true',
            price: data.price
        });

        const response = await fetch(`${ADMIN_CONFIG.API_URL}?${params.toString()}`);
        const result = await response.json();

        if (result.success) {
            showToast(isEditing ? 'Member berhasil diupdate!' : 'Member berhasil ditambahkan!');
            closeModal();
            loadSubscriptions();
        } else {
            throw new Error(result.error || 'Gagal menyimpan data');
        }
    } catch (error) {
        console.error('Submit error:', error);
        showToast('Gagal menyimpan data: ' + error.message, true);
    } finally {
        adminElements.submitBtn.disabled = false;
        adminElements.submitText.style.display = 'block';
        adminElements.submitSpinner.style.display = 'none';
    }
}

async function deleteMember(id) {
    showConfirm(id);
}

function showConfirm(id) {
    const overlay = document.getElementById('confirm-overlay');
    const deleteBtn = document.getElementById('confirm-delete-btn');

    overlay.classList.add('show');

    deleteBtn.onclick = async function () {
        hideConfirm();
        await performDelete(id);
    };
}

function hideConfirm() {
    document.getElementById('confirm-overlay').classList.remove('show');
}

async function performDelete(id) {
    try {
        const response = await fetch(`${ADMIN_CONFIG.API_URL}?action=deleteSubscription&id=${id}`);
        const result = await response.json();

        if (result.success) {
            showToast('Member berhasil dihapus!');
            loadSubscriptions();
        } else {
            throw new Error(result.error || 'Gagal menghapus');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Gagal menghapus: ' + error.message, true);
    }
}

function showInfo(id) {
    const member = subscriptions.find(s => s.id === id);
    if (!member) return;

    const dueInfo = getDueInfo(member.dueDate);
    const isSharing = member.profileType === 'sharing';
    const price = member.price || (isSharing ? 25000 : 50000);
    const isOwner = member.isSlotOwner !== false && member.isSlotOwner !== 'false';

    // Find slot partner if sharing
    let slotPartnerHtml = '';
    let effectivePin = member.pin; // Default to own PIN logic

    if (isSharing) {
        const slotPartner = subscriptions.find(s =>
            s.email === member.email &&
            s.profileType === 'sharing' &&
            s.slotNumber === member.slotNumber &&
            s.id !== member.id
        );

        // If not owner, try to find owner's PIN
        if (!isOwner) {
            const owner = subscriptions.find(s =>
                s.email === member.email &&
                s.profileType === 'sharing' &&
                s.slotNumber === member.slotNumber &&
                (s.isSlotOwner !== false && s.isSlotOwner !== 'false')
            );
            if (owner && owner.pin) {
                effectivePin = owner.pin;
            }
        }

        if (slotPartner) {
            slotPartnerHtml = `
                <div class="mt-2 pt-2 border-t border-white/10">
                    <div class="text-[10px] text-netflix-gray uppercase tracking-wider mb-2">Partner Slot</div>
                    <div class="flex items-center justify-between py-2 border-b border-white/10">
                        <span class="text-[11px] text-netflix-gray">Nama</span>
                        <span class="text-sm text-white">${escapeHtml(slotPartner.profileName)}</span>
                    </div>
                </div>
            `;
        } else {
            slotPartnerHtml = `
                <div class="mt-2 pt-2 border-t border-white/10">
                    <div class="text-[10px] text-netflix-gray uppercase tracking-wider mb-2">Partner Slot</div>
                    <div class="flex items-center justify-between py-2 border-b border-white/10">
                        <span class="text-[11px] text-netflix-gray">Status</span>
                        <span class="text-[11px] text-green-400">Tersedia 1 slot</span>
                    </div>
                </div>
            `;
        }
    }

    const waMessage = getProfileDetailMessage(member, effectivePin);

    const infoContent = `
        <div class="space-y-3">
            <!-- Type & Price -->
            <div class="flex items-center justify-between py-2 border-b border-white/10">
                <span class="text-[11px] text-netflix-gray">Tipe</span>
                <span class="px-2 py-0.5 ${isSharing ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-500/20 text-purple-400'} text-[10px] font-bold rounded">${isSharing ? '👥 Sharing' : '👤 Private'}</span>
            </div>
            ${isSharing ? `
            <div class="flex items-center justify-between py-2 border-b border-white/10">
                <span class="text-[11px] text-netflix-gray">Slot</span>
                <span class="text-sm text-white">Slot ${member.slotNumber || 1}${isOwner ? ' (Owner)' : ''}</span>
            </div>
            ` : ''}
            <div class="flex items-center justify-between py-2 border-b border-white/10">
                <span class="text-[11px] text-netflix-gray">Harga</span>
                <span class="text-sm font-semibold text-green-400">${isSharing ? 'Rp25.000' : 'Rp50.000'}</span>
            </div>
            
            <!-- Account Info -->
            <div class="flex items-center justify-between py-2 border-b border-white/10">
                <span class="text-[11px] text-netflix-gray">Email</span>
                <span class="text-[11px] text-white truncate max-w-[180px]">${escapeHtml(member.email)}</span>
            </div>
            <div class="flex items-center justify-between py-2 border-b border-white/10">
                <span class="text-[11px] text-netflix-gray">Nama</span>
                <span class="text-sm text-white font-medium">${escapeHtml(member.profileName || '-')}</span>
            </div>
            <div class="flex items-center justify-between py-2 border-b border-white/10">
                <span class="text-[11px] text-netflix-gray">PIN</span>
                <span class="text-sm text-white font-mono">${escapeHtml(effectivePin || '-')}</span>
            </div>
            <div class="flex items-center justify-between py-2 border-b border-white/10">
                <span class="text-[11px] text-netflix-gray">Catatan</span>
                <span class="text-[11px] text-white/70 max-w-[180px] truncate">${escapeHtml(member.notes || '-')}</span>
            </div>
            
            ${slotPartnerHtml}
            
            <!-- Due Date -->
            <div class="flex items-center justify-between py-2 border-b border-white/10">
                <span class="text-[11px] text-netflix-gray">Jatuh Tempo</span>
                <span class="text-sm text-white">${formatDate(member.dueDate)}</span>
            </div>
            <div class="flex items-center justify-between py-2">
                <span class="text-[11px] text-netflix-gray">Status</span>
                <span class="px-2 py-0.5 ${dueInfo.class === 'due-overdue' || dueInfo.class === 'due-today' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'} text-[10px] rounded">${dueInfo.text || 'Dibayar'}</span>
            </div>
        </div>
        
        <a href="https://wa.me/?text=${waMessage}" target="_blank" class="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">
            <span class="material-symbols-outlined text-[18px]">share</span>
            Share ke WhatsApp
        </a>
    `;

    document.getElementById('info-modal-body').innerHTML = infoContent;
    document.getElementById('info-overlay').classList.add('show');
}

function hideInfo() {
    document.getElementById('info-overlay').classList.remove('show');
}

function getWhatsAppMessage(member) {
    return encodeURIComponent(
        `*BILLING REMINDER*\n\n` +
        `Halo Kak,\n` +
        `Masa aktif Netflix untuk profil *${member.profileName || '-'}* akan segera berakhir pada *${formatDate(member.dueDate)}*.\n\n` +
        `Mohon segera melakukan pembayaran untuk perpanjangan.`
    );
}

function getProfileDetailMessage(member, effectivePin) {
    // Format date specifically for this message: "6 Februari 2026"
    const dueDateObj = new Date(member.dueDate);
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const formattedDate = dueDateObj.toLocaleDateString('id-ID', options);

    return encodeURIComponent(
        `Halo Kak ${member.profileName || ''}, 👋\n` +
        `Berikut informasi akun Netflix yang baru saja Kakak order:\n\n` +
        `Email: ${member.email}\n` +
        `Password: ${netflixPassword}\n` +
        `PIN Profil: ${effectivePin || '-'}\n` +
        `Akun aktif hingga: ${formattedDate}\n\n` +
        `Jika nanti Kakak membutuhkan kode OTP atau ingin memperbarui pengaturan Household, Kakak bisa langsung mengakses server otomatis kami yang beroperasi 24 jam di:\n` +
        `https://harisdevlab.online/netflixhub/\n\n` +
        `Sistemnya berjalan otomatis, jadi bisa dipakai kapan pun saat dibutuhkan.\n\n` +
        `Terima kasih sudah percaya sama layanan kami, Kakak. Semoga akun Netflix-nya nyaman dipakai dan bebas hambatan. ✨`
    );
}

function shareWhatsApp(id) {
    const member = subscriptions.find(s => s.id === id);
    if (!member) return;

    const waMessage = getWhatsAppMessage(member);

    window.open(`https://wa.me/?text=${waMessage}`, '_blank');
}

async function markAsPaid(id) {
    if (!confirm('Tandai sudah bayar? Jatuh tempo akan ditambah 1 bulan.')) return;

    try {
        const response = await fetch(`${ADMIN_CONFIG.API_URL}?action=markAsPaid&id=${id}`);
        const result = await response.json();

        if (result.success) {
            showToast(`✅ Pembayaran dicatat! Jatuh tempo baru: ${formatDate(result.newDueDate)}`);
            loadSubscriptions();
        } else {
            throw new Error(result.error || 'Gagal menyimpan');
        }
    } catch (error) {
        console.error('Payment error:', error);
        showToast('Gagal menyimpan: ' + error.message, true);
    }
}

// ============================================
// Utility Functions
// ============================================

function generateId() {
    return 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, isError = false) {
    const toast = adminElements.toast;
    const toastMessage = adminElements.toastMessage;

    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;

    // Toggle error/success styling
    toast.classList.remove('bg-green-600', 'bg-red-600');
    toast.classList.add(isError ? 'bg-red-600' : 'bg-green-600');

    // Show toast
    toast.classList.remove('translate-y-24', 'opacity-0');

    setTimeout(() => {
        toast.classList.add('translate-y-24', 'opacity-0');
    }, 3000);
}

// ============================================
// Calendar Functions
// ============================================

function setView(view) {
    currentView = view;
    const listContainer = document.getElementById('subscriptions-container');
    const calendarContainer = document.getElementById('calendar-container');
    const listBtn = document.getElementById('list-view-btn');
    const calendarBtn = document.getElementById('calendar-view-btn');

    if (view === 'list') {
        listContainer.style.display = 'block';
        calendarContainer.style.display = 'none';
        listBtn.classList.add('active');
        calendarBtn.classList.remove('active');
    } else {
        listContainer.style.display = 'none';
        calendarContainer.style.display = 'block';
        listBtn.classList.remove('active');
        calendarBtn.classList.add('active');
        renderCalendar();
    }
}

function changeMonth(delta) {
    calendarDate.setMonth(calendarDate.getMonth() + delta);
    renderCalendar();
}

function renderCalendar() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    // Update header
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    document.getElementById('calendar-month-year').textContent = `${monthNames[month]} ${year}`;

    // Build due dates map
    const dueDatesMap = {};
    subscriptions.forEach(sub => {
        const dueDate = sub.dueDate;
        if (!dueDatesMap[dueDate]) {
            dueDatesMap[dueDate] = [];
        }
        dueDatesMap[dueDate].push(sub);
    });

    // Calculate calendar days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay(); // 0 = Sunday
    const totalDays = lastDay.getDate();

    // Build grid HTML
    let html = `
        <div class="calendar-day-header">Min</div>
        <div class="calendar-day-header">Sen</div>
        <div class="calendar-day-header">Sel</div>
        <div class="calendar-day-header">Rab</div>
        <div class="calendar-day-header">Kam</div>
        <div class="calendar-day-header">Jum</div>
        <div class="calendar-day-header">Sab</div>
    `;

    // Empty cells for padding
    for (let i = 0; i < startPadding; i++) {
        html += `<div class="calendar-day empty"></div>`;
    }

    // Day cells
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const currentDate = new Date(year, month, day);
        const isToday = currentDate.getTime() === today.getTime();
        const hasDue = dueDatesMap[dateStr];

        let classes = 'calendar-day';
        if (isToday) classes += ' today';
        if (hasDue) {
            // Check if soon (within 3 days from today)
            const diffDays = Math.ceil((currentDate - today) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays <= 3) {
                classes += ' has-due due-soon';
            } else if (diffDays < 0) {
                classes += ' has-due due-overdue';
            } else {
                classes += ' has-due';
            }
        }

        let tooltip = '';
        if (hasDue) {
            const names = hasDue.map(s => s.profileName).join(', ');
            tooltip = `title="${hasDue.length} jatuh tempo: ${names}"`;
        }

        html += `
            <div class="${classes}" ${tooltip} onclick="showDateDetails('${dateStr}')">
                <span class="day-number">${day}</span>
                ${hasDue ? `<span class="due-count">${hasDue.length}</span>` : ''}
            </div>
        `;
    }

    document.getElementById('calendar-grid').innerHTML = html;
}

function showDateDetails(dateStr) {
    // Find members due on this date
    const dueMembers = subscriptions.filter(sub => sub.dueDate === dateStr);

    // Use the existing info modal to show list
    const overlay = document.getElementById('info-overlay');
    const modalBody = document.getElementById('info-modal-body');
    const title = document.querySelector('#info-overlay h3');

    // Format date text
    const dateObj = new Date(dateStr);
    const dateText = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    title.textContent = `Jatuh Tempo: ${dateText}`;

    if (dueMembers.length === 0) {
        modalBody.innerHTML = `
            <div class="text-center py-6 text-netflix-gray">
                <p>Tidak ada member yang jatuh tempo pada tanggal ini.</p>
            </div>
        `;
    } else {
        const html = dueMembers.map(member => {
            const isSharing = member.profileType === 'sharing';
            const statusBadge = isSharing ?
                `<span class="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded">Sharing</span>` :
                `<span class="bg-purple-500/20 text-purple-400 text-[10px] px-1.5 py-0.5 rounded">Private</span>`;

            return `
                <div class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 mb-2 hover:bg-white/10 transition-colors cursor-pointer" onclick="editMember('${member.id}'); hideInfo()">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                            ${member.profileName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="text-sm font-semibold text-white">${escapeHtml(member.profileName)}</div>
                            <div class="flex items-center gap-2 mt-0.5">
                                ${statusBadge}
                                <span class="text-[10px] text-netflix-gray">${escapeHtml(member.email)}</span>
                            </div>
                        </div>
                    </div>
                    <span class="material-symbols-outlined text-netflix-gray text-lg">chevron_right</span>
                </div>
            `;
        }).join('');

        modalBody.innerHTML = `<div class="space-y-1">${html}</div>`;
    }

    overlay.classList.add('show');
}

function hideInfo() {
    const overlay = document.getElementById('info-overlay');
    overlay.classList.remove('show');
    // Reset title when closed
    setTimeout(() => {
        document.querySelector('#info-overlay h3').textContent = 'Detail Profil';
    }, 300);
}

// ============================================
// WhatsApp Reminder Functions (Fonnte API)
// ============================================

/**
 * Format nomor telepon ke format internasional
 */
function formatPhoneNumber(phone) {
    if (!phone) return null;
    // Hapus semua karakter non-digit
    let cleaned = phone.replace(/\D/g, '');
    // Jika dimulai dengan 0, ganti dengan 62
    if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
    }
    // Jika tidak dimulai dengan 62, tambahkan
    if (!cleaned.startsWith('62')) {
        cleaned = '62' + cleaned;
    }
    return cleaned;
}

/**
 * Buat pesan pengingat tagihan
 */
function createReminderMessage(member) {
    const dueDate = new Date(member.dueDate);
    const formattedDate = dueDate.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    let urgencyText = '';
    if (diffDays < 0) {
        urgencyText = `⚠️ *SUDAH LEWAT ${Math.abs(diffDays)} HARI!*`;
    } else if (diffDays === 0) {
        urgencyText = '⚠️ *JATUH TEMPO HARI INI!*';
    } else if (diffDays <= 3) {
        urgencyText = `⏰ *${diffDays} HARI LAGI!*`;
    } else {
        urgencyText = `📅 Jatuh tempo ${diffDays} hari lagi`;
    }

    return `Halo Kak *${member.profileName || 'Pelanggan'}* 👋

${urgencyText}

Ini pengingat bahwa langganan Netflix Anda akan berakhir pada:
📆 *${formattedDate}*

Mohon segera lakukan perpanjangan agar akun tetap aktif dan tidak terputus.

💳 Pembayaran bisa dilakukan melalui:
• Transfer Bank
• QRIS
• E-wallet (OVO, GoPay, Dana)

Jika sudah bayar, abaikan pesan ini.
Terima kasih! 🙏

_Netflix Access Hub_`;
}

/**
 * Kirim pesan WhatsApp via Backend (Google Apps Script)
 * Ini menghindari masalah CORS dengan memanggil backend
 */
async function sendWhatsAppReminder(member) {
    if (!member.phone) {
        console.log(`Skip reminder for ${member.profileName}: No phone number`);
        return { success: false, error: 'No phone number' };
    }

    try {
        // Panggil backend Google Apps Script untuk kirim WA
        const params = new URLSearchParams({
            action: 'sendWhatsAppReminder',
            phone: member.phone,
            name: member.profileName || 'Pelanggan',
            dueDate: member.dueDate
        });

        const response = await fetch(`${ADMIN_CONFIG.API_URL}?${params.toString()}`);
        const result = await response.json();

        console.log(`Reminder sent to ${member.profileName}:`, result);

        return { success: result.success, result };
    } catch (error) {
        console.error(`Failed to send reminder to ${member.profileName}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Dapatkan member yang perlu diingatkan
 */
function getMembersNeedingReminder() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return subscriptions.filter(member => {
        if (!member.phone) return false;

        const dueDate = new Date(member.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

        // STRICT RULE: Hanya kirim saat jatuh tempo (0), H+1 (-1) sampai H+5 (-5)
        // diffDays 0 = Hari Ini
        // diffDays -1 = Lewat 1 hari
        // ...
        // diffDays -5 = Lewat 5 hari
        // diffDays -6 = Lewat 6 hari (STOP)
        return diffDays <= 0 && diffDays >= -5;
    });
}

/**
 * Cek apakah pengingat sudah dikirim hari ini untuk member tertentu
 */
function hasReminderSentToday(memberId) {
    const key = `${FONNTE_CONFIG.AUTO_REMINDER.reminderKey}_${memberId}`;
    const lastSent = localStorage.getItem(key);

    if (!lastSent) return false;

    const lastSentDate = new Date(lastSent);
    const today = new Date();

    const isSameDay = lastSentDate.toDateString() === today.toDateString();

    // Debug log (can be removed later)
    if (isSameDay) {
        // console.log(`[Reminder Check] Already sent today for ${memberId}`);
    }

    return isSameDay;
}

/**
 * Tandai pengingat sudah dikirim
 */
function markReminderSent(memberId) {
    const key = `${FONNTE_CONFIG.AUTO_REMINDER.reminderKey}_${memberId}`;
    localStorage.setItem(key, new Date().toISOString());
}

/**
 * Kirim pengingat otomatis ke semua member yang perlu diingatkan
 */
async function sendAutoReminders() {
    if (!FONNTE_CONFIG.AUTO_REMINDER.enabled) {
        console.log('Auto reminder is disabled');
        return;
    }

    const membersToRemind = getMembersNeedingReminder();

    if (membersToRemind.length === 0) {
        console.log('No members need reminder today');
        return;
    }

    let sentCount = 0;
    let skipCount = 0;

    for (const member of membersToRemind) {
        // Skip jika sudah dikirim hari ini
        if (hasReminderSentToday(member.id)) {
            console.log(`Skip: Already sent reminder to ${member.profileName} today`);
            skipCount++;
            continue;
        }

        const result = await sendWhatsAppReminder(member);

        if (result.success) {
            markReminderSent(member.id);
            sentCount++;
        }

        // Delay 2 detik antar pesan untuk menghindari rate limit
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (sentCount > 0) {
        showToast(`✅ ${sentCount} pengingat tagihan terkirim via WhatsApp`);
    }

    console.log(`Auto reminder completed: ${sentCount} sent, ${skipCount} skipped`);
}

/**
 * Manual: Kirim pengingat ke member tertentu
 */
async function sendManualReminder(memberId) {
    const member = subscriptions.find(s => s.id === memberId);
    if (!member) {
        showToast('Member tidak ditemukan', true);
        return;
    }

    if (!member.phone) {
        showToast('Nomor WhatsApp belum diisi untuk member ini', true);
        return;
    }

    showToast('Mengirim pengingat...');

    const result = await sendWhatsAppReminder(member);

    if (result.success) {
        markReminderSent(member.id);
        showToast(`✅ Pengingat berhasil dikirim ke ${member.profileName}`);
    } else {
        showToast(`❌ Gagal mengirim: ${result.error}`, true);
    }
}

/**
 * Tampilkan modal pengingat dengan daftar member
 */
function showReminderModal() {
    const overlay = document.getElementById('reminder-modal-overlay');
    if (overlay) {
        overlay.classList.add('show');
        filterReminderList();
    }
}

function closeReminderModal() {
    const overlay = document.getElementById('reminder-modal-overlay');
    if (overlay) {
        overlay.classList.remove('show');
    }
}

function filterReminderList() {
    const filter = document.getElementById('reminder-filter-select').value;
    const listContainer = document.getElementById('reminder-list');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filteredMembers = subscriptions.filter(member => {
        const dueDate = new Date(member.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

        switch (filter) {
            case 'overdue':
                return diffDays < 0;
            case 'today':
                return diffDays === 0;
            case 'soon':
                return diffDays >= 0 && diffDays <= 3;
            case 'week':
                return diffDays >= 0 && diffDays <= 7;
            case 'all':
            default:
                return diffDays <= 7; // Semua yang <= 7 hari
        }
    });

    if (filteredMembers.length === 0) {
        listContainer.innerHTML = `
            <div class="reminder-empty">
                <p>✅ Tidak ada member yang perlu diingatkan</p>
            </div>
        `;
        return;
    }

    let html = '';
    filteredMembers.forEach(member => {
        const dueDate = new Date(member.dueDate);
        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        const hasSentToday = hasReminderSentToday(member.id);

        let statusClass = '';
        let statusText = '';

        if (diffDays < 0) {
            statusClass = 'overdue';
            statusText = `Lewat ${Math.abs(diffDays)} hari`;
        } else if (diffDays === 0) {
            statusClass = 'today';
            statusText = 'Hari ini!';
        } else {
            statusClass = 'soon';
            statusText = `${diffDays} hari lagi`;
        }

        const phoneDisplay = member.phone || 'Belum diisi';

        html += `
            <div class="reminder-item ${statusClass}">
                <div class="reminder-info">
                    <span class="reminder-name">${escapeHtml(member.profileName)}</span>
                    <span class="reminder-phone">${escapeHtml(phoneDisplay)}</span>
                    <span class="reminder-due ${statusClass}">${statusText}</span>
                </div>
                <div class="reminder-action">
                    ${hasSentToday ?
                '<span class="reminder-sent">✓ Terkirim</span>' :
                (member.phone ?
                    `<button class="reminder-send-btn" onclick="sendManualReminder('${member.id}')">
                                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                                Kirim
                            </button>` :
                    '<span class="no-phone">No HP?</span>'
                )
            }
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = html;
}

// ============================================
// Initialize
// ============================================

// Check if already logged in
if (sessionStorage.getItem(ADMIN_CONFIG.SESSION_KEY)) {
    showDashboard();
    loadSubscriptions().then(() => {
        // Jalankan auto reminder setelah data dimuat
        setTimeout(() => {
            sendAutoReminders();
        }, 2000);
    });
} else {
    showLogin();
}
