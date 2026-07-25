# Snapshot persistence

Empire Streets stores authoritative recovery state separately from diagnostic history.

```text
atomic tick or command
  -> validate and serialize full state
  -> conditional UPSERT recovery head
  -> optionally append checkpoint
  -> commit transaction
  -> publish runtime state and events
```

## Recovery head

`empire_snapshot_latest` is the recovery-head table. It contains at most one row per
server instance and is updated after every committed authoritative mutation. Its
compare-and-swap condition rejects a lower `root_version`, while equal versions are
accepted only when their canonical payload is identical.

Recovery first validates the head identity, schema metadata, tick, root version and
entity counts. When the head is absent, recovery scans the newest checkpoints, uses
the first valid one and recreates the head. An invalid existing head fails closed
instead of silently downgrading to older state.

## Checkpoints

`empire_snapshots` contains append-only checkpoint history. Migration `017` adds:

- `checkpoint_kind`
- `reason_code`
- `lifecycle_phase`
- `is_protected`

Supported kinds are periodic, lifecycle, terminal, manual and legacy checkpoints.
Checkpoint identity contains instance ID, tick, root version, kind and reason.

Periodic checkpoints use the canonical five-minute wall-clock cadence. Free mode
therefore uses 30 ticks at 10 seconds per tick; War mode uses 20 ticks at 15 seconds.
Lifecycle transitions and terminal resolution create protected checkpoints where
appropriate.

## Retention and cleanup

The hosted worker executes snapshot maintenance through its existing run loop. The
default policy keeps 24 active rolling checkpoints, 5 terminal rolling checkpoints,
all protected lifecycle checkpoints and every terminal checkpoint. Non-protected
terminal history expires after 30 days.

Cleanup:

- never queries or deletes `empire_snapshot_latest`;
- uses a PostgreSQL advisory transaction lock;
- ranks checkpoints by root version, tick and timestamp;
- locks candidate rows with `FOR UPDATE SKIP LOCKED`;
- deletes at most 250 rows per batch;
- retries backlog batches after 30 seconds;
- otherwise runs every 15 minutes;
- persists status in `empire_snapshot_maintenance`.

The policy is configurable with:

- `EMPIRE_SNAPSHOT_ROLLING_ACTIVE`
- `EMPIRE_SNAPSHOT_ROLLING_TERMINAL`
- `EMPIRE_SNAPSHOT_RETAIN_LIFECYCLE`
- `EMPIRE_SNAPSHOT_TERMINAL_RETENTION_DAYS`
- `EMPIRE_SNAPSHOT_CLEANUP_BATCH_SIZE`
- `EMPIRE_SNAPSHOT_MAINTENANCE_INTERVAL_MS`

Worker health reports only counters, timestamps, durations and row counts. It never
exposes snapshot payloads, session tokens, cookies or secrets.

## Deployment

Migration `017_snapshot_recovery_heads_and_checkpoints.sql` backfills a missing head
from the highest root version and tick before classifying existing history as legacy
checkpoints. It intentionally does not perform a large blocking delete. The deployed
maintenance runner trims legacy history in bounded batches after schema migration.
