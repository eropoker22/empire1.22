import { Buffer } from "node:buffer";
import {
  evaluateSupportedNodeVersion,
  SUPPORTED_NODE_MAJOR
} from "./supported-node-policy.mjs";
import { validatePublicRegistrationWindow } from "./registration-window-contract.mjs";
import { releaseDatabaseTargetHash } from "./release-database-target-hash.mjs";

export const STAGING_MANIFEST_PATH = "artifacts/release-manifest.json";
export const STAGING_ENVIRONMENT = "staging";
export const STAGING_FLY_APP = "empire-streets-staging-worker";
export const STAGING_NODE_VERSION = String(SUPPORTED_NODE_MAJOR);

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const TARGET_HASH_PATTERN = /^[0-9a-f]{64}$/u;
const SECURE_SECRET_PATTERN = /^(?:[0-9a-f]{64,}|[A-Za-z0-9_-]{43,})$/u;
const TERMS_VERSION_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/u;
const STAGING_ORIGIN = "https://staging.empirestreets.cz";
const PRODUCTION_HOSTNAMES = new Set(["empirestreets.cz", "www.empirestreets.cz"]);
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export const validateStagingEnvironment = (environment, options = {}) => {
  const checks = [];
  const add = (name, component, required, passed, safeFormat, errorCode) => {
    checks.push({ name, component, required, set: isSet(environment[name]), passed: Boolean(passed), safeFormat, errorCode });
  };
  const publicOrigin = parseExactOrigin(environment.EMPIRE_PUBLIC_ORIGIN);
  const allowedOrigins = parseAllowedOrigins(environment.EMPIRE_ALLOWED_ORIGINS);
  const databaseUrl = parseDatabaseUrl(environment.EMPIRE_DATABASE_URL);
  const gameplayDatabaseUrl = parseDatabaseUrl(environment.GAMEPLAY_DATABASE_URL);
  const releasePooledDatabaseUrl = parseDatabaseUrl(environment.EMPIRE_RELEASE_DATABASE_URL_POOLED);
  const gameplayReleasePooledDatabaseUrl = parseDatabaseUrl(environment.GAMEPLAY_RELEASE_DATABASE_URL_POOLED);
  const expectedDatabaseTargetHash = String(environment.EMPIRE_STAGING_DATABASE_TARGET_HASH ?? "").trim();
  const flyStagingApp = String(environment.FLY_STAGING_APP ?? "").trim();
  const pinnedFlyStagingApp = String(environment.EMPIRE_PRE_ALPHA_STAGING_FLY_APP ?? "").trim();
  const registrationEnabled = environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED === "true";
  const allowRegistrationEnabled = options.allowRegistrationEnabled === true;
  const registrationWindow = validatePublicRegistrationWindow({
    enabled: registrationEnabled,
    expiresAt: environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT,
    now: options.now
  });

  add("EMPIRE_RELEASE_ENVIRONMENT", "build", true, environment.EMPIRE_RELEASE_ENVIRONMENT === STAGING_ENVIRONMENT,
    STAGING_ENVIRONMENT, "STAGING_RELEASE_ENVIRONMENT_INVALID");
  add("EMPIRE_DATABASE_TARGET_ENVIRONMENT", "release + worker", true,
    environment.EMPIRE_DATABASE_TARGET_ENVIRONMENT === STAGING_ENVIRONMENT,
    STAGING_ENVIRONMENT, "STAGING_DATABASE_TARGET_ENVIRONMENT_INVALID");
  add("NODE_ENV", "API + worker", true, environment.NODE_ENV === "production", "production", "STAGING_NODE_ENV_INVALID");
  add("EMPIRE_PUBLIC_ORIGIN", "frontend + API", true,
    publicOrigin?.origin === STAGING_ORIGIN && !PRODUCTION_HOSTNAMES.has(publicOrigin.hostname),
    STAGING_ORIGIN, "STAGING_PUBLIC_ORIGIN_INVALID");
  add("EMPIRE_ALLOWED_ORIGINS", "API", true,
    allowedOrigins.length === 1 && allowedOrigins[0]?.origin === STAGING_ORIGIN
      && publicOrigin?.origin === STAGING_ORIGIN,
    `exactly ${STAGING_ORIGIN}`, "STAGING_ALLOWED_ORIGINS_INVALID");
  add("EMPIRE_DATABASE_URL", "API + worker", true,
    isTlsDatabaseUrl(databaseUrl),
    "postgresql://...?...&sslmode=require or stronger", "STAGING_DATABASE_URL_INVALID");
  add("GAMEPLAY_DATABASE_URL", "API + worker", true,
    isTlsDatabaseUrl(gameplayDatabaseUrl),
    "postgresql://...?...&sslmode=require or stronger", "STAGING_GAMEPLAY_DATABASE_URL_INVALID");
  add("EMPIRE_RELEASE_DATABASE_URL_POOLED", "release + API", true,
    isTlsDatabaseUrl(releasePooledDatabaseUrl),
    "transaction-pooled postgresql://...?...&sslmode=require or stronger",
    "STAGING_POOLED_DATABASE_URL_INVALID");
  add("GAMEPLAY_RELEASE_DATABASE_URL_POOLED", "release + API", true,
    isTlsDatabaseUrl(gameplayReleasePooledDatabaseUrl),
    "transaction-pooled postgresql://...?...&sslmode=require or stronger",
    "STAGING_GAMEPLAY_POOLED_DATABASE_URL_INVALID");
  checks.push({
    name: "STAGING_DATABASE_TARGET_MATCH",
    component: "API + worker",
    required: true,
    set: Boolean(databaseUrl && gameplayDatabaseUrl),
    passed: Boolean(databaseUrl && gameplayDatabaseUrl
      && databaseTargetIdentity(databaseUrl) === databaseTargetIdentity(gameplayDatabaseUrl)),
    safeFormat: "both URLs use the same provider hostname, port and database",
    errorCode: "STAGING_DATABASE_TARGET_MISMATCH"
  });
  checks.push({
    name: "STAGING_POOLED_DATABASE_TARGET_MATCH",
    component: "release + API",
    required: true,
    set: Boolean(releasePooledDatabaseUrl && gameplayReleasePooledDatabaseUrl),
    passed: Boolean(releasePooledDatabaseUrl && gameplayReleasePooledDatabaseUrl
      && databaseTargetIdentity(releasePooledDatabaseUrl) === databaseTargetIdentity(gameplayReleasePooledDatabaseUrl)),
    safeFormat: "both pooled URLs use the same provider hostname, port and database",
    errorCode: "STAGING_POOLED_DATABASE_TARGET_MISMATCH"
  });
  add("EMPIRE_STAGING_DATABASE_TARGET_HASH", "release + worker", true,
    TARGET_HASH_PATTERN.test(expectedDatabaseTargetHash)
      && [databaseUrl, gameplayDatabaseUrl, releasePooledDatabaseUrl, gameplayReleasePooledDatabaseUrl]
        .every((value) => value && releaseDatabaseTargetHash(value) === expectedDatabaseTargetHash),
    "64 lowercase hex characters matching every normalized direct and pooled staging target",
    "STAGING_DATABASE_TARGET_HASH_MISMATCH");
  add("EMPIRE_PERSISTENCE_DRIVER", "API + worker", true,
    environment.EMPIRE_PERSISTENCE_DRIVER === "postgres", "postgres", "STAGING_RUNTIME_PERSISTENCE_INVALID");
  add("GAMEPLAY_PERSISTENCE_DRIVER", "API + worker", true,
    environment.GAMEPLAY_PERSISTENCE_DRIVER === "postgres", "postgres", "STAGING_GAMEPLAY_PERSISTENCE_INVALID");
  add("EMPIRE_BUILD_SHA", "frontend + API + worker", true, SHA_PATTERN.test(String(environment.EMPIRE_BUILD_SHA ?? "")),
    "40 lowercase hexadecimal Git SHA", "STAGING_BUILD_SHA_INVALID");
  add("FLY_STAGING_APP", "release", true, flyStagingApp === STAGING_FLY_APP,
    STAGING_FLY_APP, "STAGING_FLY_APP_INVALID");
  add("EMPIRE_PRE_ALPHA_STAGING_FLY_APP", "release", true,
    pinnedFlyStagingApp === STAGING_FLY_APP && pinnedFlyStagingApp === flyStagingApp,
    `independent pin equal to ${STAGING_FLY_APP}`, "STAGING_FLY_APP_PIN_MISMATCH");
  if (isSet(options.gitSha)) {
    checks.push({
      name: "STAGING_BUILD_SHA_MATCHES_HEAD",
      component: "build",
      required: true,
      set: true,
      passed: SHA_PATTERN.test(String(options.gitSha)) && environment.EMPIRE_BUILD_SHA === options.gitSha,
      safeFormat: "EMPIRE_BUILD_SHA equals checkout HEAD",
      errorCode: "STAGING_BUILD_SHA_MISMATCH"
    });
  }
  add("EMPIRE_HOSTED_WORKER_ID", "worker", true,
    isSet(environment.EMPIRE_HOSTED_WORKER_ID) && environment.EMPIRE_HOSTED_WORKER_ID !== "worker:local",
    "stable staging-specific worker ID", "STAGING_WORKER_ID_INVALID");
  add("EMPIRE_HOSTED_WORKER_REGION", "worker", true, isSet(environment.EMPIRE_HOSTED_WORKER_REGION),
    "provider region near PostgreSQL", "STAGING_WORKER_REGION_MISSING");
  add("EMPIRE_RUNTIME_REGION", "API + worker", true, isSet(environment.EMPIRE_RUNTIME_REGION),
    "explicit provider runtime region", "STAGING_RUNTIME_REGION_MISSING");
  add("EMPIRE_TICK_WORKER_OWNER_ID", "worker", true,
    isSet(environment.EMPIRE_TICK_WORKER_OWNER_ID) && environment.EMPIRE_TICK_WORKER_OWNER_ID !== "worker:local",
    "stable staging-specific lease owner ID", "STAGING_TICK_OWNER_ID_INVALID");
  add("GAMEPLAY_SLICE_SESSION_SECRET", "API + worker", true, isSecureSecret(environment.GAMEPLAY_SLICE_SESSION_SECRET),
    "64 hex or 43+ base64url characters", "STAGING_GAMEPLAY_SESSION_SECRET_WEAK");
  add("GAMEPLAY_SLICE_SNAPSHOT_SECRET", "API + worker", true, isSecureSecret(environment.GAMEPLAY_SLICE_SNAPSHOT_SECRET),
    "64 hex or 43+ base64url characters", "STAGING_SNAPSHOT_SECRET_WEAK");
  add("EMPIRE_ADMIN_FINGERPRINT_SECRET", "API", true, isSecureSecret(environment.EMPIRE_ADMIN_FINGERPRINT_SECRET),
    "64 hex or 43+ base64url characters", "STAGING_ADMIN_FINGERPRINT_SECRET_WEAK");
  add("EMPIRE_ADMIN_SESSION_SECRET", "API", true, isSecureSecret(environment.EMPIRE_ADMIN_SESSION_SECRET),
    "64 hex or 43+ base64url characters", "STAGING_ADMIN_SESSION_SECRET_WEAK");
  add("EMPIRE_AUTH_THROTTLE_PEPPER", "API", true,
    isSecureSecret(environment.EMPIRE_AUTH_THROTTLE_PEPPER),
    "64 hex or 43+ base64url characters", "STAGING_AUTH_THROTTLE_PEPPER_WEAK");
  add("EMPIRE_ACCOUNT_TERMS_VERSION", "API", true,
    TERMS_VERSION_PATTERN.test(String(environment.EMPIRE_ACCOUNT_TERMS_VERSION ?? "")),
    "explicit internal staging terms version", "STAGING_ACCOUNT_TERMS_VERSION_INVALID");
  add("EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED", "API", true,
    environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED === "false" || (allowRegistrationEnabled && registrationEnabled),
    allowRegistrationEnabled ? "false, or true after green preflight" : "false before green preflight",
    "STAGING_REGISTRATION_MUST_BE_CLOSED");
  add("EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT", "API", registrationEnabled,
    !registrationEnabled || registrationWindow.valid,
    "future ISO timestamp no more than 24 hours away", "STAGING_REGISTRATION_WINDOW_INVALID");
  for (const flag of ["EMPIRE_ADMIN_WRITES_ENABLED", "EMPIRE_HOSTED_CONTROL_PLANE_ENABLED", "EMPIRE_SERVER_PROVISIONING_ENABLED"]) {
    add(flag, "API", true, environment[flag] === "true", "true", "STAGING_REQUIRED_CAPABILITY_DISABLED");
  }
  add("EMPIRE_LEGACY_MATCHMAKING_ENABLED", "API", true, environment.EMPIRE_LEGACY_MATCHMAKING_ENABLED === "false",
    "false", "STAGING_LEGACY_MATCHMAKING_ENABLED");
  add("EMPIRE_WAR_HOSTING_ENABLED", "API", true, environment.EMPIRE_WAR_HOSTING_ENABLED === "false",
    "false", "STAGING_WAR_HOSTING_ENABLED");
  add("EMPIRE_HOSTED_PREFLIGHT_STRICT", "release", true,
    ["1", "true"].includes(String(environment.EMPIRE_HOSTED_PREFLIGHT_STRICT ?? "").toLowerCase()),
    "true", "STAGING_PREFLIGHT_NOT_STRICT");

  const secrets = [
    environment.GAMEPLAY_SLICE_SESSION_SECRET,
    environment.GAMEPLAY_SLICE_SNAPSHOT_SECRET,
    environment.EMPIRE_ADMIN_FINGERPRINT_SECRET,
    environment.EMPIRE_ADMIN_SESSION_SECRET,
    environment.EMPIRE_AUTH_THROTTLE_PEPPER
  ].filter(isSet);
  checks.push({
    name: "STAGING_SECRETS_DISTINCT",
    component: "API + worker",
    required: true,
    set: secrets.length === 5,
    passed: secrets.length === 5 && new Set(secrets).size === secrets.length,
    safeFormat: "all five session, snapshot, admin and throttle secrets differ",
    errorCode: "STAGING_SECRETS_REUSED"
  });

  const nodeRuntime = evaluateSupportedNodeVersion(options.nodeVersion ?? process.versions.node);
  checks.push({
    name: "NODE_VERSION",
    component: "build",
    required: true,
    set: true,
    passed: nodeRuntime.supported,
    safeFormat: `Node.js ${SUPPORTED_NODE_MAJOR}.x`,
    errorCode: "STAGING_NODE_VERSION_INVALID"
  });

  return { passed: checks.every((entry) => !entry.required || entry.passed), checks };
};

