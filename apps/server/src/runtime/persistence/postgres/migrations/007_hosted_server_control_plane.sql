CREATE TABLE IF NOT EXISTS empire_admin_users (
  id text PRIMARY KEY,
  admin_user_id text NOT NULL UNIQUE,
  username text NOT NULL,
  normalized_username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  password_algorithm text NOT NULL,
  password_parameters jsonb NOT NULL,
  password_version integer NOT NULL DEFAULT 1 CHECK (password_version > 0),
  role text NOT NULL CHECK (role IN ('viewer', 'operator', 'owner')),
  status text NOT NULL CHECK (status IN ('active', 'disabled', 'locked')),
  display_name text NOT NULL,
  last_login_at timestamptz,
  password_changed_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

ALTER TABLE empire_admin_sessions
  ADD COLUMN IF NOT EXISTS admin_user_id text REFERENCES empire_admin_users (admin_user_id),
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS password_version integer,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS empire_admin_sessions_user_idx
  ON empire_admin_sessions (admin_user_id, expires_at DESC);

ALTER TABLE empire_admin_login_failures
  ADD COLUMN IF NOT EXISTS username_hash text,
  ADD COLUMN IF NOT EXISTS combination_hash text;

CREATE INDEX IF NOT EXISTS empire_admin_login_failures_username_idx
  ON empire_admin_login_failures (username_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS empire_admin_login_failures_combination_idx
  ON empire_admin_login_failures (combination_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS empire_hosted_server_instances (
  id text PRIMARY KEY,
  server_instance_id text NOT NULL UNIQUE REFERENCES empire_server_instances (server_instance_id),
  mode text NOT NULL CHECK (mode IN ('free', 'war')),
  display_name text NOT NULL,
  region text NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  status text NOT NULL CHECK (status IN ('requested', 'provisioning', 'lobby', 'running', 'restarting', 'paused', 'stopped', 'failed', 'archived')),
  join_policy text NOT NULL CHECK (join_policy IN ('closed', 'invite_only', 'open')),
  provisioning_state text NOT NULL CHECK (provisioning_state IN ('requested', 'provisioning', 'ready', 'failed')),
  world_seed text NOT NULL,
  config_version integer NOT NULL DEFAULT 1,
  map_composition jsonb NOT NULL,
  initial_snapshot_id text,
  current_snapshot_id text,
  runtime_lease_owner_id text,
  runtime_lease_expires_at timestamptz,
  last_worker_heartbeat_at timestamptz,
  last_started_at timestamptz,
  last_paused_at timestamptz,
  last_stopped_at timestamptz,
  last_error_code text,
  created_by_admin_user_id text NOT NULL REFERENCES empire_admin_users (admin_user_id),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK (status <> 'running' OR (
    runtime_lease_owner_id IS NOT NULL AND runtime_lease_expires_at IS NOT NULL
  ))
);

CREATE INDEX IF NOT EXISTS empire_hosted_server_instances_status_idx
  ON empire_hosted_server_instances (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS empire_hosted_server_instances_public_idx
  ON empire_hosted_server_instances (join_policy, provisioning_state, status, last_worker_heartbeat_at DESC);

CREATE TABLE IF NOT EXISTS empire_hosted_server_idempotency (
  id text PRIMARY KEY,
  admin_user_id text NOT NULL REFERENCES empire_admin_users (admin_user_id),
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  resource_id text NOT NULL,
  response_payload jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (admin_user_id, operation, idempotency_key)
);

CREATE TABLE IF NOT EXISTS empire_hosted_server_provisioning_jobs (
  id text PRIMARY KEY,
  job_id text NOT NULL UNIQUE,
  server_instance_id text NOT NULL UNIQUE REFERENCES empire_hosted_server_instances (server_instance_id),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  status text NOT NULL CHECK (status IN ('pending', 'claimed', 'completed', 'failed')),
  available_at timestamptz NOT NULL,
  claimed_by_worker_id text,
  claimed_until timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS empire_hosted_provisioning_claim_idx
  ON empire_hosted_server_provisioning_jobs (status, available_at, claimed_until);

CREATE TABLE IF NOT EXISTS empire_hosted_server_action_requests (
  id text PRIMARY KEY,
  action_request_id text NOT NULL UNIQUE,
  server_instance_id text NOT NULL REFERENCES empire_hosted_server_instances (server_instance_id),
  admin_user_id text NOT NULL REFERENCES empire_admin_users (admin_user_id),
  action text NOT NULL CHECK (action IN ('open-joins', 'close-joins', 'start', 'pause', 'resume', 'restart', 'stop')),
  reason text NOT NULL,
  expected_version bigint NOT NULL,
  status text NOT NULL CHECK (status IN ('requested', 'processing', 'completed', 'failed')),
  claimed_by_worker_id text,
  claimed_until timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS empire_hosted_actions_claim_idx
  ON empire_hosted_server_action_requests (status, created_at, claimed_until);

CREATE TABLE IF NOT EXISTS empire_hosted_worker_heartbeats (
  id text PRIMARY KEY,
  worker_id text NOT NULL UNIQUE,
  region text NOT NULL,
  started_at timestamptz NOT NULL,
  last_heartbeat_at timestamptz NOT NULL,
  build_sha text NOT NULL,
  status text NOT NULL CHECK (status IN ('online', 'draining', 'stopped', 'failed')),
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS empire_hosted_instance_heartbeats (
  id text PRIMARY KEY,
  server_instance_id text NOT NULL UNIQUE REFERENCES empire_hosted_server_instances (server_instance_id),
  worker_id text NOT NULL REFERENCES empire_hosted_worker_heartbeats (worker_id),
  lease_expires_at timestamptz NOT NULL,
  last_tick integer NOT NULL CHECK (last_tick >= 0),
  last_snapshot_at timestamptz,
  last_error_code text,
  last_heartbeat_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS empire_hosted_instance_heartbeats_freshness_idx
  ON empire_hosted_instance_heartbeats (last_heartbeat_at DESC, lease_expires_at DESC);
