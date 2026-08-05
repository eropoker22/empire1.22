import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const staging = readFileSync(".github/workflows/deploy-staging.yml", "utf8");
const hosted = readFileSync(".github/workflows/hosted-acceptance.yml", "utf8");
const quality = readFileSync(".github/workflows/quality.yml", "utf8");
const remote = readFileSync(".github/workflows/staging-remote-acceptance.yml", "utf8");
const fly = readFileSync("fly.hosted-worker.toml", "utf8");

describe("public release workflows", () => {
  it("deploys staging only behind exact successful hosted acceptance evidence", () => {
    expect(staging).toContain("Hosted Acceptance");
    expect(staging).toContain(".head_sha == $sha");
    expect(staging).toContain(".conclusion == \"success\"");
    for (const suite of ["manual-admin-player", "ui-parity", "production-pharmacy", "social-concurrency-privacy", "lifecycle-stop"]) {
      expect(staging).toContain(suite);
      expect(hosted).toContain(`suite: ${suite}`);
    }
  });

  it("keeps release ordering guarded and registration closed", () => {
    const order = [
      "Create Neon pre-migration snapshot",
      "Initialize empty staging migration history",
      "Record pending migrations",
      "Apply migrations exactly once",
      "Verify current schema",
      "Verify transaction-pooled API connection",
      "Build frontend, API and worker image",
      "Deploy Netlify staging site",
      "Deploy exactly one persistent worker",
      "Wait for API and worker health",
      "Verify remote SHA and asset parity"
    ].map((label) => staging.indexOf(label));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((left, right) => left - right));
    expect(staging).toContain("EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: \"false\"");
    expect(staging).toContain("--context production");
    expect(staging).not.toContain("--context deploy-preview");
    expect(staging).toContain("npm run db:migrate:initialize-release-history");
    expect(staging).toContain("npm run verify:database-endpoints");
    expect(staging).toContain("npm run verify:database-pooling");
    expect(staging).toContain("npm run release:asset-manifest");
    expect(staging).toContain("npm run verify:remote-release");
    expect(staging).toContain(".schemaVersion == $schema");
    expect(staging).toContain("inputs.bootstrap_admin");
    expect(staging).toContain("set_function_secret EMPIRE_ADMIN_SESSION_SECRET");
    expect(staging).toContain("--secret --scope functions --context production");
  });

  it("builds and deploys one SHA-tagged Fly worker with health and restart controls", () => {
    expect(staging).toContain('registry.fly.io/${FLY_STAGING_APP}:${RELEASE_SHA}');
    expect(staging).toContain("--ha=false");
    expect(staging).toContain("flyctl scale count 1");
    expect(fly).toContain('auto_stop_machines = "off"');
    expect(fly).toContain('min_machines_running = 1');
    expect(fly).toContain('policy = "on-failure"');
    expect(fly).toContain('path = "/health"');
  });

  it("never configures runtime credentials for Netlify deploy previews", () => {
    expect(staging).not.toMatch(/env:set\s+(?:EMPIRE|GAMEPLAY)_DATABASE_URL[^\n]+deploy-preview/u);
    expect(staging).not.toContain("NETLIFY_AUTH_TOKEN=");
    expect(staging).not.toContain("NEON_API_KEY=");
    expect(staging).not.toContain("FLY_API_TOKEN=");
  });

  it("installs pinned tools before credentials and keeps secrets out of job scope", () => {
    const deployJob = staging.slice(staging.indexOf("  deploy:"));
    const jobEnvironment = deployJob.match(/\n    env:\n([\s\S]*?)\n    steps:/u)?.[1] ?? "";
    const dependencyIndex = staging.indexOf("Install exact dependencies");
    const netlifyIndex = staging.indexOf("Install pinned Netlify CLI");
    const flyIndex = staging.indexOf("Setup pinned Fly CLI");
    const credentialIndex = staging.indexOf("Validate required deployment inputs");
    expect(jobEnvironment).not.toMatch(/\$\{\{\s*secrets\./u);
    expect(Math.max(dependencyIndex, netlifyIndex, flyIndex)).toBeLessThan(credentialIndex);
    expect(staging).not.toContain('>> "$GITHUB_ENV"');
    expect(staging).not.toMatch(/uses:\s+[^\s]+@v\d/u);
    expect(hosted).not.toMatch(/uses:\s+[^\s]+@v\d/u);
    expect(hosted.indexOf("Install Playwright Chromium")).toBeLessThan(hosted.indexOf("Generate ephemeral CI secrets"));
  });

  it("does not grant API or admin-only secrets to the worker", () => {
    const workerSecretStep = staging.slice(
      staging.indexOf("Stage worker runtime secrets"),
      staging.indexOf("Deploy exactly one persistent worker")
    );
    expect(workerSecretStep).toContain("GAMEPLAY_SLICE_SESSION_SECRET");
    expect(workerSecretStep).toContain("GAMEPLAY_SLICE_SNAPSHOT_SECRET");
    expect(workerSecretStep).not.toContain("EMPIRE_ADMIN_FINGERPRINT_SECRET");
    expect(workerSecretStep).not.toContain("EMPIRE_ADMIN_SESSION_SECRET");
    expect(workerSecretStep).not.toContain("EMPIRE_AUTH_THROTTLE_PEPPER");
  });

  it("keeps the PR workflow explicit, parallel and pinned", () => {
    for (const command of [
      "test:unit",
      "test:integration",
      "test:server",
      "test:persistence",
      "test:read-models",
      "test:e2e:smoke",
      "build:admin:page",
      "build:hosted-worker",
      "lint",
      "typecheck"
    ]) {
      expect(quality).toContain(command);
    }
    expect(quality).toContain("strategy:");
    expect(quality).toContain("fail-fast: false");
    expect(quality).not.toMatch(/uses:\s+[^\s]+@v\d/u);
    expect(quality.indexOf("Install Playwright Chromium")).toBeLessThan(
      quality.indexOf("run: npm run test:e2e:smoke")
    );
  });

  it("runs the complete remote staging matrix against the exact deployed SHA", () => {
    expect(remote).toContain('name: Staging Remote Acceptance');
    expect(remote).toContain('.name == "Deploy Staging"');
    expect(remote).toContain('.head_sha == $sha');
    expect(remote).toContain('staging-release-${RELEASE_SHA}');
    expect(remote).toContain('https://staging.empirestreets.cz');
    expect(remote).not.toContain('http://localhost');
    for (const suite of [
      "manual-admin-player",
      "ui-parity",
      "ui-parity-social",
      "production-pharmacy",
      "production-drug-lab",
      "production-factory",
      "production-armory",
      "income",
      "building-actions-day",
      "building-actions-night",
      "ui-parity-non-spawn",
      "multiplayer-visible-actions",
      "city-events",
      "social-visible-ui",
      "social-concurrency-privacy",
      "lifecycle-stop"
    ]) {
      expect(remote).toContain(`suite: ${suite}`);
    }
    expect(remote).toContain("max-parallel: 1");
    expect(remote).toContain("npm run test:remote-staging:suite");
  });

  it("measures staging load and closes registration on every completed gate path", () => {
    expect(remote).toContain("npm run test:remote-staging:load-soak");
    expect(remote).toContain("EMPIRE_REMOTE_MAX_DB_CONNECTIONS");
    expect(remote).toContain("EMPIRE_REMOTE_MAX_WORKER_MEMORY_BYTES");
    expect(remote).toContain("EMPIRE_REMOTE_MAX_WORKER_CPU_PCT");
    expect(remote).toContain("EMPIRE_REMOTE_MAX_WORKER_THROTTLE_INCREASE");
    expect(remote).toContain("FLY_METRICS_TOKEN");
    expect(remote).toContain("EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT");
    const closeJob = remote.slice(remote.indexOf("  close-registration:"), remote.indexOf("  automated-verdict:"));
    expect(closeJob).toContain("if: always() && needs.gate.result == 'success'");
    expect(closeJob).toContain("EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED false");
    expect(closeJob).toContain("env:unset EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT");
    expect(closeJob).toContain("staging-registration-build-${RELEASE_SHA}");
    expect(closeJob).toContain(".data.registrationEnabled == false");
    expect(closeJob).toContain("npm run verify:remote-release");
    expect(remote).toContain('manualNetlifyObservabilityReview:"required-before-production"');
  });

  it("keeps remote credentials step-scoped and installs tools first", () => {
    const jobEnvironmentSections = [...remote.matchAll(/\n    env:\n([\s\S]*?)\n    steps:/gu)].map((match) => match[1]);
    expect(jobEnvironmentSections.every((section) => !/\$\{\{\s*secrets\./u.test(section))).toBe(true);
    expect(remote).not.toContain("NETLIFY_AUTH_TOKEN=");
    expect(remote).not.toContain("FLY_API_TOKEN=");
    expect(remote).not.toMatch(/uses:\s+[^\s]+@v\d/u);
    expect(remote.indexOf("Install Playwright Chromium")).toBeLessThan(remote.indexOf("Run public remote suite"));
    expect(remote.indexOf("Install pinned Netlify CLI")).toBeLessThan(remote.indexOf("Open a maximum 23-hour registration window"));
    expect(remote).not.toContain("--context deploy-preview");
  });
});
