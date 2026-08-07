import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");

describe("local hosted runtime startup contract", () => {
  it("treats .env.local as optional for clean CI checkouts", () => {
    const harness = read("scripts/run-local-hosted-full.mjs");
    expect(harness).toContain('existsSync(".env.local")');
    expect(harness).toContain('if (process.env.CI === "true")');
    expect(harness).toContain("Hosted CI must use its generated environment");
    expect(harness).toContain('error?.code !== "ENOENT"');
  });

  it("reaches the explicit database preflight from a clean CI cwd without .env.local", () => {
    const cleanCwd = mkdtempSync(resolve(tmpdir(), "empire-hosted-clean-ci-"));
    try {
      const environment = { ...process.env, CI: "true" };
      delete environment.EMPIRE_DATABASE_URL;
      delete environment.EMPIRE_TEST_DATABASE_URL;
      delete environment.GAMEPLAY_DATABASE_URL;
      const result = spawnSync(
        process.execPath,
        [resolve(root, "scripts/run-local-hosted-full.mjs"), "--suite=income"],
        { cwd: cleanCwd, env: environment, encoding: "utf8", windowsHide: true }
      );
      const diagnostic = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
      expect(result.status).not.toBe(0);
      expect(diagnostic).not.toMatch(/ENOENT[^\n]*\.env\.local/iu);
      expect(diagnostic).toMatch(/database|EMPIRE_TEST_DATABASE_URL/iu);
    } finally {
      rmSync(cleanCwd, { recursive: true, force: true });
    }
  });

  it("points Playwright at the frontend already managed by the hosted harness", () => {
    const harness = read("scripts/run-local-hosted-full.mjs");

    expect(harness).toContain("PLAYWRIGHT_E2E_BASE_URL: browserOrigin");
    expect(harness).toContain('PLAYWRIGHT_SKIP_WEB_SERVER: "1"');
  });

  it("prebuilds setup, long-lived Node entrypoints and the scenario seed CLI", () => {
    const config = read("vite.local-hosted-runtime.config.ts");

    expect(config).toContain('target: "node24"');
    expect(config).toContain('"hosted-dev-http"');
    expect(config).toContain('"hosted-runtime-worker"');
    expect(config).toContain('"hosted-e2e-scenario"');
    expect(config).toContain('"database-migrations"');
    expect(config).toContain('"bootstrap-admin-user"');
    expect(config).toContain('"generate-browser-gameplay-config"');
    expect(config).toContain('copyPublicDir: false');
    expect(config).toContain('basename(outputDirectory) !== "runtime-bundle"');
    expect(config).toContain("must target a runtime-bundle directory under .tmp/local-hosted-full");
  });

  it("runs setup CLIs from the prebuilt runtime bundle", () => {
    const harness = read("scripts/run-local-hosted-full.mjs");
    const buildAt = harness.indexOf('await runNode("hosted-runtime-bundle"');
    const migrationsAt = harness.indexOf('await runNode("migrations"');
    const adminBootstrapAt = harness.indexOf('await runNode("admin-bootstrap"');
    const browserConfigAt = harness.indexOf('await runNode("browser-config"');
    const clientBuildAt = harness.indexOf('await runNode("client-bundle"');
    const setupBranch = harness.slice(migrationsAt, clientBuildAt);

    expect(buildAt).toBeGreaterThan(0);
    expect(migrationsAt).toBeGreaterThan(buildAt);
    expect(adminBootstrapAt).toBeGreaterThan(migrationsAt);
    expect(browserConfigAt).toBeGreaterThan(adminBootstrapAt);
    expect(setupBranch).toContain("databaseMigrationsBundlePath");
    expect(setupBranch).toContain("adminBootstrapBundlePath");
    expect(setupBranch).toContain("browserConfigBundlePath");
    expect(setupBranch).not.toContain("vite-node/vite-node.mjs");
    expect(read("scripts/database-migrations.ts")).toContain(")}${sep}`)");
    expect(read("scripts/bootstrap-admin-user.ts")).toContain(")}${sep}`)");
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

  it("runs scenario seeds from the prebuilt runtime bundle", () => {
    const harness = read("scripts/run-local-hosted-full.mjs");
    const scenarioAt = harness.indexOf("const scenario =");
    const serverStartAt = harness.indexOf('result.status = "starting-server"', scenarioAt);
    const scenarioBranch = harness.slice(scenarioAt, serverStartAt);

    expect(harness).toContain('const hostedE2eScenarioBundlePath = path.join(runtimeBundleDirectory, "hosted-e2e-scenario.mjs")');
    expect(scenarioBranch).toContain("hostedE2eScenarioBundlePath");
    expect(scenarioBranch).not.toContain("run-local-bin.mjs");
    expect(scenarioBranch).not.toContain("vite-node/vite-node.mjs");
  });

  it("keeps credential-bearing Playwright traces off while retaining safe manual evidence", () => {
    const harness = read("scripts/run-local-hosted-full.mjs");
    const manualSpec = read("tests/e2e/manual-hosted-admin-player-flow.spec.js");
    const manualBranchAt = harness.indexOf("if (suite.manualProvisioning)");
    const fixtureBranchAt = harness.indexOf("if (suite.buildingActionPhase)", manualBranchAt);
    const manualBranch = harness.slice(manualBranchAt, fixtureBranchAt);

    expect(manualBranch).toContain('result.evidence.trace = "playwright-trace-off-credential-safety"');
    expect(manualBranch).not.toContain('"--trace"');
    expect(manualBranch).toContain('"--output"');
    expect(manualBranch).toContain("safeBrowserArtifactDirectory");
    expect(manualBranch).toContain("manualArtifactDirectory");
    expect(manualSpec).toContain('test.use({ trace: "off", video: "off" })');
    expect(manualSpec).toContain('testInfo.attach("manual-hosted-safe-trace.json"');
  });

  it("retains every Playwright run in a suite-specific artifact directory", () => {
    const harness = read("scripts/run-local-hosted-full.mjs");
    const bootstrapAt = harness.indexOf("result.status = \"bootstrapping-player\"");
    const scenarioAt = harness.indexOf("const scenario =", bootstrapAt);
    const bootstrapBranch = harness.slice(bootstrapAt, scenarioAt);
    const groupedRunsAt = harness.indexOf("const playwrightGroups =", scenarioAt);
    const suitePassedAt = harness.indexOf('result.status = "passed"', groupedRunsAt);
    const groupedRunsBranch = harness.slice(groupedRunsAt, suitePassedAt);

    expect(harness).toContain('path.join(browserArtifactRunDirectory, "playwright", result.name, phase)');
    expect(harness).toContain("EMPIRE_LOCAL_HOSTED_BROWSER_ARTIFACT_ROOT");
    expect(harness).toContain("browserArtifactRunDirectory");
    expect(harness).toContain("browser: browserArtifactRunDirectory");
    expect(harness).toContain("playwrightArtifactDirectories: []");
    expect(bootstrapBranch).toContain('retainPlaywrightArtifacts(result, "bootstrap")');
    expect(bootstrapBranch).toContain('"--output"');
    expect(bootstrapBranch).toContain("bootstrapArtifactDirectory");
    expect(groupedRunsBranch).toContain("retainPlaywrightArtifacts(result, group.name)");
    expect(groupedRunsBranch).toContain('"--output"');
    expect(groupedRunsBranch).toContain("groupArtifactDirectory");
  });

  it("reports each suite's actual gameplay interaction evidence", () => {
    const harness = read("scripts/run-local-hosted-full.mjs");
    const suiteMetadata = Object.fromEntries(
      [...harness.matchAll(
        /Object\.freeze\(\{\s+name: "([^"]+)",\s+gameplayInteraction: "([^"]+)"/gu
      )].map((match) => [match[1], match[2]])
    );

    expect(suiteMetadata).toEqual({
      "manual-admin-player": "visible-browser-ui",
      "canonical-20p-registration": "visible-browser-ui",
      "city-events": "visible-browser-ui",
      "ui-parity": "visible-browser-opening-and-observation",
      "ui-parity-social": "visible-browser-opening-and-observation",
      "district-selection-race": "browser-runtime-api-and-visible-opening-observation",
      "production-pharmacy": "visible-browser-ui",
      "production-drug-lab": "visible-browser-ui",
      "production-factory": "visible-browser-ui",
      "production-armory": "visible-browser-ui",
      income: "browser-authoritative-state-observation",
      "building-actions-day": "direct-authoritative-api",
      "building-actions-night": "direct-authoritative-api",
      "building-actions-visible-ui-day": "visible-browser-ui",
      "building-actions-visible-ui-night": "visible-browser-ui",
      "ui-parity-non-spawn": "visible-browser-opening-and-observation",
      "multiplayer-core": "direct-authoritative-api",
      "multiplayer-visible-actions": "mixed-visible-browser-ui-and-parity-observation",
      "social-visible-ui": "visible-browser-ui",
      "social-concurrency-privacy": "mixed-visible-browser-ui-and-direct-authoritative-api",
      "lifecycle-stop": "mixed-visible-admin-ui-and-direct-authoritative-api"
    });
    expect(harness).toContain("gameplayInteraction: suite.gameplayInteraction");
  });
});
