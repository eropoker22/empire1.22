import { describe, expect, it } from "vitest";
import {
  createReleaseAssetEntry,
  RELEASE_ASSET_TARGETS,
  sha256Hex
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
});
