import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sha256Hex } from "./release-asset-manifest-contract.mjs";
import {
  assertReleaseCacheControl,
  buildRemoteReleaseUrl,
  extractFrontendBuildSha,
  normalizeExactHttpsOrigin,
  validateRemoteAssetManifest,
  validateRemoteReleaseHealth
} from "./remote-release-contract.mjs";

const publicOrigin = normalizeExactHttpsOrigin(process.env.EMPIRE_PUBLIC_ORIGIN, "REMOTE_PUBLIC_ORIGIN_INVALID");
const workerOrigin = normalizeExactHttpsOrigin(process.env.EMPIRE_HOSTED_WORKER_ORIGIN, "REMOTE_WORKER_ORIGIN_INVALID");
const expectedSha = String(process.env.EMPIRE_BUILD_SHA ?? "").trim();
const expectedEnvironment = String(process.env.EMPIRE_RELEASE_ENVIRONMENT ?? "").trim();
const expectedApiRegion = String(process.env.EMPIRE_RUNTIME_REGION ?? "").trim();
const expectedWorkerRegion = String(process.env.EMPIRE_HOSTED_WORKER_REGION ?? "").trim();
const localAssetText = await readFile("artifacts/release-asset-manifest.json", "utf8");
const localAssetManifest = JSON.parse(localAssetText);
const releaseManifest = JSON.parse(await readFile("artifacts/release-manifest.json", "utf8"));
const expectedSchemaVersion = String(releaseManifest.expectedSchemaVersion ?? "");

const manifestResponse = await fetchRelease(publicOrigin, "/release-asset-manifest.json", expectedSha);
assertReleaseCacheControl(manifestResponse.headers.get("cache-control"), "revalidate");
const remoteAssetText = await manifestResponse.text();
const remoteAssetManifest = JSON.parse(remoteAssetText);
const assets = validateRemoteAssetManifest(remoteAssetManifest, localAssetManifest, expectedSha, expectedSchemaVersion);
if (sha256Hex(remoteAssetText) !== sha256Hex(localAssetText)) throw new Error("REMOTE_ASSET_MANIFEST_HASH_MISMATCH");

const deployedAssets = [];
let frontendBuildSha = null;
for (const asset of assets) {
  const response = await fetchRelease(publicOrigin, asset.publicPath, expectedSha);
  assertReleaseCacheControl(response.headers.get("cache-control"), asset.cachePolicy);
  const bytes = Buffer.from(await response.arrayBuffer());
  const deployedHash = sha256Hex(bytes);
  if (deployedHash !== asset.buildHash) throw new Error(`REMOTE_ASSET_HASH_MISMATCH:${asset.publicPath}`);
  if (asset.publicPath === "/admin.html") frontendBuildSha = extractFrontendBuildSha(bytes.toString("utf8"));
  deployedAssets.push({
    publicPath: asset.publicPath,
    sourceHash: asset.sourceHash,
    buildHash: asset.buildHash,
    deployedHash,
    cachePolicy: asset.cachePolicy
  });
}
if (frontendBuildSha !== expectedSha) throw new Error("REMOTE_FRONTEND_BUILD_SHA_MISMATCH");

const apiResponse = await fetchRelease(publicOrigin, "/api/health", expectedSha);
assertNoStore(apiResponse.headers.get("cache-control"));
const api = await apiResponse.json();
const workerResponse = await fetchRelease(workerOrigin, "/health", expectedSha, { includeReleaseSha: false });
assertNoStore(workerResponse.headers.get("cache-control"));
const worker = await workerResponse.json();
const parity = validateRemoteReleaseHealth({
  api,
  worker,
  expectedSha,
  expectedSchemaVersion,
  expectedEnvironment,
  expectedApiRegion,
  expectedWorkerRegion
});

const evidence = {
  checkedAt: new Date().toISOString(),
  publicOrigin,
  workerOrigin,
  ...parity,
  frontendSha: frontendBuildSha,
  assetManifestHash: sha256Hex(remoteAssetText),
  assets: deployedAssets
};
const outputPath = String(process.env.EMPIRE_REMOTE_RELEASE_EVIDENCE_PATH ?? "artifacts/remote-release-health.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(`Remote release parity verified for ${expectedSha} with ${deployedAssets.length} assets.`);

async function fetchRelease(origin, path, sha, options = {}) {
  const url = buildRemoteReleaseUrl({ origin, path, sha, ...options });
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
    headers: { "cache-control": "no-cache" }
  });
  if (!response.ok || new URL(response.url).origin !== origin) {
    throw new Error(`REMOTE_RELEASE_FETCH_FAILED:${path}:${response.status}`);
  }
  return response;
}

function assertNoStore(value) {
  if (!String(value ?? "").toLowerCase().split(",").map((entry) => entry.trim()).includes("no-store")) {
    throw new Error("REMOTE_HEALTH_CACHE_POLICY_INVALID");
  }
}
