import { describe, expect, it } from "vitest";
import {
  createPostgresAdminMonitoringRepository,
  resolveAdminDurableRepositories
} from "../../apps/server/src/admin/read-only";
import type { PostgresQueryable } from "../../apps/server/src/runtime/persistence/postgres";

describe("Postgres admin monitoring repository", () => {
  it("keeps a durable instance visible without a worker or snapshot", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const database = fakeDatabase(calls);
    const repository = createPostgresAdminMonitoringRepository(database, () => new Date("2026-07-16T10:00:00.000Z"));

    const overview = await repository.listKnownInstances();
    expect(overview).toEqual([expect.objectContaining({
      serverInstanceId: "server:offline", displayName: "Offline durable", workerStatus: "no-worker", playerCount: 0
    })]);
    const detail = await repository.getInstanceRuntimeProjection("server:offline");
    expect(detail).toMatchObject({ serverInstanceId: "server:offline", runtimeAvailable: false });
    expect(detail?.players).toEqual([]);
    expect(detail?.economy.serverInstanceId).toBe("server:offline");
    expect(calls.filter((call) => call.values.length > 0).every((call) => call.values[0] === "server:offline")).toBe(true);
  });

  it("rejects in-memory repositories in production", () => {
    expect(resolveAdminDurableRepositories({ NODE_ENV: "production" }).accepted).toBe(false);
    expect(resolveAdminDurableRepositories({ NODE_ENV: "test" }).accepted).toBe(true);
  });
});

const fakeDatabase = (calls: Array<{ sql: string; values: readonly unknown[] }>): PostgresQueryable => ({
  query: async <TRow extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) => {
    calls.push({ sql, values });
    if (sql.includes("FROM empire_server_instances")) return result<TRow>([{
      server_instance_id: "server:offline", mode: "free", status: "paused",
      payload: { displayName: "Offline durable", region: "eu-central", capacity: 20, joinPolicy: "closed" },
      snapshot_payload: null, snapshot_created_at: null, heartbeat_at: null, lock_owner: null, locked_until: null, last_error_at: null
    }]);
    return result<TRow>([]);
  }
});

const result = <TRow extends Record<string, unknown>>(rows: Array<Record<string, unknown>>) => ({
  rows: rows as TRow[], rowCount: rows.length, command: "SELECT", oid: 0, fields: []
});
