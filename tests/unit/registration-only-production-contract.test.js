import { describe, expect, it } from "vitest";
import {
  PRODUCTION_REGISTRATION_ORIGIN,
  validateRegistrationOnlyProductionEnvironment
} from "../../scripts/registration-only-production-contract.mjs";

const SHA = "82ab0778704c755170048d9509036eb3f03909da";
const secret = (character) => character.repeat(64);
const validEnvironment = {
  NODE_ENV: "production",
  EMPIRE_PUBLIC_ORIGIN: PRODUCTION_REGISTRATION_ORIGIN,
  EMPIRE_ALLOWED_ORIGINS: PRODUCTION_REGISTRATION_ORIGIN,
  EMPIRE_DATABASE_URL: "postgresql://runtime@ep-example-pooler.eu-central-1.aws.neon.tech/empire?sslmode=require",
  EMPIRE_PERSISTENCE_DRIVER: "postgres",
  GAMEPLAY_PERSISTENCE_DRIVER: "postgres",
  EMPIRE_BUILD_SHA: SHA,
  GAMEPLAY_SLICE_SESSION_SECRET: secret("a"),
  GAMEPLAY_SLICE_SNAPSHOT_SECRET: secret("b"),
  EMPIRE_ADMIN_FINGERPRINT_SECRET: secret("c"),
  EMPIRE_AUTH_THROTTLE_PEPPER: secret("d"),
  EMPIRE_ADMIN_WRITES_ENABLED: "false",
  EMPIRE_HOSTED_CONTROL_PLANE_ENABLED: "false",
  EMPIRE_SERVER_PROVISIONING_ENABLED: "false",
  EMPIRE_LEGACY_MATCHMAKING_ENABLED: "false",
  EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "false"
};

describe("registration-only production contract", () => {
  it("accepts a closed production account platform without game hosting", () => {
    const result = validateRegistrationOnlyProductionEnvironment(validEnvironment);
    expect(result.passed).toBe(true);
    expect(result.checks.every((check) => !("value" in check))).toBe(true);
  });

  it("accepts the registration flag only when the operator explicitly expects it", () => {
    const environment = { ...validEnvironment, EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "true" };
    expect(validateRegistrationOnlyProductionEnvironment(environment).passed).toBe(false);
    expect(validateRegistrationOnlyProductionEnvironment(environment, { registrationEnabled: true }).passed).toBe(true);
  });

  it("rejects unsafe origins, direct database URLs, enabled hosting writes and reused secrets", () => {
    const result = validateRegistrationOnlyProductionEnvironment({
      ...validEnvironment,
      EMPIRE_ALLOWED_ORIGINS: "*,https://www.empirestreets.cz",
      EMPIRE_DATABASE_URL: "postgresql://runtime@ep-example.eu-central-1.aws.neon.tech/empire?sslmode=require",
      GAMEPLAY_SLICE_SNAPSHOT_SECRET: validEnvironment.GAMEPLAY_SLICE_SESSION_SECRET,
      EMPIRE_ADMIN_WRITES_ENABLED: "true",
      EMPIRE_HOSTED_CONTROL_PLANE_ENABLED: "true",
      EMPIRE_SERVER_PROVISIONING_ENABLED: "true"
    });
    expect(result.passed).toBe(false);
    expect(result.checks.filter((check) => !check.passed).map((check) => check.errorCode)).toEqual(expect.arrayContaining([
      "REGISTRATION_ONLY_ALLOWED_ORIGINS_INVALID",
      "REGISTRATION_ONLY_DATABASE_URL_INVALID",
      "REGISTRATION_ONLY_SECRETS_REUSED",
      "REGISTRATION_ONLY_ADMIN_WRITES_MUST_BE_DISABLED",
      "REGISTRATION_ONLY_CONTROL_PLANE_MUST_BE_DISABLED",
      "REGISTRATION_ONLY_PROVISIONING_MUST_BE_DISABLED"
    ]));
  });

  it("requires strong, distinct server-only secrets and an exact build SHA", () => {
    const result = validateRegistrationOnlyProductionEnvironment({
      ...validEnvironment,
      EMPIRE_BUILD_SHA: "unknown",
      GAMEPLAY_SLICE_SESSION_SECRET: "short",
      EMPIRE_AUTH_THROTTLE_PEPPER: ""
    });
    expect(result.passed).toBe(false);
    expect(result.checks.filter((check) => !check.passed).map((check) => check.errorCode)).toEqual(expect.arrayContaining([
      "REGISTRATION_ONLY_BUILD_SHA_INVALID",
      "REGISTRATION_ONLY_SESSION_SECRET_WEAK",
      "REGISTRATION_ONLY_THROTTLE_SECRET_WEAK",
      "REGISTRATION_ONLY_SECRETS_REUSED"
    ]));
  });
});