export const validateReleaseSource = ({ gitSha, configuredSha, worktreeStatus }) => {
  if (!SHA_PATTERN.test(String(gitSha ?? ""))) {
    throw new Error("Release source requires an exact 40-character Git HEAD.");
  }
  if (!SHA_PATTERN.test(String(configuredSha ?? ""))) {
    throw new Error("Release source requires an exact 40-character EMPIRE_BUILD_SHA.");
  }
  if (gitSha !== configuredSha) {
    throw new Error("EMPIRE_BUILD_SHA must equal the current Git HEAD.");
  }
  if (String(worktreeStatus ?? "").trim()) {
    throw new Error("Refusing to create a release manifest from a dirty worktree.");
  }
  return gitSha;
};

export const validateCodeLevelReleaseEnvironment = (environment, options = {}) => {
  if (environment.EMPIRE_RELEASE_ENVIRONMENT !== STAGING_ENVIRONMENT) {
    throw new Error("Code-level release manifest requires EMPIRE_RELEASE_ENVIRONMENT=staging.");
  }
  const nodeRuntime = evaluateSupportedNodeVersion(options.nodeVersion ?? process.versions.node);
  if (!nodeRuntime.supported) {
    throw new Error(`Code-level release manifest requires Node.js ${SUPPORTED_NODE_MAJOR}.`);
  }
  return true;
};

