-- Add admin_notes column to profiles for admin panel user management
-- This allows admins to add private notes about users (support interactions, special arrangements, etc.)

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN profiles.admin_notes IS 'Private admin notes about this user (not visible to the user)';
