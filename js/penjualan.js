/* ============================================
   PENJUALAN MODULE — Sales Data Entry
   ============================================ */
const Penjualan = (() => {
    let cart = [];

    // --- Initialize ---
    async function init() {
        document.getElementById('penjTanggal').value = Utils.todayStr();
        await loadPembeliDropdown();
        await refreshHistory();
        await refreshTarikData();
        await refreshTarikDataDetail();
        bindEvents();
    }

    // --- Load pembeli dropdown ---
    async function loadPembeliDropdown() {
        const items = await DB.getMasterByType('pembeli');
        const select = document.getElementById('penjPembeli');
        const current = select.value;
        select.innerHTML = '<option value="">-- Pilih Pembeli --</option>';
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
        // Add to cart
        document.getElementById('btnPenjAddToCart').addEventListener('click', addToCart);
        document.getElementById('btnPenjClear').addEventListener('click', clearForm);

        // Cart actions
        document.getElementById('btnPenjSaveAll').addEventListener('click', saveAll);
        document.getElementById('btnPenjExportPdf').addEventListener('click', exportPdf);
        document.getElementById('btnPenjExportStaffExcel').addEventListener('click', exportStaffExcel);

        // History filter
        document.getElementById('penjHistoryFilter').addEventListener('change', refreshHistory);
        document.getElementById('btnPenjHistoryExport').addEventListener('click', exportHistory);
        document.getElementById('btnPenjHistoryPdf').addEventListener('click', exportHistoryPdf);

        // Tarik Data
        document.getElementById('penjTarikFilter').addEventListener('change', refreshTarikData);
        // Tarik Data
        document.getElementById('penjTarikFilter').addEventListener('change', refreshTarikData);
        document.getElementById('btnTarikExport').addEventListener('click', exportTarikData);

        // Tarik Data Detail
        document.getElementById('penjTarikDetailFilter').addEventListener('change', refreshTarikDataDetail);
        document.getElementById('btnTarikDetailExport').addEventListener('click', exportTarikDataDetail);

        // Print settings
        document.getElementById('btnPrintSettings').addEventListener('click', () => Utils.openModal('modalPrintSettings'));
        document.getElementById('btnSavePrintSettings').addEventListener('click', savePrintSettings);
        document.getElementById('btnClosePrintSettings').addEventListener('click', () => Utils.closeModal('modalPrintSettings'));

        // Logo upload
        document.getElementById('printLogo').addEventListener('change', handleLogoUpload);

        // Scanner auto-fill
        window.addEventListener('scanner-data', async (e) => {
            const activePage = document.querySelector('.page-section.active');
            if (!activePage || activePage.id !== 'pagePenjualan') return;
            const rfid = e.detail.rfid;
            document.getElementById('penjRfid').value = rfid;
            await lookupFromInduksi(rfid);
        });

        // Scale
        window.addEventListener('scale-data', (e) => {
            const activePage = document.querySelector('.page-section.active');
            if (activePage && activePage.id === 'pagePenjualan') {
                document.getElementById('penjBerat').value = e.detail.weight.toFixed(1);
            }
        });

        // Manual RFID
        document.getElementById('penjRfid').addEventListener('change', async (e) => {
            if (e.target.value.trim()) await lookupFromInduksi(e.target.value.trim());
        });
    }

    // --- Lookup from Induksi ---
    async function lookupFromInduksi(rfid) {
        const record = await DB.get('induksi', rfid);
        if (!record) {
            Utils.showToast('RFID tidak ditemukan di data Induksi', 'warning');
            return;
        }
        document.getElementById('penjEartag').value = record.eartag || '';
        document.getElementById('penjShipment').value = record.shipment || '';
        Utils.showToast(`Data ditemukan: ${record.eartag || rfid}`, 'info');
    }

    // --- Add to cart ---
    function addToCart() {
        const rfid = document.getElementById('penjRfid').value.trim();
        if (!rfid) { Utils.showToast('RFID tidak boleh kosong', 'warning'); return; }

        // Check duplicate in cart
        if (cart.find(c => c.rfid === rfid)) {
            Utils.showToast('RFID sudah ada di keranjang', 'warning');
            return;
        }

        const item = {
            rfid,
            pembeli: document.getElementById('penjPembeli').value,
            tanggalJual: document.getElementById('penjTanggal').value,
            eartag: document.getElementById('penjEartag').value,
            shipment: document.getElementById('penjShipment').value,
            berat: parseFloat(document.getElementById('penjBerat').value) || 0
        };
        cart.push(item);
        renderCart();
        clearItemFields();
        Utils.showToast('Ditambahkan ke keranjang', 'info');
    }

    // --- Render cart ---
    function renderCart() {
        const tbody = document.getElementById('penjCartBody');
        tbody.innerHTML = '';
        if (cart.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Keranjang kosong</td></tr>';
            document.getElementById('cartCount').textContent = '0';
            document.getElementById('cartTotal').textContent = '0.0';
            return;
        }
        let totalBerat = 0;
        cart.forEach((item, i) => {
            totalBerat += item.berat;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td>${item.rfid}</td>
                <td>${item.eartag || '-'}</td>
                <td>${item.shipment || '-'}</td>
                <td>${Utils.formatNumber(item.berat)}</td>
                <td>${item.pembeli || '-'}</td>
                <td>${Utils.formatDate(item.tanggalJual)}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="Penjualan.removeFromCart(${i})">🗑️</button>
                    <button class="btn btn-sm btn-secondary" onclick="Penjualan.editCartItem(${i})">✏️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        document.getElementById('cartCount').textContent = cart.length;
        document.getElementById('cartTotal').textContent = Utils.formatNumber(totalBerat);
    }

    // --- Remove from cart ---
    function removeFromCart(index) {
        cart.splice(index, 1);
        renderCart();
    }

    // --- Edit cart item ---
    function editCartItem(index) {
        const item = cart[index];
        document.getElementById('penjRfid').value = item.rfid;
        document.getElementById('penjEartag').value = item.eartag;
        document.getElementById('penjShipment').value = item.shipment;
        document.getElementById('penjBerat').value = item.berat;
        cart.splice(index, 1);
        renderCart();
    }

    // --- Save all cart items to DB ---
    async function saveAll() {
        if (cart.length === 0) { Utils.showToast('Keranjang kosong', 'warning'); return; }
        const pembeli = document.getElementById('penjPembeli').value;
        if (!pembeli) { Utils.showToast('Pilih pembeli terlebih dahulu', 'warning'); return; }
        if (!confirm(`Simpan ${cart.length} data penjualan?`)) return;
        try {
            for (const item of cart) {
                item.pembeli = pembeli;
                await DB.add('penjualan', item);
            }
            Utils.showToast(`${cart.length} data penjualan berhasil disimpan`, 'success');
            DB.addLog('Penjualan', `Saved ${cart.length} items for buyer: ${pembeli}`);
            cart = [];
            renderCart();
            clearForm();
            await refreshHistory();
            await refreshTarikData();
            await refreshTarikDataDetail();
        } catch (err) {
            console.error('Save penjualan error:', err);
            Utils.showToast('Gagal menyimpan: ' + err.message, 'error');
        }
    }

    // --- Clear form ---
    function clearForm() {
        clearItemFields();
        document.getElementById('penjTanggal').value = Utils.todayStr();
    }

    function clearItemFields() {
        document.getElementById('penjRfid').value = '';
        document.getElementById('penjEartag').value = '';
        document.getElementById('penjShipment').value = '';
        document.getElementById('penjBerat').value = '';
    }

    // --- Get Print Settings ---
    async function getPrintSettings() {
        const ps = await DB.get('settings', 'printSettings');
        return ps ? ps.value : {
            headerText: 'Feedlot Management',
            subHeader: 'Invoice Penjualan Sapi',
            logoData: null,
            pageSize: 'a4',
            orientation: 'portrait',
            footerText: 'Terima kasih atas kerja sama Anda'
        };
    }

    // --- Save print settings ---
    async function savePrintSettings() {
        const settings = {
            headerText: document.getElementById('printHeaderText').value || 'Feedlot Management',
            subHeader: document.getElementById('printSubHeader').value || 'Invoice Penjualan Sapi',
            pageSize: document.getElementById('printPageSize').value || 'a4',
            orientation: document.getElementById('printOrientation').value || 'portrait',
            footerText: document.getElementById('printFooterText').value || ''
        };
        // Logo data is already saved separately
        const existing = await getPrintSettings();
        settings.logoData = existing.logoData;
        await DB.add('settings', { key: 'printSettings', value: settings });
        Utils.showToast('Pengaturan cetak berhasil disimpan', 'success');
        Utils.closeModal('modalPrintSettings');
    }

    // --- Handle logo upload ---
    function handleLogoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const ps = await getPrintSettings();
            ps.logoData = evt.target.result;
            await DB.add('settings', { key: 'printSettings', value: ps });
            Utils.showToast('Logo berhasil diupload', 'success');
        };
        reader.readAsDataURL(file);
    }

    // --- Load print settings to modal ---
    async function loadPrintSettingsModal() {
        const ps = await getPrintSettings();
        document.getElementById('printHeaderText').value = ps.headerText || '';
        document.getElementById('printSubHeader').value = ps.subHeader || '';
        document.getElementById('printPageSize').value = ps.pageSize || 'a4';
        document.getElementById('printOrientation').value = ps.orientation || 'portrait';
        document.getElementById('printFooterText').value = ps.footerText || '';
    }

    // --- Export PDF Invoice ---
    async function exportPdf() {
        if (cart.length === 0) {
            // Check if we should use history
            Utils.showToast('Keranjang kosong. Gunakan riwayat untuk export', 'warning');
            return;
        }
        await generatePdf(cart, document.getElementById('penjPembeli').value);
    }

    async function exportHistoryPdf() {
        const pembeli = document.getElementById('penjHistoryFilter').value;
        if (!pembeli) { Utils.showToast('Pilih pembeli untuk export PDF', 'warning'); return; }
        const data = await DB.getAllByIndex('penjualan', 'pembeli', pembeli);
        if (data.length === 0) { Utils.showToast('Tidak ada data', 'warning'); return; }
        await generatePdf(data, pembeli);
    }

    async function generatePdf(data, pembeli) {
        const ps = await getPrintSettings();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: ps.orientation || 'portrait',
            unit: 'mm',
            format: ps.pageSize || 'a4'
        });

        let y = 15;

        // Logo
        if (ps.logoData) {
            try {
                doc.addImage(ps.logoData, 'PNG', 14, y, 25, 25);
                y += 5;
            } catch (e) { console.warn('Logo error:', e); }
        }

        // Header
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(ps.headerText || 'Feedlot Management', ps.logoData ? 45 : 14, y + 5);
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text(ps.subHeader || 'Invoice Penjualan Sapi', ps.logoData ? 45 : 14, y + 12);
        y = ps.logoData ? y + 30 : y + 20;

        // Info
        doc.setFontSize(10);
        doc.text(`Pembeli: ${pembeli || '-'}`, 14, y);
        doc.text(`Tanggal: ${Utils.formatDate(data[0]?.tanggalJual || Utils.todayStr())}`, 14, y + 6);
        y += 15;

        // Table
        const tableData = data.map((d, i) => [
            i + 1,
            d.rfid,
            d.eartag || '-',
            d.shipment || '-',
            Utils.formatNumber(d.berat) + ' Kg'
        ]);

        const totalBerat = data.reduce((sum, d) => sum + (d.berat || 0), 0);
        tableData.push(['', '', '', 'TOTAL:', Utils.formatNumber(totalBerat) + ' Kg']);

        doc.autoTable({
            head: [['No', 'RFID', 'Eartag', 'Shipment', 'Berat Jual']],
            body: tableData,
            startY: y,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [15, 52, 96] },
            theme: 'grid'
        });

        // Footer
        if (ps.footerText) {
            const pageHeight = doc.internal.pageSize.height;
            doc.setFontSize(8);
            doc.text(ps.footerText, 14, pageHeight - 10);
        }

        doc.save(`invoice_${pembeli || 'penjualan'}_${Utils.todayStr()}.pdf`);
        Utils.showToast('PDF berhasil di-export', 'success');
    }

    // --- Export Staff Excel (with DOF/ADG from Induksi & Reweight) ---
    async function exportStaffExcel() {
        let data;
        const pembeli = document.getElementById('penjPembeli').value;
        if (cart.length > 0) {
            data = cart;
        } else {
            if (!pembeli) { Utils.showToast('Keranjang kosong dan pembeli belum dipilih', 'warning'); return; }
            data = await DB.getAllByIndex('penjualan', 'pembeli', pembeli);
        }
        if (!data || data.length === 0) { Utils.showToast('Tidak ada data', 'warning'); return; }

        const exportRows = [];
        for (const d of data) {
            const indRecord = await DB.get('induksi', d.rfid);
            const rewRecords = await DB.getAllByIndex('reweight', 'rfid', d.rfid);
            const latestRew = rewRecords.length > 0 ? rewRecords[rewRecords.length - 1] : null;

            const dofInduksi = indRecord ? Utils.calculateDOF(indRecord.tanggal, d.tanggalJual) : 0;
            const adgInduksi = indRecord ? Utils.calculateADG(indRecord.berat, d.berat, dofInduksi) : 0;

            let dofReweight = '';
            let adgReweight = '';
            if (latestRew) {
                dofReweight = Utils.calculateDOF(latestRew.tanggal, d.tanggalJual);
                adgReweight = Utils.calculateADG(latestRew.berat, d.berat, dofReweight);
            }

            exportRows.push({
                RFID: d.rfid,
                Eartag: d.eartag || (indRecord ? indRecord.eartag : ''),
                Shipment: d.shipment,
                Pembeli: d.pembeli || pembeli,
                'Tanggal Jual': d.tanggalJual,
                'Berat Jual (Kg)': d.berat,
                'Berat Induksi (Kg)': indRecord ? indRecord.berat : '',
                'DOF Induksi': dofInduksi || '',
                'ADG Induksi': adgInduksi || '',
                'Berat Reweight (Kg)': latestRew ? latestRew.berat : '',
                'DOF Reweight': dofReweight,
                'ADG Reweight': adgReweight
            });
        }
        Utils.exportToExcel(exportRows, `staff_penjualan_${Utils.todayStr()}.xlsx`, 'Staff Export');
    }

    // --- History ---
    async function refreshHistory() {
        const pembeliFilter = document.getElementById('penjHistoryFilter').value;
        let data = await DB.getAll('penjualan');

        if (pembeliFilter) {
            data = data.filter(d => d.pembeli === pembeliFilter);
        }

        // Also refresh filter dropdown
        const allData = await DB.getAll('penjualan');
        const pembelis = [...new Set(allData.map(d => d.pembeli).filter(Boolean))].sort();
        const select = document.getElementById('penjHistoryFilter');
        const current = select.value;
        select.innerHTML = '<option value="">Semua Pembeli</option>';
        pembelis.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p;
            select.appendChild(opt);
        });
        if (current) select.value = current;

        const tbody = document.getElementById('penjHistoryBody');
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Belum ada riwayat</td></tr>';
            return;
        }
        data.forEach((item, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td>${item.rfid}</td>
                <td>${item.eartag || '-'}</td>
                <td>${item.shipment || '-'}</td>
                <td>${Utils.formatNumber(item.berat)}</td>
                <td>${item.pembeli || '-'}</td>
                <td>${Utils.formatDate(item.tanggalJual)}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="Penjualan.deleteHistoryItem(${item.id})">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- Delete history item ---
    async function deleteHistoryItem(id) {
        if (!confirm('Hapus data penjualan ini?')) return;
        await DB.remove('penjualan', id);
        Utils.showToast('Data berhasil dihapus', 'success');
        await refreshHistory();
        await refreshHistory();
        await refreshTarikData();
        await refreshTarikDataDetail();
    }

    // --- Export history ---
    async function exportHistory() {
        const pembeliFilter = document.getElementById('penjHistoryFilter').value;
        let data = await DB.getAll('penjualan');
        if (pembeliFilter) data = data.filter(d => d.pembeli === pembeliFilter);

        const exportData = data.map(d => ({
            RFID: d.rfid,
            Eartag: d.eartag,
            Shipment: d.shipment,
            'Berat Jual (Kg)': d.berat,
            Pembeli: d.pembeli,
            'Tanggal Jual': d.tanggalJual
        }));
        Utils.exportToExcel(exportData, `riwayat_penjualan_${Utils.todayStr()}.xlsx`, 'Riwayat');
    }

    // ============================================================
    // TARIK DATA — Summary report: Induksi + Reweight + Penjualan
    // Shows ALL cattle (including sold) grouped by Shipment
    // ============================================================
    async function refreshTarikData() {
        const shipmentFilter = document.getElementById('penjTarikFilter').value;

        const allInduksi = await DB.getAll('induksi');
        const allReweight = await DB.getAll('reweight');
        const allPenjualan = await DB.getAll('penjualan');

        // Get unique shipments for filter
        const shipments = [...new Set(allInduksi.map(d => d.shipment).filter(Boolean))].sort();
        const select = document.getElementById('penjTarikFilter');
        const current = select.value;
        select.innerHTML = '<option value="">Semua Shipment</option>';
        shipments.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            select.appendChild(opt);
        });
        if (current) select.value = current;

        // Filter by shipment
        let induksiData = shipmentFilter ? allInduksi.filter(d => d.shipment === shipmentFilter) : allInduksi;
        let reweightData = shipmentFilter ? allReweight.filter(d => d.shipment === shipmentFilter) : allReweight;
        let penjualanData = shipmentFilter ? allPenjualan.filter(d => d.shipment === shipmentFilter) : allPenjualan;

        const tbody = document.getElementById('tarikDataBody');
        tbody.innerHTML = '';

        // Group by shipment
        const shipmentGroups = {};
        induksiData.forEach(d => {
            const s = d.shipment || 'TANPA SHIPMENT';
            if (!shipmentGroups[s]) shipmentGroups[s] = { induksi: 0, totalBeratInd: 0, reweight: 0, totalBeratRew: 0, penjualan: 0, totalBeratJual: 0 };
            shipmentGroups[s].induksi++;
            shipmentGroups[s].totalBeratInd += d.berat || 0;
        });
        reweightData.forEach(d => {
            const s = d.shipment || 'TANPA SHIPMENT';
            if (!shipmentGroups[s]) shipmentGroups[s] = { induksi: 0, totalBeratInd: 0, reweight: 0, totalBeratRew: 0, penjualan: 0, totalBeratJual: 0 };
            shipmentGroups[s].reweight++;
            shipmentGroups[s].totalBeratRew += d.berat || 0;
        });
        penjualanData.forEach(d => {
            const s = d.shipment || 'TANPA SHIPMENT';
            if (!shipmentGroups[s]) shipmentGroups[s] = { induksi: 0, totalBeratInd: 0, reweight: 0, totalBeratRew: 0, penjualan: 0, totalBeratJual: 0 };
            shipmentGroups[s].penjualan++;
            shipmentGroups[s].totalBeratJual += d.berat || 0;
        });

        const keys = Object.keys(shipmentGroups).sort();
        if (keys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Belum ada data</td></tr>';
            return;
        }
        keys.forEach(shipment => {
            const g = shipmentGroups[shipment];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${shipment}</td>
                <td>${g.induksi}</td>
                <td>${Utils.formatNumber(g.totalBeratInd)}</td>
                <td>${g.reweight}</td>
                <td>${Utils.formatNumber(g.totalBeratRew)}</td>
                <td>${g.penjualan}</td>
                <td>${Utils.formatNumber(g.totalBeratJual)}</td>
                <td>${g.induksi - g.penjualan}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- Export Tarik Data ---
    async function exportTarikData() {
        const shipmentFilter = document.getElementById('penjTarikFilter').value;
        const allInduksi = await DB.getAll('induksi');
        const allReweight = await DB.getAll('reweight');
        const allPenjualan = await DB.getAll('penjualan');

        let induksiData = shipmentFilter ? allInduksi.filter(d => d.shipment === shipmentFilter) : allInduksi;
        let reweightData = shipmentFilter ? allReweight.filter(d => d.shipment === shipmentFilter) : allReweight;
        let penjualanData = shipmentFilter ? allPenjualan.filter(d => d.shipment === shipmentFilter) : allPenjualan;

        const shipmentGroups = {};
        induksiData.forEach(d => {
            const s = d.shipment || 'TANPA SHIPMENT';
            if (!shipmentGroups[s]) shipmentGroups[s] = { induksi: 0, totalBeratInd: 0, reweight: 0, totalBeratRew: 0, penjualan: 0, totalBeratJual: 0 };
            shipmentGroups[s].induksi++;
            shipmentGroups[s].totalBeratInd += d.berat || 0;
        });
        reweightData.forEach(d => {
            const s = d.shipment || 'TANPA SHIPMENT';
            if (!shipmentGroups[s]) shipmentGroups[s] = { induksi: 0, totalBeratInd: 0, reweight: 0, totalBeratRew: 0, penjualan: 0, totalBeratJual: 0 };
            shipmentGroups[s].reweight++;
            shipmentGroups[s].totalBeratRew += d.berat || 0;
        });
        penjualanData.forEach(d => {
            const s = d.shipment || 'TANPA SHIPMENT';
            if (!shipmentGroups[s]) shipmentGroups[s] = { induksi: 0, totalBeratInd: 0, reweight: 0, totalBeratRew: 0, penjualan: 0, totalBeratJual: 0 };
            shipmentGroups[s].penjualan++;
            shipmentGroups[s].totalBeratJual += d.berat || 0;
        });

        const exportData = Object.keys(shipmentGroups).sort().map(s => ({
            Shipment: s,
            'Jml Induksi': shipmentGroups[s].induksi,
            'Total Berat Induksi': shipmentGroups[s].totalBeratInd.toFixed(1),
            'Jml Reweight': shipmentGroups[s].reweight,
            'Total Berat Reweight': shipmentGroups[s].totalBeratRew.toFixed(1),
            'Jml Terjual': shipmentGroups[s].penjualan,
            'Total Berat Jual': shipmentGroups[s].totalBeratJual.toFixed(1),
            'Sisa Sapi': shipmentGroups[s].induksi - shipmentGroups[s].penjualan
        }));
        Utils.exportToExcel(exportData, `tarik_data_${Utils.todayStr()}.xlsx`, 'Tarik Data');
    }

    // ============================================================
    // TARIK DATA DETAIL — Per Eartag Report
    // Induksi -> Reweight -> Penjualan (with all DOFs/ADGs)
    // ============================================================
    async function refreshTarikDataDetail() {
        const shipmentFilter = document.getElementById('penjTarikDetailFilter').value;

        const allInduksi = await DB.getAll('induksi');
        const allReweight = await DB.getAll('reweight');
        const allPenjualan = await DB.getAll('penjualan');

        // Populate filter
        const shipments = [...new Set(allInduksi.map(d => d.shipment).filter(Boolean))].sort();
        const select = document.getElementById('penjTarikDetailFilter');
        const current = select.value;
        select.innerHTML = '<option value="">Semua Shipment</option>';
        shipments.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            select.appendChild(opt);
        });
        if (current) select.value = current;

        // Process Data
        // 1. Group reweights by RFID to find latest
        const rewMap = {};
        allReweight.forEach(r => {
            if (!rewMap[r.rfid] || new Date(r.tanggal) > new Date(rewMap[r.rfid].tanggal)) {
                rewMap[r.rfid] = r;
            }
        });

        // 2. Map sales by RFID
        const saleMap = {};
        allPenjualan.forEach(s => saleMap[s.rfid] = s);

        // 3. Filter Induksi (Base)
        let data = allInduksi;
        if (shipmentFilter) {
            data = data.filter(d => d.shipment === shipmentFilter);
        }

        const tbody = document.getElementById('tarikDataDetailBody');
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="18" class="text-center text-muted">Belum ada data</td></tr>';
            return;
        }

        data.forEach((ind, i) => {
            const rfid = ind.rfid;
            const rew = rewMap[rfid];
            const sale = saleMap[rfid];

            // Calculations
            // Induksi -> Reweight
            let dofIndRew = '-', adgIndRew = '-';
            if (rew) {
                const dof = Utils.calculateDOF(ind.tanggal, rew.tanggal);
                dofIndRew = dof;
                adgIndRew = Utils.calculateADG(ind.berat, rew.berat, dof);
            }

            // Induksi -> Jual
            let dofIndJual = '-', adgIndJual = '-';
            if (sale) {
                const dof = Utils.calculateDOF(ind.tanggal, sale.tanggalJual);
                dofIndJual = dof;
                adgIndJual = Utils.calculateADG(ind.berat, sale.berat, dof);
            }

            // Reweight -> Jual
            let dofRewJual = '-', adgRewJual = '-';
            if (rew && sale) {
                const dof = Utils.calculateDOF(rew.tanggal, sale.tanggalJual);
                dofRewJual = dof;
                adgRewJual = Utils.calculateADG(rew.berat, sale.berat, dof);
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td>${rfid}</td>
                <td>${ind.eartag || '-'}</td>
                <td>${ind.shipment || '-'}</td>
                <td>${sale ? sale.pembeli : '-'}</td>
                <td>${ind.jenisSapi || '-'}</td>
                
                <td>${Utils.formatDate(ind.tanggal)}</td>
                <td>${Utils.formatNumber(ind.berat)}</td>
                
                <td>${rew ? Utils.formatDate(rew.tanggal) : '-'}</td>
                <td>${rew ? Utils.formatNumber(rew.berat) : '-'}</td>
                
                <td>${sale ? Utils.formatDate(sale.tanggalJual) : '-'}</td>
                <td>${sale ? Utils.formatNumber(sale.berat) : '-'}</td>
                
                <td>${dofIndRew}</td>
                <td>${dofIndJual}</td>
                <td>${dofRewJual}</td>
                
                <td>${adgIndRew}</td>
                <td>${adgIndJual}</td>
                <td>${adgRewJual}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    async function exportTarikDataDetail() {
        const shipmentFilter = document.getElementById('penjTarikDetailFilter').value;
        const allInduksi = await DB.getAll('induksi');
        const allReweight = await DB.getAll('reweight');
        const allPenjualan = await DB.getAll('penjualan');

        const rewMap = {};
        allReweight.forEach(r => {
            if (!rewMap[r.rfid] || new Date(r.tanggal) > new Date(rewMap[r.rfid].tanggal)) {
                rewMap[r.rfid] = r;
            }
        });

        const saleMap = {};
        allPenjualan.forEach(s => saleMap[s.rfid] = s);

        let data = allInduksi;
        if (shipmentFilter) {
            data = data.filter(d => d.shipment === shipmentFilter);
        }

        const exportRows = data.map((ind, i) => {
            const rfid = ind.rfid;
            const rew = rewMap[rfid];
            const sale = saleMap[rfid];

            let dofIndRew = '', adgIndRew = '';
            if (rew) {
                const dof = Utils.calculateDOF(ind.tanggal, rew.tanggal);
                dofIndRew = dof;
                adgIndRew = Utils.calculateADG(ind.berat, rew.berat, dof);
            }

            let dofIndJual = '', adgIndJual = '';
            if (sale) {
                const dof = Utils.calculateDOF(ind.tanggal, sale.tanggalJual);
                dofIndJual = dof;
                adgIndJual = Utils.calculateADG(ind.berat, sale.berat, dof);
            }

            let dofRewJual = '', adgRewJual = '';
            if (rew && sale) {
                const dof = Utils.calculateDOF(rew.tanggal, sale.tanggalJual);
                dofRewJual = dof;
                adgRewJual = Utils.calculateADG(rew.berat, sale.berat, dof);
            }

            return {
                No: i + 1,
                RFID: rfid,
                Eartag: ind.eartag,
                Shipment: ind.shipment,
                Pembeli: sale ? sale.pembeli : '',
                'Jenis Sapi': ind.jenisSapi,
                'Tgl Induksi': ind.tanggal,
                'Berat Induksi': ind.berat,
                'Tgl Reweight': rew ? rew.tanggal : '',
                'Berat Reweight': rew ? rew.berat : '',
                'Tgl Jual': sale ? sale.tanggalJual : '',
                'Berat Jual': sale ? sale.berat : '',
                'DOF Ind-Rew': dofIndRew,
                'DOF Ind-Jual': dofIndJual,
                'DOF Rew-Jual': dofRewJual,
                'ADG Ind-Rew': adgIndRew,
                'ADG Ind-Jual': adgIndJual,
                'ADG Rew-Jual': adgRewJual
            };
        });
        Utils.exportToExcel(exportRows, `detail_sales_report_${Utils.todayStr()}.xlsx`, 'Laporan Detail');
    }

    return {
        init, loadPembeliDropdown, removeFromCart, editCartItem,
        deleteHistoryItem, refreshHistory, refreshTarikData, refreshTarikDataDetail,
        loadPrintSettingsModal
    };
})();
