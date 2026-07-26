export const HEAD_TICK_BACKFILL_SQL = `
  WITH batch AS (
    SELECT ctid FROM empire_snapshot_latest WHERE tick IS NULL LIMIT $1 FOR UPDATE SKIP LOCKED
  )
  UPDATE empire_snapshot_latest target
  SET tick = CASE
    WHEN target.payload ->> 'tick' ~ '^[0-9]+$' THEN (target.payload ->> 'tick')::integer
    ELSE 0
  END
  FROM batch
  WHERE target.ctid = batch.ctid
`;

export const CHECKPOINT_METADATA_BACKFILL_SQL = `
  WITH batch AS (
    SELECT ctid FROM empire_snapshots
    WHERE checkpoint_kind IS NULL OR reason_code IS NULL OR is_protected IS NULL
    LIMIT $1 FOR UPDATE SKIP LOCKED
  )
  UPDATE empire_snapshots target
  SET checkpoint_kind = COALESCE(target.checkpoint_kind, 'legacy-checkpoint'),
      reason_code = COALESCE(target.reason_code, 'legacy-snapshot-backfill'),
      is_protected = COALESCE(target.is_protected, false)
  FROM batch
  WHERE target.ctid = batch.ctid
`;

export const SNAPSHOT_CONSTRAINTS_SQL = `
  ALTER TABLE empire_snapshot_latest
    DROP CONSTRAINT IF EXISTS empire_snapshot_latest_tick_nn_controlled;
  ALTER TABLE empire_snapshot_latest
    ADD CONSTRAINT empire_snapshot_latest_tick_nn_controlled CHECK (tick IS NOT NULL) NOT VALID;
  ALTER TABLE empire_snapshot_latest VALIDATE CONSTRAINT empire_snapshot_latest_tick_nn_controlled;
  ALTER TABLE empire_snapshot_latest ALTER COLUMN tick SET NOT NULL;
  ALTER TABLE empire_snapshot_latest DROP CONSTRAINT empire_snapshot_latest_tick_nn_controlled;
  ALTER TABLE empire_snapshots
    DROP CONSTRAINT IF EXISTS empire_snapshots_checkpoint_metadata_nn_controlled;
  ALTER TABLE empire_snapshots
    ADD CONSTRAINT empire_snapshots_checkpoint_metadata_nn_controlled
    CHECK (checkpoint_kind IS NOT NULL AND reason_code IS NOT NULL AND is_protected IS NOT NULL) NOT VALID;
  ALTER TABLE empire_snapshots VALIDATE CONSTRAINT empire_snapshots_checkpoint_metadata_nn_controlled;
  ALTER TABLE empire_snapshots
    ALTER COLUMN checkpoint_kind SET NOT NULL,
    ALTER COLUMN reason_code SET NOT NULL,
    ALTER COLUMN is_protected SET NOT NULL;
  ALTER TABLE empire_snapshots DROP CONSTRAINT empire_snapshots_checkpoint_metadata_nn_controlled;
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'empire_snapshots'::regclass
        AND conname = 'empire_snapshots_checkpoint_kind_check'
    ) THEN
      ALTER TABLE empire_snapshots
        ADD CONSTRAINT empire_snapshots_checkpoint_kind_check
        CHECK (checkpoint_kind IN (
          'periodic-checkpoint', 'lifecycle-checkpoint', 'terminal-checkpoint',
          'manual-checkpoint', 'legacy-checkpoint'
        )) NOT VALID;
    END IF;
  END
  $$;
  ALTER TABLE empire_snapshots VALIDATE CONSTRAINT empire_snapshots_checkpoint_kind_check;
`;

