-- Migration: Add MT account tracking to trades
-- Enables tracking which MT account executed each trade for multi-account support

-- ============================================
-- Add MT account reference to trades_v2
-- ============================================
ALTER TABLE trades_v2
ADD COLUMN IF NOT EXISTS mt_account_id UUID REFERENCES user_mt_accounts(id) ON DELETE SET NULL;

-- Index for efficient queries by MT account
CREATE INDEX IF NOT EXISTS idx_trades_v2_mt_account_id ON trades_v2(mt_account_id);

-- Composite index for sync queries by user and account
CREATE INDEX IF NOT EXISTS idx_trades_v2_user_mt_account ON trades_v2(user_id, mt_account_id);

-- ============================================
-- Backfill existing trades with primary account
-- ============================================
-- Link existing trades to the user's primary MT account
UPDATE trades_v2 t
SET mt_account_id = (
    SELECT uma.id
    FROM user_mt_accounts uma
    WHERE uma.user_id = t.user_id
      AND uma.is_primary = TRUE
    LIMIT 1
)
WHERE t.mt_account_id IS NULL;

-- ============================================
-- Comment for documentation
-- ============================================
COMMENT ON COLUMN trades_v2.mt_account_id IS 'References the specific MT account that executed this trade. Allows tracking trades across multiple accounts per user.';
