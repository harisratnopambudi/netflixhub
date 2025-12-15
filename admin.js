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
    memberProfiles: document.getElementById('member-profiles'),
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

    const html = `
        <div class="subscriptions-table">
            <div class="table-header">
                <div class="col-email">Email</div>
                <div class="col-profiles">Profil</div>
                <div class="col-due">Jatuh Tempo</div>
                <div class="col-actions">Aksi</div>
            </div>
            ${subscriptions.map(sub => createSubscriptionRow(sub)).join('')}
        </div>
    `;

    adminElements.subscriptionsContainer.innerHTML = html;
}

function createSubscriptionRow(sub) {
    const dueInfo = getDueInfo(sub.dueDate);
    const profiles = sub.profiles ? sub.profiles.split(',').map(p => p.trim()) : [];

    return `
        <div class="table-row">
            <div class="col-email">
                <span class="email-text">${escapeHtml(sub.email)}</span>
                ${sub.notes ? `<span class="notes-text">${escapeHtml(sub.notes)}</span>` : ''}
            </div>
            <div class="col-profiles">
                <div class="profiles-list">
                    ${profiles.map(p => `<span class="profile-badge">👤 ${escapeHtml(p)}</span>`).join('')}
                </div>
            </div>
            <div class="col-due">
                <span class="due-badge ${dueInfo.class}">${dueInfo.text}</span>
            </div>
            <div class="col-actions">
                <button class="action-btn edit-btn" onclick="editMember('${sub.id}')" title="Edit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="action-btn delete-btn" onclick="deleteMember('${sub.id}')" title="Hapus">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

function getDueInfo(dateString) {
    const due = new Date(dateString);
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
        return { text: formatDate(dateString), class: 'due-normal' };
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
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
    adminElements.memberProfiles.value = member.profiles || '';
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
        profiles: adminElements.memberProfiles.value,
        dueDate: adminElements.memberDue.value,
        notes: adminElements.memberNotes.value
    };

    // Show loading
    adminElements.submitBtn.disabled = true;
    adminElements.submitText.style.display = 'none';
    adminElements.submitSpinner.style.display = 'block';

    try {
        const action = isEditing ? 'updateSubscription' : 'addSubscription';
        const response = await fetch(`${ADMIN_CONFIG.API_URL}?action=${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
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
// Initialize
// ============================================

// Check if already logged in
if (sessionStorage.getItem(ADMIN_CONFIG.SESSION_KEY)) {
    showDashboard();
    loadSubscriptions();
} else {
    showLogin();
}
