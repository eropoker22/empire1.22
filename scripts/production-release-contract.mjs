import { Buffer } from "node:buffer";
import {
  evaluateSupportedNodeVersion,
  SUPPORTED_NODE_MAJOR
} from "./supported-node-policy.mjs";
import { validatePublicRegistrationWindow } from "./registration-window-contract.mjs";
import {
  releaseDatabaseTargetHash,
  releaseDatabaseTargetIdentity
} from "./release-database-target-hash.mjs";

export const PRODUCTION_ENVIRONMENT = "production";
export const PRODUCTION_ORIGIN = "https://empirestreets.cz";
export const PRODUCTION_COMPONENTS = new Set(["netlify", "worker", "migration"]);

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const SECURE_SECRET_PATTERN = /^(?:[0-9a-f]{64,}|[A-Za-z0-9_-]{43,})$/u;
const TERMS_VERSION_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/u;
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const EU_REGION_CODES = new Set(["ams", "arn", "cdg", "fra", "lhr", "mad", "waw"]);

export const validateProductionEnvironment = (environment, options = {}) => {
  const checks = [];
  const add = (name, component, required, passed, safeFormat, errorCode) => {
    checks.push({ name, component, required, set: isSet(environment[name]), passed: Boolean(passed), safeFormat, errorCode });
  };
  const component = String(options.component ?? "netlify").trim().toLowerCase();
  const expectedConnectionMode = component === "netlify" ? "pooled" : "direct";
  const databaseUrl = parseDatabaseUrl(environment.EMPIRE_DATABASE_URL);
  const gameplayDatabaseUrl = parseDatabaseUrl(environment.GAMEPLAY_DATABASE_URL);
  const expectedDatabaseTargetHash = String(environment.EMPIRE_PRODUCTION_DATABASE_TARGET_HASH ?? "").trim();
  const publicOrigin = parseExactOrigin(environment.EMPIRE_PUBLIC_ORIGIN);
  const allowedOrigins = parseAllowedOrigins(environment.EMPIRE_ALLOWED_ORIGINS);
  const registrationEnabled = environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED === "true";
  const allowRegistrationEnabled = options.allowRegistrationEnabled === true;
  const registrationWindow = validatePublicRegistrationWindow({
    enabled: registrationEnabled,
    expiresAt: environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT,
    now: options.now
  });

  checks.push({
    name: "PRODUCTION_COMPONENT",
    component: "release",
    required: true,
    set: isSet(component),
    passed: PRODUCTION_COMPONENTS.has(component),
    safeFormat: "netlify, worker or migration",
    errorCode: "PRODUCTION_COMPONENT_INVALID"
  });
  add("EMPIRE_RELEASE_ENVIRONMENT", "all", true,
    environment.EMPIRE_RELEASE_ENVIRONMENT === PRODUCTION_ENVIRONMENT,
    PRODUCTION_ENVIRONMENT, "PRODUCTION_RELEASE_ENVIRONMENT_INVALID");
  add("NODE_ENV", "API + worker", true, environment.NODE_ENV === "production",
    "production", "PRODUCTION_NODE_ENV_INVALID");
  add("EMPIRE_PUBLIC_ORIGIN", "frontend + API", true,
    publicOrigin?.origin === PRODUCTION_ORIGIN,
    PRODUCTION_ORIGIN, "PRODUCTION_PUBLIC_ORIGIN_INVALID");
  add("EMPIRE_ALLOWED_ORIGINS", "API", true,
    allowedOrigins.length === 1 && allowedOrigins[0]?.origin === PRODUCTION_ORIGIN,
    `exactly ${PRODUCTION_ORIGIN}`, "PRODUCTION_ALLOWED_ORIGINS_INVALID");
  add("EMPIRE_DATABASE_URL", component, true,
    isProductionNeonUrl(databaseUrl, expectedConnectionMode),
    `${expectedConnectionMode} Neon PostgreSQL URL with TLS`, "PRODUCTION_DATABASE_URL_INVALID");
  add("GAMEPLAY_DATABASE_URL", component, true,
    isProductionNeonUrl(gameplayDatabaseUrl, expectedConnectionMode),
    `${expectedConnectionMode} Neon PostgreSQL URL with TLS`, "PRODUCTION_GAMEPLAY_DATABASE_URL_INVALID");
  checks.push({
    name: "PRODUCTION_DATABASE_TARGET_MATCH",
    component,
    required: true,
    set: Boolean(databaseUrl && gameplayDatabaseUrl),
    passed: Boolean(databaseUrl && gameplayDatabaseUrl
      && releaseDatabaseTargetIdentity(databaseUrl) === releaseDatabaseTargetIdentity(gameplayDatabaseUrl)),
    safeFormat: "both URLs use the same provider hostname, port and database",
    errorCode: "PRODUCTION_DATABASE_TARGET_MISMATCH"
  });
  add("EMPIRE_PRODUCTION_DATABASE_TARGET_HASH", "release", true,
    SHA256_PATTERN.test(expectedDatabaseTargetHash)
      && Boolean(databaseUrl && gameplayDatabaseUrl)
      && releaseDatabaseTargetHash(databaseUrl) === expectedDatabaseTargetHash
      && releaseDatabaseTargetHash(gameplayDatabaseUrl) === expectedDatabaseTargetHash,
    "protected SHA-256 of normalized production hostname, port and database",
    "PRODUCTION_DATABASE_TARGET_HASH_MISMATCH");
  add("EMPIRE_PERSISTENCE_DRIVER", "API + worker", true,
    environment.EMPIRE_PERSISTENCE_DRIVER === "postgres", "postgres", "PRODUCTION_RUNTIME_PERSISTENCE_INVALID");
  add("GAMEPLAY_PERSISTENCE_DRIVER", "API + worker", true,
    environment.GAMEPLAY_PERSISTENCE_DRIVER === "postgres", "postgres", "PRODUCTION_GAMEPLAY_PERSISTENCE_INVALID");
  add("EMPIRE_BUILD_SHA", "frontend + API + worker", true,
    SHA_PATTERN.test(String(environment.EMPIRE_BUILD_SHA ?? "")),
    "40 lowercase hexadecimal Git SHA", "PRODUCTION_BUILD_SHA_INVALID");
  checks.push({
    name: "PRODUCTION_BUILD_SHA_MATCHES_HEAD",
    component: "build",
    required: true,
    set: isSet(options.gitSha),
    passed: SHA_PATTERN.test(String(options.gitSha ?? "")) && environment.EMPIRE_BUILD_SHA === options.gitSha,
    safeFormat: "EMPIRE_BUILD_SHA equals checkout HEAD",
    errorCode: "PRODUCTION_BUILD_SHA_MISMATCH"
  });
  add("EMPIRE_HOSTED_WORKER_ID", "worker", true,
    isNonLocalIdentifier(environment.EMPIRE_HOSTED_WORKER_ID),
    "stable production worker ID", "PRODUCTION_WORKER_ID_INVALID");
  add("EMPIRE_HOSTED_WORKER_REGION", "worker", true, isEuRegion(environment.EMPIRE_HOSTED_WORKER_REGION),
    "explicit EU provider region", "PRODUCTION_WORKER_REGION_MISSING");
  add("EMPIRE_RUNTIME_REGION", "API + worker", true, isEuRegion(environment.EMPIRE_RUNTIME_REGION),
    "explicit EU provider runtime region", "PRODUCTION_RUNTIME_REGION_MISSING");
  add("EMPIRE_TICK_WORKER_OWNER_ID", "worker", true,
    isNonLocalIdentifier(environment.EMPIRE_TICK_WORKER_OWNER_ID)
      && environment.EMPIRE_TICK_WORKER_OWNER_ID === environment.EMPIRE_HOSTED_WORKER_ID,
    "same stable ID as EMPIRE_HOSTED_WORKER_ID", "PRODUCTION_TICK_OWNER_ID_INVALID");

  const secrets = [
    ["GAMEPLAY_SLICE_SESSION_SECRET", "API + worker", "PRODUCTION_GAMEPLAY_SESSION_SECRET_WEAK"],
    ["GAMEPLAY_SLICE_SNAPSHOT_SECRET", "API + worker", "PRODUCTION_SNAPSHOT_SECRET_WEAK"],
    ["EMPIRE_ADMIN_FINGERPRINT_SECRET", "API", "PRODUCTION_ADMIN_FINGERPRINT_SECRET_WEAK"],
    ["EMPIRE_ADMIN_SESSION_SECRET", "API", "PRODUCTION_ADMIN_SESSION_SECRET_WEAK"],
    ["EMPIRE_AUTH_THROTTLE_PEPPER", "API", "PRODUCTION_AUTH_THROTTLE_PEPPER_WEAK"]
  ];
  for (const [name, secretComponent, errorCode] of secrets) {
    add(name, secretComponent, true, isSecureSecret(environment[name]),
      "64 hex or 43+ base64url characters", errorCode);
  }
  const secretValues = secrets.map(([name]) => String(environment[name] ?? "").trim()).filter(isSet);
  checks.push({
    name: "PRODUCTION_SECRETS_DISTINCT",
    component: "API + worker",
    required: true,
    set: secretValues.length === secrets.length,
    passed: secretValues.length === secrets.length && new Set(secretValues).size === secretValues.length,
    safeFormat: "all five release secrets differ",
    errorCode: "PRODUCTION_SECRETS_REUSED"
  });

  add("EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED", "API", true,
    environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED === "false" || (allowRegistrationEnabled && registrationEnabled),
    allowRegistrationEnabled ? "false, or explicitly approved true" : "false during deploy",
    "PRODUCTION_REGISTRATION_MUST_BE_CLOSED");
  add("EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT", "API", registrationEnabled,
    !registrationEnabled || registrationWindow.valid,
    "future ISO timestamp no more than 24 hours away", "PRODUCTION_REGISTRATION_WINDOW_INVALID");
  add("EMPIRE_ACCOUNT_TERMS_VERSION", "API", true,
    TERMS_VERSION_PATTERN.test(String(environment.EMPIRE_ACCOUNT_TERMS_VERSION ?? "")),
    "explicit approved terms version", "PRODUCTION_ACCOUNT_TERMS_VERSION_INVALID");
  for (const flag of ["EMPIRE_ADMIN_WRITES_ENABLED", "EMPIRE_HOSTED_CONTROL_PLANE_ENABLED", "EMPIRE_SERVER_PROVISIONING_ENABLED"]) {
    add(flag, "API", true, environment[flag] === "true", "true", "PRODUCTION_REQUIRED_CAPABILITY_DISABLED");
  }
  add("EMPIRE_LEGACY_MATCHMAKING_ENABLED", "API", true,
    environment.EMPIRE_LEGACY_MATCHMAKING_ENABLED === "false", "false", "PRODUCTION_LEGACY_MATCHMAKING_ENABLED");
  add("EMPIRE_WAR_HOSTING_ENABLED", "API", true,
    environment.EMPIRE_WAR_HOSTING_ENABLED === "false", "false", "PRODUCTION_WAR_HOSTING_ENABLED");
  add("EMPIRE_HOSTED_PREFLIGHT_STRICT", "release", true,
    ["1", "true"].includes(String(environment.EMPIRE_HOSTED_PREFLIGHT_STRICT ?? "").toLowerCase()),
    "true", "PRODUCTION_PREFLIGHT_NOT_STRICT");
  add("EMPIRE_ADMIN_BOOTSTRAP_PASSWORD", "bootstrap", true,
    !isSet(environment.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD),
    "unset outside the one-time bootstrap job", "PRODUCTION_BOOTSTRAP_PASSWORD_PRESENT");

  const nodeRuntime = evaluateSupportedNodeVersion(options.nodeVersion ?? process.versions.node);
  checks.push({
    name: "NODE_VERSION",
    component: "build",
    required: true,
    set: true,
    passed: nodeRuntime.supported,
    safeFormat: `Node.js ${SUPPORTED_NODE_MAJOR}.x`,
    errorCode: "PRODUCTION_NODE_VERSION_INVALID"
  });

  return {
    passed: checks.every((entry) => !entry.required || entry.passed),
    component,
    connectionMode: expectedConnectionMode,
    checks
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
const isProductionNeonUrl = (value, mode) => {
  if (!value || LOOPBACK_HOSTNAMES.has(value.hostname)) return false;
  if (!["require", "verify-ca", "verify-full"].includes(value.searchParams.get("sslmode") ?? "")) return false;
  const hostname = value.hostname.toLowerCase();
  const databaseName = decodeURIComponent(value.pathname).toLowerCase();
  if (!hostname.endsWith(".neon.tech") || hostname.includes("staging") || databaseName.includes("staging")) return false;
  const pooled = hostname.split(".")[0]?.endsWith("-pooler") === true;
  return mode === "pooled" ? pooled : !pooled;
};
const isSecureSecret = (value) => {
  const normalized = String(value ?? "");
  return Buffer.byteLength(normalized, "utf8") >= 32 && SECURE_SECRET_PATTERN.test(normalized);
};
const isNonLocalIdentifier = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9._:-]{3,128}$/u.test(normalized)
    && !normalized.includes("local") && !normalized.includes("localhost");
};
const isEuRegion = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return EU_REGION_CODES.has(normalized) || /^(?:eu|europe)[a-z0-9._:-]*$/u.test(normalized);
};
const isSet = (value) => String(value ?? "").trim().length > 0;
