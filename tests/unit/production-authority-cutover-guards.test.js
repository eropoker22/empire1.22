import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

describe("production authority cutover guards", () => {
  it("keeps development fixtures outside the live import graph", () => {
    const result = spawnSync(process.execPath, ["scripts/check-production-fixture-boundary.mjs"], {
      cwd: root,
      encoding: "utf8"
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain("Production fixture boundary OK");
  });

  it("injects and renders admin-only build diagnostics", () => {
    expect(read("admin.html")).toContain('meta name="empire-build-sha" content="__EMPIRE_BUILD_SHA__"');
    expect(read("scripts/build-netlify-client.mjs")).toContain('.replace("__EMPIRE_BUILD_SHA__", adminBuildSha)');
    const adminView = read("apps/admin/src/app/read-only-admin-page.ts");
    expect(adminView).toContain('kv("Frontend SHA"');
    expect(adminView).toContain('kv("API SHA"');
    expect(adminView).toContain('kv("Worker SHA"');
    expect(adminView).toContain('kv("Schema"');
  });

  it("documents public registration without invitation authority", () => {
    const cutover = read("docs/production-authority-cutover.md");
    expect(cutover).toContain("There is no invite field and no invite authority.");
    expect(cutover).toContain("password confirmation");
    expect(cutover).toContain("minimum age of 16 years");
  });
});
