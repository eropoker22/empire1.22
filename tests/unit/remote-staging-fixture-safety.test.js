import { describe, expect, it } from "vitest";
import {
  assertRemoteStagingFixtureServer,
  assertRemoteStagingLifecycleFixtureServer,
  assertSafeRemoteStagingFixtureEnvironment,
  databaseTargetHash,
  readRemoteStagingLifecycleFixtureBinding
} from "../../scripts/remote-staging-fixture-safety.mjs";
import { releaseDatabaseTargetHash } from "../../scripts/release-database-target-hash.mjs";
import targetVector from "../fixtures/release-database-target-vectors.json";

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

  it("uses the canonical decoded-path target hash for the shared direct vector", () => {
    expect(databaseTargetHash(targetVector.directUrl)).toBe(
      releaseDatabaseTargetHash(targetVector.pooledUrl)
    );
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

  it("binds lifecycle mutation to the exact run prefix and creation window", () => {
    const runNonceHash = "a".repeat(64);
    const expectedDisplayPrefix =
      `Remote Staging Acceptance full-lifecycle-20p ${runNonceHash.slice(0, 16)}`;
    const binding = readRemoteStagingLifecycleFixtureBinding({
      EMPIRE_REMOTE_STAGING_FIXTURE_DISPLAY_PREFIX: expectedDisplayPrefix,
      EMPIRE_REMOTE_STAGING_RUN_NONCE_HASH: runNonceHash,
      EMPIRE_REMOTE_STAGING_FIXTURE_CREATED_AFTER: "2026-08-06T11:59:00.000Z",
      EMPIRE_REMOTE_STAGING_FIXTURE_CREATED_BEFORE: "2026-08-06T12:01:00.000Z"
    });
    const server = {
      displayName: `${expectedDisplayPrefix} deadbeef`,
      createdAt: "2026-08-06T12:00:00.000Z",
      provisioningState: "ready",
      status: "paused",
      mode: "free",
      serverTemplate: "full",
      capacity: 20
    };
    expect(assertRemoteStagingLifecycleFixtureServer(server, { mutate: true, ...binding })).toBe(true);
    expect(assertRemoteStagingLifecycleFixtureServer(
      { ...server, status: "running" },
      binding
    )).toBe(true);
    expect(() => assertRemoteStagingLifecycleFixtureServer(
      { ...server, status: "running" },
      { mutate: true, ...binding }
    )).toThrow(/NOT_PAUSED/u);
    expect(() => assertRemoteStagingLifecycleFixtureServer(
      { ...server, capacity: 19 },
      { mutate: true, ...binding }
    )).toThrow(/SCOPE_INVALID/u);
    expect(() => assertRemoteStagingLifecycleFixtureServer(
      { ...server, displayName: `${expectedDisplayPrefix} attacker deadbeef` },
      { mutate: true, ...binding }
    )).toThrow(/SCOPE_INVALID/u);
    expect(() => assertRemoteStagingLifecycleFixtureServer(
      { ...server, createdAt: "2026-08-06T11:58:59.999Z" },
      { mutate: true, ...binding }
    )).toThrow(/SCOPE_INVALID/u);
  });

  it("rejects a lifecycle binding whose prefix does not match the private nonce hash", () => {
    expect(() => readRemoteStagingLifecycleFixtureBinding({
      EMPIRE_REMOTE_STAGING_FIXTURE_DISPLAY_PREFIX:
        `Remote Staging Acceptance full-lifecycle-20p ${"b".repeat(16)}`,
      EMPIRE_REMOTE_STAGING_RUN_NONCE_HASH: "a".repeat(64),
      EMPIRE_REMOTE_STAGING_FIXTURE_CREATED_AFTER: "2026-08-06T11:59:00.000Z",
      EMPIRE_REMOTE_STAGING_FIXTURE_CREATED_BEFORE: "2026-08-06T12:01:00.000Z"
    })).toThrow(/BINDING_INVALID/u);
  });
});
