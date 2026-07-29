import { Buffer } from "node:buffer";
import {
  evaluateSupportedNodeVersion,
  SUPPORTED_NODE_MAJOR
} from "./supported-node-policy.mjs";

export const STAGING_MANIFEST_PATH = "artifacts/release-manifest.json";
export const STAGING_ENVIRONMENT = "staging";
export const STAGING_NODE_VERSION = String(SUPPORTED_NODE_MAJOR);

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const SECURE_SECRET_PATTERN = /^(?:[0-9a-f]{64,}|[A-Za-z0-9_-]{43,})$/u;
const TERMS_VERSION_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/u;
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
  const registrationEnabled = environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED === "true";
  const allowRegistrationEnabled = options.allowRegistrationEnabled === true;

  add("EMPIRE_RELEASE_ENVIRONMENT", "build", true, environment.EMPIRE_RELEASE_ENVIRONMENT === STAGING_ENVIRONMENT,
    STAGING_ENVIRONMENT, "STAGING_RELEASE_ENVIRONMENT_INVALID");
  add("NODE_ENV", "API + worker", true, environment.NODE_ENV === "production", "production", "STAGING_NODE_ENV_INVALID");
  add("EMPIRE_PUBLIC_ORIGIN", "frontend + API", true,
    Boolean(publicOrigin) && publicOrigin.protocol === "https:" && !PRODUCTION_HOSTNAMES.has(publicOrigin.hostname)
      && !LOOPBACK_HOSTNAMES.has(publicOrigin.hostname),
    "exact staging HTTPS origin", "STAGING_PUBLIC_ORIGIN_INVALID");
  add("EMPIRE_ALLOWED_ORIGINS", "API", true,
    allowedOrigins.length > 0 && allowedOrigins.every((origin) => origin.protocol === "https:"
      && !LOOPBACK_HOSTNAMES.has(origin.hostname)) && Boolean(publicOrigin)
      && allowedOrigins.some((origin) => origin.origin === publicOrigin.origin),
    "comma-separated exact HTTPS origins, no wildcard", "STAGING_ALLOWED_ORIGINS_INVALID");
  add("EMPIRE_DATABASE_URL", "API + worker", true,
    Boolean(databaseUrl) && !LOOPBACK_HOSTNAMES.has(databaseUrl.hostname)
      && ["require", "verify-ca", "verify-full"].includes(databaseUrl.searchParams.get("sslmode") ?? ""),
    "postgresql://...?...&sslmode=require or stronger", "STAGING_DATABASE_URL_INVALID");
  add("EMPIRE_PERSISTENCE_DRIVER", "API + worker", true,
    environment.EMPIRE_PERSISTENCE_DRIVER === "postgres", "postgres", "STAGING_RUNTIME_PERSISTENCE_INVALID");
  add("GAMEPLAY_PERSISTENCE_DRIVER", "API + worker", true,
    environment.GAMEPLAY_PERSISTENCE_DRIVER === "postgres", "postgres", "STAGING_GAMEPLAY_PERSISTENCE_INVALID");
  add("EMPIRE_BUILD_SHA", "frontend + API + worker", true, SHA_PATTERN.test(String(environment.EMPIRE_BUILD_SHA ?? "")),
    "40 lowercase hexadecimal Git SHA", "STAGING_BUILD_SHA_INVALID");
  add("EMPIRE_HOSTED_WORKER_ID", "worker", true,
    isSet(environment.EMPIRE_HOSTED_WORKER_ID) && environment.EMPIRE_HOSTED_WORKER_ID !== "worker:local",
    "stable staging-specific worker ID", "STAGING_WORKER_ID_INVALID");
  add("EMPIRE_HOSTED_WORKER_REGION", "worker", true, isSet(environment.EMPIRE_HOSTED_WORKER_REGION),
    "provider region near PostgreSQL", "STAGING_WORKER_REGION_MISSING");
  add("GAMEPLAY_SLICE_SESSION_SECRET", "API + worker", true, isSecureSecret(environment.GAMEPLAY_SLICE_SESSION_SECRET),
    "64 hex or 43+ base64url characters", "STAGING_GAMEPLAY_SESSION_SECRET_WEAK");
  add("GAMEPLAY_SLICE_SNAPSHOT_SECRET", "API + worker", true, isSecureSecret(environment.GAMEPLAY_SLICE_SNAPSHOT_SECRET),
    "64 hex or 43+ base64url characters", "STAGING_SNAPSHOT_SECRET_WEAK");
  add("EMPIRE_ADMIN_FINGERPRINT_SECRET", "API", true, isSecureSecret(environment.EMPIRE_ADMIN_FINGERPRINT_SECRET),
    "64 hex or 43+ base64url characters", "STAGING_ADMIN_FINGERPRINT_SECRET_WEAK");
  add("EMPIRE_AUTH_THROTTLE_PEPPER", "API", registrationEnabled,
    !registrationEnabled || isSecureSecret(environment.EMPIRE_AUTH_THROTTLE_PEPPER),
    "64 hex or 43+ base64url characters", "STAGING_AUTH_THROTTLE_PEPPER_WEAK");
  add("EMPIRE_ACCOUNT_TERMS_VERSION", "API", registrationEnabled,
    !registrationEnabled || TERMS_VERSION_PATTERN.test(String(environment.EMPIRE_ACCOUNT_TERMS_VERSION ?? "")),
    "explicit internal staging terms version", "STAGING_ACCOUNT_TERMS_VERSION_INVALID");
  add("EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED", "API", true,
    environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED === "false" || (allowRegistrationEnabled && registrationEnabled),
    allowRegistrationEnabled ? "false, or true after green preflight" : "false before green preflight",
    "STAGING_REGISTRATION_MUST_BE_CLOSED");
  for (const flag of ["EMPIRE_ADMIN_WRITES_ENABLED", "EMPIRE_HOSTED_CONTROL_PLANE_ENABLED", "EMPIRE_SERVER_PROVISIONING_ENABLED"]) {
    add(flag, "API", true, ["true", "false"].includes(environment[flag]), "explicit true or false", "STAGING_FLAG_MISSING");
  }

  const secrets = [
    environment.GAMEPLAY_SLICE_SESSION_SECRET,
    environment.GAMEPLAY_SLICE_SNAPSHOT_SECRET,
    environment.EMPIRE_ADMIN_FINGERPRINT_SECRET,
    registrationEnabled ? environment.EMPIRE_AUTH_THROTTLE_PEPPER : undefined
  ].filter(isSet);
  checks.push({
    name: "STAGING_SECRETS_DISTINCT",
    component: "API + worker",
    required: true,
    set: secrets.length >= 3,
    passed: secrets.length >= 3 && new Set(secrets).size === secrets.length,
    safeFormat: "all session, snapshot, admin and throttle secrets differ",
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
const isSecureSecret = (value) => {
  const normalized = String(value ?? "");
  return Buffer.byteLength(normalized, "utf8") >= 32 && SECURE_SECRET_PATTERN.test(normalized);
};
const isSet = (value) => String(value ?? "").trim().length > 0;
