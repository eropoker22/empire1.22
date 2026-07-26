import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("snapshot recovery-head migration contract", () => {
  it("backfills heads by root version and adds explicit checkpoint metadata", async () => {
    const sql = await readFile(new URL(
      "../../apps/server/src/runtime/persistence/postgres/migrations/017_snapshot_recovery_heads_and_checkpoints.sql",
      import.meta.url
    ), "utf8");

    expect(sql).toContain("ORDER BY server_instance_id, root_version DESC, tick DESC");
    expect(sql).toContain("ON CONFLICT (server_instance_id) DO UPDATE");
    expect(sql).toContain("WHERE empire_snapshot_latest.root_version < EXCLUDED.root_version");
    expect(sql).toContain("checkpoint_kind text NOT NULL DEFAULT 'legacy-checkpoint'");
    expect(sql).toContain("reason_code text NOT NULL DEFAULT 'legacy-snapshot-backfill'");
    expect(sql).toContain("WHERE NOT EXISTS");
    expect(sql).toContain("empire_snapshots_cleanup_idx");
    expect(sql).not.toContain("DELETE FROM empire_snapshots");
  });

  it("keeps the recovery head outside checkpoint cleanup storage", async () => {
    const sql = await readFile(new URL(
      "../../apps/server/src/runtime/persistence/postgres/migrations/017_snapshot_recovery_heads_and_checkpoints.sql",
      import.meta.url
    ), "utf8");

    expect(sql).toContain("ALTER TABLE empire_snapshot_latest");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS empire_snapshot_maintenance");
    expect(sql).not.toContain("DROP TABLE empire_snapshot_latest");
  });

  it("classifies hosted/runtime terminal statuses or resolved gameplay during cleanup", async () => {
    const source = await readFile(new URL(
      "../../apps/server/src/runtime/persistence/postgres/postgres-snapshot-maintenance.ts",
      import.meta.url
    ), "utf8");
    const classification = await readFile(new URL(
      "../../apps/server/src/runtime/persistence/services/snapshot-retention-classification.ts",
      import.meta.url
    ), "utf8");

    expect(classification).toContain('"stopped"');
    expect(classification).toContain('"failed"');
    expect(classification).toContain('"archived"');
    expect(classification).toContain('"ended"');
    expect(classification).toContain('"destroyed"');
    expect(source).toContain("TERMINAL_HOSTED_INSTANCE_STATUS_SQL");
    expect(source).toContain("TERMINAL_RUNTIME_INSTANCE_STATUS_SQL");
    expect(source).toContain("LEFT JOIN empire_hosted_server_instances hosted");
    expect(source).toContain("COALESCE(hosted.status IN");
    expect(source).toContain("s.payload #>> '{state,root,phase}' = 'resolved'");
  });

  it("removes the redundant tick index from the single-row recovery head", async () => {
    const sql = await readFile(new URL(
      "../../apps/server/src/runtime/persistence/postgres/migrations/018_drop_redundant_snapshot_head_tick_index.sql",
      import.meta.url
    ), "utf8");

    expect(sql).toContain("DROP INDEX IF EXISTS empire_snapshot_latest_instance_tick_idx");
  });

  it("removes the redundant root-version index from the single-row recovery head", async () => {
    const sql = await readFile(new URL(
      "../../apps/server/src/runtime/persistence/postgres/migrations/019_drop_redundant_snapshot_head_root_version_index.sql",
      import.meta.url
    ), "utf8");

    expect(sql).toContain("DROP INDEX IF EXISTS empire_snapshot_latest_root_version_idx");
  });

  it("adds incarnation fencing to hosted player job claims with a safe backfill", async () => {
    const sql = await readFile(new URL(
      "../../apps/server/src/runtime/persistence/postgres/migrations/020_hosted_player_job_incarnation_fencing.sql",
      import.meta.url
    ), "utf8");

    expect(sql).toContain("ALTER TABLE empire_hosted_join_jobs");
    expect(sql).toContain("ALTER TABLE empire_server_membership_jobs");
    expect(sql).toContain("claimed_by_worker_incarnation_id text");
    expect(sql).toContain("FROM empire_hosted_worker_heartbeats worker");
    expect(sql).toContain("worker.worker_incarnation_id");
    expect(sql).toContain("'legacy:' || claimed_by_worker_id");
  });
});
