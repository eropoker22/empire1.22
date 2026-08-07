import { describe, expect, it } from "vitest";
import {
  createReleaseManifest,
  validateCodeLevelReleaseEnvironment,
  validateReleaseSource,
  validateStagingEnvironment
} from "../../scripts/staging-release-contract.mjs";
import { releaseDatabaseTargetHash } from "../../scripts/release-database-target-hash.mjs";

const SHA = "854a5336e6f816343baf9bdec81a4bd3690a82de";
const secret = (character) => character.repeat(64);
const now = new Date("2026-08-05T10:00:00.000Z");
const directDatabaseUrl = "postgresql://runtime@ep-staging.eu-central-1.aws.neon.tech/empire_staging?sslmode=verify-full";
const pooledDatabaseUrl = "postgresql://runtime@ep-staging-pooler.eu-central-1.aws.neon.tech/empire_staging?sslmode=verify-full";
const validEnvironment = {
  EMPIRE_RELEASE_ENVIRONMENT: "staging",
  EMPIRE_DATABASE_TARGET_ENVIRONMENT: "staging",
  NODE_ENV: "production",
  EMPIRE_PUBLIC_ORIGIN: "https://staging.empirestreets.cz",
  EMPIRE_ALLOWED_ORIGINS: "https://staging.empirestreets.cz",
  EMPIRE_DATABASE_URL: directDatabaseUrl,
  GAMEPLAY_DATABASE_URL: directDatabaseUrl.replace("runtime@", "gameplay@"),
  EMPIRE_RELEASE_DATABASE_URL_POOLED: pooledDatabaseUrl,
  GAMEPLAY_RELEASE_DATABASE_URL_POOLED: pooledDatabaseUrl.replace("runtime@", "gameplay@"),
  EMPIRE_STAGING_DATABASE_TARGET_HASH: releaseDatabaseTargetHash(directDatabaseUrl),
  EMPIRE_PERSISTENCE_DRIVER: "postgres",
  GAMEPLAY_PERSISTENCE_DRIVER: "postgres",
  EMPIRE_BUILD_SHA: SHA,
  FLY_STAGING_APP: "empire-streets-staging-worker",
  EMPIRE_PRE_ALPHA_STAGING_FLY_APP: "empire-streets-staging-worker",
  EMPIRE_HOSTED_WORKER_ID: "worker:staging:eu-central",
  EMPIRE_HOSTED_WORKER_REGION: "eu-central",
  EMPIRE_RUNTIME_REGION: "eu-central",
  EMPIRE_TICK_WORKER_OWNER_ID: "worker:staging:eu-central",
  GAMEPLAY_SLICE_SESSION_SECRET: secret("a"),
  GAMEPLAY_SLICE_SNAPSHOT_SECRET: secret("b"),
  EMPIRE_ADMIN_FINGERPRINT_SECRET: secret("c"),
  EMPIRE_ADMIN_SESSION_SECRET: secret("d"),
  EMPIRE_AUTH_THROTTLE_PEPPER: secret("e"),
  EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "false",
  EMPIRE_ACCOUNT_TERMS_VERSION: "closed-alpha-internal-v1",
  EMPIRE_ADMIN_WRITES_ENABLED: "true",
  EMPIRE_HOSTED_CONTROL_PLANE_ENABLED: "true",
  EMPIRE_SERVER_PROVISIONING_ENABLED: "true",
  EMPIRE_LEGACY_MATCHMAKING_ENABLED: "false",
  EMPIRE_WAR_HOSTING_ENABLED: "false",
  EMPIRE_HOSTED_PREFLIGHT_STRICT: "true"
};

