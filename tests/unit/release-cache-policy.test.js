import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = readFileSync("netlify.toml", "utf8");

describe("public release cache policy", () => {
  it.each([
    "/*.html",
    "/pages/*",
    "/page-assets/*",
    "/packages/*",
    "/img/*",
    "/release-asset-manifest.json"
  ])("revalidates unversioned public path %s", (path) => {
    const block = headerBlock(path);
    expect(block).toContain('Cache-Control = "public, max-age=0, must-revalidate"');
  });

  it("keeps future fingerprinted assets immutable", () => {
    expect(headerBlock("/assets/*")).toContain(
      'Cache-Control = "public, max-age=31536000, immutable"'
    );
  });
});

const headerBlock = (path) => {
  const marker = `for = "${path}"`;
  const start = config.indexOf(marker);
  const end = config.indexOf("\n[[", start);
  return start < 0 ? "" : config.slice(start, end < 0 ? undefined : end);
};
