-- Migration: Set up daily signal reset cron job
--
-- PREREQUISITES (do these in Dashboard FIRST):
--   1. Dashboard > Database > Extensions > Enable "pg_cron"
--   2. Dashboard > Database > Extensions > Enable "pg_net"
--
-- Then run this SQL in Dashboard > SQL Editor

-- =============================================================================
-- Schedule the Edge Function to run at midnight UTC daily
-- =============================================================================

SELECT cron.schedule(
  'reset-daily-signals',           -- Job name (unique identifier)
  '0 0 * * *',                     -- Cron: Every day at 00:00 UTC
  $$
    SELECT net.http_post(
      url := 'https://jvgeyxoiekgvfwiixvql.supabase.co/functions/v1/reset-daily-signals',
      headers := jsonb_build_object(
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2Z2V5eG9pZWtndmZ3aWl4dnFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NDc0MjAsImV4cCI6MjA4MTAyMzQyMH0.5_57sqZ61hxf4weilVNFEmsj4uwM8XyyZvBp1LOfQlo',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- =============================================================================
-- Verify the job was created
-- =============================================================================
-- SELECT * FROM cron.job;

-- =============================================================================
-- To manually trigger a test run:
-- =============================================================================
-- SELECT net.http_post(
--   url := 'https://jvgeyxoiekgvfwiixvql.supabase.co/functions/v1/reset-daily-signals',
--   headers := jsonb_build_object(
--     'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2Z2V5eG9pZWtndmZ3aWl4dnFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NDc0MjAsImV4cCI6MjA4MTAyMzQyMH0.5_57sqZ61hxf4weilVNFEmsj4uwM8XyyZvBp1LOfQlo',
--     'Content-Type', 'application/json'
--   ),
--   body := '{}'::jsonb
-- );

-- =============================================================================
-- To remove the job if needed:
-- =============================================================================
-- SELECT cron.unschedule('reset-daily-signals');

-- =============================================================================
-- To check job execution history:
-- =============================================================================
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
