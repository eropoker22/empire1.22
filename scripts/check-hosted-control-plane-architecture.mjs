import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split(/\r?\n/u).filter(Boolean);
const staged = execFileSync("git", ["diff", "--cached", "--name-only"], { encoding: "utf8" }).split(/\r?\n/u).filter(Boolean);
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const text = (path) => {
  try { return readFileSync(path, "utf8"); }
  catch { return ""; }
};

check(!staged.some((path) => /(^|\/)\.env(\.|$)/u.test(path) && !path.endsWith(".env.example")), "local environment files must not be staged");
check(!tracked.some((path) => /(^|\/)\.env\.local$/u.test(path)), ".env.local must not be tracked");

const configuredPassword = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD ?? process.env.EMPIRE_ADMIN_NEW_PASSWORD ?? "");
if (configuredPassword) {
  check(!tracked.some((path) => {
    try { return text(path).includes(configuredPassword); } catch { return false; }
  }), "configured admin password must not occur in tracked files");
}

const adminBrowserFiles = tracked.filter((path) => path.startsWith("apps/admin/src/") && path.endsWith(".ts"));
for (const path of adminBrowserFiles) {
  check(!/apps\/server|ServerApp|ServerInstanceManager|game-core\/src|hosted-runtime-worker/u.test(text(path)), `${path} imports server/runtime authority`);
}
const netlifyFiles = tracked.filter((path) => path.startsWith("apps/server/src/netlify/") && path.endsWith(".ts"));
for (const path of netlifyFiles) {
  check(!/hosted-runtime-worker|hosted-runtime-worker-cli|tickActiveInstances\(/u.test(text(path)), `${path} must not run the hosted worker`);
}

const handler = text("apps/server/src/netlify/admin-read-only-netlify.ts");
check(handler.includes('header(request.headers, "idempotency-key")'), "create and lifecycle endpoints require Idempotency-Key");
check(handler.includes("expectedVersion") || text("apps/server/src/admin/hosted/hosted-control-plane-service.ts").includes("expectedVersion"), "lifecycle actions require expectedVersion");
check(!/hard-delete|reset-server|grant-money|grant-resources|edit-player/u.test(handler), "forbidden destructive/gameplay admin endpoint detected");
check(!tracked.some((path) => path.endsWith(".ts") && /EMPIRE_ADMIN_SECRET|x-empire-admin-secret/u.test(text(path))), "legacy shared admin secret is forbidden");
check(text("apps/server/src/admin/hosted/hosted-control-plane-service.ts").includes('repositories.kind === "postgres"'), "production admin writes must require PostgreSQL");
check(text("apps/server/src/runtime/persistence/postgres/migrations/007_hosted_server_control_plane.sql").includes("status <> 'running'"), "running status must require a lease invariant");
const migration = text("apps/server/src/runtime/persistence/postgres/migrations/007_hosted_server_control_plane.sql");
const expectedChecksum = createHash("sha256").update(migration).digest("hex");
check(text("apps/server/src/admin/hosted/postgres-hosted-control-plane-helpers.ts").includes(expectedChecksum), "hosted worker migration checksum must match migration 007");

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Hosted control-plane architecture checks passed.");
}
