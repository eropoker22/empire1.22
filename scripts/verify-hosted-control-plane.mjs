import { access, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { probeRollbackOnlyTickLease } from "./hosted-preflight-tick-probe.mjs";

const checks = [];
const failures = [];
const check = (condition, label) => { checks.push({ condition: Boolean(condition), label }); if (!condition) failures.push(label); };
const requiredFiles = [
  "apps/server/src/runtime/persistence/postgres/migrations/007_hosted_server_control_plane.sql",
  "apps/server/src/runtime/persistence/postgres/migrations/008_hosted_join_reservations.sql",
  "apps/server/src/runtime/persistence/postgres/migrations/009_player_entry_control_plane.sql",
  "apps/server/src/runtime/persistence/postgres/migrations/010_runtime_instance_foreign_keys.sql",
  "apps/server/src/runtime/persistence/postgres/migrations/011_hosted_runtime_lease_incarnation.sql",
  "apps/server/src/runtime/persistence/postgres/migrations/012_hosted_server_registration_lifecycle.sql",
  "apps/server/src/runtime/persistence/postgres/migrations/013_account_auth_throttle.sql",
  "apps/server/src/runtime/persistence/postgres/migrations/014_hosted_match_results.sql",
  "apps/server/src/runtime/persistence/postgres/migrations/015_account_age_requirement.sql",
  "apps/server/src/player-entry/postgres-player-entry-repository.ts",
  "apps/server/src/admin/hosted/postgres-hosted-join-repository.ts",
  "apps/server/src/bootstrap/hosted-runtime-worker-cli.ts",
  "Dockerfile.hosted-worker",
  "docs/hosting/hosted-server-control-plane.md"
];
for (const path of requiredFiles) {
  try { await access(new URL(`../${path}`, import.meta.url)); check(true, `${path} exists`); }
  catch { check(false, `${path} exists`); }
}
const serviceSource = await readFile(new URL("../apps/server/src/admin/hosted/hosted-control-plane-service.ts", import.meta.url), "utf8");
check(serviceSource.includes('repositories.kind === "postgres"'), "writes require PostgreSQL");
check(serviceSource.includes("Idempotency-Key") || serviceSource.includes("idempotencyKey"), "create is idempotency-gated");
check(!serviceSource.includes("passwordHash") && !serviceSource.includes("passwordSalt"), "browser-facing service excludes password material");

const strict = process.env.NODE_ENV === "production" || process.env.EMPIRE_HOSTED_PREFLIGHT_STRICT === "1";
const hostedDatabaseUrl = String(process.env.EMPIRE_DATABASE_URL ?? "").trim();
const databaseUrl = strict
  ? hostedDatabaseUrl
  : hostedDatabaseUrl || String(process.env.EMPIRE_TEST_DATABASE_URL ?? "").trim();
if (strict) {
  const allowedOrigins = parseAllowedOrigins(process.env.EMPIRE_ALLOWED_ORIGINS);
  const sessionSecret = String(process.env.GAMEPLAY_SLICE_SESSION_SECRET ?? "").trim();
  const snapshotSecret = String(process.env.GAMEPLAY_SLICE_SNAPSHOT_SECRET ?? "").trim();
  const buildSha = String(process.env.EMPIRE_BUILD_SHA ?? "").trim();
  check(Boolean(hostedDatabaseUrl), "EMPIRE_DATABASE_URL is configured");
  check(isTlsPostgresUrl(hostedDatabaseUrl), "EMPIRE_DATABASE_URL requires PostgreSQL TLS");
  check(process.env.EMPIRE_ADMIN_WRITES_ENABLED === "true", "admin writes flag is enabled");
  check(process.env.EMPIRE_HOSTED_CONTROL_PLANE_ENABLED === "true", "hosted control-plane flag is enabled");
  check(process.env.EMPIRE_SERVER_PROVISIONING_ENABLED === "true", "server provisioning flag is enabled");
  check(allowedOrigins.length > 0 && allowedOrigins.every(isAllowedOrigin), "gameplay origin allowlist is configured");
  check(sessionSecret.length >= 32, "gameplay session secret is at least 32 characters");
  check(snapshotSecret.length >= 32, "snapshot secret is at least 32 characters");
  check(Boolean(sessionSecret) && Boolean(snapshotSecret) && sessionSecret !== snapshotSecret,
    "gameplay session and snapshot secrets are distinct");
  check(String(process.env.EMPIRE_ADMIN_FINGERPRINT_SECRET ?? "").length >= 32, "admin fingerprint secret is configured");
  check(process.env.EMPIRE_PERSISTENCE_DRIVER === "postgres", "runtime persistence is PostgreSQL");
  check(process.env.GAMEPLAY_PERSISTENCE_DRIVER === "postgres", "gameplay persistence is PostgreSQL");
  check(Boolean(process.env.EMPIRE_HOSTED_WORKER_ID), "EMPIRE_HOSTED_WORKER_ID is configured");
  check(/^[0-9a-f]{40}$/u.test(buildSha), "EMPIRE_BUILD_SHA is an exact Git SHA");
  const registrationEnabled = process.env.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED === "true";
  if (registrationEnabled) {
    check(String(process.env.EMPIRE_AUTH_THROTTLE_PEPPER ?? "").trim().length >= 32,
      "public account registration has durable auth throttling");
  } else {
    check(true, "public account registration is safely disabled");
  }
}

if (databaseUrl) {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: databaseUrl });
  pool.on("error", () => undefined);
  try {
    check((await pool.query("SELECT 1 AS connected")).rows[0]?.connected === 1, "PostgreSQL connectivity is live");
    const migrationsUrl = new URL("../apps/server/src/runtime/persistence/postgres/migrations/", import.meta.url);
    const migrationFiles = (await readdir(migrationsUrl)).filter((filename) => /^\d{3}_.+\.sql$/u.test(filename)).sort();
    const applied = await pool.query("SELECT filename,checksum FROM empire_schema_migrations ORDER BY filename");
    const appliedByName = new Map(applied.rows.map((row) => [String(row.filename), String(row.checksum)]));
    const migrationChecks = await Promise.all(migrationFiles.map(async (filename) => {
      const sql = await readFile(new URL(filename, migrationsUrl), "utf8");
      return appliedByName.get(filename) === createHash("sha256").update(sql).digest("hex");
    }));
    check(migrationFiles.length >= 12 && migrationChecks.every(Boolean) && applied.rows.length === migrationFiles.length,
      "all database migrations are current");
    const expectedUsername = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_USERNAME ?? "Erik22").normalize("NFKC").trim().toLocaleLowerCase("en-US");
    const user = await pool.query("SELECT role,status FROM empire_admin_users WHERE normalized_username=$1", [expectedUsername]);
    check(user.rows[0]?.status === "active", "bootstrap admin user is active");
    check(user.rows[0]?.role === "owner", "bootstrap admin user has owner role");
    const tables = await pool.query(`SELECT to_regclass('empire_admin_users') AS admin_users,
      to_regclass('empire_admin_sessions') AS sessions,
      to_regclass('empire_admin_access_audit') AS audit,to_regclass('empire_hosted_server_instances') AS hosted,
      to_regclass('empire_hosted_server_provisioning_jobs') AS jobs,to_regclass('empire_snapshots') AS snapshots,
      to_regclass('empire_hosted_join_reservations') AS join_reservations,
      to_regclass('empire_hosted_join_jobs') AS join_jobs,
      to_regclass('empire_accounts') AS player_accounts,
      to_regclass('empire_account_sessions') AS account_sessions,
      to_regclass('empire_server_memberships') AS memberships,
      to_regclass('empire_server_membership_jobs') AS membership_jobs,
      to_regclass('empire_server_membership_events') AS membership_events,
      to_regclass('empire_player_registrations') AS player_registrations,
      to_regclass('empire_hosted_worker_heartbeats') AS worker_heartbeats,
      to_regclass('empire_tick_locks') AS tick_locks`);
    check(Object.values(tables.rows[0] ?? {}).every(Boolean), "required durable repositories exist");
    const worker = await pool.query("SELECT last_heartbeat_at,build_sha FROM empire_hosted_worker_heartbeats WHERE status='online' ORDER BY last_heartbeat_at DESC LIMIT 1");
    check(Boolean(worker.rows[0]) && Date.now() - Date.parse(worker.rows[0].last_heartbeat_at) <= 30_000, "hosted worker heartbeat is fresh");
    check(Boolean(worker.rows[0]) && worker.rows[0].build_sha === buildSha,
      "hosted worker build SHA matches API release SHA");
    check(await probeRollbackOnlyTickLease(pool), "tick lease can be acquired and released in a rollback-only probe");
  } catch (_error) {
    check(false, "live PostgreSQL hosted checks completed");
  } finally {
    await pool.end();
  }
} else {
  if (!strict) console.log("SKIP live PostgreSQL checks: no database URL configured.");
}

for (const result of checks) console.log(`${result.condition ? "PASS" : "FAIL"} ${result.label}`);
if (failures.length) {
  console.error(`Hosted control-plane preflight failed (${failures.length} checks).`);
  process.exitCode = 1;
} else {
  console.log(`Hosted control-plane preflight passed (${strict ? "strict" : "code-level"} mode).`);
}

function parseAllowedOrigins(value) {
  return String(value ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
}

function isAllowedOrigin(candidate) {
  try {
    const origin = new URL(candidate);
    return origin.origin === candidate && origin.protocol === "https:";
  } catch {
    return false;
  }
}

function isTlsPostgresUrl(candidate) {
  try {
    const url = new URL(candidate);
    return ["postgres:", "postgresql:"].includes(url.protocol)
      && ["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode"));
  } catch {
    return false;
  }
}
