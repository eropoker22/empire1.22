import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runner = readFileSync(new URL("../../scripts/run-production-release-smoke.mjs", import.meta.url), "utf8");
const bootstrapSpec = readFileSync(new URL("../e2e/production-release-bootstrap.spec.js", import.meta.url), "utf8");
const incomeSpec = readFileSync(new URL("../e2e/production-release-income.spec.js", import.meta.url), "utf8");

describe("production release smoke runner", () => {
  it("uses canonical server creation and archives only its controlled prefix", () => {
    expect(runner).toContain('displayNamePrefix: "Production Release Smoke"');
    expect(runner).not.toContain("startingPlayerState:");
    expect(runner).toContain('candidate.displayName.startsWith("Production Release Smoke ")');
    expect(runner).toContain('confirmationToken: "DELETE_SERVER"');
  });

  it("sanitizes child environments and rejects skipped or retried browser tests", () => {
    expect(runner).toContain("sanitizedChildEnvironment()");
    expect(runner).toContain("(?:SECRET|PASSWORD|TOKEN|PEPPER|DATABASE_URL)");
    expect(runner).toContain('"--retries=0"');
    expect(runner).toContain('"--trace=off"');
    expect(runner).toContain("summary.counts?.skipped !== 0");
    expect(runner).toContain("summary.counts?.retries !== 0");
  });

  it("disables credential-bearing Playwright artifacts in both specs", () => {
    for (const source of [bootstrapSpec, incomeSpec]) {
      expect(source).toContain('test.use({ trace: "off", screenshot: "off", video: "off" })');
      expect(source).toContain('process.env.EMPIRE_PRODUCTION_REMOTE_SMOKE === "1"');
      expect(source).toContain('publicOrigin !== "https://empirestreets.cz"');
    }
  });
});
