import { describe, expect, it } from "vitest";
import {
  assertReleaseDatabaseCanInitialize,
  assertReleaseMigrationHistoryExists,
  validateReleaseDatabaseEnvironment
} from "../../scripts/release-database-guard";

const validEnvironment = {
  EMPIRE_RELEASE_ENVIRONMENT: "staging",
  EMPIRE_DATABASE_TARGET_ENVIRONMENT: "staging",
  EMPIRE_DATABASE_URL: "postgresql://release@ep-safe.eu-central-1.aws.neon.tech/empire?sslmode=verify-full",
  GAMEPLAY_DATABASE_URL: "postgresql://gameplay@ep-safe.eu-central-1.aws.neon.tech/empire?sslmode=verify-full",
  EMPIRE_DATABASE_BACKUP_CONFIRMED: "true",
  EMPIRE_DATABASE_BACKUP_ID: "snap-safe-fixture",
  EMPIRE_DATABASE_INITIALIZATION_CONFIRMED: "false"
};

describe("release database guard", () => {
  it("returns only safe target diagnostics for a confirmed direct TLS database", () => {
    expect(validateReleaseDatabaseEnvironment(validEnvironment)).toEqual({
      environment: "staging",
      connectionMode: "direct",
      providerHostnameHash: expect.stringMatching(/^[0-9a-f]{16}$/u),
      databaseNameHash: expect.stringMatching(/^[0-9a-f]{16}$/u),
      sslMode: "verify-full",
      backupIdHash: expect.stringMatching(/^[0-9a-f]{16}$/u),
      initializationConfirmed: false
    });
    expect(JSON.stringify(validateReleaseDatabaseEnvironment(validEnvironment))).not.toContain("ep-safe");
  });

  it.each([
    [{ EMPIRE_DATABASE_BACKUP_CONFIRMED: "false" }, "RELEASE_DATABASE_BACKUP_NOT_CONFIRMED"],
    [{ GAMEPLAY_DATABASE_URL: "postgresql://gameplay@ep-other.eu-central-1.aws.neon.tech/empire?sslmode=require" }, "RELEASE_DATABASE_TARGET_MISMATCH"],
    [{ EMPIRE_DATABASE_URL: "postgresql://release@ep-safe-pooler.eu-central-1.aws.neon.tech/empire?sslmode=require" }, "RELEASE_DATABASE_DIRECT_TLS_REQUIRED"],
    [{ EMPIRE_DATABASE_TARGET_ENVIRONMENT: "production" }, "RELEASE_DATABASE_TARGET_ENVIRONMENT_MISMATCH"]
  ])("rejects an unsafe release target", (override, code) => {
    expect(() => validateReleaseDatabaseEnvironment({ ...validEnvironment, ...override })).toThrow(code);
  });

  it("rejects a production target whose safe identity looks like staging", () => {
    expect(() => validateReleaseDatabaseEnvironment({
      ...validEnvironment,
      EMPIRE_RELEASE_ENVIRONMENT: "production",
      EMPIRE_DATABASE_TARGET_ENVIRONMENT: "production",
      EMPIRE_DATABASE_URL: "postgresql://release@ep-staging.eu-central-1.aws.neon.tech/empire?sslmode=require",
      GAMEPLAY_DATABASE_URL: "postgresql://gameplay@ep-staging.eu-central-1.aws.neon.tech/empire?sslmode=require"
    })).toThrow("RELEASE_PRODUCTION_DATABASE_LOOKS_LIKE_STAGING");
  });

  it("requires existing migration history on every normal release command", () => {
    expect(() => assertReleaseMigrationHistoryExists(false)).toThrow("RELEASE_MIGRATION_HISTORY_MISSING");
    expect(() => assertReleaseMigrationHistoryExists(true)).not.toThrow();
  });

  it.each([
    [{ initializationConfirmed: false }, "RELEASE_DATABASE_INITIALIZATION_NOT_CONFIRMED"],
    [{ currentSchema: "private" }, "RELEASE_DATABASE_SCHEMA_NOT_PUBLIC"],
    [{ historyExists: true }, "RELEASE_MIGRATION_HISTORY_ALREADY_EXISTS"],
    [{ publicObjectCount: 1 }, "RELEASE_DATABASE_NOT_EMPTY"]
  ])("rejects unsafe one-time history initialization", (override, code) => {
    expect(() => assertReleaseDatabaseCanInitialize({
      initializationConfirmed: true,
      currentSchema: "public",
      historyExists: false,
      publicObjectCount: 0,
      ...override
    })).toThrow(code);
  });
});
