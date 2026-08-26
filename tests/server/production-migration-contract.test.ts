import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  getProductionSchemaStatus,
  isProductionSchemaCurrent,
  PRODUCTION_MIGRATION_CONTRACT
} from "../../apps/server/src/runtime/persistence/postgres/production-migration-contract";
import { checksumMigrationSql } from "../../apps/server/src/runtime/persistence/postgres/migration-runner";
import type { PostgresQueryable } from "../../apps/server/src/runtime/persistence/postgres";

describe("production migration contract", () => {
  it("matches every checked-in migration checksum", async () => {
    const directory = new URL("../../apps/server/src/runtime/persistence/postgres/migrations/", import.meta.url);
    const filenames = (await readdir(directory)).filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/u.test(name)).sort();
    const actual = await Promise.all(filenames.map(async (filename) => {
      const sql = await readFile(new URL(filename, directory), "utf8");
      return [filename, checksumMigrationSql(sql)] as const;
    }));
    expect(actual).toEqual(PRODUCTION_MIGRATION_CONTRACT);
  });

  it("keeps checksums stable across checkout line endings", () => {
    expect(checksumMigrationSql("SELECT 1;\nSELECT 2;\n"))
      .toBe(checksumMigrationSql("SELECT 1;\r\nSELECT 2;\r\n"));
  });

  it("allows Start to arm Očista before the open registration roster is frozen", async () => {
    const migration = await readFile(new URL(
      "../../apps/server/src/runtime/persistence/postgres/migrations/025_open_registration_purge_start.sql",
      import.meta.url
    ), "utf8");

    expect(migration).toContain("registration_closed_at IS NULL");
    expect(migration).toContain("effective_first_elimination_tick IS NULL");
    expect(migration).toContain("OR effective_first_elimination_tick >= 1");
    expect(migration).not.toContain("AND effective_first_elimination_tick IS NULL)\n      OR");
  });

  it("accepts only the complete exact migration history", async () => {
    expect(await isProductionSchemaCurrent(database([...PRODUCTION_MIGRATION_CONTRACT]))).toBe(true);
    expect(await isProductionSchemaCurrent(database(PRODUCTION_MIGRATION_CONTRACT.slice(0, -1)))).toBe(false);
    expect(await isProductionSchemaCurrent(database([
      ...PRODUCTION_MIGRATION_CONTRACT.slice(0, -1),
      [PRODUCTION_MIGRATION_CONTRACT.at(-1)![0], "mismatch"]
    ]))).toBe(false);
    expect(await isProductionSchemaCurrent(database([
      ...PRODUCTION_MIGRATION_CONTRACT,
      ["011_unknown.sql", "unknown"]
    ]))).toBe(false);
  });

  it("reports safe applied and expected migration versions", async () => {
    const pending = PRODUCTION_MIGRATION_CONTRACT.slice(0, -1);
    await expect(getProductionSchemaStatus(database(pending))).resolves.toEqual({
      current: false,
      appliedVersion: pending.at(-1)![0],
      expectedVersion: PRODUCTION_MIGRATION_CONTRACT.at(-1)![0],
      appliedCount: pending.length,
      expectedCount: PRODUCTION_MIGRATION_CONTRACT.length
    });
  });

  it("fails closed when migration history is unavailable", async () => {
    const unavailable: PostgresQueryable = { query: async () => { throw new Error("offline"); } };
    expect(await isProductionSchemaCurrent(unavailable)).toBe(false);
  });
});

const database = (rows: ReadonlyArray<readonly [string, string]>): PostgresQueryable => ({
  query: async () => ({
    rows: rows.map(([filename, checksum]) => ({ filename, checksum })),
    rowCount: rows.length,
    command: "SELECT",
    oid: 0,
    fields: []
  }) as never
});
