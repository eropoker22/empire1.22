CREATE TABLE IF NOT EXISTS empire_admin_sessions (
  id text PRIMARY KEY,
  admin_session_id text NOT NULL UNIQUE,
  token_hash text NOT NULL UNIQUE,
  actor_id text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('viewer', 'operator', 'owner')),
  authentication_method text NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS empire_admin_sessions_token_idx ON empire_admin_sessions (token_hash, expires_at);

CREATE TABLE IF NOT EXISTS empire_admin_access_audit (
  id text PRIMARY KEY,
  admin_session_id text,
  actor_id text,
  role text,
  action text NOT NULL,
  target_instance_id text,
  result text NOT NULL,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS empire_admin_access_audit_created_idx ON empire_admin_access_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS empire_admin_access_audit_actor_idx ON empire_admin_access_audit (actor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS empire_admin_login_failures (
  id text PRIMARY KEY,
  fingerprint_hash text NOT NULL,
  actor_hash text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS empire_admin_login_failures_fingerprint_idx ON empire_admin_login_failures (fingerprint_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS empire_admin_login_failures_actor_idx ON empire_admin_login_failures (actor_hash, created_at DESC);
