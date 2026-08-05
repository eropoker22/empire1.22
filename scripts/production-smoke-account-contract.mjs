import { createHash } from "node:crypto";

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/u;
const TERMS_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/u;
const EVIDENCE_PATH_PATTERN = /^artifacts\/release\/production\/[A-Za-z0-9._/-]+\.json$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const BACKUP_ID_PATTERN = /^[A-Za-z0-9._:-]{3,200}$/u;

export const validateProductionSmokeAccountEnvironment = (environment) => {
  requireValue(environment.EMPIRE_PRODUCTION_SMOKE_ACCOUNT_BOOTSTRAP_CONFIRMED === "production-smoke-account",
    "PRODUCTION_SMOKE_ACCOUNT_CONFIRMATION_REQUIRED");
  requireValue(environment.NODE_ENV === "production"
    && environment.EMPIRE_RELEASE_ENVIRONMENT === "production"
    && environment.EMPIRE_DATABASE_TARGET_ENVIRONMENT === "production",
  "PRODUCTION_SMOKE_ACCOUNT_ENVIRONMENT_INVALID");
  requireValue(environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED === "false",
    "PRODUCTION_SMOKE_ACCOUNT_REGISTRATION_OPEN");
  const buildSha = String(environment.EMPIRE_BUILD_SHA ?? "").trim();
  requireValue(SHA_PATTERN.test(buildSha), "PRODUCTION_SMOKE_ACCOUNT_SHA_INVALID");
  const database = productionDirectDatabase(environment.EMPIRE_DATABASE_URL);
  const gameplayDatabase = productionDirectDatabase(environment.GAMEPLAY_DATABASE_URL);
  requireValue(database.identity === gameplayDatabase.identity, "PRODUCTION_SMOKE_ACCOUNT_DATABASE_MISMATCH");
  const databaseTargetHash = createHash("sha256").update(database.identity).digest("hex");
  const expectedDatabaseTargetHash = String(environment.EMPIRE_PRODUCTION_DATABASE_TARGET_HASH ?? "").trim();
  requireValue(SHA256_PATTERN.test(expectedDatabaseTargetHash), "PRODUCTION_SMOKE_ACCOUNT_TARGET_HASH_INVALID");
  requireValue(databaseTargetHash === expectedDatabaseTargetHash, "PRODUCTION_SMOKE_ACCOUNT_TARGET_MISMATCH");
  requireValue(environment.EMPIRE_DATABASE_BACKUP_CONFIRMED === "true", "PRODUCTION_SMOKE_ACCOUNT_BACKUP_REQUIRED");
  const backupId = String(environment.EMPIRE_DATABASE_BACKUP_ID ?? "").trim();
  requireValue(BACKUP_ID_PATTERN.test(backupId), "PRODUCTION_SMOKE_ACCOUNT_BACKUP_ID_INVALID");
  const username = String(environment.EMPIRE_PRODUCTION_SMOKE_ACCOUNT_USERNAME ?? "").normalize("NFKC").trim();
  const gangName = String(environment.EMPIRE_PRODUCTION_SMOKE_ACCOUNT_GANG_NAME ?? "").normalize("NFKC").trim();
  const password = String(environment.EMPIRE_PRODUCTION_SMOKE_ACCOUNT_PASSWORD ?? "");
  const termsVersion = String(environment.EMPIRE_ACCOUNT_TERMS_VERSION ?? "").trim();
  const evidencePath = String(environment.EMPIRE_PRODUCTION_SMOKE_ACCOUNT_EVIDENCE_PATH
    ?? "artifacts/release/production/smoke-account.json").replace(/\\/gu, "/");
  requireValue(USERNAME_PATTERN.test(username), "PRODUCTION_SMOKE_ACCOUNT_USERNAME_INVALID");
  requireValue(gangName.length >= 3 && gangName.length <= 48, "PRODUCTION_SMOKE_ACCOUNT_GANG_INVALID");
  requireValue(password.length >= 20 && password.length <= 1024, "PRODUCTION_SMOKE_ACCOUNT_PASSWORD_INVALID");
  requireValue(TERMS_PATTERN.test(termsVersion), "PRODUCTION_SMOKE_ACCOUNT_TERMS_INVALID");
  requireValue(EVIDENCE_PATH_PATTERN.test(evidencePath) && !evidencePath.includes(".."),
    "PRODUCTION_SMOKE_ACCOUNT_EVIDENCE_PATH_INVALID");
  return Object.freeze({
    buildSha,
    username,
    gangName,
    termsVersion,
    evidencePath,
    databaseTargetHash: databaseTargetHash.slice(0, 16),
    backupIdHash: createHash("sha256").update(backupId).digest("hex").slice(0, 16)
  });
};

const productionDirectDatabase = (value) => {
  let parsed;
  try {
    parsed = new URL(String(value ?? "").trim());
  } catch {
    throw new Error("PRODUCTION_SMOKE_ACCOUNT_DATABASE_INVALID");
  }
  const hostname = parsed.hostname.toLowerCase();
  const databaseName = decodeURIComponent(parsed.pathname).toLowerCase();
  requireValue(["postgres:", "postgresql:"].includes(parsed.protocol)
    && hostname.endsWith(".neon.tech")
    && !hostname.split(".")[0]?.endsWith("-pooler")
    && !hostname.includes("staging")
    && !databaseName.includes("staging")
    && ["require", "verify-ca", "verify-full"].includes(parsed.searchParams.get("sslmode") ?? ""),
  "PRODUCTION_SMOKE_ACCOUNT_DATABASE_INVALID");
  return { identity: `${hostname}:${parsed.port || "5432"}${parsed.pathname}` };
};

const requireValue = (condition, code) => {
  if (!condition) throw new Error(code);
};
