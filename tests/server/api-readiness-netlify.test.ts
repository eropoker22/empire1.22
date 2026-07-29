import { describe, expect, it, vi } from "vitest";
import { PRODUCTION_MIGRATION_CONTRACT, type PostgresDatabase } from "../../apps/server/src/runtime/persistence/postgres";
import {
  createApiReadinessResponse,
  handleApiReadinessRequest
} from "../../apps/server/src/netlify/api-readiness-netlify";

const BUILD_SHA = "854a5336e6f816343baf9bdec81a4bd3690a82de";

describe("API readiness response", () => {
  it("returns only safe readiness data for a current database and exact build SHA", async () => {
    const database = createDatabase();
    const response = await createApiReadinessResponse(database, { EMPIRE_BUILD_SHA: BUILD_SHA });
    expect(response.statusCode).toBe(200);
    expect(response.headers).toMatchObject({
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8"
    });
    expect(JSON.parse(response.body ?? "")).toEqual({
      status: "ready",
      service: "empire-api",
      code: null,
      database: "available",
      schema: "current",
      buildSha: BUILD_SHA,
      runtime: {
        nodeVersion: process.versions.node,
        nodeMajor: 24,
        supported: true
      }
    });
  });

  it("uses safe error codes for unavailable databases and schema checks", async () => {
    const disconnected = createDatabase();
    vi.mocked(disconnected.query).mockRejectedValueOnce(new Error("secret connection detail"));
    expect(JSON.parse((await createApiReadinessResponse(disconnected, { EMPIRE_BUILD_SHA: BUILD_SHA })).body ?? "")).toMatchObject({
      status: "unavailable",
      service: "empire-api",
      code: "DATABASE_UNAVAILABLE"
    });

    const schemaFailure = createDatabase();
    vi.mocked(schemaFailure.query)
      .mockResolvedValueOnce({ rows: [{ connected: 1 }], rowCount: 1 } as never)
      .mockRejectedValueOnce(new Error("secret SQL detail"));
    const response = await createApiReadinessResponse(schemaFailure, { EMPIRE_BUILD_SHA: BUILD_SHA });
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("secret");
    expect(JSON.parse(response.body ?? "")).toMatchObject({
      code: "DATABASE_MIGRATIONS_PENDING",
      database: "available",
      schema: "unavailable"
    });
  });

  it("rejects non-GET methods without caching or internal details", async () => {
    const response = await handleApiReadinessRequest("POST", createDatabase(), { EMPIRE_BUILD_SHA: BUILD_SHA });
    expect(response.statusCode).toBe(405);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(JSON.parse(response.body ?? "")).toEqual({
      status: "unavailable",
      service: "empire-api",
      code: "METHOD_NOT_ALLOWED"
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

  it("fails closed and reports safe diagnostics on an unsupported Node runtime", async () => {
    const database = createDatabase();
    const response = await createApiReadinessResponse(database, { EMPIRE_BUILD_SHA: BUILD_SHA }, "20.20.2");
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body ?? "")).toMatchObject({
      status: "unavailable",
      code: "NODE_RUNTIME_UNSUPPORTED",
      runtime: {
        nodeVersion: "20.20.2",
        nodeMajor: 20,
        supported: false
      }
    });
    expect(vi.mocked(database.query)).not.toHaveBeenCalled();
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
