import { describe, expect, it, vi } from "vitest";
import { GAMEPLAY_SLICE_STABLE_POLL_INTERVAL_MS } from "../../apps/client/src/browser/gameplay-slice-timing";
import {
  createLocalHostedPostgresDatabase,
  LOCAL_HOSTED_POSTGRES_POOL_OPTIONS
} from "../../apps/server/src/bootstrap/local-hosted-postgres-database";
import type {
  PostgresDatabase,
  PostgresDatabasePoolOptions
} from "../../apps/server/src/runtime/persistence/postgres";

describe("local hosted PostgreSQL lifecycle", () => {
  it("keeps pooled connections idle beyond the stable gameplay poll cadence", () => {
    expect(LOCAL_HOSTED_POSTGRES_POOL_OPTIONS.idleTimeoutMillis)
      .toBeGreaterThan(GAMEPLAY_SLICE_STABLE_POLL_INTERVAL_MS);
    expect(LOCAL_HOSTED_POSTGRES_POOL_OPTIONS.allowExitOnIdle).toBe(false);
    expect(LOCAL_HOSTED_POSTGRES_POOL_OPTIONS.max).toBe(12);
  });

  it("uses the local long-lived pool policy without changing the Netlify policy", () => {
    const database = createDatabaseStub();
    let capturedOptions: PostgresDatabasePoolOptions | undefined;
    const factory = vi.fn((_databaseUrl: string, poolOptions?: PostgresDatabasePoolOptions) => {
      capturedOptions = poolOptions;
      return database;
    });

    expect(createLocalHostedPostgresDatabase({
      EMPIRE_PERSISTENCE_DRIVER: "postgres",
      EMPIRE_DATABASE_URL: "postgresql://local-test.invalid/empire_test"
    }, factory)).toBe(database);
    expect(factory).toHaveBeenCalledOnce();
    expect(capturedOptions).toEqual(LOCAL_HOSTED_POSTGRES_POOL_OPTIONS);
  });

  it("does not create a database for non-PostgreSQL persistence", () => {
    const factory = vi.fn(() => createDatabaseStub());

    expect(createLocalHostedPostgresDatabase({
      EMPIRE_PERSISTENCE_DRIVER: "memory"
    }, factory)).toBeNull();
    expect(factory).not.toHaveBeenCalled();
  });
});

const createDatabaseStub = (): PostgresDatabase => ({
  query: vi.fn(),
  transaction: vi.fn(),
  close: vi.fn()
});