describe("staging release contract", () => {
  it("accepts a closed, isolated production-like staging environment", () => {
    const result = validateStagingEnvironment(validEnvironment, { nodeVersion: "24.18.0" });
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
      "STAGING_DATABASE_TARGET_MISMATCH",
      "STAGING_REGISTRATION_MUST_BE_CLOSED",
      "STAGING_SECRETS_REUSED",
      "STAGING_NODE_VERSION_INVALID"
    ]));
  });

  it("does not treat missing secrets as a distinct secret set", () => {
    const result = validateStagingEnvironment({}, { nodeVersion: "24.18.0" });
    expect(result.checks.find((check) => check.name === "STAGING_SECRETS_DISTINCT")).toMatchObject({
      set: false,
      passed: false
    });
  });

  it("rejects a weak admin session secret even when the other secrets are valid", () => {
    const result = validateStagingEnvironment({
      ...validEnvironment,
      EMPIRE_ADMIN_SESSION_SECRET: "too-short"
    }, { nodeVersion: "24.18.0" });
    expect(result.checks.find((check) => check.name === "EMPIRE_ADMIN_SESSION_SECRET")).toMatchObject({
      passed: false,
      errorCode: "STAGING_ADMIN_SESSION_SECRET_WEAK"
    });
  });

  it("requires an explicit terms version before staging registration opens", () => {
    const open = {
      ...validEnvironment,
      EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "true",
      EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT: "2026-08-05T12:00:00.000Z",
      EMPIRE_AUTH_THROTTLE_PEPPER: secret("e")
    };
    expect(validateStagingEnvironment(open, { allowRegistrationEnabled: true, nodeVersion: "24.18.0", now }).passed).toBe(true);
    const missing = validateStagingEnvironment(
      { ...open, EMPIRE_ACCOUNT_TERMS_VERSION: "" },
      { allowRegistrationEnabled: true, nodeVersion: "24.18.0", now }
    );
    expect(missing.checks.find((check) => check.name === "EMPIRE_ACCOUNT_TERMS_VERSION")).toMatchObject({
      passed: false,
      errorCode: "STAGING_ACCOUNT_TERMS_VERSION_INVALID"
    });
    const expired = validateStagingEnvironment({
      ...open,
      EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT: "2026-08-05T09:00:00.000Z"
    }, { allowRegistrationEnabled: true, nodeVersion: "24.18.0", now });
    expect(expired.checks.find((check) => check.name === "EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT")).toMatchObject({
      passed: false,
      errorCode: "STAGING_REGISTRATION_WINDOW_INVALID"
    });
    expect(validateStagingEnvironment({
      ...open,
      EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT: "Wed, 05 Aug 2026 12:00:00 GMT"
    }, { allowRegistrationEnabled: true, nodeVersion: "24.18.0", now }).passed).toBe(false);
  });

  it("requires both database variables to identify the same TLS target", () => {
    const result = validateStagingEnvironment({
      ...validEnvironment,
      GAMEPLAY_DATABASE_URL: "postgresql://gameplay@other.internal/other_staging?sslmode=require"
    }, { nodeVersion: "24.18.0" });
    expect(result.checks.find((check) => check.name === "STAGING_DATABASE_TARGET_MATCH")).toMatchObject({
      passed: false,
      errorCode: "STAGING_DATABASE_TARGET_MISMATCH"
    });
  });

  it("pins every direct and pooled database URL to the protected staging hash", () => {
    for (const override of [
      { EMPIRE_STAGING_DATABASE_TARGET_HASH: "a".repeat(64) },
      { EMPIRE_STAGING_DATABASE_TARGET_HASH: "" },
      {
        EMPIRE_RELEASE_DATABASE_URL_POOLED:
          "postgresql://runtime@ep-other-pooler.eu-central-1.aws.neon.tech/empire_staging?sslmode=verify-full",
        GAMEPLAY_RELEASE_DATABASE_URL_POOLED:
          "postgresql://gameplay@ep-other-pooler.eu-central-1.aws.neon.tech/empire_staging?sslmode=verify-full"
      }
    ]) {
      const result = validateStagingEnvironment({ ...validEnvironment, ...override }, { nodeVersion: "24.18.0" });
      expect(result.checks.find((check) => check.name === "EMPIRE_STAGING_DATABASE_TARGET_HASH")).toMatchObject({
        passed: false,
        errorCode: "STAGING_DATABASE_TARGET_HASH_MISMATCH"
      });
    }
  });

  it("requires the explicit staging database environment and canonical independent Fly pin", () => {
    const wrongTarget = validateStagingEnvironment({
      ...validEnvironment,
      EMPIRE_DATABASE_TARGET_ENVIRONMENT: "production"
    }, { nodeVersion: "24.18.0" });
    expect(wrongTarget.checks.find((check) => check.name === "EMPIRE_DATABASE_TARGET_ENVIRONMENT")).toMatchObject({
      passed: false,
      errorCode: "STAGING_DATABASE_TARGET_ENVIRONMENT_INVALID"
    });

    const wrongFlyApp = validateStagingEnvironment({
      ...validEnvironment,
      FLY_STAGING_APP: "empire-streets-production-worker"
    }, { nodeVersion: "24.18.0" });
    expect(wrongFlyApp.checks.find((check) => check.name === "FLY_STAGING_APP")).toMatchObject({
      passed: false,
      errorCode: "STAGING_FLY_APP_INVALID"
    });
    expect(wrongFlyApp.checks.find((check) => check.name === "EMPIRE_PRE_ALPHA_STAGING_FLY_APP")).toMatchObject({
      passed: false,
      errorCode: "STAGING_FLY_APP_PIN_MISMATCH"
    });

    const wrongIndependentPin = validateStagingEnvironment({
      ...validEnvironment,
      EMPIRE_PRE_ALPHA_STAGING_FLY_APP: "empire-streets-production-worker"
    }, { nodeVersion: "24.18.0" });
    expect(wrongIndependentPin.checks.find((check) => check.name === "EMPIRE_PRE_ALPHA_STAGING_FLY_APP"))
      .toMatchObject({ passed: false, errorCode: "STAGING_FLY_APP_PIN_MISMATCH" });
  });

  it("requires the configured build SHA to equal checkout HEAD when supplied", () => {
    expect(validateStagingEnvironment(validEnvironment, { gitSha: SHA, nodeVersion: "24.18.0" }).passed).toBe(true);
    const result = validateStagingEnvironment(validEnvironment, {
      gitSha: "a".repeat(40),
      nodeVersion: "24.18.0"
    });
    expect(result.checks.find((check) => check.name === "STAGING_BUILD_SHA_MATCHES_HEAD")).toMatchObject({
      passed: false,
      errorCode: "STAGING_BUILD_SHA_MISMATCH"
    });
  });

  it("rejects a non-staging release environment", () => {
    const result = validateStagingEnvironment({
      ...validEnvironment,
      EMPIRE_RELEASE_ENVIRONMENT: "production"
    }, { nodeVersion: "24.18.0" });
    expect(result.checks.find((check) => check.name === "EMPIRE_RELEASE_ENVIRONMENT")).toMatchObject({
      passed: false,
      errorCode: "STAGING_RELEASE_ENVIRONMENT_INVALID"
    });
  });

  it("requires War hosting to remain explicitly disabled", () => {
    const result = validateStagingEnvironment({
      ...validEnvironment,
      EMPIRE_WAR_HOSTING_ENABLED: "true"
    }, { nodeVersion: "24.18.0" });
    expect(result.checks.find((check) => check.name === "EMPIRE_WAR_HOSTING_ENABLED")).toMatchObject({
      passed: false,
      errorCode: "STAGING_WAR_HOSTING_ENABLED"
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

  it("allows code-level manifest metadata without requiring hosting secrets", () => {
    expect(validateCodeLevelReleaseEnvironment({
      EMPIRE_RELEASE_ENVIRONMENT: "staging"
    }, { nodeVersion: "24.18.0" })).toBe(true);
    expect(() => validateCodeLevelReleaseEnvironment({
      EMPIRE_RELEASE_ENVIRONMENT: "production"
    }, { nodeVersion: "24.18.0" })).toThrow(/EMPIRE_RELEASE_ENVIRONMENT=staging/u);
    expect(() => validateCodeLevelReleaseEnvironment({
      EMPIRE_RELEASE_ENVIRONMENT: "staging"
    }, { nodeVersion: "22.0.0" })).toThrow(/Node\.js 24/u);
  });

  it("creates one immutable SHA for frontend, API and worker", () => {
    expect(createReleaseManifest({
      gitSha: SHA,
      expectedSchemaVersion: "015_account_age_requirement.sql",
      createdAt: "2026-07-23T12:00:00.000Z",
      nodeVersion: "24.18.0",
      npmVersion: "11.16.0"
    })).toEqual({
      gitSha: SHA,
      frontendBuildSha: SHA,
      apiBuildSha: SHA,
      workerBuildSha: SHA,
      expectedSchemaVersion: "015_account_age_requirement.sql",
      nodeVersion: "24.18.0",
      nodeMajor: 24,
      npmVersion: "11.16.0",
      createdAt: "2026-07-23T12:00:00.000Z",
      buildTimestamp: "2026-07-23T12:00:00.000Z",
      environment: "staging",
      targetEnvironment: "staging",
      verificationMode: "code-level"
    });
    expect(() => createReleaseManifest({
      gitSha: SHA,
      expectedSchemaVersion: "",
      createdAt: "2026-07-23T12:00:00.000Z",
      nodeVersion: "24.18.0",
      npmVersion: "11.16.0"
    })).toThrow(/schema migration filename/u);
    expect(() => createReleaseManifest({
      gitSha: SHA,
      expectedSchemaVersion: "015_account_age_requirement.sql",
      verificationMode: "live",
      nodeVersion: "24.18.0",
      npmVersion: "11.16.0"
    })).toThrow(/verification mode/u);
  });
});
