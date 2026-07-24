import { describe, expect, it } from "vitest";
import {
  createReleaseManifest,
  validateReleaseSource,
  validateStagingEnvironment
} from "../../scripts/staging-release-contract.mjs";

const SHA = "854a5336e6f816343baf9bdec81a4bd3690a82de";
const secret = (character) => character.repeat(64);
const validEnvironment = {
  EMPIRE_RELEASE_ENVIRONMENT: "staging",
  NODE_ENV: "production",
  EMPIRE_PUBLIC_ORIGIN: "https://alpha.empirestreets.cz",
  EMPIRE_ALLOWED_ORIGINS: "https://alpha.empirestreets.cz",
  EMPIRE_DATABASE_URL: "postgresql://runtime@example.internal/empire_staging?sslmode=verify-full",
  EMPIRE_PERSISTENCE_DRIVER: "postgres",
  GAMEPLAY_PERSISTENCE_DRIVER: "postgres",
  EMPIRE_BUILD_SHA: SHA,
  EMPIRE_HOSTED_WORKER_ID: "worker:staging:eu-central",
  EMPIRE_HOSTED_WORKER_REGION: "eu-central",
  GAMEPLAY_SLICE_SESSION_SECRET: secret("a"),
  GAMEPLAY_SLICE_SNAPSHOT_SECRET: secret("b"),
  EMPIRE_ADMIN_FINGERPRINT_SECRET: secret("c"),
  EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "false",
  EMPIRE_ADMIN_WRITES_ENABLED: "false",
  EMPIRE_HOSTED_CONTROL_PLANE_ENABLED: "true",
  EMPIRE_SERVER_PROVISIONING_ENABLED: "false"
};

describe("staging release contract", () => {
  it("accepts a closed, isolated production-like staging environment", () => {
    const result = validateStagingEnvironment(validEnvironment, { nodeVersion: "20.19.0" });
    expect(result.passed).toBe(true);
    expect(result.checks.every((check) => !("value" in check))).toBe(true);
  });

  it("rejects production origins, loopback databases, weak or reused secrets and open registration", () => {
    const result = validateStagingEnvironment({
      ...validEnvironment,
      EMPIRE_PUBLIC_ORIGIN: "https://empirestreets.cz",
      EMPIRE_ALLOWED_ORIGINS: "*,http://localhost:8888",
      EMPIRE_DATABASE_URL: "postgresql://postgres@127.0.0.1/empire",
      GAMEPLAY_SLICE_SNAPSHOT_SECRET: validEnvironment.GAMEPLAY_SLICE_SESSION_SECRET,
      EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "true"
    }, { nodeVersion: "22.0.0" });
    expect(result.passed).toBe(false);
    expect(result.checks.filter((check) => !check.passed).map((check) => check.errorCode)).toEqual(expect.arrayContaining([
      "STAGING_PUBLIC_ORIGIN_INVALID",
      "STAGING_ALLOWED_ORIGINS_INVALID",
      "STAGING_DATABASE_URL_INVALID",
      "STAGING_REGISTRATION_MUST_BE_CLOSED",
      "STAGING_SECRETS_REUSED",
      "STAGING_NODE_VERSION_INVALID"
    ]));
  });

  it("does not treat missing secrets as a distinct secret set", () => {
    const result = validateStagingEnvironment({}, { nodeVersion: "20.19.0" });
    expect(result.checks.find((check) => check.name === "STAGING_SECRETS_DISTINCT")).toMatchObject({
      set: false,
      passed: false
    });
  });

  it("rejects a non-staging release environment", () => {
    const result = validateStagingEnvironment({
      ...validEnvironment,
      EMPIRE_RELEASE_ENVIRONMENT: "production"
    }, { nodeVersion: "20.19.0" });
    expect(result.checks.find((check) => check.name === "EMPIRE_RELEASE_ENVIRONMENT")).toMatchObject({
      passed: false,
      errorCode: "STAGING_RELEASE_ENVIRONMENT_INVALID"
    });
  });

  it("accepts only a clean source whose configured SHA exactly matches HEAD", () => {
    expect(validateReleaseSource({
      gitSha: SHA,
      configuredSha: SHA,
      worktreeStatus: ""
    })).toBe(SHA);
    expect(() => validateReleaseSource({
      gitSha: SHA,
      configuredSha: "unknown",
      worktreeStatus: ""
    })).toThrow(/EMPIRE_BUILD_SHA/u);
    expect(() => validateReleaseSource({
      gitSha: SHA,
      configuredSha: "a".repeat(40),
      worktreeStatus: ""
    })).toThrow(/must equal/u);
    expect(() => validateReleaseSource({
      gitSha: SHA,
      configuredSha: SHA,
      worktreeStatus: " M package.json"
    })).toThrow(/dirty worktree/u);
  });

  it("creates one immutable SHA for frontend, API and worker", () => {
    expect(createReleaseManifest({
      gitSha: SHA,
      expectedSchemaVersion: "015_account_age_requirement.sql",
      createdAt: "2026-07-23T12:00:00.000Z"
    })).toEqual({
      gitSha: SHA,
      frontendBuildSha: SHA,
      apiBuildSha: SHA,
      workerBuildSha: SHA,
      expectedSchemaVersion: "015_account_age_requirement.sql",
      nodeVersion: "20",
      createdAt: "2026-07-23T12:00:00.000Z",
      environment: "staging"
    });
    expect(() => createReleaseManifest({
      gitSha: SHA,
      expectedSchemaVersion: "",
      createdAt: "2026-07-23T12:00:00.000Z"
    })).toThrow(/schema migration filename/u);
  });
});
