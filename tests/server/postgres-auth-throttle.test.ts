import { describe, expect, it } from "vitest";
import {
  createPostgresAuthThrottle,
  resolveAuthNetworkIdentifier
} from "../../apps/server/src/player-entry/postgres-auth-throttle";
import type { PostgresDatabase, PostgresQueryable } from "../../apps/server/src/runtime/persistence/postgres";

describe("PostgreSQL account auth throttle", () => {
  it("blocks the fourth registration attempt for one normalized username", async () => {
    const database = createMemoryDatabase();
    const throttle = createPostgresAuthThrottle(database, {
      NODE_ENV: "production",
      EMPIRE_AUTH_THROTTLE_PEPPER: "a-secure-auth-throttle-pepper-over-32-chars"
    });
    const decisions = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      decisions.push(await throttle.consume({
        action: "register",
        username: attempt % 2 === 0 ? "AlphaBoss" : " alphaboss ",
        networkIdentifier: `203.0.113.${attempt + 1}`
      }));
    }

    expect(decisions.slice(0, 3).every((decision) => decision.allowed)).toBe(true);
    expect(decisions[3]).toMatchObject({ allowed: false, reason: "username", retryAfterSeconds: 900 });
    expect([...database.keys].every((key) => /^[a-f0-9]{64}$/u.test(key))).toBe(true);
  });

  it("extracts only the first forwarded network identifier", () => {
    expect(resolveAuthNetworkIdentifier({ "X-Forwarded-For": "203.0.113.4, 10.0.0.2" })).toBe("203.0.113.4");
  });
});

const createMemoryDatabase = () => {
  const rows = new Map<string, Record<string, unknown>>();
  const keys = new Set<string>();
  let nowMs = Date.parse("2026-07-21T18:00:00.000Z");
  const client: PostgresQueryable = {
    query: async (sql, params = []) => {
      if (sql.includes("clock_timestamp")) return result([{ now: new Date(nowMs).toISOString() }]);
      if (sql.startsWith("DELETE")) return result([]);
      if (sql.includes("FROM empire_auth_throttle_buckets")) {
        const key = `${params[0]}:${params[1]}:${params[2]}`;
        return result(rows.has(key) ? [rows.get(key)!] : []);
      }
      if (sql.startsWith("INSERT INTO empire_auth_throttle_buckets")) {
        const key = `${params[0]}:${params[1]}:${params[2]}`;
        keys.add(String(params[2]));
        rows.set(key, {
          window_started_at: params[3],
          attempt_count: params[4],
          blocked_until: params[5]
        });
        nowMs += 1;
        return result([]);
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  return {
    keys,
    query: client.query,
    transaction: async (callback) => callback(client),
    close: async () => {}
  } as PostgresDatabase & { keys: Set<string> };
};

const result = <TRow extends Record<string, unknown>>(rows: TRow[]) => ({
  rows,
  rowCount: rows.length,
  command: "SELECT",
  oid: 0,
  fields: []
}) as never;
