import { releaseDatabaseTargetHash } from "./release-database-target-hash.mjs";

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const LIFECYCLE_DISPLAY_PREFIX_PATTERN =
  /^Remote Staging Acceptance full-lifecycle-20p ([0-9a-f]{16})$/u;
const MAX_LIFECYCLE_CREATION_WINDOW_MS = 10 * 60 * 1_000;

export const databaseTargetHash = (value) => {
  const parsed = parseDatabaseUrl(value);
  return releaseDatabaseTargetHash(parsed);
};

export const assertSafeRemoteStagingFixtureEnvironment = (environment) => {
  if (environment.NODE_ENV !== "production") {
    throw new Error("REMOTE_STAGING_FIXTURE_NODE_ENV_INVALID");
  }
  if (environment.EMPIRE_RELEASE_ENVIRONMENT !== "staging"
    || environment.EMPIRE_DATABASE_TARGET_ENVIRONMENT !== "staging") {
    throw new Error("REMOTE_STAGING_FIXTURE_ENVIRONMENT_INVALID");
  }
  if (environment.EMPIRE_REMOTE_STAGING_FIXTURE_APPROVED !== "staging-only-fixture-write") {
    throw new Error("REMOTE_STAGING_FIXTURE_NOT_APPROVED");
  }
  const expectedHash = String(environment.EMPIRE_STAGING_DATABASE_TARGET_HASH ?? "").trim();
  if (!SHA256_PATTERN.test(expectedHash)) {
    throw new Error("REMOTE_STAGING_FIXTURE_TARGET_HASH_INVALID");
  }
  const actualHash = databaseTargetHash(environment.EMPIRE_DATABASE_URL);
  if (actualHash !== expectedHash) {
    throw new Error("REMOTE_STAGING_FIXTURE_TARGET_MISMATCH");
  }
  const gameplayHash = databaseTargetHash(environment.GAMEPLAY_DATABASE_URL);
  if (gameplayHash !== actualHash) {
    throw new Error("REMOTE_STAGING_FIXTURE_GAMEPLAY_TARGET_MISMATCH");
  }
  return Object.freeze({
    connectionMode: "direct",
    environment: "staging",
    targetHash: actualHash
  });
};

export const assertRemoteStagingFixtureServer = (server) => {
  if (!server || server.provisioningState !== "ready" || server.status !== "lobby") {
    throw new Error("REMOTE_STAGING_FIXTURE_SERVER_NOT_READY_LOBBY");
  }
  if (!String(server.displayName ?? "").startsWith("Remote Staging Acceptance ")) {
    throw new Error("REMOTE_STAGING_FIXTURE_SERVER_SCOPE_INVALID");
  }
  return true;
};

export const readRemoteStagingLifecycleFixtureBinding = (environment) => {
  const expectedDisplayPrefix = String(
    environment.EMPIRE_REMOTE_STAGING_FIXTURE_DISPLAY_PREFIX ?? ""
  ).trim();
  const runNonceHash = String(environment.EMPIRE_REMOTE_STAGING_RUN_NONCE_HASH ?? "").trim();
  const createdAfter = String(environment.EMPIRE_REMOTE_STAGING_FIXTURE_CREATED_AFTER ?? "").trim();
  const createdBefore = String(environment.EMPIRE_REMOTE_STAGING_FIXTURE_CREATED_BEFORE ?? "").trim();
  const prefixMatch = LIFECYCLE_DISPLAY_PREFIX_PATTERN.exec(expectedDisplayPrefix);
  const createdAfterMs = Date.parse(createdAfter);
  const createdBeforeMs = Date.parse(createdBefore);

  if (!SHA256_PATTERN.test(runNonceHash)
    || prefixMatch?.[1] !== runNonceHash.slice(0, 16)
    || !Number.isFinite(createdAfterMs)
    || !Number.isFinite(createdBeforeMs)
    || createdBeforeMs < createdAfterMs
    || createdBeforeMs - createdAfterMs > MAX_LIFECYCLE_CREATION_WINDOW_MS) {
    throw new Error("REMOTE_STAGING_LIFECYCLE_BINDING_INVALID");
  }

  return Object.freeze({
    expectedDisplayPrefix,
    runNonceHash,
    createdAfter,
    createdBefore
  });
};

export const assertRemoteStagingLifecycleFixtureServer = (server, {
  mutate = false,
  expectedDisplayPrefix,
  runNonceHash,
  createdAfter,
  createdBefore
} = {}) => {
  const prefixMatch = LIFECYCLE_DISPLAY_PREFIX_PATTERN.exec(String(expectedDisplayPrefix ?? ""));
  const createdAfterMs = Date.parse(String(createdAfter ?? ""));
  const createdBeforeMs = Date.parse(String(createdBefore ?? ""));
  const createdAtMs = Date.parse(String(server?.createdAt ?? ""));
  if (!SHA256_PATTERN.test(String(runNonceHash ?? ""))
    || prefixMatch?.[1] !== String(runNonceHash).slice(0, 16)
    || !Number.isFinite(createdAfterMs)
    || !Number.isFinite(createdBeforeMs)
    || createdBeforeMs < createdAfterMs
    || createdBeforeMs - createdAfterMs > MAX_LIFECYCLE_CREATION_WINDOW_MS) {
    throw new Error("REMOTE_STAGING_LIFECYCLE_BINDING_INVALID");
  }
  if (!server || server.provisioningState !== "ready") {
    throw new Error("REMOTE_STAGING_LIFECYCLE_SERVER_NOT_READY");
  }
  const expectedDisplayStart = `${expectedDisplayPrefix} `;
  const displayName = String(server.displayName ?? "");
  const displaySuffix = displayName.startsWith(expectedDisplayStart)
    ? displayName.slice(expectedDisplayStart.length)
    : "";
  if (!/^[0-9a-f]{8}$/u.test(displaySuffix)
    || !Number.isFinite(createdAtMs)
    || createdAtMs < createdAfterMs
    || createdAtMs > createdBeforeMs
    || server.mode !== "free"
    || server.serverTemplate !== "full"
    || server.capacity !== 20) {
    throw new Error("REMOTE_STAGING_LIFECYCLE_SERVER_SCOPE_INVALID");
  }
  if (mutate && server.status !== "paused") {
    throw new Error("REMOTE_STAGING_LIFECYCLE_SERVER_NOT_PAUSED");
  }
  if (!mutate && !["running", "paused", "stopped", "archived"].includes(server.status)) {
    throw new Error("REMOTE_STAGING_LIFECYCLE_SERVER_STATUS_INVALID");
  }
  return true;
};

const parseDatabaseUrl = (value) => {
  let parsed;
  try {
    parsed = new URL(String(value ?? "").trim());
  } catch {
    throw new Error("REMOTE_STAGING_FIXTURE_DATABASE_URL_INVALID");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)
    || !parsed.hostname.toLowerCase().endsWith(".neon.tech")
    || !["require", "verify-ca", "verify-full"].includes(parsed.searchParams.get("sslmode") ?? "")) {
    throw new Error("REMOTE_STAGING_FIXTURE_DATABASE_URL_INVALID");
  }
  if (parsed.hostname.split(".")[0]?.endsWith("-pooler")) {
    throw new Error("REMOTE_STAGING_FIXTURE_REQUIRES_DIRECT_DATABASE");
  }
  return parsed;
};
