import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("browser config generator runner", () => {
  it("uses a bounded esbuild runner instead of the hanging vite-node path", () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
    const runner = readFileSync(
      resolve(process.cwd(), "scripts/run-browser-config-generator.mjs"),
      "utf8"
    );

    expect(packageJson.scripts["generate:browser-config"])
      .toBe("node scripts/run-browser-config-generator.mjs");
    expect(packageJson.scripts["check:browser-config"])
      .toBe("node scripts/run-browser-config-generator.mjs --check");
    expect(runner).toContain("bundle: true");
    expect(runner).toContain("spawnSync(process.execPath");
    expect(runner).not.toContain("vite-node");
  });
});
