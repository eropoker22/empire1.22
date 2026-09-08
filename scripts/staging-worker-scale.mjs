import { execFileSync } from "node:child_process";
import { STAGING_FLY_APP } from "./staging-release-contract.mjs";

const action = String(process.argv[2] ?? "").trim().toLowerCase();
if (!new Set(["pause", "resume"]).has(action)) {
  throw new Error("STAGING_WORKER_SCALE_ACTION_INVALID");
}
if (process.env.EMPIRE_RELEASE_ENVIRONMENT
  && process.env.EMPIRE_RELEASE_ENVIRONMENT !== "staging") {
  throw new Error("STAGING_WORKER_SCALE_ENVIRONMENT_INVALID");
}
if (process.env.FLY_STAGING_APP && process.env.FLY_STAGING_APP !== STAGING_FLY_APP) {
  throw new Error("STAGING_WORKER_SCALE_APP_NOT_PINNED");
}
if (/(?:^|-)(?:prod|production)(?:-|$)/u.test(STAGING_FLY_APP)) {
  throw new Error("STAGING_WORKER_SCALE_PRODUCTION_TARGET_REJECTED");
}

const count = action === "pause" ? "0" : "1";
execFileSync("flyctl", ["scale", "count", count, "--app", STAGING_FLY_APP, "--yes"], {
  stdio: "inherit"
});
console.info(`[staging-worker] action=${action} app=${STAGING_FLY_APP} count=${count}`);
