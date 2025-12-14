-- Migration: Add dismissed column to signals_v2 for persistent signal clearing
-- This allows users to dismiss/clear signals and have that state persist across sessions

-- Add dismissed column
ALTER TABLE signals_v2
ADD COLUMN IF NOT EXISTS dismissed BOOLEAN DEFAULT FALSE;

-- Add dismissed_at timestamp for tracking when signals were dismissed
ALTER TABLE signals_v2
ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

-- Create index for efficient filtering of non-dismissed signals
CREATE INDEX IF NOT EXISTS idx_signals_v2_dismissed ON signals_v2(dismissed);

-- Create composite index for common query pattern: user's non-dismissed signals
CREATE INDEX IF NOT EXISTS idx_signals_v2_user_dismissed ON signals_v2(user_id, dismissed);
