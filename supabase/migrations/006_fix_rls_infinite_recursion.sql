-- Migration: Fix RLS infinite recursion on profiles table
-- The admin policies were querying profiles to check admin status, causing recursion

-- Create a security definer function to check admin status (bypasses RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- Fix profiles table policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- Fix system_config table policies
DROP POLICY IF EXISTS "Admins can view system config" ON system_config;
DROP POLICY IF EXISTS "Admins can update system config" ON system_config;

CREATE POLICY "Admins can view system config" ON system_config
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can update system config" ON system_config
  FOR ALL USING (is_admin());

-- Fix activity_logs table policies
DROP POLICY IF EXISTS "Admins can view activity logs" ON activity_logs;

CREATE POLICY "Admins can view activity logs" ON activity_logs
  FOR SELECT USING (is_admin());
