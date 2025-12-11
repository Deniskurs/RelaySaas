-- System Configuration Table for Admin-Managed Settings
-- Run this in Supabase SQL Editor after 001_multi_tenant_schema.sql

-- ============================================
-- Table: system_config (admin-managed settings)
-- ============================================
CREATE TABLE IF NOT EXISTS system_config (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on key for fast lookups
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_system_config_updated_at ON system_config;
CREATE TRIGGER update_system_config_updated_at
  BEFORE UPDATE ON system_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read system config (via anon key)
CREATE POLICY "Admins can view system config" ON system_config
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admins can update system config (via anon key)
CREATE POLICY "Admins can update system config" ON system_config
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role can do everything (backend operations)
CREATE POLICY "Service can manage system config" ON system_config
  FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON system_config TO authenticated;
GRANT ALL ON system_config TO service_role;
GRANT USAGE, SELECT ON SEQUENCE system_config_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE system_config_id_seq TO service_role;

-- Insert default values (these will be overridden by env vars until set in admin panel)
INSERT INTO system_config (key, value, description) VALUES
  ('llm_model', 'claude-haiku-4-5-20251001', 'Claude model ID for signal parsing'),
  ('default_lot_size', '0.01', 'Default lot size for trades'),
  ('max_lot_size', '0.1', 'Maximum allowed lot size'),
  ('max_open_trades', '5', 'Maximum concurrent open trades'),
  ('max_risk_percent', '2.0', 'Maximum risk percentage per trade'),
  ('symbol_suffix', '', 'Broker-specific symbol suffix (e.g., .ecn)'),
  ('split_tps', 'true', 'Split positions across multiple take profits'),
  ('tp_split_ratios', '0.5,0.3,0.2', 'Ratios for splitting positions at TPs'),
  ('enable_breakeven', 'true', 'Move SL to entry after first TP hit')
ON CONFLICT (key) DO NOTHING;

-- Note: API keys (anthropic_api_key, metaapi_token) are NOT inserted by default
-- They must be set via the admin panel
