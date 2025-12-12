-- Migration: Update subscription tier values to match UI
-- Changes: basic -> pro (already exists), unlimited -> premium

-- Step 1: Update existing 'basic' users to 'pro'
UPDATE profiles SET subscription_tier = 'pro' WHERE subscription_tier = 'basic';

-- Step 2: Update existing 'unlimited' users to 'premium'
UPDATE profiles SET subscription_tier = 'premium' WHERE subscription_tier = 'unlimited';

-- Step 3: Alter the constraint to use new tier names
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'pro', 'premium'));

-- Step 4: Add usage tracking fields for plans feature
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signals_used_today INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signals_reset_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_day_eligible BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_day_activated_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_day_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consecutive_active_days INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_date DATE;

-- Function to reset daily signals at midnight UTC
CREATE OR REPLACE FUNCTION reset_daily_signals()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET signals_used_today = 0,
      signals_reset_at = NOW()
  WHERE signals_reset_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC');
END;
$$ LANGUAGE plpgsql;

-- Function to track consecutive active days and trigger Pro Day eligibility
CREATE OR REPLACE FUNCTION update_activity_streak()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is a new day of activity
  IF NEW.last_active_date IS DISTINCT FROM CURRENT_DATE THEN
    -- Check if consecutive (yesterday was the last active day)
    IF OLD.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN
      NEW.consecutive_active_days := OLD.consecutive_active_days + 1;
    ELSE
      NEW.consecutive_active_days := 1;
    END IF;

    NEW.last_active_date := CURRENT_DATE;

    -- Trigger Pro Day eligibility at 7 consecutive days (for free users)
    IF NEW.consecutive_active_days >= 7
       AND NEW.subscription_tier = 'free'
       AND NEW.pro_day_eligible = FALSE
       AND NEW.pro_day_activated_at IS NULL THEN
      NEW.pro_day_eligible := TRUE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for activity tracking
DROP TRIGGER IF EXISTS track_activity_streak ON profiles;
CREATE TRIGGER track_activity_streak
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  WHEN (NEW.last_seen_at IS DISTINCT FROM OLD.last_seen_at)
  EXECUTE FUNCTION update_activity_streak();
