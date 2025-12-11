-- Create System User Profile for Single-User Mode
-- Run this in Supabase SQL Editor

-- This creates a "system user" that satisfies foreign key constraints
-- for single-user/legacy mode operation.

-- First, insert into auth.users (Supabase requires this for FK)
-- The system user won't be able to log in normally but will satisfy FK constraints
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  role,
  aud
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'system@localhost',
  '',
  NOW(),
  NOW(),
  NOW(),
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Create the system profile
INSERT INTO profiles (
  id,
  email,
  full_name,
  role,
  status,
  onboarding_step
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'system@localhost',
  'System User',
  'admin',
  'active',
  'complete'
)
ON CONFLICT (id) DO NOTHING;

-- Create user_credentials entry for system user
INSERT INTO user_credentials (user_id)
VALUES ('00000000-0000-0000-0000-000000000000')
ON CONFLICT (user_id) DO NOTHING;

-- Create settings for the system user
INSERT INTO user_settings_v2 (user_id)
VALUES ('00000000-0000-0000-0000-000000000000')
ON CONFLICT (user_id) DO NOTHING;
