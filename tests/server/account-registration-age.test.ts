import { describe, expect, it } from "vitest";
import { createPostgresPlayerEntryRepository } from "../../apps/server/src/player-entry/postgres-player-entry-repository";
import type { PostgresDatabase, PostgresQueryable } from "../../apps/server/src/runtime/persistence/postgres";

const NOW = "2026-07-21T12:00:00.000Z";

describe("account registration age authority", () => {
  it("accepts a player exactly 16 years old and stores the birth date", async () => {
    const database = registrationDatabase();
    const repository = createPostgresPlayerEntryRepository(database);
    const created = await repository.registerAccount(request("2010-07-21"));

    expect(created.session.username).toBe("AgeBoss");
    const insert = database.queries.find((entry) => entry.sql.includes("INSERT INTO empire_accounts"));
    expect(insert?.params).toContain("2010-07-21");
    expect(database.queries.some((entry) => entry.sql.includes("AT TIME ZONE 'UTC'") && entry.sql.includes("make_interval"))).toBe(true);
  });

  it("rejects a player one day younger than 16 without inserting an account", async () => {
    const database = registrationDatabase();
    const repository = createPostgresPlayerEntryRepository(database);

    await expect(repository.registerAccount(request("2010-07-22"))).rejects.toMatchObject({
      entryCode: "ACCOUNT_AGE_REQUIREMENT_NOT_MET"
    });
    expect(database.queries.some((entry) => entry.sql.includes("INSERT INTO empire_accounts"))).toBe(false);
  });
});

const request = (dateOfBirth: string) => ({
  username: "AgeBoss",
  gangName: "Age Gang",
  dateOfBirth,
  password: "long-secure-password",
  passwordConfirmation: "long-secure-password"
});

const registrationDatabase = () => {
  const queries: Array<{ sql: string; params: readonly unknown[] }> = [];
  const queryable: PostgresQueryable = {
    query: async (sql, params = []) => {
      queries.push({ sql, params });
      if (sql.includes("clock_timestamp() AS now")) {
        const dateOfBirth = String(params[0] ?? "");
        return result([{ now: NOW, eligible: dateOfBirth <= "2010-07-21" }]);
      }
      return result([]);
    }
  };
  return Object.assign({
    queries,
    query: queryable.query,
    transaction: async <TResult>(callback: (client: PostgresQueryable) => Promise<TResult>) => callback(queryable),
    close: async () => {}
  }, {}) as PostgresDatabase & { queries: typeof queries };
};

const result = (rows: unknown[]) => ({ rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] }) as never;
