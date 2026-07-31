import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");

describe("local hosted runtime startup contract", () => {
  it("prebuilds both long-lived Node entrypoints", () => {
    const config = read("vite.local-hosted-runtime.config.ts");

    expect(config).toContain('target: "node24"');
    expect(config).toContain('"hosted-dev-http"');
    expect(config).toContain('"hosted-runtime-worker"');
    expect(config).toContain('copyPublicDir: false');
    expect(config).toContain('basename(outputDirectory) !== "runtime-bundle"');
    expect(config).toContain("must target a runtime-bundle directory under .tmp/local-hosted-full");
  });

  it("starts and restarts runtime services without the synchronous local-bin wrapper", () => {
    const harness = read("scripts/run-local-hosted-full.mjs");
    const buildAt = harness.indexOf('await runNode("hosted-runtime-bundle"');
    const apiStartAt = harness.indexOf('name: "hosted-api"');
    const frontendStartAt = harness.indexOf('name: "frontend"', apiStartAt);
    const runtimeStartup = harness.slice(apiStartAt, frontendStartAt);

    expect(buildAt).toBeGreaterThan(0);
    expect(apiStartAt).toBeGreaterThan(buildAt);
    expect(frontendStartAt).toBeGreaterThan(apiStartAt);
    expect(runtimeStartup).toContain("args: [hostedApiBundlePath]");
    expect(runtimeStartup).toContain("args: [hostedWorkerBundlePath]");
    expect(runtimeStartup).not.toContain("run-local-bin.mjs");
    expect(runtimeStartup).not.toContain("vite-node/vite-node.mjs");
    expect(harness.match(/args: \[hostedWorkerBundlePath\]/gu)).toHaveLength(2);
  });

  it("retains a Playwright trace for the real manual admin flow", () => {
    const harness = read("scripts/run-local-hosted-full.mjs");
    const manualBranchAt = harness.indexOf("if (suite.manualProvisioning)");
    const fixtureBranchAt = harness.indexOf("if (suite.buildingActionPhase)", manualBranchAt);
    const manualBranch = harness.slice(manualBranchAt, fixtureBranchAt);

    expect(manualBranch).toContain('result.evidence.trace = "playwright-trace-on"');
    expect(manualBranch).toContain('"--trace"');
    expect(manualBranch).toContain('"on"');
    expect(manualBranch).toContain('"--output"');
    expect(manualBranch).toContain("manualTraceDirectory");
  });
});
