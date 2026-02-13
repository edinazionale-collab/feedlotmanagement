/* ============================================
   DATABASE LAYER — IndexedDB
   ============================================ */
const DB = (() => {
    const DB_NAME = 'CattleManagementDB';
    const DB_VERSION = 2;
    let db = null;

    function open() {
        return new Promise((resolve, reject) => {
            if (db) { resolve(db); return; }
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const database = e.target.result;

                // Induksi store — keyed by RFID
                if (!database.objectStoreNames.contains('induksi')) {
                    const indStore = database.createObjectStore('induksi', { keyPath: 'rfid' });
                    indStore.createIndex('shipment', 'shipment', { unique: false });
                    indStore.createIndex('pen', 'pen', { unique: false });
                    indStore.createIndex('eartag', 'eartag', { unique: false });
                    indStore.createIndex('tanggal', 'tanggal', { unique: false });
                }

                // Reweight store — auto-increment (multiple reweights per RFID possible)
                if (!database.objectStoreNames.contains('reweight')) {
                    const rewStore = database.createObjectStore('reweight', { keyPath: 'id', autoIncrement: true });
                    rewStore.createIndex('rfid', 'rfid', { unique: false });
                    rewStore.createIndex('shipment', 'shipment', { unique: false });
                    rewStore.createIndex('penAwal', 'penAwal', { unique: false });
                    rewStore.createIndex('penAkhir', 'penAkhir', { unique: false });
                    rewStore.createIndex('tanggal', 'tanggal', { unique: false });
                }

                // Penjualan store
                if (!database.objectStoreNames.contains('penjualan')) {
                    const penjStore = database.createObjectStore('penjualan', { keyPath: 'id', autoIncrement: true });
                    penjStore.createIndex('rfid', 'rfid', { unique: false });
                    penjStore.createIndex('pembeli', 'pembeli', { unique: false });
                    penjStore.createIndex('tanggalJual', 'tanggalJual', { unique: false });
                }

                // Master data (shipment, frame, kodeProperty, jenisSapi, pembeli)
                if (!database.objectStoreNames.contains('master_data')) {
                    const masterStore = database.createObjectStore('master_data', { keyPath: ['type', 'value'] });
                    masterStore.createIndex('type', 'type', { unique: false });
                }

                // Users
                if (!database.objectStoreNames.contains('users')) {
                    database.createObjectStore('users', { keyPath: 'username' });
                }

                // Settings (key-value)
                if (!database.objectStoreNames.contains('settings')) {
                    database.createObjectStore('settings', { keyPath: 'key' });
                }

                // Sync log
                if (!database.objectStoreNames.contains('sync_log')) {
                    const syncStore = database.createObjectStore('sync_log', { keyPath: 'id', autoIncrement: true });
                    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            request.onsuccess = (e) => {
                db = e.target.result;
                resolve(db);
            };

            request.onerror = (e) => reject(e.target.error);
        });
    }

    // --- Generic CRUD ---
    async function add(storeName, data) {
        const database = await open();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(data); // put = add or update
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function get(storeName, key) {
        const database = await open();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function getAll(storeName) {
        const database = await open();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function getAllByIndex(storeName, indexName, value) {
        const database = await open();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const req = index.getAll(value);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function update(storeName, data) {
        return add(storeName, data); // put handles both
    }

    async function remove(storeName, key) {
        const database = await open();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async function clear(storeName) {
        const database = await open();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    // --- Master Data helpers ---
    async function getMasterByType(type) {
        const all = await getAllByIndex('master_data', 'type', type);
        return all.map(item => item.value).sort();
    }

    async function addMaster(type, value) {
        return add('master_data', { type, value });
    }

    // --- Full Export/Import for backup ---
    async function exportAll() {
        const stores = ['induksi', 'reweight', 'penjualan', 'master_data', 'users', 'settings', 'sync_log'];
        const data = {};
        for (const store of stores) {
            data[store] = await getAll(store);
        }
        data._exportDate = new Date().toISOString();
        data._version = DB_VERSION;
        return data;
    }

    async function importAll(data) {
        const stores = ['induksi', 'reweight', 'penjualan', 'master_data', 'users', 'settings', 'sync_log'];
        for (const store of stores) {
            if (data[store]) {
                await clear(store);
                for (const item of data[store]) {
                    await add(store, item);
                }
            }
        }
    }

    // --- Log helpers ---
    async function addLog(action, detail) {
        return add('sync_log', {
            timestamp: new Date().toISOString(),
            action,
            detail
        });
    }

    // --- Get sold RFIDs (for filtering) ---
    async function getSoldRfids() {
        const penjualan = await getAll('penjualan');
        return new Set(penjualan.map(p => p.rfid));
    }

    return {
        open, add, get, getAll, getAllByIndex, update, remove, clear,
        getMasterByType, addMaster,
        exportAll, importAll, addLog, getSoldRfids
    };
})();
