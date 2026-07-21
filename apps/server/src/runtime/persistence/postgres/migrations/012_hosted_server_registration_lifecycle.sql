ALTER TABLE empire_hosted_server_instances
  ADD COLUMN IF NOT EXISTS server_template text,
  ADD COLUMN IF NOT EXISTS registration_opens_at timestamptz,
  ADD COLUMN IF NOT EXISTS registration_closes_at timestamptz,
  ADD COLUMN IF NOT EXISTS registration_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS minimum_ready_players_to_start integer,
  ADD COLUMN IF NOT EXISTS registration_window_minutes integer,
  ADD COLUMN IF NOT EXISTS registration_schedule_version integer,
  ADD COLUMN IF NOT EXISTS registration_baseline_players integer,
  ADD COLUMN IF NOT EXISTS canonical_final_lockdown_trigger integer,
  ADD COLUMN IF NOT EXISTS canonical_first_elimination_tick integer,
  ADD COLUMN IF NOT EXISTS canonical_tick_rate_ms integer,
  ADD COLUMN IF NOT EXISTS effective_final_lockdown_trigger integer,
  ADD COLUMN IF NOT EXISTS effective_first_elimination_tick integer;

UPDATE empire_hosted_server_instances
SET server_template = COALESCE(server_template, 'full'),
    minimum_ready_players_to_start = COALESCE(minimum_ready_players_to_start, 2),
    registration_window_minutes = COALESCE(registration_window_minutes, 60),
    registration_schedule_version = COALESCE(registration_schedule_version, 0),
    canonical_final_lockdown_trigger = CASE
      WHEN mode = 'free' THEN COALESCE(canonical_final_lockdown_trigger, 8)
      ELSE canonical_final_lockdown_trigger
    END,
    canonical_first_elimination_tick = CASE
      WHEN mode = 'free' AND COALESCE(server_template, 'full') = 'full'
        THEN COALESCE(canonical_first_elimination_tick, 5760)
      WHEN mode = 'free' AND COALESCE(server_template, 'full') = 'control' THEN NULL
      ELSE canonical_first_elimination_tick
    END,
    canonical_tick_rate_ms = CASE
      WHEN mode = 'free' AND COALESCE(server_template, 'full') = 'full'
        THEN COALESCE(canonical_tick_rate_ms, 5000)
      WHEN mode = 'free' AND COALESCE(server_template, 'full') = 'control' THEN NULL
      ELSE canonical_tick_rate_ms
    END;

ALTER TABLE empire_hosted_server_instances
  ALTER COLUMN server_template SET NOT NULL,
  ALTER COLUMN minimum_ready_players_to_start SET NOT NULL,
  ALTER COLUMN registration_window_minutes SET NOT NULL,
  ALTER COLUMN registration_schedule_version SET NOT NULL;

ALTER TABLE empire_hosted_server_instances
  DROP CONSTRAINT IF EXISTS empire_hosted_server_template_check,
  DROP CONSTRAINT IF EXISTS empire_hosted_registration_minimum_players_check,
  DROP CONSTRAINT IF EXISTS empire_hosted_registration_window_minutes_check,
  DROP CONSTRAINT IF EXISTS empire_hosted_registration_schedule_pair_check,
  DROP CONSTRAINT IF EXISTS empire_hosted_registration_closed_at_check,
  DROP CONSTRAINT IF EXISTS empire_hosted_registration_schedule_version_check,
  DROP CONSTRAINT IF EXISTS empire_hosted_registration_baseline_check,
  DROP CONSTRAINT IF EXISTS empire_hosted_registration_canonical_lockdown_check,
  DROP CONSTRAINT IF EXISTS empire_hosted_registration_canonical_elimination_check,
  DROP CONSTRAINT IF EXISTS empire_hosted_registration_effective_lockdown_check,
  DROP CONSTRAINT IF EXISTS empire_hosted_registration_freeze_pair_check;

