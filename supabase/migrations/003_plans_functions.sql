-- Migration: Plan-related functions and triggers
-- Provides helper functions for plan limit enforcement and usage tracking

-- =============================================================================
-- Function: Increment daily signal count
-- Called when a signal is successfully executed
-- =============================================================================
CREATE OR REPLACE FUNCTION increment_signal_count(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_count INTEGER;
    v_tier TEXT;
    v_pro_day_expires TIMESTAMPTZ;
    v_effective_tier TEXT;
    v_limit INTEGER;
BEGIN
    -- Get current usage and tier
    SELECT
        COALESCE(signals_used_today, 0),
        COALESCE(subscription_tier, 'free'),
        pro_day_expires_at
    INTO v_current_count, v_tier, v_pro_day_expires
    FROM profiles
    WHERE id = p_user_id;

    -- Determine effective tier (considering Pro Day)
    v_effective_tier := v_tier;
    IF v_pro_day_expires IS NOT NULL AND v_pro_day_expires > NOW() THEN
        v_effective_tier := 'pro';
    END IF;

    -- Get signal limit for tier
    v_limit := CASE v_effective_tier
        WHEN 'free' THEN 5
        WHEN 'pro' THEN NULL  -- Unlimited
        WHEN 'premium' THEN NULL  -- Unlimited
        ELSE 5
    END;

    -- Check if limit would be exceeded
    IF v_limit IS NOT NULL AND v_current_count >= v_limit THEN
        RETURN FALSE;  -- Limit reached
    END IF;

    -- Increment count
    UPDATE profiles
    SET signals_used_today = COALESCE(signals_used_today, 0) + 1
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- Function: Check signal limit
-- Returns whether user can execute another signal
-- =============================================================================
CREATE OR REPLACE FUNCTION check_signal_limit(p_user_id UUID)
RETURNS TABLE (
    allowed BOOLEAN,
    current_count INTEGER,
    signal_limit INTEGER,
    effective_tier TEXT
) AS $$
DECLARE
    v_current_count INTEGER;
    v_tier TEXT;
    v_pro_day_expires TIMESTAMPTZ;
    v_effective_tier TEXT;
    v_limit INTEGER;
BEGIN
    -- Get current usage and tier
    SELECT
        COALESCE(signals_used_today, 0),
        COALESCE(subscription_tier, 'free'),
        pro_day_expires_at
    INTO v_current_count, v_tier, v_pro_day_expires
    FROM profiles
    WHERE id = p_user_id;

    -- Determine effective tier (considering Pro Day)
    v_effective_tier := v_tier;
    IF v_pro_day_expires IS NOT NULL AND v_pro_day_expires > NOW() THEN
        v_effective_tier := 'pro';
    END IF;

    -- Get signal limit for tier
    v_limit := CASE v_effective_tier
        WHEN 'free' THEN 5
        WHEN 'pro' THEN NULL  -- Unlimited
        WHEN 'premium' THEN NULL  -- Unlimited
        ELSE 5
    END;

    RETURN QUERY SELECT
        (v_limit IS NULL OR v_current_count < v_limit) AS allowed,
        v_current_count AS current_count,
        v_limit AS signal_limit,
        v_effective_tier AS effective_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- Function: Get usage summary for a user
-- Returns all usage counts and limits in one call
-- =============================================================================
CREATE OR REPLACE FUNCTION get_usage_summary(p_user_id UUID)
RETURNS TABLE (
    signals_today INTEGER,
    signals_limit INTEGER,
    accounts_connected INTEGER,
    accounts_limit INTEGER,
    channels_active INTEGER,
    channels_limit INTEGER,
    tier TEXT,
    effective_tier TEXT,
    is_pro_day_active BOOLEAN
) AS $$
DECLARE
    v_tier TEXT;
    v_pro_day_expires TIMESTAMPTZ;
    v_effective_tier TEXT;
    v_signals_today INTEGER;
    v_accounts INTEGER;
    v_channels INTEGER;
    v_signals_limit INTEGER;
    v_accounts_limit INTEGER;
    v_channels_limit INTEGER;
BEGIN
    -- Get profile data
    SELECT
        COALESCE(signals_used_today, 0),
        COALESCE(subscription_tier, 'free'),
        pro_day_expires_at
    INTO v_signals_today, v_tier, v_pro_day_expires
    FROM profiles
    WHERE id = p_user_id;

    -- Determine effective tier
    v_effective_tier := v_tier;
    IF v_pro_day_expires IS NOT NULL AND v_pro_day_expires > NOW() THEN
        v_effective_tier := 'pro';
    END IF;

    -- Count accounts
    SELECT COUNT(*)::INTEGER INTO v_accounts
    FROM user_credentials
    WHERE user_id = p_user_id;

    -- Count channels
    SELECT COALESCE(array_length(telegram_channel_ids, 1), 0)::INTEGER INTO v_channels
    FROM user_settings_v2
    WHERE user_id = p_user_id;

    -- Get limits based on effective tier
    v_signals_limit := CASE v_effective_tier
        WHEN 'free' THEN 5
        ELSE NULL  -- Unlimited for pro/premium
    END;

    v_accounts_limit := CASE v_effective_tier
        WHEN 'free' THEN 1
        WHEN 'pro' THEN 3
        WHEN 'premium' THEN 10
        ELSE 1
    END;

    v_channels_limit := CASE v_effective_tier
        WHEN 'free' THEN 2
        WHEN 'pro' THEN 5
        ELSE NULL  -- Unlimited for premium
    END;

    RETURN QUERY SELECT
        COALESCE(v_signals_today, 0) AS signals_today,
        v_signals_limit AS signals_limit,
        COALESCE(v_accounts, 0) AS accounts_connected,
        v_accounts_limit AS accounts_limit,
        COALESCE(v_channels, 0) AS channels_active,
        v_channels_limit AS channels_limit,
        v_tier AS tier,
        v_effective_tier AS effective_tier,
        (v_pro_day_expires IS NOT NULL AND v_pro_day_expires > NOW()) AS is_pro_day_active;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- Grant execute permissions to authenticated users
-- =============================================================================
GRANT EXECUTE ON FUNCTION increment_signal_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_signal_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_usage_summary(UUID) TO authenticated;

-- Also grant to service role for backend operations
GRANT EXECUTE ON FUNCTION increment_signal_count(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION check_signal_limit(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_usage_summary(UUID) TO service_role;
