ALTER TABLE empire_snapshot_latest
  ADD COLUMN IF NOT EXISTS tick integer;

UPDATE empire_snapshot_latest
SET tick = CASE
  WHEN payload ->> 'tick' ~ '^[0-9]+$' THEN (payload ->> 'tick')::integer
  ELSE 0
END
WHERE tick IS NULL;

ALTER TABLE empire_snapshot_latest
  ALTER COLUMN tick SET DEFAULT 0,
  ALTER COLUMN tick SET NOT NULL;

ALTER TABLE empire_snapshots
  ADD COLUMN IF NOT EXISTS checkpoint_kind text NOT NULL DEFAULT 'legacy-checkpoint',
  ADD COLUMN IF NOT EXISTS reason_code text NOT NULL DEFAULT 'legacy-snapshot-backfill',
  ADD COLUMN IF NOT EXISTS lifecycle_phase text,
  ADD COLUMN IF NOT EXISTS is_protected boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empire_snapshots_checkpoint_kind_check'
  ) THEN
    ALTER TABLE empire_snapshots
      ADD CONSTRAINT empire_snapshots_checkpoint_kind_check
      CHECK (checkpoint_kind IN (
        'periodic-checkpoint',
        'lifecycle-checkpoint',
        'terminal-checkpoint',
        'manual-checkpoint',
        'legacy-checkpoint'
      ));
  END IF;
END
$$;

INSERT INTO empire_snapshot_latest (
  id,
  server_instance_id,
  schema_version,
  snapshot_id,
  root_version,
  tick,
  payload,
  created_at,
  updated_at
)
SELECT
  'snapshot-head:' || newest.server_instance_id,
  newest.server_instance_id,
  newest.schema_version,
  newest.snapshot_id,
  newest.root_version,
  newest.tick,
  newest.payload,
  newest.created_at,
  now()
FROM (
  SELECT DISTINCT ON (server_instance_id)
    server_instance_id,
    schema_version,
    snapshot_id,
    root_version,
    tick,
    payload,
    created_at
  FROM empire_snapshots
  WHERE NOT EXISTS (
    SELECT 1
    FROM empire_snapshot_latest existing_head
    WHERE existing_head.server_instance_id = empire_snapshots.server_instance_id
  )
  ORDER BY server_instance_id, root_version DESC, tick DESC, created_at DESC, snapshot_id DESC
) newest
ON CONFLICT (server_instance_id) DO UPDATE
SET schema_version = EXCLUDED.schema_version,
    snapshot_id = EXCLUDED.snapshot_id,
    root_version = EXCLUDED.root_version,
    tick = EXCLUDED.tick,
    payload = EXCLUDED.payload,
    created_at = EXCLUDED.created_at,
    updated_at = now()
WHERE empire_snapshot_latest.root_version < EXCLUDED.root_version;

CREATE INDEX IF NOT EXISTS empire_snapshot_latest_instance_tick_idx
  ON empire_snapshot_latest (server_instance_id, tick DESC);

CREATE INDEX IF NOT EXISTS empire_snapshots_instance_kind_created_idx
  ON empire_snapshots (server_instance_id, checkpoint_kind, created_at DESC);

CREATE INDEX IF NOT EXISTS empire_snapshots_cleanup_idx
  ON empire_snapshots (checkpoint_kind, is_protected, created_at, server_instance_id);

CREATE TABLE IF NOT EXISTS empire_snapshot_maintenance (
  scope text PRIMARY KEY,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_status text NOT NULL DEFAULT 'never',
  last_deleted_rows integer NOT NULL DEFAULT 0,
  last_duration_ms double precision NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empire_snapshot_maintenance_status_check
    CHECK (last_status IN ('never', 'success', 'failed', 'skipped-lock'))
);

INSERT INTO empire_snapshot_maintenance (scope)
VALUES ('global')
ON CONFLICT (scope) DO NOTHING;
