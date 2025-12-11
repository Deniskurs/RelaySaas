-- Multi-Tenant SaaS Schema for Signal Copier
-- Run this in Supabase SQL Editor

-- ============================================
-- Table: profiles (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,

  -- Role & Status
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'onboarding', 'active', 'suspended')),
  onboarding_step TEXT DEFAULT 'telegram' CHECK (onboarding_step IN ('telegram', 'metatrader', 'settings', 'complete')),

  -- Subscription
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'pro', 'unlimited')),
  subscription_status TEXT DEFAULT 'inactive',
  subscription_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- Table: user_credentials (encrypted sensitive data)
-- ============================================
CREATE TABLE IF NOT EXISTS user_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Telegram (encrypted)
  telegram_api_id TEXT,
  telegram_api_hash TEXT,
  telegram_phone TEXT,
  telegram_session_encrypted TEXT,  -- Encrypted session string
  telegram_connected BOOLEAN DEFAULT FALSE,

  -- MetaTrader
  mt_login TEXT,
  mt_server TEXT,
  mt_platform TEXT DEFAULT 'mt5' CHECK (mt_platform IN ('mt4', 'mt5')),
  metaapi_account_id TEXT,  -- Created MetaApi account ID
  mt_connected BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================
-- Table: user_settings (trading parameters)
-- ============================================
-- First drop the old table if migrating from single-user
-- DROP TABLE IF EXISTS user_settings;

CREATE TABLE IF NOT EXISTS user_settings_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Risk Management
  max_risk_percent DECIMAL(5,2) DEFAULT 2.0,
  max_lot_size DECIMAL(10,4) DEFAULT 0.1,
  max_open_trades INTEGER DEFAULT 5,

  -- Lot Sizing
  lot_reference_balance DECIMAL(15,2) DEFAULT 500.0,
  lot_reference_size_gold DECIMAL(10,4) DEFAULT 0.04,
  lot_reference_size_default DECIMAL(10,4) DEFAULT 0.01,

  -- Execution
  auto_accept_symbols TEXT[] DEFAULT ARRAY['XAUUSD', 'GOLD'],
  gold_market_threshold DECIMAL(10,2) DEFAULT 3.0,
  split_tps BOOLEAN DEFAULT TRUE,
  tp_split_ratios DECIMAL[] DEFAULT ARRAY[0.5, 0.3, 0.2],
  enable_breakeven BOOLEAN DEFAULT TRUE,

  -- Broker
  symbol_suffix TEXT DEFAULT '',

  -- Telegram Channels
  telegram_channel_ids TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- System
  paused BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Auto-create settings for new profile
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user_credentials entry
  INSERT INTO public.user_credentials (user_id)
  VALUES (NEW.id);

  -- Create user_settings_v2 entry
  INSERT INTO public.user_settings_v2 (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile();

-- ============================================
-- Table: signals (per-user signals)
-- ============================================
CREATE TABLE IF NOT EXISTS signals_v2 (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Signal data
  raw_message TEXT NOT NULL,
  channel_name TEXT,
  channel_id TEXT,
  direction TEXT,
  symbol TEXT,
  entry_price DECIMAL(20,5),
  stop_loss DECIMAL(20,5),
  take_profits JSONB DEFAULT '[]',
  confidence DECIMAL(5,2),
  warnings JSONB DEFAULT '[]',

  -- Status
  status TEXT DEFAULT 'received',
  failure_reason TEXT,

  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT NOW(),
  parsed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_signals_v2_user_id ON signals_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_signals_v2_received_at ON signals_v2(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_v2_status ON signals_v2(status);

-- ============================================
-- Table: trades (per-user trades)
-- ============================================
CREATE TABLE IF NOT EXISTS trades_v2 (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  signal_id BIGINT REFERENCES signals_v2(id),

  -- Trade data
  order_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  lot_size DECIMAL(10,4) NOT NULL,
  entry_price DECIMAL(20,5),
  stop_loss DECIMAL(20,5),
  take_profit DECIMAL(20,5),
  tp_index INTEGER DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'pending',
  open_price DECIMAL(20,5),
  close_price DECIMAL(20,5),
  profit DECIMAL(20,2),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trades_v2_user_id ON trades_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_v2_status ON trades_v2(status);
CREATE INDEX IF NOT EXISTS idx_trades_v2_signal_id ON trades_v2(signal_id);

-- ============================================
-- Table: activity_logs (for admin monitoring)
-- ============================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can manage own credentials" ON user_credentials;
DROP POLICY IF EXISTS "Users can manage own settings" ON user_settings_v2;
DROP POLICY IF EXISTS "Users can view own signals" ON signals_v2;
DROP POLICY IF EXISTS "Users can view own trades" ON trades_v2;
DROP POLICY IF EXISTS "Admins can view activity logs" ON activity_logs;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- User credentials policies
CREATE POLICY "Users can view own credentials" ON user_credentials
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials" ON user_credentials
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials" ON user_credentials
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User settings policies
CREATE POLICY "Users can view own settings" ON user_settings_v2
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON user_settings_v2
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON user_settings_v2
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Signals policies
CREATE POLICY "Users can view own signals" ON signals_v2
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert signals" ON signals_v2
  FOR INSERT WITH CHECK (true);  -- Backend service will use service key

-- Trades policies
CREATE POLICY "Users can view own trades" ON trades_v2
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage trades" ON trades_v2
  FOR ALL USING (true);  -- Backend service will use service key

-- Activity logs policies (admin only read)
CREATE POLICY "Admins can view activity logs" ON activity_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service can insert activity logs" ON activity_logs
  FOR INSERT WITH CHECK (true);  -- Backend service will use service key

-- ============================================
-- Updated_at trigger function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_credentials_updated_at ON user_credentials;
CREATE TRIGGER update_user_credentials_updated_at
  BEFORE UPDATE ON user_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_v2_updated_at ON user_settings_v2;
CREATE TRIGGER update_user_settings_v2_updated_at
  BEFORE UPDATE ON user_settings_v2
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Grant permissions for authenticated users
-- ============================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant permissions for service role (backend)
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