ALTER TABLE empire_hosted_server_instances
  ADD CONSTRAINT empire_hosted_server_template_check
    CHECK (server_template IN ('control', 'full')),
  ADD CONSTRAINT empire_hosted_registration_minimum_players_check
    CHECK (minimum_ready_players_to_start >= 2),
  ADD CONSTRAINT empire_hosted_registration_window_minutes_check
    CHECK (registration_window_minutes = 60),
  ADD CONSTRAINT empire_hosted_registration_schedule_pair_check
    CHECK ((registration_opens_at IS NULL AND registration_closes_at IS NULL)
      OR (registration_opens_at IS NOT NULL AND registration_closes_at IS NOT NULL
        AND registration_closes_at = registration_opens_at + interval '60 minutes')),
  ADD CONSTRAINT empire_hosted_registration_closed_at_check
    CHECK (registration_closed_at IS NULL OR (registration_opens_at IS NOT NULL
      AND registration_closes_at IS NOT NULL AND registration_closed_at >= registration_opens_at
      AND registration_closed_at <= registration_closes_at)),
  ADD CONSTRAINT empire_hosted_registration_schedule_version_check
    CHECK (registration_schedule_version >= 0),
  ADD CONSTRAINT empire_hosted_registration_baseline_check
    CHECK (registration_baseline_players IS NULL OR registration_baseline_players >= 0),
  ADD CONSTRAINT empire_hosted_registration_canonical_lockdown_check
    CHECK ((mode <> 'free' OR canonical_final_lockdown_trigger IS NOT NULL)
      AND (canonical_final_lockdown_trigger IS NULL OR canonical_final_lockdown_trigger >= 1)),
  ADD CONSTRAINT empire_hosted_registration_canonical_elimination_check
    CHECK ((mode <> 'free'
        OR (server_template = 'full' AND canonical_first_elimination_tick IS NOT NULL AND canonical_tick_rate_ms IS NOT NULL)
        OR (server_template = 'control' AND canonical_first_elimination_tick IS NULL AND canonical_tick_rate_ms IS NULL))
      AND (canonical_first_elimination_tick IS NULL OR canonical_first_elimination_tick >= 1)
      AND (canonical_tick_rate_ms IS NULL OR canonical_tick_rate_ms >= 1)),
  ADD CONSTRAINT empire_hosted_registration_effective_lockdown_check
    CHECK (effective_final_lockdown_trigger IS NULL OR (canonical_final_lockdown_trigger IS NOT NULL
      AND effective_final_lockdown_trigger >= 1
      AND effective_final_lockdown_trigger <= canonical_final_lockdown_trigger)),
  ADD CONSTRAINT empire_hosted_registration_freeze_pair_check
    CHECK ((registration_closed_at IS NULL AND registration_baseline_players IS NULL AND effective_final_lockdown_trigger IS NULL
      AND effective_first_elimination_tick IS NULL)
      OR (registration_closed_at IS NOT NULL AND registration_baseline_players IS NOT NULL
        AND effective_final_lockdown_trigger IS NOT NULL
        AND ((server_template = 'control' AND effective_first_elimination_tick IS NULL)
          OR (server_template = 'full' AND effective_first_elimination_tick IS NOT NULL
            AND effective_first_elimination_tick >= 0))));

CREATE INDEX IF NOT EXISTS empire_hosted_registration_schedule_idx
  ON empire_hosted_server_instances (registration_opens_at, registration_closes_at)
  WHERE registration_opens_at IS NOT NULL;

ALTER TABLE empire_hosted_server_action_requests
  ADD COLUMN IF NOT EXISTS action_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE empire_hosted_server_action_requests
  DROP CONSTRAINT IF EXISTS empire_hosted_server_action_requests_action_check,
  DROP CONSTRAINT IF EXISTS empire_hosted_server_action_requests_action_payload_check;

ALTER TABLE empire_hosted_server_action_requests
  ADD CONSTRAINT empire_hosted_server_action_requests_action_check CHECK (action IN (
    'open-joins', 'close-joins', 'schedule-registration', 'open-registration-now',
    'cancel-registration', 'close-registration-now', 'start', 'pause', 'resume', 'restart', 'stop'
  )),
  ADD CONSTRAINT empire_hosted_server_action_requests_action_payload_check
    CHECK (jsonb_typeof(action_payload) = 'object');
