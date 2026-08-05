import { describe, expect, it } from "vitest";
import { resolveHostedRuntimeWorkerEnvironment } from
  "../../apps/server/src/bootstrap/hosted-runtime-worker-environment";

const secret = (character: string): string => character.repeat(64);
const credential = ["worker", "fixture-password"].join(":");
const directUrl = (endpoint = "ep-release", database = "empire"): string =>
  `postgresql://${credential}@${endpoint}.eu-central-1.aws.neon.tech/${database}?sslmode=verify-full`;
const validPublicEnvironment = {
  NODE_ENV: "production",
  EMPIRE_RELEASE_ENVIRONMENT: "staging",
  EMPIRE_DATABASE_URL: directUrl(),
  GAMEPLAY_DATABASE_URL: directUrl(),
  EMPIRE_PERSISTENCE_DRIVER: "postgres",
  GAMEPLAY_PERSISTENCE_DRIVER: "postgres",
  GAMEPLAY_SLICE_SESSION_SECRET: secret("a"),
  GAMEPLAY_SLICE_SNAPSHOT_SECRET: secret("b"),
  EMPIRE_BUILD_SHA: "c".repeat(40),
  EMPIRE_HOSTED_WORKER_ID: "worker:staging:fra:01",
  EMPIRE_HOSTED_WORKER_REGION: "fra",
  EMPIRE_RUNTIME_REGION: "fra",
  EMPIRE_TICK_WORKER_OWNER_ID: "worker:staging:fra:01",
  EMPIRE_HOSTED_PREFLIGHT_STRICT: "true",
  PORT: "8080"
};

describe("hosted runtime worker environment", () => {
  it("accepts a strict public worker with direct TLS PostgreSQL", () => {
    expect(resolveHostedRuntimeWorkerEnvironment(validPublicEnvironment)).toMatchObject({
      workerId: "worker:staging:fra:01",
      region: "fra",
      runtimeRegion: "fra",
      releaseEnvironment: "staging",
      publicRelease: true,
      port: 8080
    });
  });

  it.each([
    ["missing release environment", { EMPIRE_RELEASE_ENVIRONMENT: "" }, "HOSTED_WORKER_RELEASE_ENVIRONMENT_INVALID"],
    ["pooled database", { EMPIRE_DATABASE_URL: directUrl("ep-release-pooler") }, "HOSTED_WORKER_DIRECT_TLS_DATABASE_REQUIRED"],
    ["different database", { GAMEPLAY_DATABASE_URL: directUrl("ep-release", "other") }, "HOSTED_WORKER_DATABASE_TARGET_MISMATCH"],
    ["local worker", { EMPIRE_HOSTED_WORKER_ID: "worker:local", EMPIRE_TICK_WORKER_OWNER_ID: "worker:local" }, "HOSTED_WORKER_ID_INVALID"],
    ["region mismatch", { EMPIRE_RUNTIME_REGION: "ams" }, "HOSTED_WORKER_REGION_INVALID"],
    ["owner mismatch", { EMPIRE_TICK_WORKER_OWNER_ID: "worker:staging:fra:02" }, "HOSTED_WORKER_LEASE_OWNER_INVALID"],
    ["weak secret", { GAMEPLAY_SLICE_SESSION_SECRET: "weak" }, "HOSTED_WORKER_SECRETS_INVALID"]
  ])("rejects %s", (_label, override, code) => {
    expect(() => resolveHostedRuntimeWorkerEnvironment({
      ...validPublicEnvironment,
      ...override
    })).toThrow(code);
  });

  it("preserves the explicit local development worker contract", () => {
    expect(resolveHostedRuntimeWorkerEnvironment({
      ...validPublicEnvironment,
      NODE_ENV: "development",
      EMPIRE_RELEASE_ENVIRONMENT: "local-hosted",
      EMPIRE_DATABASE_URL: "postgresql://empire@127.0.0.1:5432/empire",
      GAMEPLAY_DATABASE_URL: "postgresql://empire@127.0.0.1:5432/empire",
      EMPIRE_BUILD_SHA: "local",
      EMPIRE_HOSTED_WORKER_ID: "local-hosted-worker",
      EMPIRE_HOSTED_WORKER_REGION: "eu-central",
      EMPIRE_RUNTIME_REGION: "eu-central",
      EMPIRE_TICK_WORKER_OWNER_ID: "local-hosted-worker",
      EMPIRE_HOSTED_PREFLIGHT_STRICT: "false",
      GAMEPLAY_SLICE_SESSION_SECRET: "local-session-secret-with-at-least-32-characters",
      GAMEPLAY_SLICE_SNAPSHOT_SECRET: "local-snapshot-secret-with-at-least-32-characters"
    })).toMatchObject({ publicRelease: false, releaseEnvironment: "local-hosted" });
  });
});
