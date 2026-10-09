-- Tracks the last open/closed state the weekly-schedule auto-switcher applied
-- to vendors.is_open, so it only flips the toggle at opening/closing time.
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "schedule_state" boolean;
