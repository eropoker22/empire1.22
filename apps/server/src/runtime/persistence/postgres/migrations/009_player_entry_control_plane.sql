CREATE TABLE IF NOT EXISTS empire_accounts (
  id text PRIMARY KEY,
  account_id text NOT NULL UNIQUE,
  username text NOT NULL,
  normalized_username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  password_algorithm text NOT NULL CHECK (password_algorithm = 'scrypt'),
  password_parameters jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'disabled', 'locked')),
  display_name text NOT NULL,
  gang_name text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  last_login_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE IF NOT EXISTS empire_account_sessions (
  id text PRIMARY KEY,
  session_id text NOT NULL UNIQUE,
  token_hash text NOT NULL UNIQUE,
  account_id text NOT NULL REFERENCES empire_accounts (account_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  revoked_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS empire_account_sessions_account_idx
  ON empire_account_sessions (account_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS empire_account_sessions_active_idx
  ON empire_account_sessions (token_hash, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS empire_server_memberships (
  id text PRIMARY KEY,
  membership_id text NOT NULL UNIQUE,
  account_id text NOT NULL REFERENCES empire_accounts (account_id),
  server_instance_id text NOT NULL REFERENCES empire_hosted_server_instances (server_instance_id),
  player_id text NOT NULL,
  reserved_spawn_district_id text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'setup_required', 'finalizing_setup', 'active', 'leave_pending', 'left_early', 'defeated', 'completed'
  )),
  confirm_idempotency_key text NOT NULL,
  confirm_request_hash text NOT NULL,
  setup_idempotency_key text,
  setup_request_hash text,
  faction_id text,
  avatar_id text,
  gang_color text,
  joined_at timestamptz NOT NULL,
  early_leave_deadline timestamptz,
  setup_completed_at timestamptz,
  early_leave_at timestamptz,
  completed_at timestamptz,
  starter_package_applied_at timestamptz,
  join_ticket_id text,
  last_error_code text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (server_instance_id, account_id),
  UNIQUE (server_instance_id, player_id),
  UNIQUE (account_id, confirm_idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS empire_server_memberships_blocking_account_idx
  ON empire_server_memberships (account_id)
  WHERE status IN ('setup_required', 'finalizing_setup', 'active', 'leave_pending', 'defeated');

CREATE UNIQUE INDEX IF NOT EXISTS empire_server_memberships_reserved_district_idx
  ON empire_server_memberships (server_instance_id, reserved_spawn_district_id)
  WHERE status IN ('setup_required', 'finalizing_setup', 'active', 'leave_pending', 'defeated');

CREATE INDEX IF NOT EXISTS empire_server_memberships_history_idx
  ON empire_server_memberships (account_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS empire_server_membership_jobs (
  id text PRIMARY KEY,
  job_id text NOT NULL UNIQUE,
  membership_id text NOT NULL REFERENCES empire_server_memberships (membership_id),
  server_instance_id text NOT NULL REFERENCES empire_hosted_server_instances (server_instance_id),
  job_type text NOT NULL CHECK (job_type IN ('activate', 'leave')),
  status text NOT NULL CHECK (status IN ('pending', 'claimed', 'completed', 'failed')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  available_at timestamptz NOT NULL,
  claimed_by_worker_id text,
  claimed_until timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (membership_id, job_type)
);

CREATE INDEX IF NOT EXISTS empire_server_membership_jobs_claim_idx
  ON empire_server_membership_jobs (status, available_at, claimed_until);

CREATE TABLE IF NOT EXISTS empire_server_membership_events (
  id text PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  membership_id text NOT NULL REFERENCES empire_server_memberships (membership_id),
  server_instance_id text NOT NULL REFERENCES empire_hosted_server_instances (server_instance_id),
  account_id text NOT NULL REFERENCES empire_accounts (account_id),
  event_type text NOT NULL,
  result text NOT NULL CHECK (result IN ('accepted', 'completed', 'rejected')),
  error_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS empire_server_membership_events_membership_idx
  ON empire_server_membership_events (membership_id, created_at);

ALTER TABLE empire_hosted_join_reservations
  ADD COLUMN IF NOT EXISTS membership_id text REFERENCES empire_server_memberships (membership_id),
  ADD COLUMN IF NOT EXISTS reserved_spawn_district_id text;

CREATE UNIQUE INDEX IF NOT EXISTS empire_hosted_join_reservations_membership_idx
  ON empire_hosted_join_reservations (membership_id) WHERE membership_id IS NOT NULL;
