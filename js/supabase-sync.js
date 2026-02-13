/* ============================================
   SUPABASE SYNC MODULE
   Upload/Download data to/from Supabase
   Uses REST API via fetch() — no SDK needed
   ============================================ */
const SupabaseSync = (() => {
    const TABLES = ['induksi', 'reweight', 'penjualan', 'master_data', 'users', 'settings'];

    function getConfig() {
        // Try runtime config from settings DB first, then config.js
        const url = window._supabaseUrl || (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL);
        const key = window._supabaseKey || (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_ANON_KEY);
        if (!url || !key) return null;
        return { url, key };
    }

    function isConfigured() {
        return getConfig() !== null;
    }

    // --- REST helpers ---
    async function supabaseRequest(config, table, method = 'GET', body = null) {
        const url = `${config.url}/rest/v1/${table}`;
        const headers = {
            'apikey': config.key,
            'Authorization': `Bearer ${config.key}`,
            'Content-Type': 'application/json',
            'Prefer': method === 'POST' ? 'resolution=merge-duplicates' : ''
        };
        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);
        const resp = await fetch(url, options);
        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Supabase ${method} ${table}: ${resp.status} ${text}`);
        }
        if (method === 'GET') return resp.json();
        return null;
    }

    // --- Upload all local data to Supabase ---
    async function upload() {
        const config = getConfig();
        if (!config) {
            Utils.showToast('Supabase belum dikonfigurasi', 'warning');
            return;
        }
        try {
            Utils.showToast('Uploading data ke Supabase...', 'info');
            for (const table of TABLES) {
                const localData = await DB.getAll(table);
                if (localData.length > 0) {
                    // Upsert in batches of 100
                    for (let i = 0; i < localData.length; i += 100) {
                        const batch = localData.slice(i, i + 100);
                        await supabaseRequest(config, table, 'POST', batch);
                    }
                }
            }
            const now = new Date().toISOString();
            await DB.add('settings', { key: 'lastSyncUpload', value: now });
            updateSyncUI(now);
            Utils.showToast('Upload ke Supabase berhasil!', 'success');
            DB.addLog('Sync', 'Upload to Supabase completed');
        } catch (err) {
            console.error('Sync upload error:', err);
            Utils.showToast('Gagal upload: ' + err.message, 'error');
        }
    }

    // --- Download all data from Supabase ---
    async function download() {
        const config = getConfig();
        if (!config) {
            Utils.showToast('Supabase belum dikonfigurasi', 'warning');
            return;
        }
        if (!confirm('Download akan MENGGANTI data lokal dengan data dari server. Lanjutkan?')) return;
        try {
            Utils.showToast('Downloading data dari Supabase...', 'info');
            for (const table of TABLES) {
                const remoteData = await supabaseRequest(config, table, 'GET');
                if (remoteData && remoteData.length > 0) {
                    await DB.clear(table);
                    for (const item of remoteData) {
                        await DB.add(table, item);
                    }
                }
            }
            const now = new Date().toISOString();
            await DB.add('settings', { key: 'lastSyncDownload', value: now });
            updateSyncUI(now);
            Utils.showToast('Download dari Supabase berhasil! Halaman akan di-refresh.', 'success');
            DB.addLog('Sync', 'Download from Supabase completed');
            setTimeout(() => location.reload(), 1500);
        } catch (err) {
            console.error('Sync download error:', err);
            Utils.showToast('Gagal download: ' + err.message, 'error');
        }
    }

    // --- Save Supabase config to settings ---
    async function saveConfig(url, key) {
        window._supabaseUrl = url;
        window._supabaseKey = key;
        await DB.add('settings', { key: 'supabaseUrl', value: url });
        await DB.add('settings', { key: 'supabaseKey', value: key });
        DB.addLog('Sync', 'Supabase config updated');
        updateStatus();
    }

    // --- Load saved config on startup ---
    async function loadConfig() {
        const urlSetting = await DB.get('settings', 'supabaseUrl');
        const keySetting = await DB.get('settings', 'supabaseKey');
        if (urlSetting && keySetting) {
            window._supabaseUrl = urlSetting.value;
            window._supabaseKey = keySetting.value;
        }
    }

    // --- Update UI ---
    function updateStatus() {
        const el = document.getElementById('syncStatus');
        if (el) {
            el.textContent = isConfigured() ? '✅ Terkonfigurasi' : '❌ Tidak dikonfigurasi';
        }
    }

    function updateSyncUI(time) {
        const el = document.getElementById('syncLastTime');
        if (el && time) {
            el.textContent = Utils.formatDate(time) + ' ' + new Date(time).toLocaleTimeString('id-ID');
        }
    }

    async function initUI() {
        await loadConfig();
        updateStatus();
        // Load last sync time
        const lastUp = await DB.get('settings', 'lastSyncUpload');
        const lastDown = await DB.get('settings', 'lastSyncDownload');
        const latest = lastUp || lastDown;
        if (latest) updateSyncUI(latest.value);
    }

    return { upload, download, saveConfig, loadConfig, isConfigured, initUI };
})();
