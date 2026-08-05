import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { validateReleaseBuildSource } from "./release-build-source-contract.mjs";
import {
  createReleaseAssetEntry,
  RELEASE_ASSET_TARGETS,
  shouldCreateReleaseAssetManifest
} from "./release-asset-manifest-contract.mjs";
import { extractFrontendBuildSha } from "./remote-release-contract.mjs";

const gitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const source = validateReleaseBuildSource({
  releaseEnvironment: process.env.EMPIRE_RELEASE_ENVIRONMENT,
  configuredSha: String(process.env.EMPIRE_BUILD_SHA ?? "").trim(),
  gitSha
});
const createManifest = shouldCreateReleaseAssetManifest({
  publicRelease: source.publicRelease && Boolean(source.buildSha),
  required: process.argv.includes("--required")
});

if (!createManifest) {
  console.log("Release asset manifest skipped for local build.");
} else {
  const migrationFiles = (await readdir(new URL("../apps/server/src/runtime/persistence/postgres/migrations/", import.meta.url)))
    .filter((filename) => /^\d{3}_[a-z0-9_]+\.sql$/u.test(filename)).sort();
  const schemaVersion = migrationFiles.at(-1);
  if (!schemaVersion) throw new Error("RELEASE_ASSET_MANIFEST_SCHEMA_UNAVAILABLE");
  const builtAdminHtml = await readFile(new URL("../client/admin.html", import.meta.url), "utf8");
  if (extractFrontendBuildSha(builtAdminHtml) !== source.buildSha) {
    throw new Error("RELEASE_ASSET_FRONTEND_SHA_MISMATCH");
  }
  const files = await Promise.all(RELEASE_ASSET_TARGETS.map(async ([sourcePath, buildPath, publicPath, cachePolicy]) =>
    createReleaseAssetEntry({
      sourcePath,
      buildPath,
      publicPath,
      cachePolicy,
      source: await readFile(new URL(`../${sourcePath}`, import.meta.url)),
      build: await readFile(new URL(`../${buildPath}`, import.meta.url))
    })));
  const manifest = {
    version: 1,
    buildSha: source.buildSha,
    schemaVersion,
    createdAt: new Date().toISOString(),
    files
  };
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  await mkdir(new URL("../artifacts/", import.meta.url), { recursive: true });
  await writeFile(new URL("../artifacts/release-asset-manifest.json", import.meta.url), serialized, "utf8");
  await writeFile(new URL("../client/release-asset-manifest.json", import.meta.url), serialized, "utf8");
  console.log(`Created release asset manifest for ${source.buildSha} with ${files.length} critical assets.`);
}
