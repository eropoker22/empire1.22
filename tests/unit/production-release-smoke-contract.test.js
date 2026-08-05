import { describe, expect, it } from "vitest";
import { validateProductionReleaseSmokeEnvironment } from "../../scripts/production-release-smoke-contract.mjs";

const sha = "82ab0778704c755170048d9509036eb3f03909da";
const valid = {
  NODE_ENV: "production",
  EMPIRE_RELEASE_ENVIRONMENT: "production",
  EMPIRE_DATABASE_TARGET_ENVIRONMENT: "production",
  EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "false",
  EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT: "",
  EMPIRE_BUILD_SHA: sha,
  EMPIRE_PUBLIC_ORIGIN: "https://empirestreets.cz",
  EMPIRE_HOSTED_WORKER_ORIGIN: "https://empire-production-worker.fly.dev",
  EMPIRE_RUNTIME_REGION: "fra",
  EMPIRE_PRODUCTION_REMOTE_SMOKE: "1",
  EMPIRE_PRODUCTION_SMOKE_ARTIFACT_ROOT: "artifacts/release/production/smoke",
  FLY_PRODUCTION_APP: "empire-production-worker",
  PRODUCTION_ADMIN_USERNAME: "release-owner",
  PRODUCTION_ADMIN_PASSWORD: "strong-admin-password-1234",
  PRODUCTION_SMOKE_ACCOUNT_USERNAME: "ReleaseControl",
  PRODUCTION_SMOKE_ACCOUNT_PASSWORD: "strong-player-password-123"
};

describe("production release smoke contract", () => {
  it("accepts an exact closed production release without returning passwords", () => {
    const result = validateProductionReleaseSmokeEnvironment(valid, {
      gitSha: sha,
      nodeVersion: "24.18.0"
    });
    expect(result).toMatchObject({
      buildSha: sha,
      publicOrigin: "https://empirestreets.cz",
      workerOrigin: "https://empire-production-worker.fly.dev",
      artifactRoot: "artifacts/release/production/smoke"
    });
    expect(JSON.stringify(result)).not.toContain(valid.PRODUCTION_ADMIN_PASSWORD);
    expect(JSON.stringify(result)).not.toContain(valid.PRODUCTION_SMOKE_ACCOUNT_PASSWORD);
  });

  it.each([
    ["missing approval", { EMPIRE_PRODUCTION_REMOTE_SMOKE: "" }, {}, "PRODUCTION_SMOKE_APPROVAL_REQUIRED"],
    ["staging environment", { EMPIRE_RELEASE_ENVIRONMENT: "staging" }, {}, "PRODUCTION_SMOKE_ENVIRONMENT_INVALID"],
    ["open registration", { EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "true" }, {}, "PRODUCTION_SMOKE_REGISTRATION_OPEN"],
    ["stale registration expiry", { EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT: "2026-08-06T12:00:00.000Z" }, {}, "PRODUCTION_SMOKE_REGISTRATION_OPEN"],
    ["different checkout", {}, { gitSha: "a".repeat(40) }, "PRODUCTION_SMOKE_SHA_MISMATCH"],
    ["wrong public origin", { EMPIRE_PUBLIC_ORIGIN: "https://www.empirestreets.cz" }, {}, "PRODUCTION_SMOKE_ORIGIN_INVALID"],
    ["wrong worker origin", { EMPIRE_HOSTED_WORKER_ORIGIN: "https://other.fly.dev" }, {}, "PRODUCTION_SMOKE_WORKER_ORIGIN_INVALID"],
    ["non-EU region", { EMPIRE_RUNTIME_REGION: "iad" }, {}, "PRODUCTION_SMOKE_REGION_INVALID"],
    ["weak account password", { PRODUCTION_SMOKE_ACCOUNT_PASSWORD: "short" }, {}, "PRODUCTION_SMOKE_ACCOUNT_PASSWORD_INVALID"],
    ["reused password", { PRODUCTION_SMOKE_ACCOUNT_PASSWORD: valid.PRODUCTION_ADMIN_PASSWORD }, {}, "PRODUCTION_SMOKE_PASSWORD_REUSED"],
    ["unsafe artifacts", { EMPIRE_PRODUCTION_SMOKE_ARTIFACT_ROOT: "../smoke" }, {}, "PRODUCTION_SMOKE_ARTIFACT_ROOT_INVALID"],
    ["unsupported Node", {}, { nodeVersion: "26.3.1" }, "PRODUCTION_SMOKE_NODE_INVALID"]
  ])("rejects %s", (_label, override, optionOverride, code) => {
    expect(() => validateProductionReleaseSmokeEnvironment(
      { ...valid, ...override },
      { gitSha: sha, nodeVersion: "24.18.0", ...optionOverride }
    )).toThrow(code);
  });
});
