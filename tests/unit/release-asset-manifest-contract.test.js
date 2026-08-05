import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createReleaseAssetEntry,
  RELEASE_ASSET_TARGETS,
  sha256Hex,
  shouldCreateReleaseAssetManifest
} from "../../scripts/release-asset-manifest-contract.mjs";

describe("release asset manifest contract", () => {
  it("records source and built hashes without embedding file contents", () => {
    expect(createReleaseAssetEntry({
      sourcePath: "admin.html",
      buildPath: "client/admin.html",
      publicPath: "/admin.html",
      cachePolicy: "revalidate",
      source: Buffer.from("source"),
      build: Buffer.from("build")
    })).toEqual({
      sourcePath: "admin.html",
      buildPath: "client/admin.html",
      publicPath: "/admin.html",
      cachePolicy: "revalidate",
      sourceHash: sha256Hex(Buffer.from("source")),
      buildHash: sha256Hex(Buffer.from("build")),
      bytes: 5
    });
  });

  it("covers the critical frontend, gameplay client, CSS and image assets", () => {
    const publicPaths = RELEASE_ASSET_TARGETS.map((entry) => entry[2]);
    expect(publicPaths).toEqual(expect.arrayContaining([
      "/admin.html",
      "/pages/login.html",
      "/pages/game.html",
      "/page-assets/css/styles.css",
      "/page-assets/js/client-assets/gameplay-slice-client.js",
      "/img/logmes.png"
    ]));
  });

  it("creates manifests for releases and safely skips them for local builds", () => {
    expect(shouldCreateReleaseAssetManifest({ publicRelease: true })).toBe(true);
    expect(shouldCreateReleaseAssetManifest({ publicRelease: false })).toBe(false);
    expect(() => shouldCreateReleaseAssetManifest({ publicRelease: false, required: true }))
      .toThrow("RELEASE_ASSET_MANIFEST_REQUIRES_PUBLIC_BUILD");
  });

  it("wires manifest generation into the Netlify publish build", () => {
    const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
    expect(scripts["build:admin:page"]).toContain("node scripts/create-release-asset-manifest.mjs");
    expect(scripts["release:asset-manifest"]).toContain("--required");
  });
});
