import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { isExplicitLocalDemoEnabled } from "../page-assets/js/app/local-demo-gate.js";
import {
  validateRegistrationOnlyProductionEnvironment
} from "./registration-only-production-contract.mjs";

const root = new URL("../", import.meta.url);
const checks = [];
const failures = [];
const check = (passed, label, code) => {
  const result = { passed: Boolean(passed), label, code };
  checks.push(result);
  if (!result.passed) failures.push(result);
};
const source = (path) => readFile(new URL(path, root), "utf8");
const expectRegistrationEnabled = process.argv.includes("--expect-registration-enabled");

const publicStorage = createMemoryStorage({ "empire:local-demo-session:v1": "1" });
check(isExplicitLocalDemoEnabled({
  locationRef: { hostname: "empirestreets.cz", search: "?runtimeMode=local-demo" },
  configOverrides: { localDemoEnabled: true },
  sessionStorageRef: publicStorage
}) === false, "public production hostname rejects local demo", "REGISTRATION_ONLY_PUBLIC_DEMO_BLOCKED");
check(publicStorage.getItem("empire:local-demo-session:v1") === null,
  "public production hostname clears stale demo state", "REGISTRATION_ONLY_STALE_DEMO_CLEARED");

const [cookieSource, registrationRequest, lobbySource, controlPlaneSource, poolSource, healthSource] = await Promise.all([
  source("apps/server/src/player-entry/player-account-cookie.ts"),
  source("apps/server/src/player-entry/account-registration-request.ts"),
  source("page-assets/js/lobby-live.js"),
  source("apps/server/src/admin/hosted/hosted-control-plane-service.ts"),
  source("apps/server/src/netlify/netlify-postgres-database.ts"),
  source("apps/server/src/netlify/api-readiness-netlify.ts")
]);
check(cookieSource.includes('"HttpOnly"') && cookieSource.includes('"SameSite=Strict"')
  && cookieSource.includes('"Path=/"') && cookieSource.includes('environment.NODE_ENV === "production" ? "Secure"'),
"production account cookie is HttpOnly, Secure, SameSite Strict and path scoped", "REGISTRATION_ONLY_COOKIE_POLICY_INVALID");
check(registrationRequest.includes("ACCOUNT_REGISTRATION_MINIMUM_AGE_YEARS = 16")
  && registrationRequest.includes("ACCOUNT_PASSWORD_CONFIRMATION_MISMATCH"),
"registration enforces age 16 and password confirmation on the server", "REGISTRATION_ONLY_REGISTRATION_POLICY_INVALID");
check(lobbySource.includes("Herní servery zatím nejsou spuštěné."),
  "lobby has an honest no-server state", "REGISTRATION_ONLY_LOBBY_EMPTY_STATE_MISSING");
check(controlPlaneSource.includes("EMPIRE_ADMIN_WRITES_ENABLED")
  && controlPlaneSource.includes("EMPIRE_HOSTED_CONTROL_PLANE_ENABLED")
  && controlPlaneSource.includes("EMPIRE_SERVER_PROVISIONING_ENABLED"),
"admin writes and provisioning are server-side gated", "REGISTRATION_ONLY_ADMIN_GATES_MISSING");
check(poolSource.includes("max: 4") && poolSource.includes("allowExitOnIdle: true")
  && poolSource.includes("statementTimeoutMillis: 15_000"),
"Netlify PostgreSQL pool has bounded serverless settings", "REGISTRATION_ONLY_POOL_POLICY_INVALID");
check(healthSource.includes('"cache-control": "no-store"') && !healthSource.includes("EMPIRE_DATABASE_URL"),
  "public health response is no-store and excludes the database URL", "REGISTRATION_ONLY_HEALTH_POLICY_INVALID");

const strict = process.env.NODE_ENV === "production"
  || process.env.EMPIRE_REGISTRATION_ONLY_PREFLIGHT_STRICT === "1";
if (strict) {
  const validation = validateRegistrationOnlyProductionEnvironment(process.env, {
    registrationEnabled: expectRegistrationEnabled
  });
  for (const result of validation.checks) {
    check(result.passed, `${result.name} matches the registration-only production contract`, result.errorCode);
  }
  if (validation.checks.find((result) => result.name === "EMPIRE_DATABASE_URL")?.passed) {
    await checkLiveSchema(String(process.env.EMPIRE_DATABASE_URL));
  } else {
    check(false, "production schema check has a valid database target", "REGISTRATION_ONLY_SCHEMA_TARGET_INVALID");
  }
}

for (const result of checks) {
  console.log(`${result.passed ? "PASS" : "FAIL"} ${result.code} ${result.label}`);
}
if (failures.length) {
  console.error(`Registration-only production preflight failed (${failures.length} checks).`);
  process.exitCode = 1;
} else if (strict) {
  console.log("ACCOUNT PLATFORM READY");
  console.log("GAME HOSTING NOT DEPLOYED");
} else {
  console.log("ACCOUNT PLATFORM CONTRACT READY");
  console.log("GAME HOSTING NOT DEPLOYED");
}

async function checkLiveSchema(databaseUrl) {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    allowExitOnIdle: true
  });
  pool.on("error", () => undefined);
  try {
    const connected = await pool.query("SELECT 1 AS connected");
    check(connected.rows[0]?.connected === 1,
      "production PostgreSQL connection is available", "REGISTRATION_ONLY_DATABASE_UNAVAILABLE");
    const migrationsUrl = new URL("../apps/server/src/runtime/persistence/postgres/migrations/", import.meta.url);
    const filenames = (await readdir(migrationsUrl)).filter((filename) => /^\d{3}_.+\.sql$/u.test(filename)).sort();
    const applied = await pool.query("SELECT filename,checksum FROM empire_schema_migrations ORDER BY filename");
    const appliedByName = new Map(applied.rows.map((row) => [String(row.filename), String(row.checksum)]));
    const current = await Promise.all(filenames.map(async (filename) => {
      const sql = await readFile(new URL(filename, migrationsUrl), "utf8");
      return appliedByName.get(filename) === migrationChecksum(sql);
    }));
    check(filenames.length > 0 && applied.rows.length === filenames.length && current.every(Boolean),
      "production database migrations are current", "REGISTRATION_ONLY_SCHEMA_NOT_CURRENT");
  } catch {
    check(false, "live production database checks completed", "REGISTRATION_ONLY_DATABASE_CHECK_FAILED");
  } finally {
    await pool.end();
  }
}

function migrationChecksum(sql) {
  return createHash("sha256").update(sql.replace(/\r\n/gu, "\n")).digest("hex");
}

function createMemoryStorage(seed = {}) {
  const state = new Map(Object.entries(seed));
  return {
    getItem: (key) => state.get(key) ?? null,
    setItem: (key, value) => state.set(key, String(value)),
    removeItem: (key) => state.delete(key)
  };
}
