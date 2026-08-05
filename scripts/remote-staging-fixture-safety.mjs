import { createHash } from "node:crypto";

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

export const databaseTargetHash = (value) => {
  const parsed = parseDatabaseUrl(value);
  const identity = `${parsed.hostname.toLowerCase()}:${parsed.port || "5432"}${parsed.pathname}`;
  return createHash("sha256").update(identity).digest("hex");
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
