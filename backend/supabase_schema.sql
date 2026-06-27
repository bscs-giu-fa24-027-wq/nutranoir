-- ═══════════════════════════════════════════════════════
--  NUTRANOIR DATABASE SCHEMA
--  Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- ── USERS TABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  phone       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── ORDERS TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  order_ref         TEXT UNIQUE NOT NULL,
  items             JSONB NOT NULL,
  shipping_address  JSONB NOT NULL,
  total_amount      NUMERIC(10,2) NOT NULL,
  status            TEXT DEFAULT 'pending',       -- pending | confirmed | shipped | delivered | cancelled
  payment_status    TEXT DEFAULT 'unpaid',        -- unpaid | initiated | paid | failed | refunded
  jazzcash_txn_ref  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── AUTO-UPDATE updated_at ────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── INDEXES ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_ref ON orders(order_ref);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ── ROW LEVEL SECURITY (optional but recommended) ─────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Since we use service role key from backend, RLS won't block our queries.
-- These policies are just for safety if anon key is ever used directly.
CREATE POLICY "Service role full access users" ON users USING (true);
CREATE POLICY "Service role full access orders" ON orders USING (true);
