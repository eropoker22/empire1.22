import { describe, expect, it } from "vitest";
import { validateProductionSmokeAccountEnvironment } from "../../scripts/production-smoke-account-contract.mjs";
import { releaseDatabaseTargetHash } from "../../scripts/release-database-target-hash.mjs";

const direct = "postgresql://release@ep-production.eu-central-1.aws.neon.tech/empire?sslmode=verify-full";
const targetHash = releaseDatabaseTargetHash(direct);
const valid = {
  NODE_ENV: "production",
  EMPIRE_RELEASE_ENVIRONMENT: "production",
  EMPIRE_DATABASE_TARGET_ENVIRONMENT: "production",
  EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "false",
  EMPIRE_BUILD_SHA: "82ab0778704c755170048d9509036eb3f03909da",
  EMPIRE_DATABASE_URL: direct,
  GAMEPLAY_DATABASE_URL: direct,
  EMPIRE_PRODUCTION_DATABASE_TARGET_HASH: targetHash,
  EMPIRE_DATABASE_BACKUP_CONFIRMED: "true",
  EMPIRE_DATABASE_BACKUP_ID: "snapshot-production-2026-08-05",
  EMPIRE_PRODUCTION_SMOKE_ACCOUNT_BOOTSTRAP_CONFIRMED: "production-smoke-account",
  EMPIRE_PRODUCTION_SMOKE_ACCOUNT_USERNAME: "ReleaseControl",
  EMPIRE_PRODUCTION_SMOKE_ACCOUNT_GANG_NAME: "Release Control Gang",
  EMPIRE_PRODUCTION_SMOKE_ACCOUNT_PASSWORD: "strong-release-password-123",
  EMPIRE_ACCOUNT_TERMS_VERSION: "closed-alpha-approved-v1",
  EMPIRE_PRODUCTION_SMOKE_ACCOUNT_EVIDENCE_PATH: "artifacts/release/production/smoke-account.json"
};

describe("production smoke account contract", () => {
  it("accepts only an explicit closed production bootstrap", () => {
    expect(validateProductionSmokeAccountEnvironment(valid)).toMatchObject({
      buildSha: valid.EMPIRE_BUILD_SHA,
      username: "ReleaseControl",
      gangName: "Release Control Gang",
      evidencePath: "artifacts/release/production/smoke-account.json",
      databaseTargetHash: expect.stringMatching(/^[0-9a-f]{16}$/u),
      backupIdHash: expect.stringMatching(/^[0-9a-f]{16}$/u)
    });
  });

  it.each([
    ["missing confirmation", { EMPIRE_PRODUCTION_SMOKE_ACCOUNT_BOOTSTRAP_CONFIRMED: "" }, "PRODUCTION_SMOKE_ACCOUNT_CONFIRMATION_REQUIRED"],
    ["open registration", { EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "true" }, "PRODUCTION_SMOKE_ACCOUNT_REGISTRATION_OPEN"],
    ["pooled database", { EMPIRE_DATABASE_URL: direct.replace("ep-production", "ep-production-pooler") }, "PRODUCTION_SMOKE_ACCOUNT_DATABASE_INVALID"],
    ["staging database", { EMPIRE_DATABASE_URL: direct.replace("production", "staging") }, "PRODUCTION_SMOKE_ACCOUNT_DATABASE_INVALID"],
    ["database mismatch", { GAMEPLAY_DATABASE_URL: direct.replace("/empire", "/other") }, "PRODUCTION_SMOKE_ACCOUNT_DATABASE_MISMATCH"],
    ["missing target hash", { EMPIRE_PRODUCTION_DATABASE_TARGET_HASH: "" }, "PRODUCTION_SMOKE_ACCOUNT_TARGET_HASH_INVALID"],
    ["wrong target hash", { EMPIRE_PRODUCTION_DATABASE_TARGET_HASH: "a".repeat(64) }, "PRODUCTION_SMOKE_ACCOUNT_TARGET_MISMATCH"],
    ["missing backup", { EMPIRE_DATABASE_BACKUP_CONFIRMED: "false" }, "PRODUCTION_SMOKE_ACCOUNT_BACKUP_REQUIRED"],
    ["invalid backup ID", { EMPIRE_DATABASE_BACKUP_ID: "" }, "PRODUCTION_SMOKE_ACCOUNT_BACKUP_ID_INVALID"],
    ["weak password", { EMPIRE_PRODUCTION_SMOKE_ACCOUNT_PASSWORD: "too-short" }, "PRODUCTION_SMOKE_ACCOUNT_PASSWORD_INVALID"],
    ["unsafe evidence", { EMPIRE_PRODUCTION_SMOKE_ACCOUNT_EVIDENCE_PATH: "../account.json" }, "PRODUCTION_SMOKE_ACCOUNT_EVIDENCE_PATH_INVALID"]
  ])("rejects %s", (_label, override, code) => {
    expect(() => validateProductionSmokeAccountEnvironment({ ...valid, ...override })).toThrow(code);
  });
});
