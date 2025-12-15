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
    memberEmail: document.getElementById('member-email'),
    memberName: document.getElementById('member-name'),
    memberDue: document.getElementById('member-due'),
    memberNotes: document.getElementById('member-notes'),
    submitBtn: document.getElementById('submit-btn'),
    submitText: document.getElementById('submit-text'),
    submitSpinner: document.getElementById('submit-spinner'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message')
};

// ============================================
// State
// ============================================
let subscriptions = [];
let isEditing = false;
let currentView = 'list';
let calendarDate = new Date();

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
}

// ============================================
// Subscriptions CRUD
// ============================================

async function loadSubscriptions() {
    adminElements.subscriptionsContainer.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Memuat data...</p>
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
            <div class="empty-state">
                <p>⚠️ Gagal memuat data. <a href="#" onclick="loadSubscriptions()">Coba lagi</a></p>
            </div>
        `;
    }
}

function renderSubscriptions() {
    if (subscriptions.length === 0) {
        adminElements.subscriptionsContainer.innerHTML = `
            <div class="empty-state">
                <p>Belum ada data member. Klik "Tambah Member" untuk menambahkan.</p>
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

    // Render grouped view
    let html = '';
    Object.keys(grouped).forEach(email => {
        const profiles = grouped[email];
        html += `
            <div class="email-group">
                <div class="email-group-header">
                    <span class="email-icon">📧</span>
                    <span class="email-title">${escapeHtml(email)}</span>
                    <span class="profile-count">${profiles.length} slot</span>
                </div>
                <div class="email-group-content">
                    <div class="member-row header">
                        <div>Nama Profil</div>
                        <div>Jatuh Tempo</div>
                        <div>Status</div>
                        <div>Aksi</div>
                    </div>
                    ${profiles.map(sub => createSubscriptionRow(sub)).join('')}
                </div>
            </div>
        `;
    });

    adminElements.subscriptionsContainer.innerHTML = html;
}

function createSubscriptionRow(sub) {
    const dueInfo = getDueInfo(sub.dueDate);
    const isPastDue = dueInfo.class === 'due-overdue' || dueInfo.class === 'due-today';

    return `
        <div class="member-row ${isPastDue ? 'needs-payment' : ''}">
            <div class="member-name">👤 ${escapeHtml(sub.profileName)}</div>
            <div class="member-date">${formatDate(sub.dueDate)}</div>
            <div class="member-status ${dueInfo.class}">${dueInfo.text}</div>
            <div class="member-actions">
                <button class="action-btn" onclick="editMember('${sub.id}')" title="Edit">✏️</button>
                <button class="action-btn" onclick="deleteMember('${sub.id}')" title="Hapus">🗑️</button>
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
        return { text: `⚠️ Lewat ${Math.abs(diffDays)} hari`, class: 'due-overdue' };
    } else if (diffDays === 0) {
        return { text: '🔴 Hari ini!', class: 'due-today' };
    } else if (diffDays <= 3) {
        return { text: `🟡 ${diffDays} hari lagi`, class: 'due-soon' };
    } else if (diffDays <= 7) {
        return { text: `🟢 ${diffDays} hari lagi`, class: 'due-normal' };
    } else {
        return { text: `🟢 ${diffDays} hari lagi`, class: 'due-normal' };
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
    adminElements.memberDue.value = getDefaultDueDate();
    adminElements.modalOverlay.classList.add('show');
}

function editMember(id) {
    const member = subscriptions.find(s => s.id === id);
    if (!member) return;

    isEditing = true;
    adminElements.modalTitle.textContent = 'Edit Member';
    adminElements.memberId.value = member.id;
    adminElements.memberEmail.value = member.email;
    adminElements.memberName.value = member.profileName || '';
    adminElements.memberDue.value = member.dueDate;
    adminElements.memberNotes.value = member.notes || '';
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

    const data = {
        id: adminElements.memberId.value || generateId(),
        email: adminElements.memberEmail.value,
        profileName: adminElements.memberName.value,
        dueDate: adminElements.memberDue.value,
        notes: adminElements.memberNotes.value
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
            dueDate: data.dueDate,
            notes: data.notes || ''
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
    if (!confirm('Yakin ingin menghapus member ini?')) return;

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
    adminElements.toastMessage.textContent = message;
    adminElements.toast.classList.remove('error');
    if (isError) {
        adminElements.toast.classList.add('error');
    }
    adminElements.toast.classList.add('show');
    setTimeout(() => {
        adminElements.toast.classList.remove('show');
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
            const names = hasDue.map(s => `${s.profileName} (${s.customerName})`).join(', ');
            tooltip = `title="${hasDue.length} jatuh tempo: ${names}"`;
        }

        html += `
            <div class="${classes}" ${tooltip}>
                <span class="day-number">${day}</span>
                ${hasDue ? `<span class="due-count">${hasDue.length}</span>` : ''}
            </div>
        `;
    }

    document.getElementById('calendar-grid').innerHTML = html;
}

// ============================================
// Initialize
// ============================================

// Check if already logged in
if (sessionStorage.getItem(ADMIN_CONFIG.SESSION_KEY)) {
    showDashboard();
    loadSubscriptions();
} else {
    showLogin();
}
