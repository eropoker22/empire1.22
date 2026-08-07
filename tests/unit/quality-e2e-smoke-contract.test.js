import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  QUALITY_LIVE_SMOKE_FORBIDDEN_SPECS,
  QUALITY_LIVE_SMOKE_SPECS
} from "../../scripts/playwright-e2e-smoke-contract.mjs";

const qualityWorkflow = readFileSync(".github/workflows/quality.yml", "utf8");

describe("Quality live-only browser smoke contract", () => {
  it("uses the exact public live-only allowlist", () => {
    expect(QUALITY_LIVE_SMOKE_SPECS).toEqual([
      "tests/e2e/admin-read-only.spec.js",
      "tests/e2e/login-smoke.spec.js",
      "tests/e2e/live-authority-fail-closed.spec.js"
    ]);
    expect(new Set(QUALITY_LIVE_SMOKE_SPECS).size).toBe(QUALITY_LIVE_SMOKE_SPECS.length);
    for (const spec of QUALITY_LIVE_SMOKE_SPECS) {
      expect(existsSync(spec), spec).toBe(true);
    }
  });

  it("keeps guest and local-demo fixtures outside the Quality release smoke", () => {
    for (const forbidden of QUALITY_LIVE_SMOKE_FORBIDDEN_SPECS) {
      expect(QUALITY_LIVE_SMOKE_SPECS).not.toContain(forbidden);
    }
    expect(QUALITY_LIVE_SMOKE_SPECS).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/(?:^|\/)(?:local-demo|live-demo)[^/]*\.spec\.js$/u)
    ]));

    for (const spec of QUALITY_LIVE_SMOKE_SPECS) {
      const source = readFileSync(spec, "utf8");
      expect(source).not.toContain("localDemoEnabled: true");
      expect(source).not.toContain("window.__EMPIRE_E2E__ = true");
      expect(source).not.toContain("loginKind: \"guest\"");
      expect(source).not.toContain("isGuest: true");
      expect(source).not.toMatch(/guest-login-button[^\n]+toBeVisible/u);
      expect(source).not.toMatch(/executionMode[^\n]+toBe\(["']local-demo["']\)/u);
    }
  });

  it("keeps workflow routing canonical and retries disabled", () => {
    expect(qualityWorkflow).toContain("run: npm run test:e2e:smoke");
    expect(qualityWorkflow).not.toContain("test:e2e:full");
    expect(qualityWorkflow).not.toContain("--all");
    for (const forbidden of QUALITY_LIVE_SMOKE_FORBIDDEN_SPECS) {
      expect(qualityWorkflow).not.toContain(forbidden);
    }
    const playwrightConfig = readFileSync("playwright.config.ts", "utf8");
    expect(playwrightConfig).toContain("failOnFlakyTests: Boolean(process.env.CI)");
    expect(playwrightConfig).toContain("retries: 0");
  });
});
