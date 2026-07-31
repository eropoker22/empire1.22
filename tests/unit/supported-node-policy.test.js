import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertSupportedNodeVersion,
  evaluateSupportedNodeVersion,
  formatUnsupportedNodeMessage
} from "../../scripts/supported-node-policy.mjs";

const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

describe("supported Node runtime policy", () => {
  it.each([
    ["20.20.2", false],
    ["22.19.0", false],
    ["24.18.0", true],
    ["v24.0.0", true],
    ["26.3.1", false],
    ["invalid", false],
    ["", false]
  ])("evaluates %s deterministically", (version, supported) => {
    expect(evaluateSupportedNodeVersion(version).supported).toBe(supported);
  });

  it("reports the detected and expected versions with cross-platform guidance", () => {
    expect(() => assertSupportedNodeVersion("26.3.1")).toThrow(/requires Node\.js 24 LTS/u);
    const message = formatUnsupportedNodeMessage("26.3.1");
    expect(message).toContain("Detected Node.js 26.3.1.");
    expect(message).toContain("Expected major version 24");
    expect(message).toContain("Windows:");
    expect(message).toContain("Unix/macOS:");
  });

  it("keeps active repository runtime pins on Node 24 only", () => {
    expect(read(".nvmrc").trim()).toBe("24");
    expect(read(".node-version").trim()).toBe("24");
    expect(JSON.parse(read("package.json")).engines.node).toBe(">=24 <25");
    expect(read("netlify.toml")).toMatch(/NODE_VERSION = "24"/u);
    expect(read("Dockerfile.hosted-worker")).toMatch(/FROM node:24-bookworm-slim/u);
    expect(read("Dockerfile.hosted-worker")).not.toMatch(/FROM node:20/u);
    expect(read("Dockerfile.release-validation")).toMatch(/FROM node:24-bookworm-slim/u);
    expect(read("Dockerfile.release-validation")).not.toMatch(/FROM node:20/u);
    expect(read("vite.netlify-functions.config.ts")).toContain('target: "node24"');
    expect(read("vite.hosted-worker.config.ts")).toContain('target: "node24"');
    expect(read("vite.local-hosted-runtime.config.ts")).toContain('target: "node24"');
    expect(read(".github/workflows/quality.yml")).toContain("node-version-file: .node-version");
    expect(read(".github/workflows/deep-checks.yml")).toContain("node-version-file: .node-version");
    expect(read("package.json")).not.toContain("require-node20.mjs");
  });
});
