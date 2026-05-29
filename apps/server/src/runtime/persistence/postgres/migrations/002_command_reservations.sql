-- Transactional command reservation lifecycle for exactly-once server submit.
-- Apply after 001_initial_runtime_persistence.sql.

CREATE TABLE IF NOT EXISTS empire_command_reservations (
  id text PRIMARY KEY,
  server_instance_id text NOT NULL REFERENCES empire_server_instances (server_instance_id) ON DELETE CASCADE,
  command_id text NOT NULL,
  status text NOT NULL,
  command_type text NOT NULL,
  actor_id text NOT NULL,
  payload_hash text NOT NULL,
  payload jsonb NOT NULL,
  result jsonb,
  rejection_reason jsonb,
  reserved_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  rejected_at timestamptz,
  UNIQUE (server_instance_id, command_id)
);

CREATE INDEX IF NOT EXISTS empire_command_reservations_status_idx
  ON empire_command_reservations (server_instance_id, status, updated_at);

CREATE INDEX IF NOT EXISTS empire_command_reservations_command_idx
  ON empire_command_reservations (server_instance_id, command_id);

CREATE INDEX IF NOT EXISTS empire_command_reservations_actor_idx
  ON empire_command_reservations (server_instance_id, actor_id, updated_at);
