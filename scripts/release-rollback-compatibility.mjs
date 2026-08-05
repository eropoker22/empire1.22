import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const MIGRATION_PATTERN = /^\d{3}_[a-z0-9_]+\.sql$/u;
const MIGRATION_DIRECTORY = "apps/server/src/runtime/persistence/postgres/migrations";
const ALLOWED_CLASSIFICATIONS = new Set([
  "backward-compatible",
  "forward-only",
  "destructive",
  "requires-maintenance-window"
]);

export const checksumMigration = (sql) => createHash("sha256")
  .update(String(sql).replace(/\r\n/gu, "\n"))
  .digest("hex");

export const validateMigrationClassifications = (manifest, migrations) => {
  if (manifest?.version !== 1 || !Array.isArray(manifest.migrations)) {
    throw new Error("ROLLBACK_MIGRATION_CLASSIFICATION_MANIFEST_INVALID");
  }
  const classified = new Map();
  for (const entry of manifest.migrations) {
    const filename = String(entry?.filename ?? "");
    const classification = String(entry?.classification ?? "");
    const reason = String(entry?.reason ?? "").trim();
    if (!MIGRATION_PATTERN.test(filename) || !ALLOWED_CLASSIFICATIONS.has(classification) || reason.length < 12
      || classified.has(filename)) {
      throw new Error("ROLLBACK_MIGRATION_CLASSIFICATION_ENTRY_INVALID");
    }
    classified.set(filename, { classification, reason });
  }
  const filenames = migrations.map((entry) => entry.filename);
  if (filenames.length === 0 || filenames.some((filename, index) => !MIGRATION_PATTERN.test(filename)
    || (index > 0 && filename <= filenames[index - 1]))
    || filenames.some((filename) => !classified.has(filename)) || classified.size !== filenames.length) {
    throw new Error("ROLLBACK_MIGRATION_CLASSIFICATION_COVERAGE_INVALID");
  }
  return migrations.map((entry) => ({ ...entry, ...classified.get(entry.filename) }));
};

export const evaluateCodeOnlyRollback = ({ candidateSha, previousSha, candidateMigrations, previousMigrations }) => {
  if (!SHA_PATTERN.test(candidateSha) || !SHA_PATTERN.test(previousSha) || candidateSha === previousSha) {
    throw new Error("ROLLBACK_RELEASE_SHA_INVALID");
  }
  const identical = candidateMigrations.length === previousMigrations.length
    && candidateMigrations.every((entry, index) => entry.filename === previousMigrations[index]?.filename
      && entry.checksum === previousMigrations[index]?.checksum);
  return {
    candidateSha,
    previousSha,
    candidateSchemaVersion: candidateMigrations.at(-1)?.filename ?? null,
    previousSchemaVersion: previousMigrations.at(-1)?.filename ?? null,
    migrationSetsIdentical: identical,
    codeOnlyRollbackSafe: identical,
    databaseRestoreRequired: false
  };
};

const isEntrypoint = process.argv[1]
  && fileURLToPath(import.meta.url).toLowerCase() === String(process.argv[1]).toLowerCase();

if (isEntrypoint) {
  const previousSha = readArgument("--previous-sha") ?? String(process.env.EMPIRE_ROLLBACK_PREVIOUS_SHA ?? "").trim();
  const candidateSha = git(["rev-parse", "HEAD"]);
  const configuredSha = String(process.env.EMPIRE_BUILD_SHA ?? "").trim();
  if (!SHA_PATTERN.test(previousSha) || !SHA_PATTERN.test(candidateSha) || configuredSha !== candidateSha) {
    throw new Error("ROLLBACK_RELEASE_SHA_INVALID");
  }
  git(["cat-file", "-e", `${previousSha}^{commit}`]);
  try {
    git(["merge-base", "--is-ancestor", previousSha, candidateSha]);
  } catch {
    throw new Error("ROLLBACK_PREVIOUS_RELEASE_NOT_ANCESTOR");
  }
  const candidateMigrations = await loadCurrentMigrations();
  const previousMigrations = loadGitMigrations(previousSha);
  const classificationManifest = JSON.parse(await readFile(
    new URL("../docs/deployment/migration-compatibility.json", import.meta.url), "utf8"
  ));
  const classifiedMigrations = validateMigrationClassifications(classificationManifest, candidateMigrations);
  const result = evaluateCodeOnlyRollback({ candidateSha, previousSha, candidateMigrations, previousMigrations });
  const evidence = {
    checkedAt: new Date().toISOString(),
    ...result,
    migrations: classifiedMigrations
  };
  const outputPath = String(process.env.EMPIRE_ROLLBACK_COMPATIBILITY_EVIDENCE_PATH
    ?? "artifacts/release/rollback-compatibility.json");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  if (!result.codeOnlyRollbackSafe) throw new Error("ROLLBACK_SCHEMA_CONTRACT_MISMATCH");
  console.log(`Code-only rollback compatibility verified: ${previousSha} -> ${candidateSha}.`);
}

async function loadCurrentMigrations() {
  const directory = new URL(`../${MIGRATION_DIRECTORY}/`, import.meta.url);
  const filenames = (await readdir(directory)).filter((filename) => MIGRATION_PATTERN.test(filename)).sort();
  return Promise.all(filenames.map(async (filename) => ({
    filename,
    checksum: checksumMigration(await readFile(new URL(filename, directory), "utf8"))
  })));
}

function loadGitMigrations(sha) {
  const filenames = git(["ls-tree", "-r", "--name-only", sha, "--", MIGRATION_DIRECTORY])
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((path) => path.slice(MIGRATION_DIRECTORY.length + 1))
    .filter((filename) => MIGRATION_PATTERN.test(filename))
    .sort();
  return filenames.map((filename) => ({
    filename,
    checksum: checksumMigration(git(["show", `${sha}:${MIGRATION_DIRECTORY}/${filename}`], false))
  }));
}

function git(arguments_, trim = true) {
  const output = execFileSync("git", arguments_, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return trim ? output.trim() : output;
}

function readArgument(name) {
  const prefix = `${name}=`;
  const inline = process.argv.find((entry) => entry.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim();
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] ?? "").trim() : null;
}
