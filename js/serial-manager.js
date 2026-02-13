/* ============================================
   WEB SERIAL API MANAGER
   Scanner (Bluetooth RS232) + Scale (USB RS232)
============================================ */

const SerialManager = (() => {
    let scannerPort = null;
    let scalePort = null;
    let scannerReader = null;
    let scaleReader = null;
    let scannerBuffer = '';
    let scaleBuffer = '';
    let isReading = { scanner: false, scale: false };

    // --- Check browser support ---
    function isSupported() {
        return 'serial' in navigator;
    }

    // --- Connect Scanner ---
    async function connectScanner() {
        if (!isSupported()) {
            Utils.showToast('Web Serial API tidak didukung di browser ini. Gunakan Chrome/Edge.', 'error');
            return false;
        }
        try {
            scannerPort = await navigator.serial.requestPort();
            await scannerPort.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });
            updateDot('dotScanner', true);
            Utils.showToast('Scanner terhubung', 'success');
            DB.addLog('Serial', 'Scanner connected');
            readScanner();
            return true;
        } catch (err) {
            console.error('Scanner connect error:', err);
            Utils.showToast('Gagal menghubungkan scanner: ' + err.message, 'error');
            return false;
        }
    }

    // --- Connect Scale ---
    async function connectScale() {
        if (!isSupported()) {
            Utils.showToast('Web Serial API tidak didukung di browser ini. Gunakan Chrome/Edge.', 'error');
            return false;
        }
        try {
            scalePort = await navigator.serial.requestPort();
            await scalePort.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });
            updateDot('dotScale', true);
            Utils.showToast('Timbangan terhubung', 'success');
            DB.addLog('Serial', 'Scale connected');
            readScale();
            return true;
        } catch (err) {
            console.error('Scale connect error:', err);
            Utils.showToast('Gagal menghubungkan timbangan: ' + err.message, 'error');
            return false;
        }
    }

    // --- Disconnect ---
    async function disconnectScanner() {
        try {
            isReading.scanner = false;
            if (scannerReader) { await scannerReader.cancel(); scannerReader = null; }
            if (scannerPort) { await scannerPort.close(); scannerPort = null; }
            updateDot('dotScanner', false);
            Utils.showToast('Scanner terputus', 'info');
            DB.addLog('Serial', 'Scanner disconnected');
        } catch (err) {
            console.error('Scanner disconnect error:', err);
        }
    }

    async function disconnectScale() {
        try {
            isReading.scale = false;
            if (scaleReader) { await scaleReader.cancel(); scaleReader = null; }
            if (scalePort) { await scalePort.close(); scalePort = null; }
            updateDot('dotScale', false);
            Utils.showToast('Timbangan terputus', 'info');
            DB.addLog('Serial', 'Scale disconnected');
        } catch (err) {
            console.error('Scale disconnect error:', err);
        }
    }

    // --- Read Scanner Data ---
    async function readScanner() {
        if (!scannerPort || !scannerPort.readable) return;
        isReading.scanner = true;
        try {
            while (scannerPort.readable && isReading.scanner) {
                scannerReader = scannerPort.readable.getReader();
                try {
                    while (isReading.scanner) {
                        const { value, done } = await scannerReader.read();
                        if (done) break;
                        const text = new TextDecoder().decode(value);
                        console.log('Raw scanner data:', text); // debug

                        scannerBuffer += text;

                        // Bersihkan spasi dan karakter non-digit
                        const cleanedBuffer = scannerBuffer.replace(/\s+/g, '').replace(/[^\d]/g, '');

                        // Cari angka 10–20 digit
                        const match = cleanedBuffer.match(/\d{10,20}/);
                        if (match) {
                            const rfid = match[0];
                            scannerBuffer = ''; // reset buffer setelah dapat RFID
                            window.dispatchEvent(new CustomEvent('scanner-data', { detail: { rfid } }));
                            console.log('RFID detected:', rfid);
                        }

                        if (scannerBuffer.length > 200) {
                            scannerBuffer = scannerBuffer.slice(-50);
                        }
                    }
                } finally {
                    scannerReader.releaseLock();
                }
            }
        } catch (err) {
            if (isReading.scanner) {
                console.error('Scanner read error:', err);
                updateDot('dotScanner', false);
                Utils.showToast('Scanner terputus secara tidak terduga', 'error');
            }
        }
    }

    // --- Read Scale Data ---
    async function readScale() {
        if (!scalePort || !scalePort.readable) return;
        isReading.scale = true;
        try {
            while (scalePort.readable && isReading.scale) {
                scaleReader = scalePort.readable.getReader();
                try {
                    while (isReading.scale) {
                        const { value, done } = await scaleReader.read();
                        if (done) break;
                        const text = new TextDecoder().decode(value);
                        scaleBuffer += text;

                        const lines = scaleBuffer.split(/[\r\n]+/);
                        for (const line of lines) {
                            const weightMatch = line.match(/([+-]?\s*\d+\.?\d*)\s*(?:kg|KG|Kg)?/i);
                            if (weightMatch) {
                                const weight = parseFloat(weightMatch[1].replace(/\s/g, ''));
                                if (!isNaN(weight) && weight >= 0 && weight < 9999) {
                                    window.dispatchEvent(new CustomEvent('scale-data', { detail: { weight } }));
                                }
                            }
                        }
                        scaleBuffer = lines[lines.length - 1] || '';
                        if (scaleBuffer.length > 200) {
                            scaleBuffer = scaleBuffer.slice(-50);
                        }
                    }
                } finally {
                    scaleReader.releaseLock();
                }
            }
        } catch (err) {
            if (isReading.scale) {
                console.error('Scale read error:', err);
                updateDot('dotScale', false);
                Utils.showToast('Timbangan terputus secara tidak terduga', 'error');
            }
        }
    }

    // --- UI status dot ---
    function updateDot(dotId, connected) {
        const dot = document.getElementById(dotId);
        if (dot) {
            if (connected) dot.classList.add('connected');
            else dot.classList.remove('connected');
        }
    }

    // --- Toggle functions ---
    function toggleScanner() {
        if (scannerPort) disconnectScanner();
        else connectScanner();
    }

    function toggleScale() {
        if (scalePort) disconnectScale();
        else connectScale();
    }

    function isScannerConnected() { return !!scannerPort; }
    function isScaleConnected() { return !!scalePort; }

    return {
        isSupported, connectScanner, connectScale,
        disconnectScanner, disconnectScale,
        toggleScanner, toggleScale,
        isScannerConnected, isScaleConnected
    };
})();
