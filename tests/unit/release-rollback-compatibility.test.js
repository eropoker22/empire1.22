import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checksumMigration,
  evaluateCodeOnlyRollback,
  validateMigrationClassifications
} from "../../scripts/release-rollback-compatibility.mjs";

const candidateSha = "a".repeat(40);
const previousSha = "b".repeat(40);
const migration = (filename, sql) => ({ filename, checksum: checksumMigration(sql) });

describe("release rollback compatibility", () => {
  it("permits code-only rollback only for identical migration contracts", () => {
    const migrations = [migration("001_initial.sql", "SELECT 1;\n")];
    expect(evaluateCodeOnlyRollback({ candidateSha, previousSha, candidateMigrations: migrations,
      previousMigrations: migrations })).toMatchObject({
      migrationSetsIdentical: true,
      codeOnlyRollbackSafe: true,
      databaseRestoreRequired: false
    });
    expect(evaluateCodeOnlyRollback({ candidateSha, previousSha, candidateMigrations: migrations,
      previousMigrations: [] })).toMatchObject({
      migrationSetsIdentical: false,
      codeOnlyRollbackSafe: false,
      databaseRestoreRequired: false
    });
  });

  it("normalizes migration line endings before comparison", () => {
    expect(checksumMigration("SELECT 1;\r\n")).toBe(checksumMigration("SELECT 1;\n"));
  });

  it("requires one valid classification for every checked-in migration", () => {
    const manifest = JSON.parse(readFileSync("docs/deployment/migration-compatibility.json", "utf8"));
    const contract = readFileSync(
      "apps/server/src/runtime/persistence/postgres/production-migration-contract.ts", "utf8"
    );
    const migrations = [...contract.matchAll(/\["(\d{3}_[a-z0-9_]+\.sql)",\s*"([0-9a-f]{64})"\]/gu)]
      .map((match) => ({ filename: match[1], checksum: match[2] }));
    const classified = validateMigrationClassifications(manifest, migrations);
    expect(classified).toHaveLength(24);
    expect(classified.every((entry) => entry.reason.length >= 12)).toBe(true);
  });

  it("rejects missing, duplicate, or unknown classifications", () => {
    const migrations = [migration("001_initial.sql", "SELECT 1;")];
    expect(() => validateMigrationClassifications({ version: 1, migrations: [] }, migrations))
      .toThrow("ROLLBACK_MIGRATION_CLASSIFICATION_COVERAGE_INVALID");
    expect(() => validateMigrationClassifications({ version: 1, migrations: [{
      filename: "001_initial.sql",
      classification: "safe",
      reason: "This reason is long enough."
    }] }, migrations)).toThrow("ROLLBACK_MIGRATION_CLASSIFICATION_ENTRY_INVALID");
  });
});
