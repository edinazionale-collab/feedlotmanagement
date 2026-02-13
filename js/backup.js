/* ============================================
   BACKUP MODULE — Full JSON Export/Import
   For computer migration
   ============================================ */
const Backup = (() => {

    async function exportAll() {
        try {
            Utils.showToast('Memproses export...', 'info');
            const data = await DB.exportAll();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const filename = `feedlot_backup_${Utils.todayStr()}.json`;
            Utils.downloadFile(blob, filename);
            Utils.showToast('Backup berhasil di-export!', 'success');
            DB.addLog('Backup', `Exported all data to ${filename}`);
        } catch (err) {
            console.error('Backup export error:', err);
            Utils.showToast('Gagal export backup: ' + err.message, 'error');
        }
    }

    async function importAll(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!data._version) {
                Utils.showToast('File backup tidak valid', 'error');
                return;
            }
            if (!confirm('Import akan MENGGANTI semua data lokal. Lanjutkan?')) return;
            Utils.showToast('Memproses import...', 'info');
            await DB.importAll(data);
            Utils.showToast('Data berhasil di-import! Halaman akan di-refresh.', 'success');
            DB.addLog('Backup', `Imported backup from ${file.name}`);
            setTimeout(() => location.reload(), 1500);
        } catch (err) {
            console.error('Backup import error:', err);
            Utils.showToast('Gagal import backup: ' + err.message, 'error');
        }
    }

    return { exportAll, importAll };
})();
