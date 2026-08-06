import { describe, expect, it } from "vitest";
import {
  assertReleaseCacheControl,
  buildRemoteReleaseUrl,
  extractFrontendBuildSha,
  normalizeExactHttpsOrigin,
  validateRemoteAssetManifest,
  validateRemoteReleaseHealth
} from "../../scripts/remote-release-contract.mjs";

const sha = "a".repeat(40);
const schema = "024_hosted_starting_player_state.sql";

describe("remote release contract", () => {
  it("accepts exact HTTPS origins and extracts the frontend SHA", () => {
    expect(normalizeExactHttpsOrigin("https://staging.empirestreets.cz")).toBe("https://staging.empirestreets.cz");
    expect(extractFrontendBuildSha(`<meta name="empire-build-sha" content="${sha}">`)).toBe(sha);
    expect(() => normalizeExactHttpsOrigin("http://localhost:8888")).toThrow("REMOTE_RELEASE_ORIGIN_INVALID");
  });

  it("adds release cache-busting only when the target accepts query parameters", () => {
    expect(buildRemoteReleaseUrl({
      origin: "https://staging.empirestreets.cz",
      path: "/release-asset-manifest.json",
      sha
    }).href).toBe(`https://staging.empirestreets.cz/release-asset-manifest.json?release-sha=${sha}`);
    expect(buildRemoteReleaseUrl({
      origin: "https://empire-streets-staging-worker.fly.dev",
      path: "/health",
      sha,
      includeReleaseSha: false
    }).href).toBe("https://empire-streets-staging-worker.fly.dev/health");
  });

  it("enforces revalidated and immutable cache policies", () => {
    expect(() => assertReleaseCacheControl("public, max-age=0, must-revalidate", "revalidate")).not.toThrow();
    expect(() => assertReleaseCacheControl("public, max-age=31536000, immutable", "immutable")).not.toThrow();
    expect(() => assertReleaseCacheControl("public, max-age=3600", "revalidate")).toThrow("REMOTE_ASSET_CACHE_POLICY_INVALID");
  });

  it("requires exact frontend, API, worker, schema, environment and region parity", () => {
    const common = {
      buildSha: sha,
      environment: "staging",
      schemaVersion: schema,
      expectedSchemaVersion: schema
    };
    expect(validateRemoteReleaseHealth({
      api: { ...common, region: "us-east-2", status: "ready", apiBuildSha: sha },
      worker: { ...common, region: "fra", status: "ok", heartbeat: { registered: true } },
      expectedSha: sha,
      expectedSchemaVersion: schema,
      expectedEnvironment: "staging",
      expectedApiRegion: "us-east-2",
      expectedWorkerRegion: "fra"
    })).toMatchObject({
      frontendSha: sha,
      apiSha: sha,
      workerSha: sha,
      apiRegion: "us-east-2",
      workerRegion: "fra"
    });
  });

  it("rejects a stale worker and a changed asset manifest", () => {
    const common = { buildSha: sha, environment: "staging", region: "fra", schemaVersion: schema, expectedSchemaVersion: schema };
    expect(() => validateRemoteReleaseHealth({
      api: { ...common, status: "ready", apiBuildSha: sha },
      worker: { ...common, buildSha: "b".repeat(40), status: "ok", heartbeat: { registered: true } },
      expectedSha: sha,
      expectedSchemaVersion: schema,
      expectedEnvironment: "staging",
      expectedRegion: "fra"
    })).toThrow("REMOTE_WORKER_RELEASE_MISMATCH");
    const manifest = { version: 1, buildSha: sha, schemaVersion: schema, files: [{
      publicPath: "/admin.html", sourceHash: "c".repeat(64), buildHash: "d".repeat(64), cachePolicy: "revalidate"
    }] };
    expect(() => validateRemoteAssetManifest({ ...manifest, buildSha: "b".repeat(40) }, manifest, sha, schema))
      .toThrow("REMOTE_ASSET_MANIFEST_MISMATCH");
  });
});
