import { describe, expect, it } from "vitest";
import {
  PRODUCTION_ORIGIN,
  validateProductionEnvironment
} from "../../scripts/production-release-contract.mjs";

const SHA = "82ab0778704c755170048d9509036eb3f03909da";
const secret = (character) => character.repeat(64);
const validEnvironment = {
  EMPIRE_RELEASE_ENVIRONMENT: "production",
  NODE_ENV: "production",
  EMPIRE_PUBLIC_ORIGIN: PRODUCTION_ORIGIN,
  EMPIRE_ALLOWED_ORIGINS: PRODUCTION_ORIGIN,
  EMPIRE_DATABASE_URL: "postgresql://runtime@ep-production-pooler.eu-central-1.aws.neon.tech/empire?sslmode=verify-full",
  GAMEPLAY_DATABASE_URL: "postgresql://gameplay@ep-production-pooler.eu-central-1.aws.neon.tech/empire?sslmode=verify-full",
  EMPIRE_PERSISTENCE_DRIVER: "postgres",
  GAMEPLAY_PERSISTENCE_DRIVER: "postgres",
  EMPIRE_BUILD_SHA: SHA,
  EMPIRE_HOSTED_WORKER_ID: "worker:production:eu-central",
  EMPIRE_HOSTED_WORKER_REGION: "eu-central",
  EMPIRE_RUNTIME_REGION: "eu-central",
  EMPIRE_TICK_WORKER_OWNER_ID: "worker:production:eu-central",
  GAMEPLAY_SLICE_SESSION_SECRET: secret("a"),
  GAMEPLAY_SLICE_SNAPSHOT_SECRET: secret("b"),
  EMPIRE_ADMIN_FINGERPRINT_SECRET: secret("c"),
  EMPIRE_ADMIN_SESSION_SECRET: secret("d"),
  EMPIRE_AUTH_THROTTLE_PEPPER: secret("e"),
  EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "false",
  EMPIRE_ACCOUNT_TERMS_VERSION: "closed-alpha-approved-v1",
  EMPIRE_ADMIN_WRITES_ENABLED: "true",
  EMPIRE_HOSTED_CONTROL_PLANE_ENABLED: "true",
  EMPIRE_SERVER_PROVISIONING_ENABLED: "true",
  EMPIRE_LEGACY_MATCHMAKING_ENABLED: "false",
  EMPIRE_HOSTED_PREFLIGHT_STRICT: "true",
  EMPIRE_ADMIN_BOOTSTRAP_PASSWORD: ""
};
const options = { component: "netlify", gitSha: SHA, nodeVersion: "24.18.0" };

describe("production release contract", () => {
  it("accepts an exact closed production Netlify environment", () => {
    const result = validateProductionEnvironment(validEnvironment, options);
    expect(result.passed).toBe(true);
    expect(result.connectionMode).toBe("pooled");
    expect(result.checks.every((check) => !("value" in check))).toBe(true);
  });

  it.each(["worker", "migration"])("requires a direct TLS endpoint for %s", (component) => {
    const direct = "postgresql://runtime@ep-production.eu-central-1.aws.neon.tech/empire?sslmode=require";
    const result = validateProductionEnvironment({
      ...validEnvironment,
      EMPIRE_DATABASE_URL: direct,
      GAMEPLAY_DATABASE_URL: direct.replace("runtime@", "gameplay@")
    }, { ...options, component });
    expect(result.passed).toBe(true);
    expect(result.connectionMode).toBe("direct");

    expect(validateProductionEnvironment(validEnvironment, { ...options, component }).checks
      .find((check) => check.name === "EMPIRE_DATABASE_URL")).toMatchObject({ passed: false });
  });

  it("accepts the Fly.io Frankfurt region code as an EU worker region", () => {
    expect(validateProductionEnvironment({
      ...validEnvironment,
      EMPIRE_HOSTED_WORKER_REGION: "fra",
      EMPIRE_RUNTIME_REGION: "fra"
    }, options).passed).toBe(true);
  });

  it("rejects staging targets, loopback origins, stale SHA and open registration", () => {
    const result = validateProductionEnvironment({
      ...validEnvironment,
      EMPIRE_RELEASE_ENVIRONMENT: "staging",
      EMPIRE_PUBLIC_ORIGIN: "http://localhost:8888",
      EMPIRE_ALLOWED_ORIGINS: "*",
      EMPIRE_DATABASE_URL: "postgresql://runtime@ep-staging-pooler.eu-central-1.aws.neon.tech/empire_staging?sslmode=require",
      GAMEPLAY_DATABASE_URL: "postgresql://gameplay@ep-staging-pooler.eu-central-1.aws.neon.tech/empire_staging?sslmode=require",
      EMPIRE_BUILD_SHA: "a".repeat(40),
      EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "true"
    }, options);
    expect(result.passed).toBe(false);
    expect(result.checks.filter((check) => !check.passed).map((check) => check.errorCode)).toEqual(expect.arrayContaining([
      "PRODUCTION_RELEASE_ENVIRONMENT_INVALID",
      "PRODUCTION_PUBLIC_ORIGIN_INVALID",
      "PRODUCTION_ALLOWED_ORIGINS_INVALID",
      "PRODUCTION_DATABASE_URL_INVALID",
      "PRODUCTION_GAMEPLAY_DATABASE_URL_INVALID",
      "PRODUCTION_BUILD_SHA_MISMATCH",
      "PRODUCTION_REGISTRATION_MUST_BE_CLOSED"
    ]));
  });

  it("rejects missing or reused secrets and retained bootstrap credentials", () => {
    const result = validateProductionEnvironment({
      ...validEnvironment,
      EMPIRE_ADMIN_SESSION_SECRET: validEnvironment.EMPIRE_ADMIN_FINGERPRINT_SECRET,
      EMPIRE_AUTH_THROTTLE_PEPPER: "short",
      EMPIRE_ADMIN_BOOTSTRAP_PASSWORD: "must-not-remain"
    }, options);
    expect(result.passed).toBe(false);
    expect(result.checks.filter((check) => !check.passed).map((check) => check.errorCode)).toEqual(expect.arrayContaining([
      "PRODUCTION_AUTH_THROTTLE_PEPPER_WEAK",
      "PRODUCTION_SECRETS_REUSED",
      "PRODUCTION_BOOTSTRAP_PASSWORD_PRESENT"
    ]));
  });

  it("allows registration only after an explicit post-gate override", () => {
    const open = { ...validEnvironment, EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "true" };
    expect(validateProductionEnvironment(open, options).passed).toBe(false);
    expect(validateProductionEnvironment(open, { ...options, allowRegistrationEnabled: true }).passed).toBe(true);
  });
});
