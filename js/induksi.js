/* ============================================
   INDUKSI MODULE — Induction Data Entry
   ============================================ */
const Induksi = (() => {
    const TEMPLATE_HEADERS = ['Shipment', 'RFID', 'Tanggal', 'Eartag', 'Berat', 'PEN', 'Gigi', 'Frame', 'KodeProperty', 'Vitamin', 'JenisSapi'];

    // --- Initialize ---
    async function init() {
        document.getElementById('indTanggal').value = Utils.todayStr();
        await loadDropdowns();
        await refreshTable();
        await refreshSummary();
        bindEvents();
    }

    // --- Load dropdown options from master_data ---
    async function loadDropdowns() {
        await loadSelect('indShipment', 'shipment');
        await loadSelect('indFrame', 'frame');
        await loadSelect('indKodeProperty', 'kodeProperty');
        await loadSelect('indJenisSapi', 'jenisSapi');
    }

    async function loadSelect(selectId, type) {
        const select = document.getElementById(selectId);
        const current = select.value;
        const items = await DB.getMasterByType(type);
        select.innerHTML = '<option value="">-- Pilih --</option>';
        items.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            select.appendChild(opt);
        });
        if (current) select.value = current;
    }

    // --- Bind events ---
    function bindEvents() {
        // Input button
        document.getElementById('btnInduksiInput').addEventListener('click', saveData);
        document.getElementById('btnInduksiClear').addEventListener('click', clearForm);

        // Table actions
        document.getElementById('btnIndDeleteSelected').addEventListener('click', deleteSelected);
        document.getElementById('btnIndExportExcel').addEventListener('click', exportExcel);
        document.getElementById('btnIndImportExcel').addEventListener('click', () => document.getElementById('indImportFile').click());
        document.getElementById('indImportFile').addEventListener('change', importExcel);
        document.getElementById('btnIndDownloadTemplate').addEventListener('click', downloadTemplate);

        // Check all
        document.getElementById('indCheckAll').addEventListener('change', (e) => {
            document.querySelectorAll('#indTableBody input[type="checkbox"]').forEach(cb => cb.checked = e.target.checked);
        });

        // Table filter
        document.getElementById('indTableFilter').addEventListener('change', refreshTable);
        document.getElementById('indTableFilterPen').addEventListener('change', refreshTable);

        // Summary filter
        document.getElementById('indSummaryFilter').addEventListener('change', refreshSummary);
        document.getElementById('btnIndSummaryExport').addEventListener('click', exportSummary);

        // Scanner auto-fill
        window.addEventListener('scanner-data', (e) => {
            const activePage = document.querySelector('.page-section.active');
            if (activePage && activePage.id === 'pageInduksi') {
                document.getElementById('indRfid').value = e.detail.rfid;
                Utils.showToast('RFID: ' + e.detail.rfid, 'info');
            }
        });

        // Scale → capture weight
        window.addEventListener('scale-data', (e) => {
            const activePage = document.querySelector('.page-section.active');
            if (activePage && activePage.id === 'pageInduksi') {
                document.getElementById('indBerat').value = e.detail.weight.toFixed(1);
            }
        });
    }

    // --- Save Data ---
    async function saveData() {
        const rfid = document.getElementById('indRfid').value.trim();
        if (!rfid) { Utils.showToast('RFID tidak boleh kosong', 'warning'); return; }

        const data = {
            rfid,
            shipment: document.getElementById('indShipment').value,
            tanggal: document.getElementById('indTanggal').value,
            eartag: document.getElementById('indEartag').value.trim(),
            berat: parseFloat(document.getElementById('indBerat').value) || 0,
            pen: document.getElementById('indPen').value.trim(),
            gigi: document.getElementById('indGigi').value.trim(),
            frame: document.getElementById('indFrame').value,
            kodeProperty: document.getElementById('indKodeProperty').value,
            vitamin: parseInt(document.getElementById('indVitamin').value) || 1,
            jenisSapi: document.getElementById('indJenisSapi').value
        };

        try {
            await DB.add('induksi', data);
            Utils.showToast('Data induksi berhasil disimpan', 'success');
            DB.addLog('Induksi', `Saved RFID: ${rfid}`);
            clearForm();
            await refreshTable();
            await refreshSummary();
            await refreshSummaryFilter();
            await refreshTableFilter();
        } catch (err) {
            console.error('Save induksi error:', err);
            Utils.showToast('Gagal menyimpan: ' + err.message, 'error');
        }
    }

    // --- Clear form ---
    function clearForm() {
        document.getElementById('indRfid').value = '';
        document.getElementById('indEartag').value = '';
        document.getElementById('indBerat').value = '';
        document.getElementById('indPen').value = '';
        document.getElementById('indGigi').value = '';
        document.getElementById('indVitamin').value = '1';
        document.getElementById('indTanggal').value = Utils.todayStr();
    }

    // --- Refresh Table (with shipment filter & sold filter & PEN filter) ---
    async function refreshTable() {
        const shipmentFilter = document.getElementById('indTableFilter').value;
        const penFilter = document.getElementById('indTableFilterPen').value;
        let data = await DB.getAll('induksi');

        // Filter out sold cattle
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));

        // Filter by shipment
        if (shipmentFilter) {
            data = data.filter(d => d.shipment === shipmentFilter);
        }
        if (penFilter) {
            data = data.filter(d => (d.pen || '') === penFilter);
        }

        const tbody = document.getElementById('indTableBody');
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="14" class="text-center text-muted">Belum ada data</td></tr>';
            return;
        }
        data.forEach((item, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="checkbox-col"><input type="checkbox" data-rfid="${item.rfid}"></td>
                <td>${i + 1}</td>
                <td>${item.shipment || '-'}</td>
                <td>${item.rfid}</td>
                <td>${Utils.formatDate(item.tanggal)}</td>
                <td>${item.eartag || '-'}</td>
                <td>${Utils.formatNumber(item.berat)}</td>
                <td>
                    <span class="editable-pen" data-rfid="${item.rfid}" data-field="pen" title="Klik untuk edit PEN">${item.pen || '-'}</span>
                </td>
                <td>${item.gigi || '-'}</td>
                <td>${item.frame || '-'}</td>
                <td>${item.kodeProperty || '-'}</td>
                <td>${item.vitamin}</td>
                <td>${item.jenisSapi || '-'}</td>
            `;
            tbody.appendChild(tr);
        });

        // Bind editable pen click events using event delegation
        const tbody2 = document.getElementById('indTableBody');
        tbody2.onclick = function (e) {
            const span = e.target.closest('.editable-pen');
            if (span) handleEditPen(span);
        };
    }

    // --- Edit PEN inline (for changing temp pen to fixed pen) ---
    async function handleEditPen(span) {
        try {
            const rfid = span.dataset.rfid;
            if (!rfid) { console.warn('No rfid found on editable-pen span'); return; }
            const currentVal = span.textContent.trim() === '-' ? '' : span.textContent.trim();
            const newVal = prompt('Ubah PEN (dari pen sementara ke pen fix):', currentVal);
            if (newVal === null) return; // cancelled
            const record = await DB.get('induksi', rfid);
            if (record) {
                record.pen = newVal.trim();
                await DB.update('induksi', record);
                Utils.showToast('PEN berhasil diubah', 'success');
                DB.addLog('Induksi', `PEN updated for RFID: ${rfid} → ${newVal.trim()}`);
                await refreshTable();
                await refreshSummary();
                await refreshTableFilter();
            } else {
                Utils.showToast('Data RFID tidak ditemukan di database', 'error');
            }
        } catch (err) {
            console.error('Edit PEN error:', err);
            Utils.showToast('Gagal mengubah PEN: ' + err.message, 'error');
        }
    }

    // --- Delete selected ---
    async function deleteSelected() {
        const checked = document.querySelectorAll('#indTableBody input[type="checkbox"]:checked');
        if (checked.length === 0) { Utils.showToast('Pilih data yang ingin dihapus', 'warning'); return; }
        if (!confirm(`Hapus ${checked.length} data?`)) return;
        for (const cb of checked) {
            await DB.remove('induksi', cb.dataset.rfid);
        }
        Utils.showToast(`${checked.length} data berhasil dihapus`, 'success');
        document.getElementById('indCheckAll').checked = false;
        await refreshTable();
        await refreshSummary();
        await refreshTableFilter();
    }

    // --- Export Excel ---
    async function exportExcel() {
        const shipmentFilter = document.getElementById('indTableFilter').value;
        let data = await DB.getAll('induksi');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipmentFilter) data = data.filter(d => d.shipment === shipmentFilter);

        const exportData = data.map(d => ({
            Shipment: d.shipment,
            RFID: d.rfid,
            Tanggal: d.tanggal,
            Eartag: d.eartag,
            'Berat (Kg)': d.berat,
            PEN: d.pen,
            Gigi: d.gigi,
            Frame: d.frame,
            'Kode Property': d.kodeProperty,
            Vitamin: d.vitamin,
            'Jenis Sapi': d.jenisSapi
        }));
        Utils.exportToExcel(exportData, `induksi_${Utils.todayStr()}.xlsx`, 'Induksi');
    }

    // --- Import Excel ---
    async function importExcel(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const rows = await Utils.readExcel(file);
            let count = 0;
            for (const row of rows) {
                const data = {
                    rfid: String(row.RFID || row.rfid || '').trim(),
                    shipment: String(row.Shipment || row.shipment || ''),
                    tanggal: String(row.Tanggal || row.tanggal || Utils.todayStr()),
                    eartag: String(row.Eartag || row.eartag || ''),
                    berat: parseFloat(row.Berat || row.berat || row['Berat (Kg)'] || 0),
                    pen: String(row.PEN || row.pen || ''),
                    gigi: String(row.Gigi || row.gigi || ''),
                    frame: String(row.Frame || row.frame || ''),
                    kodeProperty: String(row.KodeProperty || row.kodeProperty || row['Kode Property'] || ''),
                    vitamin: parseInt(row.Vitamin || row.vitamin || 1),
                    jenisSapi: String(row.JenisSapi || row.jenisSapi || row['Jenis Sapi'] || '')
                };
                if (data.rfid) {
                    await DB.add('induksi', data);
                    count++;
                }
            }
            Utils.showToast(`${count} data berhasil di-import`, 'success');
            await refreshTable();
            await refreshSummary();
            await refreshTableFilter();
        } catch (err) {
            console.error('Import error:', err);
            Utils.showToast('Gagal import: ' + err.message, 'error');
        }
        e.target.value = '';
    }

    // --- Download Template ---
    function downloadTemplate() {
        Utils.downloadTemplate(TEMPLATE_HEADERS, 'template_induksi.xlsx');
    }

    // --- Summary ---
    async function refreshSummary() {
        const shipmentFilter = document.getElementById('indSummaryFilter').value;
        let data = await DB.getAll('induksi');

        // Filter out sold cattle
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));

        if (shipmentFilter) {
            data = data.filter(d => d.shipment === shipmentFilter);
        }

        // Group by PEN
        const groups = {};
        data.forEach(d => {
            const p = d.pen || 'TANPA PEN';
            if (!groups[p]) groups[p] = { items: [], totalBerat: 0, jenisSapi: new Set(), frame: new Set() };
            groups[p].items.push(d);
            groups[p].totalBerat += d.berat || 0;
            if (d.jenisSapi) groups[p].jenisSapi.add(d.jenisSapi);
            if (d.frame) groups[p].frame.add(d.frame);
        });

        const tbody = document.getElementById('indSummaryBody');
        tbody.innerHTML = '';
        const pens = Object.keys(groups).sort();
        if (pens.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada data</td></tr>';
            return;
        }
        pens.forEach(pen => {
            const g = groups[pen];
            const count = g.items.length;
            const avg = count > 0 ? (g.totalBerat / count).toFixed(1) : 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${pen}</td>
                <td>${count}</td>
                <td>${Utils.formatNumber(g.totalBerat)}</td>
                <td>${Utils.formatNumber(avg)}</td>
                <td>${[...g.jenisSapi].join(', ') || '-'}</td>
                <td>${[...g.frame].join(', ') || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- Refresh summary filter dropdown ---
    async function refreshSummaryFilter() {
        const data = await DB.getAll('induksi');
        const shipments = [...new Set(data.map(d => d.shipment).filter(Boolean))].sort();
        const select = document.getElementById('indSummaryFilter');
        const current = select.value;
        select.innerHTML = '<option value="">Semua Shipment</option>';
        shipments.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            select.appendChild(opt);
        });
        if (current) select.value = current;
    }

    // --- Refresh table filter dropdown ---
    async function refreshTableFilter() {
        const data = await DB.getAll('induksi');

        // Shipment Filter
        const shipments = [...new Set(data.map(d => d.shipment).filter(Boolean))].sort();
        const selectCtx = document.getElementById('indTableFilter');
        const currentCtx = selectCtx.value;
        selectCtx.innerHTML = '<option value="">Semua Shipment</option>';
        shipments.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            selectCtx.appendChild(opt);
        });
        if (currentCtx) selectCtx.value = currentCtx;

        // PEN Filter
        const pens = [...new Set(data.map(d => d.pen).filter(Boolean))].sort();
        const selectPen = document.getElementById('indTableFilterPen');
        const currentPen = selectPen.value;
        selectPen.innerHTML = '<option value="">Semua PEN</option>';
        pens.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p;
            selectPen.appendChild(opt);
        });
        if (currentPen) selectPen.value = currentPen;
    }

    // --- Export Summary ---
    async function exportSummary() {
        const shipmentFilter = document.getElementById('indSummaryFilter').value;
        let data = await DB.getAll('induksi');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipmentFilter) data = data.filter(d => d.shipment === shipmentFilter);

        const groups = {};
        data.forEach(d => {
            const p = d.pen || 'TANPA PEN';
            if (!groups[p]) groups[p] = { count: 0, totalBerat: 0, jenisSapi: new Set(), frame: new Set() };
            groups[p].count++;
            groups[p].totalBerat += d.berat || 0;
            if (d.jenisSapi) groups[p].jenisSapi.add(d.jenisSapi);
            if (d.frame) groups[p].frame.add(d.frame);
        });

        const exportData = Object.keys(groups).sort().map(pen => ({
            PEN: pen,
            'Jumlah Sapi': groups[pen].count,
            'Total Berat (Kg)': groups[pen].totalBerat.toFixed(1),
            'Avg Berat (Kg)': (groups[pen].totalBerat / groups[pen].count).toFixed(1),
            'Jenis Sapi': [...groups[pen].jenisSapi].join(', '),
            Frame: [...groups[pen].frame].join(', ')
        }));
        Utils.exportToExcel(exportData, `summary_induksi_${Utils.todayStr()}.xlsx`, 'Summary');
    }

    return { init, loadDropdowns, refreshTable, refreshSummary, refreshSummaryFilter, refreshTableFilter };
})();