export const createReleaseManifest = ({
  gitSha,
  expectedSchemaVersion,
  createdAt = new Date().toISOString(),
  verificationMode = "code-level",
  nodeVersion = process.versions.node,
  npmVersion
}) => {
  if (!SHA_PATTERN.test(gitSha)) throw new Error("Release manifest requires an exact 40-character Git SHA.");
  if (!/^\d{3}_[a-z0-9_]+\.sql$/u.test(String(expectedSchemaVersion ?? ""))) {
    throw new Error("Release manifest requires an exact production schema migration filename.");
  }
  if (!["code-level", "staging-environment"].includes(verificationMode)) {
    throw new Error("Release manifest requires a known verification mode.");
  }
  const nodeRuntime = evaluateSupportedNodeVersion(nodeVersion);
  if (!nodeRuntime.supported || nodeRuntime.detectedVersion === null) {
    throw new Error(`Release manifest requires Node.js ${SUPPORTED_NODE_MAJOR}.`);
  }
  const normalizedNpmVersion = String(npmVersion ?? "").trim();
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(normalizedNpmVersion)) {
    throw new Error("Release manifest requires an exact npm version.");
  }
  return {
    gitSha,
    frontendBuildSha: gitSha,
    apiBuildSha: gitSha,
    workerBuildSha: gitSha,
    expectedSchemaVersion,
    nodeVersion: nodeRuntime.detectedVersion,
    nodeMajor: nodeRuntime.detectedMajor,
    npmVersion: normalizedNpmVersion,
    createdAt,
    buildTimestamp: createdAt,
    environment: STAGING_ENVIRONMENT,
    targetEnvironment: STAGING_ENVIRONMENT,
    verificationMode
  };
};

const parseAllowedOrigins = (value) => String(value ?? "").split(",").map(parseExactOrigin).filter(Boolean);
const parseExactOrigin = (value) => {
  const candidate = String(value ?? "").trim();
  if (!candidate || candidate === "*") return null;
  try {
    const parsed = new URL(candidate);
    return parsed.origin === candidate ? parsed : null;
  } catch {
    return null;
  }
};
const parseDatabaseUrl = (value) => {
  try {
    const parsed = new URL(String(value ?? "").trim());
    return ["postgres:", "postgresql:"].includes(parsed.protocol) ? parsed : null;
  } catch {
    return null;
  }
};
const isTlsDatabaseUrl = (value) => Boolean(value) && !LOOPBACK_HOSTNAMES.has(value.hostname)
  && ["require", "verify-ca", "verify-full"].includes(value.searchParams.get("sslmode") ?? "");
const databaseTargetIdentity = (value) => `${value.hostname.toLowerCase()}:${value.port || "5432"}${value.pathname}`;
const isSecureSecret = (value) => {
  const normalized = String(value ?? "");
  return Buffer.byteLength(normalized, "utf8") >= 32 && SECURE_SECRET_PATTERN.test(normalized);
};
const isSet = (value) => String(value ?? "").trim().length > 0;
