-- Migration: Add tp_lot_mode column to user_settings_v2
-- This column controls how lot sizes are split across multiple take profits
-- "split" = divide lot across TPs, "equal" = same lot for each TP

ALTER TABLE user_settings_v2
ADD COLUMN IF NOT EXISTS tp_lot_mode TEXT DEFAULT 'split' CHECK (tp_lot_mode IN ('split', 'equal'));
