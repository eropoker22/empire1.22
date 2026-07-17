CREATE TABLE IF NOT EXISTS empire_hosted_join_reservations (
  id text PRIMARY KEY,
  reservation_id text NOT NULL UNIQUE,
  server_instance_id text NOT NULL REFERENCES empire_hosted_server_instances (server_instance_id),
  player_identity_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('reserved', 'committed', 'expired', 'canceled', 'rejected')),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  expected_server_version bigint NOT NULL,
  reserved_slot integer NOT NULL CHECK (reserved_slot > 0),
  faction_id text,
  join_ticket_id text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  committed_at timestamptz,
  canceled_at timestamptz,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (player_identity_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS empire_hosted_join_reservations_active_player_idx
  ON empire_hosted_join_reservations (server_instance_id, player_identity_id)
  WHERE status IN ('reserved', 'committed');

CREATE INDEX IF NOT EXISTS empire_hosted_join_reservations_capacity_idx
  ON empire_hosted_join_reservations (server_instance_id, status, expires_at);

CREATE TABLE IF NOT EXISTS empire_hosted_join_jobs (
  id text PRIMARY KEY,
  job_id text NOT NULL UNIQUE,
  reservation_id text NOT NULL UNIQUE REFERENCES empire_hosted_join_reservations (reservation_id),
  server_instance_id text NOT NULL REFERENCES empire_hosted_server_instances (server_instance_id),
  status text NOT NULL CHECK (status IN ('pending', 'claimed', 'completed', 'failed')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  available_at timestamptz NOT NULL,
  claimed_by_worker_id text,
  claimed_until timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS empire_hosted_join_jobs_claim_idx
  ON empire_hosted_join_jobs (status, available_at, claimed_until);
