import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import {
  GAMEPLAY_EXECUTION_MODES,
  GAMEPLAY_SYSTEM_IDS,
  assertGameplayAuthorityMatrix,
  getGameplayAuthorityMatrix
} from "../page-assets/js/app/runtime/gameplayExecutionMode.js";

const root = new URL("../", import.meta.url);
const failures = [];
const checks = [];
const check = (condition, label) => {
  checks.push({ label, passed: Boolean(condition) });
  if (!condition) failures.push(label);
};

const gameHtml = await readFile(new URL("pages/game.html", root), "utf8");
check(!/empire-gameplay-execution-mode[^>]+content=["']local-demo["']/i.test(gameHtml), "checked-in game shell is not forced to local-demo");

for (const mode of Object.values(GAMEPLAY_EXECUTION_MODES)) {
  const matrix = getGameplayAuthorityMatrix(mode);
  check(assertGameplayAuthorityMatrix(matrix, mode) === true, `authority matrix is valid for ${mode}`);
  check(Object.keys(matrix).length === GAMEPLAY_SYSTEM_IDS.length, `authority matrix covers every gameplay system in ${mode}`);
}

for (const relativePath of [
  "packages/game-core/src/projections/leaderboard-read-model-projection.ts",
  "packages/game-core/src/projections/city-event-projection.ts",
  "apps/server/src/runtime/persistence/postgres/postgres-atomic-command-transaction.ts",
  "apps/server/src/runtime/persistence/postgres/postgres-tick-lock.ts"
]) {
  try {
    await access(new URL(relativePath, root));
    check(true, `${relativePath} exists`);
  } catch {
    check(false, `${relativePath} exists`);
  }
}

const strict = process.env.NODE_ENV === "production" || process.env.EMPIRE_CLOSED_ALPHA_PREFLIGHT_STRICT === "1";
if (strict) {
  const env = process.env;
  const sessionSecret = String(env.GAMEPLAY_SLICE_SESSION_SECRET ?? "").trim();
  const snapshotSecret = String(env.GAMEPLAY_SLICE_SNAPSHOT_SECRET ?? "").trim();
  const allowedOrigins = String(env.EMPIRE_ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  check(env.EMPIRE_PERSISTENCE_DRIVER === "postgres", "runtime persistence driver is postgres");
  check(env.GAMEPLAY_PERSISTENCE_DRIVER === "postgres", "gameplay persistence driver is postgres");
  check(Boolean(env.EMPIRE_DATABASE_URL || env.GAMEPLAY_DATABASE_URL), "production database URL is configured");
  check(sessionSecret.length >= 32, "gameplay session secret is at least 32 characters");
  check(snapshotSecret.length >= 32, "snapshot secret is at least 32 characters");
  check(Boolean(sessionSecret) && Boolean(snapshotSecret) && sessionSecret !== snapshotSecret,
    "gameplay session and snapshot secrets are distinct");
  check(allowedOrigins.length > 0 && allowedOrigins.every(isSecureOrigin), "gameplay origin allowlist is configured");
  check(Boolean(env.EMPIRE_HOSTED_WORKER_ID), "hosted worker identity is configured");
  const registrationEnabled = env.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED === "true";
  if (registrationEnabled) {
    check(String(env.EMPIRE_AUTH_THROTTLE_PEPPER ?? "").trim().length >= 32,
      "public account registration has durable auth throttling");
  } else {
    check(true, "public account registration is safely disabled");
  }
}

for (const result of checks) console.log(`${result.passed ? "PASS" : "FAIL"} ${result.label}`);
if (failures.length) {
  console.error(`Closed-alpha preflight failed (${failures.length} checks).`);
  process.exitCode = 1;
} else {
  console.log(`Closed-alpha preflight passed (${checks.length} checks${strict ? ", strict production mode" : ", code-level mode"}).`);
}

function isSecureOrigin(candidate) {
  try {
    const parsed = new URL(candidate);
    const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]";
    return parsed.origin === candidate && (parsed.protocol === "https:" || loopback);
  } catch {
    return false;
  }
}
