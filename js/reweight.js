/* ============================================
   REWEIGHT MODULE — Reweight Data Entry
   ============================================ */
const Reweight = (() => {
    const TEMPLATE_HEADERS = ['RFID', 'Tanggal', 'BeratReweight', 'PenAwal', 'PenAkhir', 'Vitamin'];

    // --- Initialize ---
    async function init() {
        document.getElementById('rewTanggal').value = Utils.todayStr();
        await refreshTable();
        await refreshSummaryAwal();
        await refreshSummaryAkhir();
        bindEvents();
    }

    // --- Bind events ---
    function bindEvents() {
        document.getElementById('btnReweightInput').addEventListener('click', saveData);
        document.getElementById('btnReweightClear').addEventListener('click', clearForm);

        // Table
        document.getElementById('btnRewDeleteSelected').addEventListener('click', deleteSelected);
        document.getElementById('btnRewExportExcel').addEventListener('click', exportExcel);
        document.getElementById('btnRewImportExcel').addEventListener('click', () => document.getElementById('rewImportFile').click());
        document.getElementById('rewImportFile').addEventListener('change', importExcel);
        document.getElementById('btnRewDownloadTemplate').addEventListener('click', downloadTemplate);

        document.getElementById('rewCheckAll').addEventListener('change', (e) => {
            document.querySelectorAll('#rewTableBody input[type="checkbox"]').forEach(cb => cb.checked = e.target.checked);
        });

        // Table filter
        document.getElementById('rewTableFilter').addEventListener('change', refreshTable);
        document.getElementById('rewTableFilterPen').addEventListener('change', refreshTable);

        // Summary tabs
        document.getElementById('btnSummaryAwal').addEventListener('click', () => {
            document.getElementById('btnSummaryAwal').classList.add('active');
            document.getElementById('btnSummaryAkhir').classList.remove('active');
            document.getElementById('rewSummaryAwalSection').classList.remove('hidden');
            document.getElementById('rewSummaryAkhirSection').classList.add('hidden');
        });
        document.getElementById('btnSummaryAkhir').addEventListener('click', () => {
            document.getElementById('btnSummaryAkhir').classList.add('active');
            document.getElementById('btnSummaryAwal').classList.remove('active');
            document.getElementById('rewSummaryAkhirSection').classList.remove('hidden');
            document.getElementById('rewSummaryAwalSection').classList.add('hidden');
        });

        // Summary filters
        document.getElementById('rewSummaryAwalFilter').addEventListener('change', refreshSummaryAwal);
        document.getElementById('rewSummaryAkhirFilter').addEventListener('change', refreshSummaryAkhir);
        document.getElementById('btnRewSummaryAwalExport').addEventListener('click', exportSummaryAwal);
        document.getElementById('btnRewSummaryAkhirExport').addEventListener('click', exportSummaryAkhir);

        // Scanner auto-fill (looks up Induksi data)
        window.addEventListener('scanner-data', async (e) => {
            const activePage = document.querySelector('.page-section.active');
            if (!activePage || activePage.id !== 'pageReweight') return;
            const rfid = e.detail.rfid;
            document.getElementById('rewRfid').value = rfid;
            await lookupInduksi(rfid);
        });

        // Scale
        window.addEventListener('scale-data', (e) => {
            const activePage = document.querySelector('.page-section.active');
            if (activePage && activePage.id === 'pageReweight') {
                document.getElementById('rewBerat').value = e.detail.weight.toFixed(1);
                calculateDofAdg();
            }
        });

        // Manual RFID entry — lookup on change
        document.getElementById('rewRfid').addEventListener('change', async (e) => {
            if (e.target.value.trim()) await lookupInduksi(e.target.value.trim());
        });

        // Recalculate DOF/ADG on weight change
        document.getElementById('rewBerat').addEventListener('input', calculateDofAdg);
        document.getElementById('rewTanggal').addEventListener('change', calculateDofAdg);
    }

    // --- Lookup Induksi data by RFID ---
    async function lookupInduksi(rfid) {
        const record = await DB.get('induksi', rfid);
        if (!record) {
            Utils.showToast('RFID tidak ditemukan di data Induksi', 'warning');
            return;
        }
        document.getElementById('rewTglInduksi').value = record.tanggal || '';
        document.getElementById('rewEartag').value = record.eartag || '';
        document.getElementById('rewShipment').value = record.shipment || '';
        document.getElementById('rewPenInduksi').value = record.pen || '';
        document.getElementById('rewFrame').value = record.frame || '';
        document.getElementById('rewJenisSapi').value = record.jenisSapi || '';
        document.getElementById('rewBeratInduksi').value = record.berat || 0;
        Utils.showToast(`Data Induksi ditemukan: ${record.eartag || rfid}`, 'info');
        calculateDofAdg();
    }

    // --- Calculate DOF and ADG ---
    function calculateDofAdg() {
        const tglInduksi = document.getElementById('rewTglInduksi').value;
        const tglReweight = document.getElementById('rewTanggal').value;
        const beratInduksi = parseFloat(document.getElementById('rewBeratInduksi').value) || 0;
        const beratReweight = parseFloat(document.getElementById('rewBerat').value) || 0;

        const dof = Utils.calculateDOF(tglInduksi, tglReweight);
        const adg = Utils.calculateADG(beratInduksi, beratReweight, dof);

        document.getElementById('rewDof').value = dof;
        document.getElementById('rewAdg').value = adg;
    }

    // --- Save Data ---
    async function saveData() {
        const rfid = document.getElementById('rewRfid').value.trim();
        if (!rfid) { Utils.showToast('RFID tidak boleh kosong', 'warning'); return; }

        const data = {
            rfid,
            tglInduksi: document.getElementById('rewTglInduksi').value,
            tanggal: document.getElementById('rewTanggal').value,
            eartag: document.getElementById('rewEartag').value,
            shipment: document.getElementById('rewShipment').value,
            berat: parseFloat(document.getElementById('rewBerat').value) || 0,
            beratInduksi: parseFloat(document.getElementById('rewBeratInduksi').value) || 0,
            penInduksi: document.getElementById('rewPenInduksi').value,
            penAwal: document.getElementById('rewPenAwal').value.trim(),
            penAkhir: document.getElementById('rewPenAkhir').value.trim(),
            dof: parseInt(document.getElementById('rewDof').value) || 0,
            adg: parseFloat(document.getElementById('rewAdg').value) || 0,
            frame: document.getElementById('rewFrame').value,
            vitamin: parseInt(document.getElementById('rewVitamin').value) || 1,
            jenisSapi: document.getElementById('rewJenisSapi').value
        };

        try {
            await DB.add('reweight', data);
            Utils.showToast('Data reweight berhasil disimpan', 'success');
            DB.addLog('Reweight', `Saved RFID: ${rfid}`);
            clearForm();
            await refreshTable();
            await refreshSummaryAwal();
            await refreshSummaryAkhir();
            await refreshTableFilter();
        } catch (err) {
            console.error('Save reweight error:', err);
            Utils.showToast('Gagal menyimpan: ' + err.message, 'error');
        }
    }

    // --- Clear form ---
    function clearForm() {
        ['rewRfid', 'rewTglInduksi', 'rewEartag', 'rewShipment', 'rewBerat',
            'rewBeratInduksi', 'rewPenInduksi', 'rewPenAwal', 'rewPenAkhir',
            'rewDof', 'rewAdg', 'rewFrame', 'rewJenisSapi'].forEach(id => {
                document.getElementById(id).value = '';
            });
        document.getElementById('rewVitamin').value = '1';
        document.getElementById('rewTanggal').value = Utils.todayStr();
    }

    // --- Refresh Table (with sold cattle filter + shipment filter + PEN Akhir filter) ---
    async function refreshTable() {
        const shipmentFilter = document.getElementById('rewTableFilter').value;
        const penFilter = document.getElementById('rewTableFilterPen').value;
        let data = await DB.getAll('reweight');

        // Filter out sold cattle
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));

        if (shipmentFilter) {
            data = data.filter(d => d.shipment === shipmentFilter);
        }
        if (penFilter) {
            data = data.filter(d => (d.penAkhir || '') === penFilter);
        }

        const tbody = document.getElementById('rewTableBody');
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="17" class="text-center text-muted">Belum ada data</td></tr>';
            return;
        }
        data.forEach((item, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="checkbox-col"><input type="checkbox" data-id="${item.id}"></td>
                <td>${i + 1}</td>
                <td>${item.rfid}</td>
                <td>${Utils.formatDate(item.tglInduksi)}</td>
                <td>${Utils.formatDate(item.tanggal)}</td>
                <td>${item.eartag || '-'}</td>
                <td>${item.shipment || '-'}</td>
                <td>${Utils.formatNumber(item.berat)}</td>
                <td>${item.penInduksi || '-'}</td>
                <td>${item.penAwal || '-'}</td>
                <td>
                    <span class="editable-pen" data-id="${item.id}" data-field="penAkhir" title="Klik untuk edit PEN Akhir">${item.penAkhir || '-'}</span>
                </td>
                <td>${item.dof}</td>
                <td>${item.adg}</td>
                <td>${item.frame || '-'}</td>
                <td>${item.vitamin}</td>
                <td>${item.jenisSapi || '-'}</td>
            `;
            tbody.appendChild(tr);
        });

        // Bind editable PEN Akhir using event delegation
        const tbody2 = document.getElementById('rewTableBody');
        tbody2.onclick = function (e) {
            const span = e.target.closest('.editable-pen');
            if (span) handleEditPenAkhir(span);
        };
    }

    // --- Edit PEN Akhir inline ---
    async function handleEditPenAkhir(span) {
        try {
            const id = parseInt(span.dataset.id);
            if (isNaN(id)) { console.warn('No valid id found on editable-pen span'); return; }
            const currentVal = span.textContent.trim() === '-' ? '' : span.textContent.trim();
            const newVal = prompt('Ubah PEN Akhir (dari pen sementara ke pen fix):', currentVal);
            if (newVal === null) return;
            const allData = await DB.getAll('reweight');
            const record = allData.find(d => d.id === id);
            if (record) {
                record.penAkhir = newVal.trim();
                await DB.update('reweight', record);
                Utils.showToast('PEN Akhir berhasil diubah', 'success');
                DB.addLog('Reweight', `PEN Akhir updated for ID: ${id} → ${newVal.trim()}`);
                await refreshTable();
                await refreshSummaryAwal();
                await refreshSummaryAkhir();
                await refreshTableFilter();
            } else {
                Utils.showToast('Data tidak ditemukan di database', 'error');
            }
        } catch (err) {
            console.error('Edit PEN Akhir error:', err);
            Utils.showToast('Gagal mengubah PEN Akhir: ' + err.message, 'error');
        }
    }

    // --- Delete selected ---
    async function deleteSelected() {
        const checked = document.querySelectorAll('#rewTableBody input[type="checkbox"]:checked');
        if (checked.length === 0) { Utils.showToast('Pilih data yang ingin dihapus', 'warning'); return; }
        if (!confirm(`Hapus ${checked.length} data?`)) return;
        for (const cb of checked) {
            await DB.remove('reweight', parseInt(cb.dataset.id));
        }
        Utils.showToast(`${checked.length} data berhasil dihapus`, 'success');
        document.getElementById('rewCheckAll').checked = false;
        await refreshTable();
        await refreshSummaryAwal();
        await refreshSummaryAkhir();
        await refreshTableFilter();
    }

    // --- Export/Import/Template ---
    async function exportExcel() {
        const shipmentFilter = document.getElementById('rewTableFilter').value;
        let data = await DB.getAll('reweight');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipmentFilter) data = data.filter(d => d.shipment === shipmentFilter);

        const exportData = data.map(d => ({
            RFID: d.rfid,
            'Tgl Induksi': d.tglInduksi,
            'Tgl Reweight': d.tanggal,
            Eartag: d.eartag,
            Shipment: d.shipment,
            'Berat Reweight': d.berat,
            'Berat Induksi': d.beratInduksi,
            'PEN Induksi': d.penInduksi,
            'PEN Awal': d.penAwal,
            'PEN Akhir': d.penAkhir,
            DOF: d.dof,
            ADG: d.adg,
            Frame: d.frame,
            Vitamin: d.vitamin,
            'Jenis Sapi': d.jenisSapi
        }));
        Utils.exportToExcel(exportData, `reweight_${Utils.todayStr()}.xlsx`, 'Reweight');
    }

    async function importExcel(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const rows = await Utils.readExcel(file);
            let count = 0;
            for (const row of rows) {
                const rfid = String(row.RFID || row.rfid || '').trim();
                if (!rfid) continue;
                // Lookup induksi for auto-fill
                const indRecord = await DB.get('induksi', rfid);

                const data = {
                    rfid,
                    tglInduksi: String(row['Tgl Induksi'] || row.tglInduksi || (indRecord ? indRecord.tanggal : '') || ''),
                    tanggal: String(row.Tanggal || row.tanggal || row['Tgl Reweight'] || Utils.todayStr()),
                    eartag: String(row.Eartag || row.eartag || (indRecord ? indRecord.eartag : '') || ''),
                    shipment: String(row.Shipment || row.shipment || (indRecord ? indRecord.shipment : '') || ''),
                    berat: parseFloat(row.BeratReweight || row.berat || row['Berat Reweight'] || 0),
                    beratInduksi: parseFloat(row.BeratInduksi || row['Berat Induksi'] || (indRecord ? indRecord.berat : 0) || 0),
                    penInduksi: String(row.PenInduksi || row['PEN Induksi'] || (indRecord ? indRecord.pen : '') || ''),
                    penAwal: String(row.PenAwal || row['PEN Awal'] || ''),
                    penAkhir: String(row.PenAkhir || row['PEN Akhir'] || ''),
                    dof: 0, adg: 0,
                    frame: String(row.Frame || row.frame || (indRecord ? indRecord.frame : '') || ''),
                    vitamin: parseInt(row.Vitamin || row.vitamin || 1),
                    jenisSapi: String(row.JenisSapi || row['Jenis Sapi'] || (indRecord ? indRecord.jenisSapi : '') || '')
                };
                // Calculate DOF and ADG
                data.dof = Utils.calculateDOF(data.tglInduksi, data.tanggal);
                data.adg = Utils.calculateADG(data.beratInduksi, data.berat, data.dof);
                await DB.add('reweight', data);
                count++;
            }
            Utils.showToast(`${count} data berhasil di-import`, 'success');
            await refreshTable();
            await refreshSummaryAwal();
            await refreshSummaryAkhir();
        } catch (err) {
            Utils.showToast('Gagal import: ' + err.message, 'error');
        }
        e.target.value = '';
    }

    function downloadTemplate() {
        Utils.downloadTemplate(TEMPLATE_HEADERS, 'template_reweight.xlsx');
    }

    // --- Refresh table filter dropdown ---
    async function refreshTableFilter() {
        const data = await DB.getAll('reweight');

        // Shipment
        const shipments = [...new Set(data.map(d => d.shipment).filter(Boolean))].sort();
        const select = document.getElementById('rewTableFilter');
        const current = select.value;
        select.innerHTML = '<option value="">Semua Shipment</option>';
        shipments.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            select.appendChild(opt);
        });
        if (current) select.value = current;

        // PEN Akhir
        const pens = [...new Set(data.map(d => d.penAkhir).filter(Boolean))].sort();
        const selectPen = document.getElementById('rewTableFilterPen');
        const currentPen = selectPen.value;
        selectPen.innerHTML = '<option value="">Semua PEN Akhir</option>';
        pens.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p;
            selectPen.appendChild(opt);
        });
        if (currentPen) selectPen.value = currentPen;
    }

    // --- Summary PEN Awal ---
    async function refreshSummaryAwal() {
        const shipmentFilter = document.getElementById('rewSummaryAwalFilter').value;
        let data = await DB.getAll('reweight');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipmentFilter) data = data.filter(d => d.shipment === shipmentFilter);

        const groups = {};
        data.forEach(d => {
            // Skip invalid weight records for summary (avoids negative ADG from 0 weight)
            if (!d.berat || d.berat <= 0) return;

            const p = d.penAwal || 'TANPA PEN';
            if (!groups[p]) groups[p] = { count: 0, totalBerat: 0, totalAdg: 0, jenisSapi: new Set() };
            groups[p].count++;
            groups[p].totalBerat += d.berat || 0;
            groups[p].totalAdg += d.adg || 0;
            if (d.jenisSapi) groups[p].jenisSapi.add(d.jenisSapi);
        });

        const tbody = document.getElementById('rewSummaryAwalBody');
        tbody.innerHTML = '';
        const pens = Object.keys(groups).sort();
        if (pens.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada data</td></tr>';
            return;
        }
        pens.forEach(pen => {
            const g = groups[pen];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${pen}</td>
                <td>${g.count}</td>
                <td>${Utils.formatNumber(g.totalBerat)}</td>
                <td>${Utils.formatNumber(g.count ? g.totalBerat / g.count : 0)}</td>
                <td>${Utils.formatNumber(g.count ? g.totalAdg / g.count : 0, 2)}</td>
                <td>${[...g.jenisSapi].join(', ') || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
        // Refresh filter
        await refreshSummaryFilter('rewSummaryAwalFilter');
    }

    // --- Summary PEN Akhir ---
    async function refreshSummaryAkhir() {
        const shipmentFilter = document.getElementById('rewSummaryAkhirFilter').value;
        let data = await DB.getAll('reweight');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipmentFilter) data = data.filter(d => d.shipment === shipmentFilter);

        const groups = {};
        data.forEach(d => {
            // Skip invalid weight records for summary
            if (!d.berat || d.berat <= 0) return;

            const p = d.penAkhir || 'TANPA PEN';
            if (!groups[p]) groups[p] = { count: 0, totalBerat: 0, totalAdg: 0, jenisSapi: new Set() };
            groups[p].count++;
            groups[p].totalBerat += d.berat || 0;
            groups[p].totalAdg += d.adg || 0;
            if (d.jenisSapi) groups[p].jenisSapi.add(d.jenisSapi);
        });

        const tbody = document.getElementById('rewSummaryAkhirBody');
        tbody.innerHTML = '';
        const pens = Object.keys(groups).sort();
        if (pens.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada data</td></tr>';
            return;
        }
        pens.forEach(pen => {
            const g = groups[pen];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${pen}</td>
                <td>${g.count}</td>
                <td>${Utils.formatNumber(g.totalBerat)}</td>
                <td>${Utils.formatNumber(g.count ? g.totalBerat / g.count : 0)}</td>
                <td>${Utils.formatNumber(g.count ? g.totalAdg / g.count : 0, 2)}</td>
                <td>${[...g.jenisSapi].join(', ') || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
        await refreshSummaryFilter('rewSummaryAkhirFilter');
    }

    // --- Refresh summary filter dropdown ---
    async function refreshSummaryFilter(selectId) {
        const data = await DB.getAll('reweight');
        const shipments = [...new Set(data.map(d => d.shipment).filter(Boolean))].sort();
        const select = document.getElementById(selectId);
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

    // --- Export summaries ---
    async function exportSummaryAwal() {
        const shipmentFilter = document.getElementById('rewSummaryAwalFilter').value;
        let data = await DB.getAll('reweight');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipmentFilter) data = data.filter(d => d.shipment === shipmentFilter);

        const groups = {};
        data.forEach(d => {
            const p = d.penAwal || 'TANPA PEN';
            if (!groups[p]) groups[p] = { count: 0, totalBerat: 0, totalAdg: 0, jenisSapi: new Set() };
            groups[p].count++;
            groups[p].totalBerat += d.berat || 0;
            groups[p].totalAdg += d.adg || 0;
            if (d.jenisSapi) groups[p].jenisSapi.add(d.jenisSapi);
        });

        const exportData = Object.keys(groups).sort().map(pen => ({
            'PEN Awal': pen,
            'Jumlah Sapi': groups[pen].count,
            'Total Berat': groups[pen].totalBerat.toFixed(1),
            'Avg Berat': (groups[pen].totalBerat / groups[pen].count).toFixed(1),
            'Avg ADG': (groups[pen].totalAdg / groups[pen].count).toFixed(2),
            'Jenis Sapi': [...groups[pen].jenisSapi].join(', ')
        }));
        Utils.exportToExcel(exportData, `summary_reweight_awal_${Utils.todayStr()}.xlsx`, 'PEN Awal');
    }

    async function exportSummaryAkhir() {
        const shipmentFilter = document.getElementById('rewSummaryAkhirFilter').value;
        let data = await DB.getAll('reweight');
        const soldRfids = await DB.getSoldRfids();
        data = data.filter(d => !soldRfids.has(d.rfid));
        if (shipmentFilter) data = data.filter(d => d.shipment === shipmentFilter);

        const groups = {};
        data.forEach(d => {
            const p = d.penAkhir || 'TANPA PEN';
            if (!groups[p]) groups[p] = { count: 0, totalBerat: 0, totalAdg: 0, jenisSapi: new Set() };
            groups[p].count++;
            groups[p].totalBerat += d.berat || 0;
            groups[p].totalAdg += d.adg || 0;
            if (d.jenisSapi) groups[p].jenisSapi.add(d.jenisSapi);
        });

        const exportData = Object.keys(groups).sort().map(pen => ({
            'PEN Akhir': pen,
            'Jumlah Sapi': groups[pen].count,
            'Total Berat': groups[pen].totalBerat.toFixed(1),
            'Avg Berat': (groups[pen].totalBerat / groups[pen].count).toFixed(1),
            'Avg ADG': (groups[pen].totalAdg / groups[pen].count).toFixed(2),
            'Jenis Sapi': [...groups[pen].jenisSapi].join(', ')
        }));
        Utils.exportToExcel(exportData, `summary_reweight_akhir_${Utils.todayStr()}.xlsx`, 'PEN Akhir');
    }

    return { init, refreshTable, refreshSummaryAwal, refreshSummaryAkhir, refreshTableFilter };
})();
