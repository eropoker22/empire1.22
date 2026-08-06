const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const SCHEMA_PATTERN = /^\d{3}_[a-z0-9_]+\.sql$/u;

export const normalizeExactHttpsOrigin = (value, code = "REMOTE_RELEASE_ORIGIN_INVALID") => {
  try {
    const parsed = new URL(String(value ?? "").trim());
    if (parsed.protocol !== "https:" || parsed.origin !== String(value).trim()
      || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      throw new Error(code);
    }
    return parsed.origin;
  } catch (error) {
    if (error instanceof Error && error.message === code) throw error;
    throw new Error(code);
  }
};

export const buildRemoteReleaseUrl = ({ origin, path, sha, includeReleaseSha = true }) => {
  const url = new URL(path, origin);
  if (includeReleaseSha) url.searchParams.set("release-sha", sha);
  return url;
};

export const extractFrontendBuildSha = (html) => {
  const tag = /<meta\b[^>]*\bname=["']empire-build-sha["'][^>]*>/iu.exec(String(html))?.[0] ?? "";
  const sha = /\bcontent=["']([0-9a-f]{40})["']/iu.exec(tag)?.[1] ?? null;
  if (!sha) throw new Error("REMOTE_FRONTEND_BUILD_SHA_MISSING");
  return sha;
};

export const assertReleaseCacheControl = (value, policy) => {
  const directives = new Set(String(value ?? "").toLowerCase().split(",").map((entry) => entry.trim()));
  if (policy === "immutable") {
    if (!directives.has("public") || !directives.has("max-age=31536000") || !directives.has("immutable")) {
      throw new Error("REMOTE_ASSET_CACHE_POLICY_INVALID");
    }
    return;
  }
  if (!directives.has("max-age=0") || !directives.has("must-revalidate")) {
    throw new Error("REMOTE_ASSET_CACHE_POLICY_INVALID");
  }
};

export const validateRemoteReleaseHealth = ({
  api,
  worker,
  expectedSha,
  expectedSchemaVersion,
  expectedEnvironment,
  expectedRegion,
  expectedApiRegion = expectedRegion,
  expectedWorkerRegion = expectedRegion
}) => {
  if (!SHA_PATTERN.test(String(expectedSha)) || !SCHEMA_PATTERN.test(String(expectedSchemaVersion))
    || !String(expectedApiRegion ?? "").trim() || !String(expectedWorkerRegion ?? "").trim()) {
    throw new Error("REMOTE_RELEASE_EXPECTATION_INVALID");
  }
  const common = (value) => value?.buildSha === expectedSha
    && value?.environment === expectedEnvironment
    && value?.schemaVersion === expectedSchemaVersion
    && value?.expectedSchemaVersion === expectedSchemaVersion;
  if (api?.status !== "ready" || api?.apiBuildSha !== expectedSha
    || api?.region !== expectedApiRegion || !common(api)) {
    throw new Error("REMOTE_API_RELEASE_MISMATCH");
  }
  if (worker?.status !== "ok" || worker?.heartbeat?.registered !== true
    || worker?.region !== expectedWorkerRegion || !common(worker)) {
    throw new Error("REMOTE_WORKER_RELEASE_MISMATCH");
  }
  return {
    frontendSha: expectedSha,
    apiSha: api.apiBuildSha,
    workerSha: worker.buildSha,
    schemaVersion: expectedSchemaVersion,
    environment: expectedEnvironment,
    apiRegion: expectedApiRegion,
    workerRegion: expectedWorkerRegion
  };
};

export const validateRemoteAssetManifest = (remote, local, expectedSha, expectedSchemaVersion) => {
  if (remote?.version !== 1 || remote.buildSha !== expectedSha || remote.schemaVersion !== expectedSchemaVersion
    || JSON.stringify(remote) !== JSON.stringify(local) || !Array.isArray(remote.files) || remote.files.length === 0) {
    throw new Error("REMOTE_ASSET_MANIFEST_MISMATCH");
  }
  for (const file of remote.files) {
    if (!/^\/[A-Za-z0-9._/-]+$/u.test(String(file.publicPath ?? ""))
      || !/^[0-9a-f]{64}$/u.test(String(file.sourceHash ?? ""))
      || !/^[0-9a-f]{64}$/u.test(String(file.buildHash ?? ""))
      || !["revalidate", "immutable"].includes(file.cachePolicy)) {
      throw new Error("REMOTE_ASSET_MANIFEST_INVALID");
    }
  }
  return remote.files;
};
