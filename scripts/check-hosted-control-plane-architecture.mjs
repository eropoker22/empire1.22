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
const hasDynamicModuleImport = (source, modulePath) => {
  const escapedModulePath = modulePath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`import\\(\\s*["']${escapedModulePath}(?:\\?[^"']*)?["']\\s*\\)`, "u").test(source);
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
const matchmakingHandler = text("apps/server/src/netlify/public-server-matchmaking-netlify.ts");
const functionHandler = text("apps/server/src/netlify/gameplay-slice-function.ts");
const entryMigration = text("apps/server/src/runtime/persistence/postgres/migrations/009_player_entry_control_plane.sql");
const runtimeForeignKeyMigration = text("apps/server/src/runtime/persistence/postgres/migrations/010_runtime_instance_foreign_keys.sql");
const lobbyPage = text("pages/lobby.html");
const factionPage = text("pages/faction.html");
const lobbyLive = text("page-assets/js/lobby-live.js");
const lobbyEntry = text("page-assets/js/lobby-entry.js");
const loginEntry = text("page-assets/js/login-entry.js");
const factionEntry = text("page-assets/js/faction-entry.js");
const localDemoGate = text("page-assets/js/app/local-demo-gate.js");
const lifecyclePolicy = text("packages/game-config/src/public/free-hosted-server-lifecycle-policy.ts");
const controlPlanePolicy = text("apps/server/src/admin/hosted/hosted-control-plane-policy.ts");
const lifecycleCompletion = text("apps/server/src/admin/hosted/hosted-lifecycle-action-completion.ts");
const postgresJoin = text("apps/server/src/admin/hosted/postgres-hosted-join-repository.ts");
const readyMembershipQuery = text("apps/server/src/runtime/persistence/postgres/hosted-ready-membership-query.ts");
check(handler.includes('header(request.headers, "idempotency-key")'), "create and lifecycle endpoints require Idempotency-Key");
check(handler.includes("expectedVersion") || text("apps/server/src/admin/hosted/hosted-control-plane-service.ts").includes("expectedVersion"), "lifecycle actions require expectedVersion");
check(!/hard-delete|reset-server|grant-money|grant-resources|edit-player/u.test(handler), "forbidden destructive/gameplay admin endpoint detected");
check(!tracked.some((path) => path.endsWith(".ts") && /EMPIRE_ADMIN_SECRET|x-empire-admin-secret/u.test(text(path))), "legacy shared admin secret is forbidden");
check(matchmakingHandler.includes('repositories?.kind === "postgres"') && matchmakingHandler.includes("listHostedPublicServers"), "hosted matchmaking must use the durable PostgreSQL registry");
check(!matchmakingHandler.includes("publicServerRegistry"), "production matchmaking handler must not import the hardcoded public registry");
check(functionHandler.includes("EMPIRE_LEGACY_MATCHMAKING_ENABLED"), "legacy matchmaking must be explicitly disabled in production");
check(lobbyPage.includes("lobby-entry.js") && lobbyEntry.includes("isExplicitLocalDemoEnabled") && hasDynamicModuleImport(lobbyEntry, "./lobby-live.js"), "production lobby defaults to the live account/membership entrypoint");
check(text("pages/login.html").includes("login-entry.js") && loginEntry.includes("isExplicitLocalDemoEnabled") && hasDynamicModuleImport(loginEntry, "./login-live.js"), "production login defaults to the live account entrypoint");
check(factionPage.includes("faction-entry.js") && factionEntry.includes("isExplicitLocalDemoEnabled") && hasDynamicModuleImport(factionEntry, "./faction-live.js"), "production setup defaults to the live membership entrypoint");
check(localDemoGate.includes("127.0.0.1") && localDemoGate.includes("localDemoEnabled === true"), "legacy entry flow requires an explicit loopback-only demo flag");
check(!/SERVER_CATALOG|saveLobbyStep|SPAWN_SIDE_BAND_COLUMNS|Math\.random/u.test(lobbyLive), "production lobby has no static spawn/server authority");
check(entryMigration.includes("empire_server_memberships_blocking_account_idx"), "one blocking membership is enforced by PostgreSQL");
check(entryMigration.includes("empire_server_memberships_reserved_district_idx"), "spawn district reservation is unique in PostgreSQL");
check(runtimeForeignKeyMigration.includes("REFERENCES empire_server_instances (server_instance_id)"), "atomic command foreign keys use the canonical server instance ID");
check(text("apps/server/src/admin/hosted/hosted-control-plane-service.ts").includes('repositories.kind === "postgres"'), "production admin writes must require PostgreSQL");
check(text("apps/server/src/runtime/persistence/postgres/migrations/007_hosted_server_control_plane.sql").includes("status <> 'running'"), "running status must require a lease invariant");
check(lifecyclePolicy.includes("minimumReadyPlayersToStart: 2") && lifecyclePolicy.includes("registrationWindowMs: 60 * 60 * 1000"),
  "hosted Free lifecycle must keep the two-player start and one-hour window canonical");
check(lifecyclePolicy.includes('control: Object.freeze({') && lifecyclePolicy.includes("eliminationEnabled: false")
  && lifecyclePolicy.includes('full: Object.freeze({') && lifecyclePolicy.includes("eliminationEnabled: true"),
  "control and full server templates must explicitly separate elimination policy");
check(controlPlanePolicy.includes("CREATE_KEYS") && !controlPlanePolicy.match(/CREATE_KEYS[^;]+registrationClosesAt/us),
  "browser create payload must not control registrationClosesAt");
check(controlPlanePolicy.includes("resolveModeConfig(mode)") && controlPlanePolicy.includes("config.balance.maxPlayersPerServer"),
  "hosted capacity must remain canonical and independent from minimum ready players");
check(lifecycleCompletion.includes('joinPolicy: registration.state === "open" ? "open" : "closed"'),
  "starting a hosted server must preserve an open registration window");
check(readyMembershipQuery.includes("FROM empire_server_memberships membership")
  && readyMembershipQuery.includes("membership.status='active'")
  && readyMembershipQuery.includes("JOIN empire_snapshot_latest snapshot")
  && readyMembershipQuery.includes("'homeDistrictId'")
  && !readyMembershipQuery.includes("reservation.status='reserved'"),
  "start readiness must use durable active memberships rather than pending join reservations");
check(postgresJoin.indexOf("FOR UPDATE") < postgresJoin.indexOf("SELECT clock_timestamp() AS now"),
  "join boundary must read authoritative database time after acquiring the server lock");
const migrationContract = text("apps/server/src/runtime/persistence/postgres/production-migration-contract.ts");
const migrationPaths = tracked.filter((path) =>
  /^apps\/server\/src\/runtime\/persistence\/postgres\/migrations\/\d{3}_[a-z0-9_]+\.sql$/u.test(path)
).sort();
check(migrationPaths.length >= 10, "production migration contract must cover the full schema");
for (const path of migrationPaths) {
  const filename = path.split("/").at(-1);
  const expectedChecksum = createHash("sha256").update(text(path)).digest("hex");
  check(migrationContract.includes(`\"${filename}\", \"${expectedChecksum}\"`), `${filename} must match the production migration contract`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Hosted control-plane architecture checks passed.");
}
