import { execFileSync } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { createProductionReleaseManifest } from "./production-release-manifest-contract.mjs";
import { validateProductionEnvironment } from "./production-release-contract.mjs";

const gitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const worktreeStatus = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" }).trim();
if (worktreeStatus) throw new Error("PRODUCTION_MANIFEST_WORKTREE_DIRTY");
const validation = validateProductionEnvironment(process.env, {
  component: "netlify",
  allowRegistrationEnabled: true,
  gitSha
});
if (!validation.passed) throw new Error("PRODUCTION_MANIFEST_ENVIRONMENT_INVALID");

const migrationFiles = (await readdir(new URL("../apps/server/src/runtime/persistence/postgres/migrations/", import.meta.url)))
  .filter((filename) => /^\d{3}_[a-z0-9_]+\.sql$/u.test(filename))
  .sort();
const expectedSchemaVersion = migrationFiles.at(-1);
if (!expectedSchemaVersion) throw new Error("PRODUCTION_MANIFEST_SCHEMA_MISSING");

const npmVersion = String(process.env.npm_config_user_agent ?? "").match(/(?:^|\s)npm\/([^\s]+)/u)?.[1] ?? "";
const manifest = createProductionReleaseManifest({ gitSha, expectedSchemaVersion, npmVersion });
await mkdir(new URL("../artifacts/", import.meta.url), { recursive: true });
await writeFile(new URL("../artifacts/release-manifest.json", import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Created production release manifest for ${gitSha}.`);
