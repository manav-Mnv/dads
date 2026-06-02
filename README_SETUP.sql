-- ============================================================
-- SONA GOLD TRACKER — Supabase Database Setup
-- Run this entire file in your Supabase SQL Editor
-- Project: Settings → SQL Editor → New Query → Paste → Run
-- ============================================================

-- ── RAW ENTRIES TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raw_entries (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name   TEXT        NOT NULL,
  received_date   DATE        NOT NULL,
  weight_g        NUMERIC     NOT NULL DEFAULT 0,
  weight_mg       NUMERIC     NOT NULL DEFAULT 0,
  purity          NUMERIC     NOT NULL,        -- % purity of received gold
  ordered_purity  NUMERIC,                     -- % purity customer ordered
  fine_gold       NUMERIC     NOT NULL,        -- computed: total_weight * purity / 100
  settled         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── ORDERS TABLE (completed chains) ──────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name    TEXT        NOT NULL,
  raw_entry_id     UUID        REFERENCES raw_entries(id) ON DELETE SET NULL,
  raw_date         DATE,
  raw_fine_gold    NUMERIC     NOT NULL,        -- fine gold from raw entry
  completed_date   DATE,
  chain_weight_g   NUMERIC     NOT NULL DEFAULT 0,
  chain_weight_mg  NUMERIC     NOT NULL DEFAULT 0,
  chain_purity     NUMERIC     NOT NULL,
  chain_fine_gold  NUMERIC     NOT NULL,        -- computed: chain_weight * chain_purity / 100
  gauge_mm         NUMERIC,
  diff             NUMERIC     NOT NULL,        -- raw_fine_gold - chain_fine_gold (+ = dad returns, - = customer pays)
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ── INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_raw_entries_customer    ON raw_entries (customer_name);
CREATE INDEX IF NOT EXISTS idx_raw_entries_settled     ON raw_entries (settled);
CREATE INDEX IF NOT EXISTS idx_raw_entries_date        ON raw_entries (received_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer         ON orders (customer_name);
CREATE INDEX IF NOT EXISTS idx_orders_date             ON orders (completed_date DESC);

-- ── ROW LEVEL SECURITY (RLS) ──────────────────────────────────
-- By default, allow all operations using the anon key.
-- For a private family app, this is fine. For multi-user auth,
-- add Supabase Auth and scope rows by user_id.

ALTER TABLE raw_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;

-- Allow full access with the anon key (single-user family app)
CREATE POLICY "Allow all for anon" ON raw_entries
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon" ON orders
  FOR ALL USING (true) WITH CHECK (true);

-- ── AUTO-UPDATE updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_raw_entries_updated_at
  BEFORE UPDATE ON raw_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── DONE ──────────────────────────────────────────────────────
-- After running this, go to js/config.js and fill in:
-- SUPABASE_URL  = your project URL
-- SUPABASE_ANON = your project anon key
