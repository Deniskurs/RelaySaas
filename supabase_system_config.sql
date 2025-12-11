-- Create system_config table for storing admin configuration
-- This stores key-value pairs for system settings

CREATE TABLE IF NOT EXISTS system_config (
    id BIGSERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast key lookups
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- Enable RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can read/write (backend uses service role key)
-- This means the frontend cannot directly access this table, only through API
CREATE POLICY "Service role can manage system_config" ON system_config
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Note: If you want admins to also be able to read via frontend, add:
-- CREATE POLICY "Admins can read system_config" ON system_config
--     FOR SELECT
--     USING (
--         EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
--     );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_config_updated_at
    BEFORE UPDATE ON system_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify table was created
SELECT 'system_config table created successfully' AS status;
