import { describe, expect, it } from "vitest";
import {
  assertRemoteStagingFixtureServer,
  assertSafeRemoteStagingFixtureEnvironment,
  databaseTargetHash
} from "../../scripts/remote-staging-fixture-safety.mjs";

const directUrl = "postgresql://staging-role@ep-acceptance.eu-central-1.aws.neon.tech/empire?sslmode=verify-full";
const validEnvironment = {
  NODE_ENV: "production",
  EMPIRE_RELEASE_ENVIRONMENT: "staging",
  EMPIRE_DATABASE_TARGET_ENVIRONMENT: "staging",
  EMPIRE_REMOTE_STAGING_FIXTURE_APPROVED: "staging-only-fixture-write",
  EMPIRE_STAGING_DATABASE_TARGET_HASH: databaseTargetHash(directUrl),
  EMPIRE_DATABASE_URL: directUrl,
  GAMEPLAY_DATABASE_URL: directUrl
};

describe("remote staging fixture safety", () => {
  it("accepts only an explicitly approved direct staging target hash", () => {
    expect(assertSafeRemoteStagingFixtureEnvironment(validEnvironment)).toMatchObject({
      connectionMode: "direct",
      environment: "staging"
    });
  });

  it.each([
    ["production release", { EMPIRE_RELEASE_ENVIRONMENT: "production" }, "ENVIRONMENT_INVALID"],
    ["wrong target hash", { EMPIRE_STAGING_DATABASE_TARGET_HASH: "a".repeat(64) }, "TARGET_MISMATCH"],
    ["pooled URL", { EMPIRE_DATABASE_URL: directUrl.replace("ep-acceptance", "ep-acceptance-pooler") }, "REQUIRES_DIRECT"],
    ["missing approval", { EMPIRE_REMOTE_STAGING_FIXTURE_APPROVED: "" }, "NOT_APPROVED"],
    ["different gameplay target", { GAMEPLAY_DATABASE_URL: directUrl.replace("/empire?", "/other?") }, "GAMEPLAY_TARGET_MISMATCH"]
  ])("rejects %s", (_label, override, code) => {
    expect(() => assertSafeRemoteStagingFixtureEnvironment({
      ...validEnvironment,
      ...override
    })).toThrow(code);
  });

  it("limits writes to ready lobby servers with the acceptance prefix", () => {
    const server = {
      displayName: "Remote Staging Acceptance social-concurrency-privacy abc123",
      provisioningState: "ready",
      status: "lobby"
    };
    expect(assertRemoteStagingFixtureServer(server)).toBe(true);
    expect(() => assertRemoteStagingFixtureServer({ ...server, status: "running" })).toThrow(/NOT_READY_LOBBY/u);
    expect(() => assertRemoteStagingFixtureServer({ ...server, displayName: "Public Alpha" })).toThrow(/SCOPE_INVALID/u);
  });
});
