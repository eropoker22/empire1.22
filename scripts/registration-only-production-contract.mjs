export const PRODUCTION_REGISTRATION_ORIGIN = "https://empirestreets.cz";
const TERMS_VERSION_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/u;
const SECURE_SECRET_PATTERN = /^(?:[0-9a-f]{64,}|[A-Za-z0-9_-]{43,})$/u;

export const validateRegistrationOnlyProductionEnvironment = (
  environment,
  { registrationEnabled = false } = {}
) => {
  const checks = [];
  const add = (name, component, required, passed, safeFormat, errorCode) => {
    checks.push({ name, component, required, set: isSet(environment[name]), passed: Boolean(passed), safeFormat, errorCode });
  };

  const databaseUrl = String(environment.EMPIRE_DATABASE_URL ?? "").trim();
  const gameplayDatabaseUrl = String(environment.GAMEPLAY_DATABASE_URL ?? "").trim();
  const allowedOrigins = parseAllowedOrigins(environment.EMPIRE_ALLOWED_ORIGINS);
  const secrets = [
    environment.GAMEPLAY_SLICE_SESSION_SECRET,
    environment.GAMEPLAY_SLICE_SNAPSHOT_SECRET,
    environment.EMPIRE_ADMIN_FINGERPRINT_SECRET,
    environment.EMPIRE_ADMIN_SESSION_SECRET,
    environment.EMPIRE_AUTH_THROTTLE_PEPPER
  ].map((value) => String(value ?? "").trim());

  add("EMPIRE_RELEASE_ENVIRONMENT", "build", true, environment.EMPIRE_RELEASE_ENVIRONMENT === "production",
    "production", "REGISTRATION_ONLY_RELEASE_ENVIRONMENT_INVALID");
  add("NODE_ENV", "API", true, environment.NODE_ENV === "production",
    "production", "REGISTRATION_ONLY_NODE_ENV_INVALID");
  add("EMPIRE_PUBLIC_ORIGIN", "frontend + API", true,
    environment.EMPIRE_PUBLIC_ORIGIN === PRODUCTION_REGISTRATION_ORIGIN,
    PRODUCTION_REGISTRATION_ORIGIN, "REGISTRATION_ONLY_PUBLIC_ORIGIN_INVALID");
  add("EMPIRE_ALLOWED_ORIGINS", "API", true,
    allowedOrigins.length === 1 && allowedOrigins[0] === PRODUCTION_REGISTRATION_ORIGIN,
    "one exact HTTPS production origin", "REGISTRATION_ONLY_ALLOWED_ORIGINS_INVALID");
  add("EMPIRE_DATABASE_URL", "API", true, isNeonPooledTlsPostgresUrl(databaseUrl),
    "pooled Neon PostgreSQL URL with sslmode=require or stronger", "REGISTRATION_ONLY_DATABASE_URL_INVALID");
  add("GAMEPLAY_DATABASE_URL", "API", true, isNeonPooledTlsPostgresUrl(gameplayDatabaseUrl),
    "pooled Neon PostgreSQL URL with sslmode=require or stronger", "REGISTRATION_ONLY_GAMEPLAY_DATABASE_URL_INVALID");
  checks.push({
    name: "REGISTRATION_ONLY_DATABASE_TARGET_MATCH",
    component: "API",
    required: true,
    set: Boolean(databaseUrl && gameplayDatabaseUrl),
    passed: Boolean(databaseUrl && gameplayDatabaseUrl
      && databaseTargetIdentity(databaseUrl) === databaseTargetIdentity(gameplayDatabaseUrl)),
    safeFormat: "both URLs use the same pooled provider target",
    errorCode: "REGISTRATION_ONLY_DATABASE_TARGET_MISMATCH"
  });
  add("EMPIRE_PERSISTENCE_DRIVER", "API", true, environment.EMPIRE_PERSISTENCE_DRIVER === "postgres",
    "postgres", "REGISTRATION_ONLY_RUNTIME_DRIVER_INVALID");
  add("GAMEPLAY_PERSISTENCE_DRIVER", "API", true, environment.GAMEPLAY_PERSISTENCE_DRIVER === "postgres",
    "postgres", "REGISTRATION_ONLY_GAMEPLAY_DRIVER_INVALID");
  add("EMPIRE_BUILD_SHA", "frontend + API", true, /^[0-9a-f]{40}$/u.test(String(environment.EMPIRE_BUILD_SHA ?? "")),
    "exact 40-character Git SHA", "REGISTRATION_ONLY_BUILD_SHA_INVALID");
  add("GAMEPLAY_SLICE_SESSION_SECRET", "API", true, isSecureSecret(secrets[0]),
    "64 hex or 43+ base64url characters", "REGISTRATION_ONLY_SESSION_SECRET_WEAK");
  add("GAMEPLAY_SLICE_SNAPSHOT_SECRET", "API", true, isSecureSecret(secrets[1]),
    "64 hex or 43+ base64url characters", "REGISTRATION_ONLY_SNAPSHOT_SECRET_WEAK");
  add("EMPIRE_ADMIN_FINGERPRINT_SECRET", "API", true, isSecureSecret(secrets[2]),
    "64 hex or 43+ base64url characters", "REGISTRATION_ONLY_ADMIN_SECRET_WEAK");
  add("EMPIRE_ADMIN_SESSION_SECRET", "API", true, isSecureSecret(secrets[3]),
    "64 hex or 43+ base64url characters", "REGISTRATION_ONLY_ADMIN_SESSION_SECRET_WEAK");
  add("EMPIRE_AUTH_THROTTLE_PEPPER", "API", true, isSecureSecret(secrets[4]),
    "64 hex or 43+ base64url characters", "REGISTRATION_ONLY_THROTTLE_SECRET_WEAK");
  checks.push({
    name: "REGISTRATION_ONLY_SECRETS_DISTINCT",
    component: "API",
    required: true,
    set: secrets.every(Boolean),
    passed: secrets.every(Boolean) && new Set(secrets).size === secrets.length,
    safeFormat: "five distinct secrets",
    errorCode: "REGISTRATION_ONLY_SECRETS_REUSED"
  });
  add("EMPIRE_ADMIN_WRITES_ENABLED", "admin API", true, environment.EMPIRE_ADMIN_WRITES_ENABLED === "false",
    "false", "REGISTRATION_ONLY_ADMIN_WRITES_MUST_BE_DISABLED");
  add("EMPIRE_HOSTED_CONTROL_PLANE_ENABLED", "admin API", true,
    environment.EMPIRE_HOSTED_CONTROL_PLANE_ENABLED === "false",
    "false", "REGISTRATION_ONLY_CONTROL_PLANE_MUST_BE_DISABLED");
  add("EMPIRE_SERVER_PROVISIONING_ENABLED", "admin API", true,
    environment.EMPIRE_SERVER_PROVISIONING_ENABLED === "false",
    "false", "REGISTRATION_ONLY_PROVISIONING_MUST_BE_DISABLED");
  add("EMPIRE_LEGACY_MATCHMAKING_ENABLED", "API", true,
    environment.EMPIRE_LEGACY_MATCHMAKING_ENABLED === "false",
    "false", "REGISTRATION_ONLY_LEGACY_MATCHMAKING_MUST_BE_DISABLED");
  add("EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED", "account API", true,
    environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED === String(registrationEnabled),
    String(registrationEnabled), "REGISTRATION_ONLY_REGISTRATION_FLAG_MISMATCH");
  add("EMPIRE_ACCOUNT_TERMS_VERSION", "account API", registrationEnabled,
    !registrationEnabled || TERMS_VERSION_PATTERN.test(String(environment.EMPIRE_ACCOUNT_TERMS_VERSION ?? "")),
    "explicit approved terms version", "REGISTRATION_ONLY_TERMS_VERSION_INVALID");

  return {
    passed: checks.every((check) => check.passed),
    checks
  };
};

export const parseAllowedOrigins = (value) =>
  String(value ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);

export const isNeonPooledTlsPostgresUrl = (candidate) => {
  try {
    const url = new URL(candidate);
    const sslMode = url.searchParams.get("sslmode");
    return ["postgres:", "postgresql:"].includes(url.protocol)
      && ["require", "verify-ca", "verify-full"].includes(sslMode)
      && url.hostname.endsWith(".neon.tech")
      && url.hostname.split(".")[0]?.endsWith("-pooler");
  } catch {
    return false;
  }
};

const isSecureSecret = (value) => typeof value === "string" && SECURE_SECRET_PATTERN.test(value.trim());
const databaseTargetIdentity = (value) => {
  try {
    const parsed = new URL(value);
    return `${parsed.hostname.toLowerCase()}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return null;
  }
};
const isSet = (value) => String(value ?? "").trim().length > 0;
