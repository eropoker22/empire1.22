import { execFileSync } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import {
  createReleaseManifest,
  STAGING_MANIFEST_PATH,
  validateReleaseSource,
  validateStagingEnvironment
} from "./staging-release-contract.mjs";

const validation = validateStagingEnvironment(process.env, {
  allowRegistrationEnabled: process.argv.includes("--allow-registration-enabled")
});
if (!validation.passed) {
  throw new Error("Refusing to create a release manifest from an invalid staging environment.");
}

const gitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const configuredSha = String(process.env.EMPIRE_BUILD_SHA ?? "").trim();
const worktree = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" }).trim();
validateReleaseSource({ gitSha, configuredSha, worktreeStatus: worktree });

const migrationsDirectory = new URL("../apps/server/src/runtime/persistence/postgres/migrations/", import.meta.url);
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((filename) => /^\d{3}_[a-z0-9_]+\.sql$/u.test(filename))
  .sort();
const expectedSchemaVersion = migrationFiles.at(-1);
if (!expectedSchemaVersion) throw new Error("No production migration was found.");

const manifest = createReleaseManifest({ gitSha, expectedSchemaVersion });
const output = new URL(`../${STAGING_MANIFEST_PATH}`, import.meta.url);
await mkdir(new URL("./", output), { recursive: true });
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Created ${STAGING_MANIFEST_PATH} for ${gitSha}.`);