export const RECOVERY_HEAD_BACKFILL_SQL = `
  INSERT INTO empire_snapshot_latest (
    id, server_instance_id, schema_version, snapshot_id, root_version,
    tick, payload, created_at, updated_at
  )
  SELECT 'snapshot-head:' || newest.server_instance_id, newest.server_instance_id,
         newest.schema_version, newest.snapshot_id, newest.root_version,
         newest.tick, newest.payload, newest.created_at, now()
  FROM (
    SELECT DISTINCT ON (server_instance_id)
      server_instance_id, schema_version, snapshot_id, root_version, tick, payload, created_at
    FROM empire_snapshots
    WHERE server_instance_id = ANY($1::text[])
      AND ${snapshotPayloadMatchesColumns("empire_snapshots")}
    ORDER BY server_instance_id, root_version DESC, tick DESC, created_at DESC, snapshot_id DESC
  ) newest
  ON CONFLICT (server_instance_id) DO UPDATE
  SET schema_version = EXCLUDED.schema_version, snapshot_id = EXCLUDED.snapshot_id,
      root_version = EXCLUDED.root_version, tick = EXCLUDED.tick, payload = EXCLUDED.payload,
      created_at = EXCLUDED.created_at, updated_at = now()
  WHERE empire_snapshot_latest.root_version < EXCLUDED.root_version
     OR NOT (${snapshotPayloadMatchesColumns("empire_snapshot_latest")})
`;

export const SNAPSHOT_MAINTENANCE_SQL = `
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
  INSERT INTO empire_snapshot_maintenance (scope) VALUES ('global')
  ON CONFLICT (scope) DO NOTHING;
`;

export const PREPARATION_VERIFICATION_SQL = `
  SELECT
    NOT EXISTS (SELECT 1 FROM empire_snapshot_latest WHERE tick IS NULL)
    AND NOT EXISTS (
      SELECT 1 FROM empire_snapshots
      WHERE checkpoint_kind IS NULL OR reason_code IS NULL OR is_protected IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM empire_snapshots snapshots
      WHERE NOT EXISTS (
        SELECT 1 FROM empire_snapshot_latest head
        WHERE head.server_instance_id = snapshots.server_instance_id
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM empire_snapshot_latest head
      WHERE NOT (${snapshotPayloadMatchesColumns("head")})
    )
    AND EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'empire_snapshots'::regclass
        AND conname = 'empire_snapshots_checkpoint_kind_check'
        AND convalidated
    )
    AND to_regclass('empire_snapshot_maintenance') IS NOT NULL
    AND COALESCE((
      SELECT count(*) = 2 AND bool_and(index.indisvalid)
      FROM pg_index index
      WHERE index.indexrelid IN (
        to_regclass('empire_snapshots_instance_kind_created_idx'),
        to_regclass('empire_snapshots_cleanup_idx')
      )
    ), false) AS ready
`;

function snapshotPayloadMatchesColumns(alias: string): string {
  return `
    ${alias}.payload ->> 'instanceId' = ${alias}.server_instance_id
    AND ${alias}.payload #>> '{state,root,serverInstanceId}' = ${alias}.server_instance_id
    AND ${alias}.payload #>> '{state,serverInstance,id}' = ${alias}.server_instance_id
    AND ${alias}.payload ->> 'snapshotId' = ${alias}.snapshot_id
    AND ${alias}.payload ->> 'tick' = ${alias}.tick::text
    AND ${alias}.payload #>> '{state,root,tick}' = ${alias}.tick::text
    AND ${alias}.payload #>> '{integrity,rootVersion}' = ${alias}.root_version::text
    AND ${alias}.payload #>> '{state,root,version}' = ${alias}.root_version::text
    AND ${alias}.payload #>> '{version,schemaVersion}' = ${alias}.schema_version::text
    AND COALESCE(${alias}.payload #>> '{version,coreVersion}', '') <> ''
    AND COALESCE(${alias}.payload #>> '{version,configVersion}', '') <> ''
    AND ${entityCountMatchesState(alias, "players", "playersById")}
    AND ${entityCountMatchesState(alias, "alliances", "alliancesById")}
    AND ${entityCountMatchesState(alias, "districts", "districtsById")}
    AND ${entityCountMatchesState(alias, "buildings", "buildingsById")}
  `;
}

function entityCountMatchesState(
  alias: string,
  countKey: string,
  stateKey: string
): string {
  return `
    ${alias}.payload #>> '{integrity,entityCounts,${countKey}}' =
    CASE
      WHEN jsonb_typeof(${alias}.payload #> '{state,${stateKey}}') = 'object'
      THEN (
        SELECT count(*)::text
        FROM jsonb_object_keys(${alias}.payload #> '{state,${stateKey}}')
      )
      ELSE NULL
    END
  `;
}
