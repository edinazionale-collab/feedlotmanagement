/* ============================================
   UTILITY FUNCTIONS
   ============================================ */
const Utils = (() => {

    // --- Date Helpers ---
    function todayStr() {
        return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function calculateDOF(startDate, endDate) {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diff = Math.floor((end - start) / (1000 * 60 * 60 * 24));
        return Math.max(diff, 0);
    }

    function calculateADG(weightStart, weightEnd, dof) {
        if (!dof || dof <= 0) return 0;
        const w1 = parseFloat(weightStart) || 0;
        const w2 = parseFloat(weightEnd) || 0;
        return parseFloat(((w2 - w1) / dof).toFixed(2));
    }

    // --- Number Helpers ---
    function formatNumber(num, decimals = 1) {
        const n = parseFloat(num);
        if (isNaN(n)) return '0';
        return n.toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    // --- Toast Notifications ---
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => { if (toast.parentElement) toast.remove(); }, 3000);
    }

    // --- Modal Helpers ---
    function openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    function closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    // --- File Download Helper ---
    function downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // --- Excel Helpers (SheetJS) ---
    function exportToExcel(data, filename, sheetName = 'Data') {
        if (!data || data.length === 0) {
            showToast('Tidak ada data untuk di-export', 'warning');
            return;
        }
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadFile(blob, filename);
        showToast(`Data berhasil di-export: ${filename}`, 'success');
    }

    function downloadTemplate(headers, filename) {
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadFile(blob, filename);
        showToast('Template berhasil di-download', 'success');
    }

    function readExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                    resolve(jsonData);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    return {
        todayStr, formatDate, calculateDOF, calculateADG,
        formatNumber, generateId,
        showToast, openModal, closeModal,
        downloadFile, exportToExcel, downloadTemplate, readExcel
    };
})();
