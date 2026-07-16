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
  check((env.EMPIRE_PERSISTENCE_DRIVER || env.GAMEPLAY_PERSISTENCE_DRIVER) === "postgres", "production persistence driver is postgres");
  check(Boolean(env.EMPIRE_DATABASE_URL || env.GAMEPLAY_DATABASE_URL), "production database URL is configured");
  check(Boolean(env.GAMEPLAY_SLICE_SESSION_SECRET), "gameplay session secret is configured");
  check(Boolean(env.GAMEPLAY_SLICE_SNAPSHOT_SECRET), "snapshot secret is configured");
  check(Boolean(env.EMPIRE_ACCOUNT_IDENTITY_PROVIDER), "production account identity adapter is configured");
  check(Boolean(env.EMPIRE_TICK_WORKER_OWNER_ID), "tick worker lease owner is configured");
}

for (const result of checks) console.log(`${result.passed ? "PASS" : "FAIL"} ${result.label}`);
if (failures.length) {
  console.error(`Closed-alpha preflight failed (${failures.length} checks).`);
  process.exitCode = 1;
} else {
  console.log(`Closed-alpha preflight passed (${checks.length} checks${strict ? ", strict production mode" : ", code-level mode"}).`);
}
