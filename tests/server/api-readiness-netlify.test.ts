import { describe, expect, it, vi } from "vitest";
import { PRODUCTION_MIGRATION_CONTRACT, type PostgresDatabase } from "../../apps/server/src/runtime/persistence/postgres";
import { createApiReadinessResponse } from "../../apps/server/src/netlify/api-readiness-netlify";

const BUILD_SHA = "854a5336e6f816343baf9bdec81a4bd3690a82de";

describe("API readiness response", () => {
  it("returns only safe readiness data for a current database and exact build SHA", async () => {
    const database = createDatabase();
    const response = await createApiReadinessResponse(database, { EMPIRE_BUILD_SHA: BUILD_SHA });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "")).toEqual({
      status: "ready",
      code: null,
      database: "available",
      schema: "current",
      buildSha: BUILD_SHA
    });
  });

  it("fails closed without a database or exact build SHA", async () => {
    expect(JSON.parse((await createApiReadinessResponse(null, {})).body ?? "")).toMatchObject({
      status: "unavailable",
      code: "DATABASE_UNAVAILABLE",
      buildSha: null
    });
    const response = await createApiReadinessResponse(createDatabase(), { EMPIRE_BUILD_SHA: "unknown" });
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body ?? "")).toMatchObject({
      status: "unavailable",
      code: "BUILD_SHA_UNAVAILABLE",
      database: "available",
      schema: "current",
      buildSha: null
    });
  });
});

const createDatabase = (): PostgresDatabase => ({
  query: vi.fn(async (sql: string) => sql.startsWith("SELECT 1")
    ? { rows: [{ connected: 1 }], rowCount: 1 }
    : { rows: PRODUCTION_MIGRATION_CONTRACT.map(([filename, checksum]) => ({ filename, checksum })),
      rowCount: PRODUCTION_MIGRATION_CONTRACT.length }) as never,
  transaction: vi.fn(),
  close: vi.fn()
});
