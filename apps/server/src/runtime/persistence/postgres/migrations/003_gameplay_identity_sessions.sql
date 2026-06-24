-- Server-authoritative identity/session flow.
-- Player ids are bound to account ids per server instance; join tickets and sessions
-- are persistent so retries, logout and revocation are enforceable.

ALTER TABLE empire_player_registrations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS empire_player_registrations_instance_account_unique
  ON empire_player_registrations (server_instance_id, account_id)
  WHERE account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS empire_player_registrations_instance_player_unique
  ON empire_player_registrations (server_instance_id, player_id);

CREATE TABLE IF NOT EXISTS empire_join_tickets (
  id text PRIMARY KEY,
  ticket_id text NOT NULL UNIQUE,
  account_id text NOT NULL,
  server_instance_id text NOT NULL REFERENCES empire_server_instances (server_instance_id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1,
  mode text NOT NULL,
  faction_id text,
  nonce text NOT NULL,
  status text NOT NULL DEFAULT 'issued',
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS empire_join_tickets_account_server_idx
  ON empire_join_tickets (account_id, server_instance_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS empire_join_tickets_expires_idx
  ON empire_join_tickets (expires_at);

CREATE INDEX IF NOT EXISTS empire_join_tickets_consumed_idx
  ON empire_join_tickets (consumed_at);

CREATE TABLE IF NOT EXISTS empire_gameplay_sessions (
  id text PRIMARY KEY,
  session_id text NOT NULL UNIQUE,
  registration_id text NOT NULL REFERENCES empire_player_registrations (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  account_id text NOT NULL,
  player_id text NOT NULL,
  server_instance_id text NOT NULL REFERENCES empire_server_instances (server_instance_id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  revoked_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS empire_gameplay_sessions_token_hash_idx
  ON empire_gameplay_sessions (token_hash);

CREATE INDEX IF NOT EXISTS empire_gameplay_sessions_account_server_idx
  ON empire_gameplay_sessions (account_id, server_instance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS empire_gameplay_sessions_player_idx
  ON empire_gameplay_sessions (server_instance_id, player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS empire_gameplay_sessions_expires_idx
  ON empire_gameplay_sessions (expires_at);

CREATE INDEX IF NOT EXISTS empire_gameplay_sessions_revoked_idx
  ON empire_gameplay_sessions (revoked_at);
