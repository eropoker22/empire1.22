-- Atomic command execution persistence: result replay and durable outbox.

CREATE TABLE IF NOT EXISTS empire_command_results (
  id text PRIMARY KEY,
  server_instance_id text NOT NULL REFERENCES empire_server_instances (id) ON DELETE CASCADE,
  command_id text NOT NULL,
  command_type text NOT NULL,
  player_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('applied', 'rejected')),
  payload_hash text NOT NULL,
  root_version_before bigint NOT NULL,
  root_version_after bigint NULL,
  event_count integer NOT NULL DEFAULT 0,
  event_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot_id text NULL,
  snapshot_version bigint NULL,
  response_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  applied_at timestamptz NULL,
  rejected_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_instance_id, command_id)
);

CREATE INDEX IF NOT EXISTS empire_command_results_instance_created_idx
  ON empire_command_results (server_instance_id, created_at ASC);

CREATE INDEX IF NOT EXISTS empire_command_results_status_idx
  ON empire_command_results (server_instance_id, status, created_at ASC);

CREATE TABLE IF NOT EXISTS empire_runtime_outbox (
  outbox_id text PRIMARY KEY,
  server_instance_id text NOT NULL REFERENCES empire_server_instances (id) ON DELETE CASCADE,
  command_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  published_at timestamptz NULL,
  attempts integer NOT NULL DEFAULT 0,
  last_error text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS empire_runtime_outbox_unpublished_idx
  ON empire_runtime_outbox (server_instance_id, created_at ASC)
  WHERE published_at IS NULL;

CREATE INDEX IF NOT EXISTS empire_runtime_outbox_command_idx
  ON empire_runtime_outbox (server_instance_id, command_id);

