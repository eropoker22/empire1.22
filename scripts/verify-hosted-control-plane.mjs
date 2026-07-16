import { access, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const checks = [];
const failures = [];
const check = (condition, label) => { checks.push({ condition: Boolean(condition), label }); if (!condition) failures.push(label); };
const requiredFiles = [
  "apps/server/src/runtime/persistence/postgres/migrations/007_hosted_server_control_plane.sql",
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
const databaseUrl = String(process.env.EMPIRE_DATABASE_URL ?? process.env.EMPIRE_TEST_DATABASE_URL ?? "").trim();
if (strict) {
  check(Boolean(databaseUrl), "PostgreSQL URL is configured");
  check(process.env.EMPIRE_ADMIN_WRITES_ENABLED === "true", "admin writes flag is enabled");
  check(process.env.EMPIRE_HOSTED_CONTROL_PLANE_ENABLED === "true", "hosted control-plane flag is enabled");
  check(process.env.EMPIRE_SERVER_PROVISIONING_ENABLED === "true", "server provisioning flag is enabled");
  check(Boolean(process.env.EMPIRE_PUBLIC_ORIGIN || process.env.EMPIRE_ALLOWED_ORIGINS), "public origin is configured");
  check(String(process.env.EMPIRE_ADMIN_FINGERPRINT_SECRET ?? "").length >= 32, "admin fingerprint secret is configured");
}

if (databaseUrl) {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const migrationSql = await readFile(new URL("../apps/server/src/runtime/persistence/postgres/migrations/007_hosted_server_control_plane.sql", import.meta.url), "utf8");
    const migration = await pool.query("SELECT EXISTS (SELECT 1 FROM empire_schema_migrations WHERE filename=$1 AND checksum=$2) AS present",
      ["007_hosted_server_control_plane.sql", createHash("sha256").update(migrationSql).digest("hex")]);
    check(migration.rows[0]?.present === true, "hosted migration is current");
    const expectedUsername = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_USERNAME ?? "Erik22").normalize("NFKC").trim().toLocaleLowerCase("en-US");
    const user = await pool.query("SELECT role,status FROM empire_admin_users WHERE normalized_username=$1", [expectedUsername]);
    check(user.rows[0]?.status === "active", "bootstrap admin user is active");
    check(user.rows[0]?.role === "owner", "bootstrap admin user has owner role");
    const tables = await pool.query(`SELECT to_regclass('empire_admin_sessions') AS sessions,
      to_regclass('empire_admin_access_audit') AS audit,to_regclass('empire_hosted_server_instances') AS hosted,
      to_regclass('empire_hosted_server_provisioning_jobs') AS jobs,to_regclass('empire_snapshots') AS snapshots,
      to_regclass('empire_tick_locks') AS tick_locks`);
    check(Object.values(tables.rows[0] ?? {}).every(Boolean), "required durable repositories exist");
    const worker = await pool.query("SELECT last_heartbeat_at FROM empire_hosted_worker_heartbeats WHERE status='online' ORDER BY last_heartbeat_at DESC LIMIT 1");
    check(Boolean(worker.rows[0]) && Date.now() - Date.parse(worker.rows[0].last_heartbeat_at) <= 60_000, "hosted worker heartbeat is fresh");
  } catch (_error) {
    check(false, "live PostgreSQL hosted checks completed");
  } finally {
    await pool.end();
  }
} else {
  console.log("SKIP live PostgreSQL checks: no database URL configured.");
}

for (const result of checks) console.log(`${result.condition ? "PASS" : "FAIL"} ${result.label}`);
if (failures.length) {
  console.error(`Hosted control-plane preflight failed (${failures.length} checks).`);
  process.exitCode = 1;
} else {
  console.log(`Hosted control-plane preflight passed (${strict ? "strict" : "code-level"} mode).`);
}
