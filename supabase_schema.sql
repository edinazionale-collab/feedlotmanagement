-- ============================================
-- SUPABASE SCHEMA — Feedlot Management PWA
-- Paste this entire script into Supabase SQL Editor and click "Run"
-- ============================================

-- 1. INDUKSI (Induction) — Primary key: rfid
CREATE TABLE IF NOT EXISTS induksi (
    rfid TEXT PRIMARY KEY,
    shipment TEXT,
    tanggal DATE,
    eartag TEXT,
    berat NUMERIC(8,1) DEFAULT 0,
    pen TEXT,
    gigi TEXT,
    frame TEXT,
    "kodeProperty" TEXT,
    vitamin INTEGER DEFAULT 1,
    "jenisSapi" TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_induksi_shipment ON induksi(shipment);
CREATE INDEX IF NOT EXISTS idx_induksi_pen ON induksi(pen);
CREATE INDEX IF NOT EXISTS idx_induksi_eartag ON induksi(eartag);
CREATE INDEX IF NOT EXISTS idx_induksi_tanggal ON induksi(tanggal);

-- 2. REWEIGHT — Auto-increment ID, multiple reweights per RFID
CREATE TABLE IF NOT EXISTS reweight (
    id BIGSERIAL PRIMARY KEY,
    rfid TEXT,
    "tglInduksi" DATE,
    tanggal DATE,
    eartag TEXT,
    shipment TEXT,
    berat NUMERIC(8,1) DEFAULT 0,
    "beratInduksi" NUMERIC(8,1) DEFAULT 0,
    "penInduksi" TEXT,
    "penAwal" TEXT,
    "penAkhir" TEXT,
    dof INTEGER DEFAULT 0,
    adg NUMERIC(6,2) DEFAULT 0,
    frame TEXT,
    vitamin INTEGER DEFAULT 1,
    "jenisSapi" TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reweight_rfid ON reweight(rfid);
CREATE INDEX IF NOT EXISTS idx_reweight_shipment ON reweight(shipment);
CREATE INDEX IF NOT EXISTS idx_reweight_penAwal ON reweight("penAwal");
CREATE INDEX IF NOT EXISTS idx_reweight_penAkhir ON reweight("penAkhir");
CREATE INDEX IF NOT EXISTS idx_reweight_tanggal ON reweight(tanggal);

-- 3. PENJUALAN (Sales) — Auto-increment ID
CREATE TABLE IF NOT EXISTS penjualan (
    id BIGSERIAL PRIMARY KEY,
    rfid TEXT,
    pembeli TEXT,
    "tanggalJual" DATE,
    eartag TEXT,
    shipment TEXT,
    berat NUMERIC(8,1) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_penjualan_rfid ON penjualan(rfid);
CREATE INDEX IF NOT EXISTS idx_penjualan_pembeli ON penjualan(pembeli);
CREATE INDEX IF NOT EXISTS idx_penjualan_tanggalJual ON penjualan("tanggalJual");

-- 4. MASTER DATA — Composite key: (type, value)
CREATE TABLE IF NOT EXISTS master_data (
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (type, value)
);

CREATE INDEX IF NOT EXISTS idx_master_data_type ON master_data(type);

-- 5. USERS — Primary key: username
CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. SETTINGS — Key-value store
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. SYNC LOG — Activity log
CREATE TABLE IF NOT EXISTS sync_log (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT now(),
    action TEXT,
    detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_log_timestamp ON sync_log(timestamp);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- Enable RLS but allow all operations with anon key
-- (for offline-first PWA with simple auth)
-- ============================================

ALTER TABLE induksi ENABLE ROW LEVEL SECURITY;
ALTER TABLE reweight ENABLE ROW LEVEL SECURITY;
ALTER TABLE penjualan ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated/anon users
CREATE POLICY "Allow all for anon" ON induksi FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON reweight FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON penjualan FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON master_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON sync_log FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- DONE! All tables are ready for sync.
-- 
-- Next steps:
-- 1. Copy your Supabase URL and anon key
-- 2. Paste them into config.js or configure via 
--    Settings → Supabase → Setup in the app
-- ============================================
