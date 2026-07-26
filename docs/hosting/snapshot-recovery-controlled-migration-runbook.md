# Controlled snapshot recovery migration

Use this runbook only when the normal migration command reports
`SNAPSHOT_RECOVERY_MIGRATION_REQUIRES_CONTROLLED_ROLLOUT` for migration
`017_snapshot_recovery_heads_and_checkpoints.sql`.

The controlled path is required whenever a legacy `empire_snapshots` table
already contains rows. It does not delete snapshot history and it does not
change the checksum of migration `017`.

The normal path executes the original migration `017` only for an empty snapshot
history. This prevents an unvalidated newest legacy row from becoming the
recovery head. The normal command fails closed with
`SNAPSHOT_RECOVERY_MIGRATION_REQUIRES_CONTROLLED_ROLLOUT` when any legacy row is
present; the error additionally calls out histories above 50,000 rows.

## Preconditions

1. Take and verify a PostgreSQL backup or point-in-time recovery checkpoint.
2. Stop every hosted worker and every process that can write runtime snapshots.
3. Keep the database reachable only by the migration operator during this run.
4. Confirm migrations `001` through `016` are already applied:

```powershell
npm run db:migrate:status
```

The controlled command fails closed if any prerequisite migration is absent or
has a different checksum.

## Run

Choose a bounded batch size. The default is 500 rows.

```powershell
$env:EMPIRE_SNAPSHOT_MIGRATION_BATCH_SIZE = "500"
npm run db:migrate -- --controlled-snapshot-recovery
```

The command:

1. adds the recovery/checkpoint columns without rewriting migration `017`;
2. backfills head ticks and checkpoint metadata with `FOR UPDATE SKIP LOCKED`
   batches;
3. validates `NOT NULL` and checkpoint-kind constraints before enforcing them;
4. backfills recovery heads in bounded instance batches ordered by root version,
   tick, creation time, and snapshot ID, skipping candidates whose identity,
   tick, root-version, schema metadata, or entity counts disagree with their
   relational columns or serialized state;
5. creates the two checkpoint indexes with `CREATE INDEX CONCURRENTLY`;
6. verifies column data, head coverage, constraints, indexes, and maintenance
   storage;
7. records the unchanged canonical checksum for migration `017`;
8. runs the normal migrator for later migrations.

An interrupted command is retryable from the beginning; completed row batches are
idempotent and already-valid heads cannot be downgraded. Do not manually insert
migration history.
If an index build was interrupted, the next run removes only its invalid index
shell and recreates it concurrently.

## Verify

```powershell
npm run db:migrate:status
```

Then run these read-only checks:

```sql
SELECT count(*) AS missing_heads
FROM (
  SELECT DISTINCT snapshots.server_instance_id
  FROM empire_snapshots snapshots
  LEFT JOIN empire_snapshot_latest head
    ON head.server_instance_id = snapshots.server_instance_id
  WHERE head.server_instance_id IS NULL
) missing;

SELECT count(*) AS null_checkpoint_metadata
FROM empire_snapshots
WHERE checkpoint_kind IS NULL
   OR reason_code IS NULL
   OR is_protected IS NULL;

SELECT indexrelid::regclass AS index_name, indisvalid
FROM pg_index
WHERE indexrelid IN (
  to_regclass('empire_snapshots_instance_kind_created_idx'),
  to_regclass('empire_snapshots_cleanup_idx')
);
```

Expected results are zero missing heads, zero null metadata rows, and two valid
indexes. Restart one hosted worker, verify its health endpoint and recovery source,
then restore normal worker capacity.

Historical rows are trimmed later by the bounded snapshot maintenance runner.
Do not issue an unbounded manual `DELETE` during this migration.
