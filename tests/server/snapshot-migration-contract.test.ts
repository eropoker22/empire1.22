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
});
