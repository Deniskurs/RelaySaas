-- Migration: Multi-Account MetaTrader Support
-- Allows users to connect multiple MT4/MT5 accounts

-- ============================================
-- Table: user_mt_accounts
-- ============================================
CREATE TABLE IF NOT EXISTS user_mt_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Account identification
  account_alias TEXT NOT NULL,        -- "Main Account", "Scalping", etc.

  -- MetaTrader credentials
  mt_login TEXT NOT NULL,
  mt_server TEXT NOT NULL,
  mt_platform TEXT DEFAULT 'mt5' CHECK (mt_platform IN ('mt4', 'mt5')),
  metaapi_account_id TEXT,

  -- Status flags
  is_active BOOLEAN DEFAULT TRUE,     -- Execute trades on this account?
  is_connected BOOLEAN DEFAULT FALSE, -- Current connection status
  is_primary BOOLEAN DEFAULT FALSE,   -- Default account for backward compat

  -- Future: copy trading extensibility (commented out for Phase 1)
  -- account_role TEXT DEFAULT 'personal' CHECK (account_role IN ('personal', 'provider', 'copier')),
  -- provider_account_id UUID REFERENCES user_mt_accounts(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, mt_login, mt_server),
  UNIQUE(metaapi_account_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_mt_accounts_user_id ON user_mt_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mt_accounts_active ON user_mt_accounts(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_mt_accounts_primary ON user_mt_accounts(user_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_mt_accounts_metaapi ON user_mt_accounts(metaapi_account_id) WHERE metaapi_account_id IS NOT NULL;

-- ============================================
-- Trigger: Ensure only one primary account per user
-- ============================================
CREATE OR REPLACE FUNCTION ensure_single_primary_account()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this account as primary, unset all other primary accounts for this user
  IF NEW.is_primary = TRUE THEN
    UPDATE user_mt_accounts
    SET is_primary = FALSE
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_primary = TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_primary ON user_mt_accounts;
CREATE TRIGGER trigger_ensure_single_primary
  BEFORE INSERT OR UPDATE ON user_mt_accounts
  FOR EACH ROW
  WHEN (NEW.is_primary = TRUE)
  EXECUTE FUNCTION ensure_single_primary_account();

-- ============================================
-- Trigger: Sync primary account to user_credentials
-- For backward compatibility with existing code
-- ============================================
CREATE OR REPLACE FUNCTION sync_primary_to_user_credentials()
RETURNS TRIGGER AS $$
BEGIN
  -- When an account becomes primary, update user_credentials
  IF NEW.is_primary = TRUE THEN
    UPDATE user_credentials
    SET
      mt_login = NEW.mt_login,
      mt_server = NEW.mt_server,
      mt_platform = NEW.mt_platform,
      metaapi_account_id = NEW.metaapi_account_id,
      mt_connected = NEW.is_connected,
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_primary_to_credentials ON user_mt_accounts;
CREATE TRIGGER trigger_sync_primary_to_credentials
  AFTER INSERT OR UPDATE ON user_mt_accounts
  FOR EACH ROW
  WHEN (NEW.is_primary = TRUE)
  EXECUTE FUNCTION sync_primary_to_user_credentials();

-- ============================================
-- Trigger: Update updated_at timestamp
-- ============================================
DROP TRIGGER IF EXISTS update_user_mt_accounts_updated_at ON user_mt_accounts;
CREATE TRIGGER update_user_mt_accounts_updated_at
  BEFORE UPDATE ON user_mt_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE user_mt_accounts ENABLE ROW LEVEL SECURITY;

-- Users can view their own accounts
DROP POLICY IF EXISTS "Users can view own mt accounts" ON user_mt_accounts;
CREATE POLICY "Users can view own mt accounts" ON user_mt_accounts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own accounts
DROP POLICY IF EXISTS "Users can insert own mt accounts" ON user_mt_accounts;
CREATE POLICY "Users can insert own mt accounts" ON user_mt_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own accounts
DROP POLICY IF EXISTS "Users can update own mt accounts" ON user_mt_accounts;
CREATE POLICY "Users can update own mt accounts" ON user_mt_accounts
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own accounts
DROP POLICY IF EXISTS "Users can delete own mt accounts" ON user_mt_accounts;
CREATE POLICY "Users can delete own mt accounts" ON user_mt_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can view all accounts
DROP POLICY IF EXISTS "Admins can view all mt accounts" ON user_mt_accounts;
CREATE POLICY "Admins can view all mt accounts" ON user_mt_accounts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role has full access
DROP POLICY IF EXISTS "Service can manage mt accounts" ON user_mt_accounts;
CREATE POLICY "Service can manage mt accounts" ON user_mt_accounts
  FOR ALL USING (true);

-- ============================================
-- Migrate existing data from user_credentials
-- ============================================
-- Insert existing MT accounts from user_credentials as primary accounts
INSERT INTO user_mt_accounts (
  user_id,
  account_alias,
  mt_login,
  mt_server,
  mt_platform,
  metaapi_account_id,
  is_active,
  is_connected,
  is_primary,
  created_at,
  updated_at
)
SELECT
  uc.user_id,
  'Main Account' as account_alias,
  uc.mt_login,
  uc.mt_server,
  COALESCE(uc.mt_platform, 'mt5') as mt_platform,
  uc.metaapi_account_id,
  TRUE as is_active,
  COALESCE(uc.mt_connected, FALSE) as is_connected,
  TRUE as is_primary,  -- Existing accounts become primary
  uc.created_at,
  uc.updated_at
FROM user_credentials uc
WHERE uc.mt_login IS NOT NULL
  AND uc.mt_server IS NOT NULL
  AND NOT EXISTS (
    -- Don't duplicate if already migrated
    SELECT 1 FROM user_mt_accounts uma
    WHERE uma.user_id = uc.user_id
      AND uma.mt_login = uc.mt_login
      AND uma.mt_server = uc.mt_server
  );

-- ============================================
-- Grant permissions
-- ============================================
GRANT ALL ON user_mt_accounts TO authenticated;
GRANT ALL ON user_mt_accounts TO service_role;
