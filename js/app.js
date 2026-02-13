/* ============================================
   APP.JS — Main Application Entry Point
   SPA Router, Event Wiring, Initialization
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
    // --- Initialize Database ---
    try {
        await DB.open();
    } catch (err) {
        console.error('DB init error:', err);
    }

    // --- Initialize Auth ---
    const savedUser = await Auth.init();
    if (savedUser) {
        showMainApp(savedUser);
    } else {
        showLogin();
    }

    // --- Login handler ---
    document.getElementById('btnLogin').addEventListener('click', async () => {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        if (!username || !password) {
            showLoginError('Username dan password tidak boleh kosong');
            return;
        }
        const result = await Auth.login(username, password);
        if (result.success) {
            showMainApp(result.user);
        } else {
            showLoginError(result.message);
        }
    });

    // Enter key on password field
    document.getElementById('loginPassword').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('btnLogin').click();
    });

    // --- Logout ---
    document.getElementById('btnLogout').addEventListener('click', () => {
        Auth.logout();
        showLogin();
    });

    // --- Navigation ---
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const pageId = tab.dataset.page;
            switchPage(pageId);
        });
    });

    // --- Weight Display from Scale ---
    window.addEventListener('scale-data', (e) => {
        const val = document.getElementById('weightValue');
        if (val) val.textContent = e.detail.weight.toFixed(1);
    });

    // --- Add Master Data modal ---
    document.querySelectorAll('.btn-add-master').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            document.getElementById('masterType').value = type;
            document.getElementById('masterValue').value = '';
            document.getElementById('masterModalTitle').textContent = 'Tambah ' + formatMasterType(type);
            Utils.openModal('modalMaster');
        });
    });

    document.getElementById('btnSaveMaster').addEventListener('click', async () => {
        const type = document.getElementById('masterType').value;
        const value = document.getElementById('masterValue').value.trim();
        if (!value) { Utils.showToast('Nilai tidak boleh kosong', 'warning'); return; }
        await DB.addMaster(type, value);
        Utils.showToast(`${formatMasterType(type)} "${value}" berhasil ditambahkan`, 'success');
        Utils.closeModal('modalMaster');
        // Refresh dropdowns
        if (type === 'shipment' || type === 'frame' || type === 'kodeProperty' || type === 'jenisSapi') {
            await Induksi.loadDropdowns();
        }
        if (type === 'pembeli') {
            await Penjualan.loadPembeliDropdown();
        }
    });

    document.getElementById('btnCloseMaster').addEventListener('click', () => Utils.closeModal('modalMaster'));

    // --- Serial Connection Buttons (Settings page) ---
    document.getElementById('btnConnectScanner').addEventListener('click', () => SerialManager.toggleScanner());
    document.getElementById('btnConnectScale').addEventListener('click', () => SerialManager.toggleScale());

    // --- Settings: Backup ---
    document.getElementById('btnExportBackup').addEventListener('click', () => Backup.exportAll());
    document.getElementById('btnImportBackup').addEventListener('click', () => document.getElementById('backupImportFile').click());
    document.getElementById('backupImportFile').addEventListener('change', (e) => {
        if (e.target.files[0]) Backup.importAll(e.target.files[0]);
        e.target.value = '';
    });

    // --- Settings: Supabase ---
    document.getElementById('btnSyncUpload').addEventListener('click', () => SupabaseSync.upload());
    document.getElementById('btnSyncDownload').addEventListener('click', () => SupabaseSync.download());
    document.getElementById('btnSupabaseSetup').addEventListener('click', () => {
        Utils.openModal('modalSupabase');
    });
    document.getElementById('btnSaveSupabase').addEventListener('click', async () => {
        const url = document.getElementById('supabaseUrl').value.trim();
        const key = document.getElementById('supabaseKey').value.trim();
        if (!url || !key) { Utils.showToast('URL dan Key tidak boleh kosong', 'warning'); return; }
        await SupabaseSync.saveConfig(url, key);
        Utils.showToast('Konfigurasi Supabase berhasil disimpan', 'success');
        Utils.closeModal('modalSupabase');
    });
    document.getElementById('btnCloseSupabase').addEventListener('click', () => Utils.closeModal('modalSupabase'));

    // --- Settings: User Management ---
    document.getElementById('btnOpenUserMgmt').addEventListener('click', () => {
        loadUserList();
        Utils.openModal('modalUserMgmt');
    });
    document.getElementById('btnCloseUserMgmt').addEventListener('click', () => Utils.closeModal('modalUserMgmt'));
    document.getElementById('btnAddUser').addEventListener('click', addNewUser);

    // --- Settings: Log ---
    document.getElementById('btnViewLog').addEventListener('click', async () => {
        const logs = await DB.getAll('sync_log');
        const tbody = document.getElementById('logTableBody');
        tbody.innerHTML = '';
        logs.reverse().slice(0, 100).forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${Utils.formatDate(log.timestamp)} ${new Date(log.timestamp).toLocaleTimeString('id-ID')}</td>
                <td>${log.action}</td>
                <td>${log.detail}</td>
            `;
            tbody.appendChild(tr);
        });
        Utils.openModal('modalLog');
    });
    document.getElementById('btnCloseLog').addEventListener('click', () => Utils.closeModal('modalLog'));

    // --- Print Settings button in Penjualan ---
    const printSettingsBtn = document.getElementById('btnPrintSettings');
    if (printSettingsBtn) {
        printSettingsBtn.addEventListener('click', async () => {
            await Penjualan.loadPrintSettingsModal();
            Utils.openModal('modalPrintSettings');
        });
    }

    // --- Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('./service-worker.js');
            console.log('Service Worker registered');
        } catch (err) {
            console.warn('SW registration failed:', err);
        }
    }
});

// === Helper Functions ===

function showLogin() {
    document.getElementById('pageLogin').classList.remove('hidden');
    document.getElementById('pageMain').classList.add('hidden');
    document.getElementById('loginError').textContent = '';
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
}

async function showMainApp(user) {
    document.getElementById('pageLogin').classList.add('hidden');
    document.getElementById('pageMain').classList.remove('hidden');
    document.getElementById('headerUser').textContent = `👤 ${user.username} (${user.role})`;

    // Apply permissions to tabs
    applyPermissions(user);

    // Initialize modules
    try {
        await Induksi.init();
        await Induksi.refreshSummaryFilter();
        await Induksi.refreshTableFilter();
    } catch (e) { console.error('Induksi init error:', e); }

    try {
        await Reweight.init();
        await Reweight.refreshTableFilter();
    } catch (e) { console.error('Reweight init error:', e); }

    try {
        await Penjualan.init();
    } catch (e) { console.error('Penjualan init error:', e); }

    try {
        await SupabaseSync.initUI();
    } catch (e) { console.error('Supabase init error:', e); }

    // Show first allowed page
    const firstTab = document.querySelector('.nav-tab:not(.hidden)');
    if (firstTab) firstTab.click();
}

function applyPermissions(user) {
    const tabs = {
        'tabInduksi': 'induksi',
        'tabReweight': 'reweight',
        'tabPenjualan': 'penjualan',
        'tabSettings': 'settings'
    };
    Object.entries(tabs).forEach(([tabId, perm]) => {
        const tab = document.getElementById(tabId);
        if (Auth.hasPermission(perm)) {
            tab.classList.remove('hidden');
        } else {
            tab.classList.add('hidden');
        }
    });
}

function switchPage(pageId) {
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');

    const tab = document.querySelector(`.nav-tab[data-page="${pageId}"]`);
    if (tab) tab.classList.add('active');
}

function showLoginError(msg) {
    document.getElementById('loginError').textContent = msg;
}

function formatMasterType(type) {
    const map = {
        'shipment': 'Shipment',
        'frame': 'Frame',
        'kodeProperty': 'Kode Property',
        'jenisSapi': 'Jenis Sapi',
        'pembeli': 'Pembeli'
    };
    return map[type] || type;
}

// --- User Management ---
async function loadUserList() {
    const users = await Auth.getAllUsers();
    const tbody = document.getElementById('userListBody');
    tbody.innerHTML = '';
    users.forEach(u => {
        const perms = u.role === 'admin' ? 'Semua Akses' :
            Object.entries(u.permissions || {}).filter(([, v]) => v).map(([k]) => formatMasterType(k)).join(', ') || 'Tidak ada';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.username}</td>
            <td>${u.role}</td>
            <td>${perms}</td>
            <td>
                ${u.username !== 'Sidiq23' ? `<button class="btn btn-sm btn-danger" onclick="deleteUser('${u.username}')">🗑️</button>` : '<span class="text-muted">Protected</span>'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function addNewUser() {
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value.trim();
    const role = document.getElementById('newRole').value;
    if (!username || !password) { Utils.showToast('Username dan password tidak boleh kosong', 'warning'); return; }

    const permissions = {
        induksi: document.getElementById('permInduksi').checked,
        reweight: document.getElementById('permReweight').checked,
        penjualan: document.getElementById('permPenjualan').checked,
        settings: document.getElementById('permSettings').checked
    };

    const result = await Auth.addUser(username, password, role, permissions);
    if (result.success) {
        Utils.showToast(`User "${username}" berhasil ditambahkan`, 'success');
        document.getElementById('newUsername').value = '';
        document.getElementById('newPassword').value = '';
        loadUserList();
    } else {
        Utils.showToast(result.message, 'error');
    }
}

async function deleteUser(username) {
    if (!confirm(`Hapus user "${username}"?`)) return;
    const result = await Auth.deleteUser(username);
    if (result.success) {
        Utils.showToast(`User "${username}" berhasil dihapus`, 'success');
        loadUserList();
    } else {
        Utils.showToast(result.message, 'error');
    }
}
