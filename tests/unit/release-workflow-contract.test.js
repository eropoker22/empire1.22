import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HOSTED_ACCEPTANCE_SUITE_NAMES,
  REMOTE_STAGING_ACCEPTANCE_SUITE_NAMES
} from "../../scripts/remote-staging-acceptance-suites.mjs";

const staging = readFileSync(".github/workflows/deploy-staging.yml", "utf8");
const hosted = readFileSync(".github/workflows/hosted-acceptance.yml", "utf8");
const quality = readFileSync(".github/workflows/quality.yml", "utf8");
const remote = readFileSync(".github/workflows/staging-remote-acceptance.yml", "utf8");
const rollback = readFileSync(".github/workflows/staging-rollback-rehearsal.yml", "utf8");
const production = readFileSync(".github/workflows/deploy-production.yml", "utf8");
const fly = readFileSync("fly.hosted-worker.toml", "utf8");
const ciHostedEnvironment = readFileSync("scripts/write-ci-hosted-environment.mjs", "utf8");

describe("public release workflows", () => {
  it("deploys staging only behind exact successful hosted acceptance evidence", () => {
    expect(staging).toContain("Hosted Acceptance");
    expect(staging).toContain(".head_sha == $sha");
    expect(staging).toContain(".conclusion == \"success\"");
    for (const suite of HOSTED_ACCEPTANCE_SUITE_NAMES) {
      expect(staging).toContain(suite);
      expect(hosted).toContain(`suite: ${suite}`);
    }
  });

  it("keeps release ordering guarded and the staging registration policy explicit", () => {
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
    expect(staging).toContain("leave_registration_open:");
    expect(staging).toContain(
      "EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: ${{ needs.gate.outputs.leave_registration_open }}"
    );
    expect(staging).toContain("Resolve bounded staging registration policy");
    expect(staging).toContain("--allow-registration-enabled");
    expect(staging).toContain(
      'set_function EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED "$EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED"'
    );
    const workerSecrets = staging.slice(
      staging.indexOf("Stage worker runtime secrets"),
      staging.indexOf("Deploy exactly one persistent worker")
    );
    expect(workerSecrets).not.toContain("EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED");
    expect(workerSecrets).not.toContain("EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT");
    expect(staging).toContain("Verify deployed registration policy");
    expect(staging).toContain("artifacts/release/staging/registration-policy.json");
    const registrationConfiguration = staging.slice(
      staging.indexOf("Configure isolated Netlify staging environment"),
      staging.indexOf("Deploy Netlify staging site")
    );
    expect(registrationConfiguration.indexOf(
      'set_function EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT'
    )).toBeLessThan(registrationConfiguration.indexOf(
      'set_function EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED'
    ));
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

  it("pins every staging deploy mutation to the non-production Netlify site", () => {
    expect(staging).toContain("NETLIFY_PRODUCTION_SITE_ID: ${{ vars.NETLIFY_PRODUCTION_SITE_ID }}");
    expect(staging).toContain("Verify exact staging Netlify site target before deployment mutation");
    expect(staging).toContain('[[ "$NETLIFY_SITE_ID" != "$NETLIFY_PRODUCTION_SITE_ID" ]]');
    expect(staging).toContain("https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}");
    expect(staging).toContain(".id == $id");
    expect(staging).toContain('. != "empirestreets.cz"');
    expect(staging.indexOf("Verify exact staging Netlify site target before deployment mutation"))
      .toBeLessThan(staging.indexOf("Create Neon pre-migration snapshot"));
    expect(staging.indexOf("Verify exact staging Netlify site target before deployment mutation"))
      .toBeLessThan(staging.indexOf("Configure isolated Netlify staging environment"));
  });

  it("pins the staging database and Fly app before any provider mutation", () => {
    expect(staging).toContain("EMPIRE_DATABASE_TARGET_ENVIRONMENT: staging");
    expect(staging).toContain(
      "EMPIRE_STAGING_DATABASE_TARGET_HASH: ${{ vars.EMPIRE_STAGING_DATABASE_TARGET_HASH }}"
    );
    expect(staging).toContain("EMPIRE_PRE_ALPHA_STAGING_FLY_APP: empire-streets-staging-worker");
    expect(staging).toContain('[[ "$EMPIRE_STAGING_DATABASE_TARGET_HASH" =~ ^[0-9a-f]{64}$ ]]');
    expect(staging).toContain('[[ "$FLY_STAGING_APP" == "empire-streets-staging-worker" ]]');
    expect(staging).toContain('[[ "$FLY_STAGING_APP" == "$EMPIRE_PRE_ALPHA_STAGING_FLY_APP" ]]');
    expect(staging).toContain("EMPIRE_RELEASE_DATABASE_URL_POOLED: ${{ secrets.STAGING_DATABASE_URL_POOLED }}");
    expect(staging).toContain("GAMEPLAY_RELEASE_DATABASE_URL_POOLED: ${{ secrets.STAGING_DATABASE_URL_POOLED }}");

    const validation = staging.indexOf("Validate staging environment and create manifest");
    const neonBinding = staging.indexOf("Verify exact Neon project branch and endpoint before snapshot mutation");
    const firstMutation = staging.indexOf("Create Neon pre-migration snapshot");
    const neonPost = staging.indexOf("--request POST");
    const snapshotResponseAssertion = staging.indexOf("node scripts/verify-staging-neon-snapshot.mjs");
    const firstMigration = staging.indexOf("Initialize empty staging migration history");
    expect(validation).toBeGreaterThan(0);
    expect(neonBinding).toBeGreaterThan(validation);
    expect(neonBinding).toBeLessThan(firstMutation);
    expect(neonBinding).toBeLessThan(neonPost);
    expect(neonPost).toBeLessThan(snapshotResponseAssertion);
    expect(snapshotResponseAssertion).toBeLessThan(firstMigration);
    expect(staging).toContain("/projects/${NEON_PROJECT_ID}/branches/${NEON_BRANCH_ID}/endpoints");
    expect(staging).toContain("node scripts/verify-staging-neon-target.mjs");
    expect(staging).toContain("EMPIRE_STAGING_NEON_BINDING_EVIDENCE_PATH: artifacts/release/staging/neon-target-binding.json");
    expect(staging).toContain("EMPIRE_STAGING_NEON_BACKUP_EVIDENCE_PATH: artifacts/release/staging/database-backup.json");

    const netlifyGuard = staging.indexOf("Verify exact staging Netlify site target before deployment mutation");
    const firstNetlifyMutation = staging.indexOf("netlify env:set");
    const flyPin = staging.indexOf('[[ "$FLY_STAGING_APP" == "empire-streets-staging-worker" ]]');
    for (const providerMutation of [
      neonPost,
      firstNetlifyMutation,
      staging.indexOf('docker push "registry.fly.io/${FLY_STAGING_APP}:${RELEASE_SHA}"'),
      staging.indexOf('flyctl secrets import --stage --app "$FLY_STAGING_APP"'),
      staging.indexOf('flyctl deploy --app "$FLY_STAGING_APP"')
    ]) {
      expect(providerMutation).toBeGreaterThan(0);
      expect(providerMutation).toBeGreaterThan(flyPin);
    }
    expect(netlifyGuard).toBeLessThan(firstNetlifyMutation);

    const workerSecrets = staging.slice(
      staging.indexOf("Stage worker runtime secrets"),
      staging.indexOf("Deploy exactly one persistent worker")
    );
    expect(workerSecrets).toContain("EMPIRE_DATABASE_TARGET_ENVIRONMENT=staging");
    expect(workerSecrets).toContain("EMPIRE_STAGING_DATABASE_TARGET_HASH=%s");
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
    expect(hosted).toContain("Verify hosted artifact secret canary");
    expect(hosted).toContain("node scripts/verify-ci-hosted-artifact-secret-canary.mjs");
    expect(hosted).toContain("steps.artifact_secret_canary.outcome == 'success'");
    expect(hosted.indexOf("Verify hosted artifact secret canary"))
      .toBeLessThan(hosted.indexOf("Upload hosted evidence"));
    expect(readFileSync("scripts/run-local-hosted-full.mjs", "utf8")).toContain('"--trace=off"');
    for (const credentialBearingSpec of [
      "tests/e2e/manual-hosted-admin-player-flow.spec.js",
      "tests/e2e/live-hosted-building-actions-visible-ui.spec.js",
      "tests/e2e/live-hosted-non-spawn-building-parity.spec.js"
    ]) {
      expect(readFileSync(credentialBearingSpec, "utf8")).toContain('trace: "off"');
      expect(readFileSync(credentialBearingSpec, "utf8")).not.toContain('trace: "on"');
    }
    expect(ciHostedEnvironment).toContain("const secretEnvironment = {");
    expect(ciHostedEnvironment).toContain("const secretValues = Object.values(secretEnvironment)");
    expect(ciHostedEnvironment).not.toContain("Object.values(values).slice(3)");
    expect(ciHostedEnvironment).toContain("`::add-mask::${value}`");
    expect(ciHostedEnvironment.indexOf("`::add-mask::${value}`"))
      .toBeLessThan(ciHostedEnvironment.indexOf("await appendFile("));
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
      "test:recovery:critical",
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
    expect(quality).not.toContain("test:e2e:full");
    expect(quality).not.toContain("--all");
    expect(quality).not.toMatch(/tests\/e2e\/[^\s]+\.spec\.[jt]s/u);
  });

  it("runs the complete remote staging matrix against the exact deployed SHA", () => {
    expect(remote).toContain('name: Staging Remote Acceptance');
    expect(remote).toContain('.name == "Deploy Staging"');
    expect(remote).toContain('.head_sha == $sha');
    expect(remote).toContain('staging-release-${RELEASE_SHA}');
    expect(remote).toContain('gate-evidence/artifacts/release/staging/registration-policy.json');
    expect(remote).toContain('LEAVE_REGISTRATION_OPEN: ${{ steps.release.outputs.leave_registration_open }}');
    expect(remote).toContain('.registrationMode == "open" and .registrationOpen == true');
    expect(remote).toContain('.registrationMode == "closed" and .registrationOpen == false');
    expect(remote).toContain('https://staging.empirestreets.cz');
    expect(remote).not.toContain('http://localhost');
    for (const suite of REMOTE_STAGING_ACCEPTANCE_SUITE_NAMES) {
      expect(remote).toContain(`suite: ${suite}`);
    }
    expect(remote).toContain("max-parallel: 1");
    expect(remote).toContain("npm run test:remote-staging:suite");
    expect(remote).toContain("EMPIRE_PRE_ALPHA_STAGING_FLY_APP: empire-streets-staging-worker");
    expect(remote).toContain('[[ "$FLY_STAGING_APP" == "empire-streets-staging-worker" ]]');
    expect(remote).toContain('[[ "$FLY_STAGING_APP" == "$EMPIRE_PRE_ALPHA_STAGING_FLY_APP" ]]');
    const remoteSuites = remote.slice(remote.indexOf("  remote-suites:"), remote.indexOf("  worker-redeploy:"));
    const workerRedeploy = remote.slice(remote.indexOf("  worker-redeploy:"), remote.indexOf("  load-soak:"));
    for (const mutationBlock of [remoteSuites, workerRedeploy]) {
      expect(mutationBlock).toContain("EMPIRE_PRE_ALPHA_STAGING_FLY_APP: empire-streets-staging-worker");
      expect(mutationBlock.indexOf('[[ "$FLY_STAGING_APP" == "empire-streets-staging-worker" ]]'))
        .toBeGreaterThan(0);
    }
    expect(workerRedeploy.indexOf('[[ "$FLY_STAGING_APP" == "empire-streets-staging-worker" ]]'))
      .toBeLessThan(workerRedeploy.indexOf('flyctl deploy --app "$FLY_STAGING_APP"'));
    expect(remote).toContain("matrix.fixture == true && matrix.restart_worker == true");
    expect(remote).toContain("Run fixture-backed worker-recovery remote suite");
    expect(remote).toContain('.counts.executed == .counts.total');
    expect(remote).toContain("node scripts/validate-release-critical-suite-summary.mjs");
    expect(remote).toContain('"--summary=$summary"');
    expect(remote).toContain('"--suite=$SUITE"');
    expect(remote).toContain('"--build-sha=$RELEASE_SHA"');
    expect(remote).toContain("Canonical code-level release evidence");
    expect(remote).toContain("npm run verify:pre-alpha:staging");
    expect(remote).toContain("staging-pre-alpha-code-${{ env.RELEASE_SHA }}");
    expect(remote).toContain("gate-evidence/artifacts/release/staging/neon-target-binding.json");
    expect(remote).toContain('.schemaVersion == 1 and .status == "verified" and .environment == "staging"');
    expect(remote).toContain('.databaseTargetHash == $binding[0].databaseTargetHash');
    expect(remote).toContain('.projectIdHash == $binding[0].projectIdHash');
    expect(remote).toContain('.branchIdHash == $binding[0].branchIdHash');
    expect(remote).toContain('.endpointIdHash == $binding[0].endpointIdHash');
  });

  it("measures staging load and finalizes the explicitly selected registration policy", () => {
    expect(remote).toContain("npm run test:remote-staging:load-soak");
    expect(remote).toContain("EMPIRE_REMOTE_MAX_DB_CONNECTIONS");
    expect(remote).toContain("EMPIRE_REMOTE_MAX_WORKER_MEMORY_BYTES");
    expect(remote).toContain("EMPIRE_REMOTE_MAX_WORKER_CPU_PCT");
    expect(remote).toContain("EMPIRE_REMOTE_MAX_WORKER_THROTTLE_INCREASE");
    expect(remote).toContain("FLY_METRICS_TOKEN");
    const loadSoak = remote.slice(remote.indexOf("  load-soak:"), remote.indexOf("  finalize-registration-policy:"));
    expect(loadSoak).toContain("EMPIRE_PRE_ALPHA_STAGING_FLY_APP: empire-streets-staging-worker");
    expect(loadSoak).toContain("EMPIRE_HOSTED_WORKER_ORIGIN: https://empire-streets-staging-worker.fly.dev");
    expect(loadSoak.indexOf('[[ "$FLY_STAGING_APP" == "empire-streets-staging-worker" ]]'))
      .toBeGreaterThan(0);
    expect(loadSoak.indexOf('[[ "$FLY_STAGING_APP" == "empire-streets-staging-worker" ]]'))
      .toBeLessThan(loadSoak.indexOf("npm run test:remote-staging:load-soak"));
    expect(remote).toContain('.performance.metrics.actionMix.distinctActualActionCount >= 5');
    expect(remote).toContain('.performance.metrics.actionMix.distinctAcceptedActionCount >= 4');
    expect(remote).toContain('.performance.metrics.rejectionClassification.unexpected == 0');
    expect(remote).toContain("EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT");
    const finalPolicyInput = remote.slice(
      remote.indexOf("      leave_registration_open:"), remote.indexOf("permissions:")
    );
    expect(finalPolicyInput).toContain("required: true");
    expect(finalPolicyInput).toContain("default: false");
    expect(finalPolicyInput).toContain("type: boolean");
    const finalizationJob = remote.slice(
      remote.indexOf("  finalize-registration-policy:"), remote.indexOf("  automated-verdict:")
    );
    const openRegistrationJob = remote.slice(
      remote.indexOf("  open-registration:"), remote.indexOf("  remote-suites:")
    );
    for (const registrationJob of [openRegistrationJob, finalizationJob]) {
      expect(registrationJob).toContain("EMPIRE_PRE_ALPHA_STAGING_FLY_APP: empire-streets-staging-worker");
      expect(registrationJob).toContain('[[ "$FLY_STAGING_APP" == "empire-streets-staging-worker" ]]');
      expect(registrationJob).toContain('[[ "$FLY_STAGING_APP" == "$EMPIRE_PRE_ALPHA_STAGING_FLY_APP" ]]');
      expect(registrationJob).toContain("EMPIRE_HOSTED_WORKER_ORIGIN: https://empire-streets-staging-worker.fly.dev");
    }
    expect(openRegistrationJob.indexOf('[[ "$FLY_STAGING_APP" == "empire-streets-staging-worker" ]]'))
      .toBeLessThan(openRegistrationJob.indexOf("netlify env:set EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT"));
    expect(openRegistrationJob.indexOf("Verify exact staging Netlify site target before mutation"))
      .toBeLessThan(openRegistrationJob.indexOf("netlify env:set EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT"));
    expect(finalizationJob.indexOf('[[ "$FLY_STAGING_APP" == "empire-streets-staging-worker" ]]'))
      .toBeLessThan(finalizationJob.indexOf("Verify final registration policy and exact release parity"));
    expect(finalizationJob.indexOf("Verify exact staging Netlify site target before closure mutation"))
      .toBeLessThan(finalizationJob.indexOf("netlify env:set EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED false"));
    expect(finalizationJob).toContain("if: always() && needs.gate.result == 'success'");
    expect(finalizationJob).toContain("if: env.LEAVE_REGISTRATION_OPEN != 'true'");
    expect(finalizationJob).toContain("EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED false");
    expect(finalizationJob).toContain("env:unset EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT");
    expect(finalizationJob).toContain("staging-registration-build-${RELEASE_SHA}");
    expect(finalizationJob).toContain('expected_mode="open"');
    expect(finalizationJob).toContain('expected_enabled="true"');
    expect(finalizationJob).toContain("validatePublicRegistrationWindow");
    expect(finalizationJob).toContain("npm run verify:remote-release");
    expect(finalizationJob).toContain("staging-registration-final-${{ env.RELEASE_SHA }}");
    const immutableBuildDownload = finalizationJob.slice(
      finalizationJob.indexOf("      - name: Download immutable registration build"),
      finalizationJob.indexOf("      - name: Verify exact staging Netlify site target before closure mutation")
    );
    expect(immutableBuildDownload).not.toContain("if: env.LEAVE_REGISTRATION_OPEN != 'true'");
    expect(remote.match(/EMPIRE_HOSTED_WORKER_REGION: fra/gu)).toHaveLength(2);
    expect(remote).toContain('manualNetlifyObservabilityReview:"required-before-production"');
  });

  it("assembles and uploads the exact twelve-file fail-closed pre-alpha evidence bundle", () => {
    expect(remote).toContain("Assemble canonical pre-alpha evidence");
    for (const artifact of [
      "staging-pre-alpha-code-${RELEASE_SHA}",
      "staging-remote-full-lifecycle-20p-${RELEASE_SHA}",
      "staging-remote-social-concurrency-privacy-${RELEASE_SHA}",
      "staging-load-soak-${RELEASE_SHA}",
      "staging-registration-final-${RELEASE_SHA}",
      "staging-remote-final-${RELEASE_SHA}",
      "staging-release-${RELEASE_SHA}"
    ]) expect(remote).toContain(artifact);
    expect(remote).toContain("npm run release:pre-alpha:evidence");
    for (const file of [
      "summary.json",
      "summary.md",
      "test-results.json",
      "lifecycle-report.json",
      "concurrency-report.json",
      "invariant-report.json",
      "security-report.json",
      "balance-report.json",
      "performance-report.json",
      "release-health.json",
      "cleanup-report.json",
      "manifest.json"
    ]) expect(remote).toContain(`\${{ env.EVIDENCE_OUTPUT }}/${file}`);
    expect(remote).toContain('continue-on-error: true');
    expect(remote).toContain('[[ "${{ steps.bundle.outcome }}" == "success" ]]');
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

  it("pins registration mutations to the exact staging Netlify site and rejects the production site", () => {
    expect(remote).toContain("NETLIFY_PRODUCTION_SITE_ID: ${{ vars.NETLIFY_PRODUCTION_SITE_ID }}");
    expect(remote.match(/Verify exact staging Netlify site target/gu)).toHaveLength(2);
    expect(remote.match(/\[\[ "\$NETLIFY_SITE_ID" != "\$NETLIFY_PRODUCTION_SITE_ID" \]\]/gu))
      .toHaveLength(2);
    expect(remote.match(/https:\/\/api\.netlify\.com\/api\/v1\/sites\/\$\{NETLIFY_SITE_ID\}/gu))
      .toHaveLength(2);
    expect(remote.match(/\.id == \$id/gu)).toHaveLength(2);
    expect(remote.match(/\.domain_aliases \/\/ \[\]/gu)).toHaveLength(2);
    expect(remote.match(/\. != "www\.empirestreets\.cz"/gu)).toHaveLength(2);
    expect(remote.match(/staging\.empirestreets\.cz/gu).length).toBeGreaterThan(2);
    expect(staging).toContain(".domain_aliases // []");
    expect(staging).toContain('. != "www.empirestreets.cz"');
  });

  it("gates production on exact remote staging and rollback rehearsal artifacts", () => {
    expect(production).toContain("name: Deploy Production");
    expect(production).toContain("workflow_dispatch:");
    expect(production).not.toContain("workflow_run:");
    expect(production).toContain('.name == "Staging Remote Acceptance"');
    expect(production).toContain('.path == ".github/workflows/staging-remote-acceptance.yml"');
    expect(production).toContain('staging-remote-final-${RELEASE_SHA}');
    expect(production).toContain('.name == "Staging Rollback Rehearsal"');
    expect(production).toContain('staging-rollback-final-${RELEASE_SHA}');
    expect(production).toContain("schemaCompatibleWithPrevious == true");
    expect(production).toContain("netlify_observability_evidence_id");
    expect(production).toContain("environment: production");
  });

  it("keeps the production deploy ordered, immutable and registration closed", () => {
    const order = [
      "Validate production environments and create manifest",
      "Capture rollback pointers",
      "Create Neon pre-migration snapshot",
      "Record pending production migrations",
      "Apply production migrations exactly once",
      "Verify current production schema",
      "Build frontend, API and immutable worker image",
      "Deploy Netlify production with registration closed",
      "Deploy exactly one persistent production worker",
      "Wait for production API and worker health",
      "Verify remote production SHA and asset parity",
      "Run guarded production browser smoke",
      "Force final closed registration and redeploy the same SHA",
      "Verify final production registration, domain and SHA parity"
    ].map((label) => production.indexOf(label));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((left, right) => left - right));
    expect(production).toContain("npm run release:production:manifest");
    expect(production).toContain("npm run verify:production-env -- --component=netlify");
    expect(production).toContain("npm run verify:production-env -- --component=worker");
    expect(production).toContain("npm run verify:database-pooling");
    expect(production).toContain("npm run verify:remote-release");
    expect(production).toContain("npm run test:remote-production:smoke");
    expect(production).toContain("EMPIRE_PRODUCTION_DATABASE_TARGET_HASH");
    expect(production).toContain('EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "false"');
    expect(production).toContain('EMPIRE_WAR_HOSTING_ENABLED: "false"');
    expect(production).not.toMatch(/EMPIRE_WAR_HOSTING_ENABLED true/u);
    expect(production).not.toMatch(/env:set EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED true/u);
    expect(production).not.toContain("--context deploy-preview");
    expect(production).toContain('registry.fly.io/${FLY_PRODUCTION_APP}:${RELEASE_SHA}');
    expect(production).toContain("--ha=false");
    expect(production).toContain("flyctl scale count 1");
  });

  it("separates initial production cutover rollback from same-schema upgrades", () => {
    expect(production).toContain("initial_cutover:");
    expect(production).toContain("previous_production_sha:");
    expect(production).toContain("initial_rollback_deploy_id:");
    expect(production).toContain('[[ "$INITIALIZE_DATABASE" == "true" ]]');
    expect(production).toContain('[[ "$BOOTSTRAP_ADMIN" == "true" ]]');
    expect(production).toContain('[[ "$BOOTSTRAP_SMOKE_ACCOUNT" == "true" ]]');
    expect(production).toContain("initial-cutover-shutdown");
    expect(production).toContain("same-schema-code-rollback");
    expect(production).toContain("npm run verify:rollback-compatibility");
    expect(production).toContain('flyctl scale count 0 --app "$FLY_PRODUCTION_APP" --yes');
    expect(production).toContain('flyctl machines list --app "$FLY_PRODUCTION_APP" --json');
  });

  it("keeps production provider credentials step-scoped and tools pinned", () => {
    const deployJob = production.slice(production.indexOf("  deploy:"), production.indexOf("  verdict:"));
    const jobEnvironment = deployJob.match(/\n    env:\n([\s\S]*?)\n    steps:/u)?.[1] ?? "";
    expect(jobEnvironment).not.toMatch(/\$\{\{\s*secrets\./u);
    const toolIndexes = [
      production.indexOf("Install exact dependencies"),
      production.indexOf("Install pinned Netlify CLI"),
      production.indexOf("Setup pinned Fly CLI"),
      production.indexOf("Install Playwright Chromium")
    ];
    expect(Math.max(...toolIndexes)).toBeLessThan(production.indexOf("Validate required production inputs"));
    expect(production).not.toContain('>> "$GITHUB_ENV"');
    expect(production).not.toMatch(/uses:\s+[^\s]+@v\d/u);
    expect(production).not.toContain("NETLIFY_AUTH_TOKEN=");
    expect(production).not.toContain("FLY_API_TOKEN=");
  });

  it("gives the production worker no API or admin-only secrets", () => {
    const workerSecrets = production.slice(
      production.indexOf("Stage production worker-only secrets"),
      production.indexOf("Deploy exactly one persistent production worker")
    );
    expect(workerSecrets).toContain("GAMEPLAY_SLICE_SESSION_SECRET");
    expect(workerSecrets).toContain("GAMEPLAY_SLICE_SNAPSHOT_SECRET");
    expect(workerSecrets).toContain("EMPIRE_PRODUCTION_DATABASE_TARGET_HASH");
    expect(workerSecrets).not.toContain("EMPIRE_ADMIN_FINGERPRINT_SECRET");
    expect(workerSecrets).not.toContain("EMPIRE_ADMIN_SESSION_SECRET");
    expect(workerSecrets).not.toContain("EMPIRE_AUTH_THROTTLE_PEPPER");
  });

  it("rolls back code or shuts down initial cutover while retaining the production database", () => {
    const rollback = production.slice(
      production.indexOf("Roll back code automatically without restoring the database"),
      production.indexOf("Upload production release evidence")
    );
    expect(rollback).toContain("/deploys/${PREVIOUS_NETLIFY_DEPLOY_ID}/restore");
    expect(rollback).toContain('--image "$PREVIOUS_FLY_IMAGE"');
    expect(rollback).toContain("databaseRestored:false");
    expect(rollback).toContain("workerReplicas:0");
    expect(rollback).toContain("workerReplicas:1");
    expect(rollback).not.toContain("NEON_API_KEY");
    expect(rollback).not.toContain("snapshot");
    expect(rollback).toContain("EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED false");
  });

  it("rehearses rollback only after exact closed remote staging acceptance", () => {
    expect(rollback).toContain("name: Staging Rollback Rehearsal");
    expect(rollback).toContain("workflow_dispatch:");
    expect(rollback).toContain('.name == "Deploy Staging"');
    expect(rollback).toContain('.path == ".github/workflows/deploy-staging.yml"');
    expect(rollback).toContain('.name == "Staging Remote Acceptance"');
    expect(rollback).toContain('.path == ".github/workflows/staging-remote-acceptance.yml"');
    expect(rollback).toContain('.registrationClosed == true');
    expect(rollback).toContain("group: empire-staging-release");
    expect(rollback).toContain("environment: staging");
  });

  it("requires schema-identical code rollback and never touches the staging database", () => {
    const compatibility = rollback.indexOf("Verify code-only rollback schema compatibility");
    const capture = rollback.indexOf("Capture candidate and previous deployment pointers");
    expect(compatibility).toBeGreaterThan(0);
    expect(compatibility).toBeLessThan(capture);
    expect(rollback).toContain("npm run verify:rollback-compatibility");
    expect(rollback).toContain("schemaCompatibleWithPrevious:true");
    expect(rollback).toContain("databaseRestored:false");
    expect(rollback).not.toContain("DATABASE_URL");
    expect(rollback).not.toContain("NEON_API_KEY");
    expect(rollback).not.toMatch(/db:migrate|snapshot/u);
  });

  it("always restores the candidate and keeps one worker with registration closed", () => {
    const order = [
      "Restore previous staging code with registration closed",
      "Verify previous staging release is healthy and closed",
      "Restore exact staging candidate",
      "Verify exact candidate was restored",
      "Verify restored candidate frontend and asset parity",
      "Record successful rollback rehearsal"
    ].map((label) => rollback.indexOf(label));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((left, right) => left - right));
    expect(rollback).toContain("if: always() && steps.capture.outcome == 'success'");
    expect(rollback.match(/flyctl scale count 1/gu)).toHaveLength(2);
    expect(rollback).not.toMatch(/flyctl scale count [2-9]/u);
    expect(rollback.match(/EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED false/gu)).toHaveLength(2);
    expect(rollback).not.toMatch(/EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED true/u);
    expect(rollback).toContain("candidateRestored:true");
    expect(rollback).toContain("candidateAssetParityVerified:true");
    expect(rollback).toContain("npm run verify:remote-release");
  });

  it("keeps rollback provider credentials step-scoped and actions pinned", () => {
    const rehearseJob = rollback.slice(rollback.indexOf("  rehearse:"), rollback.indexOf("  verdict:"));
    const jobEnvironment = rehearseJob.match(/\n    env:\n([\s\S]*?)\n    steps:/u)?.[1] ?? "";
    expect(jobEnvironment).not.toMatch(/\$\{\{\s*secrets\./u);
    expect(rollback.indexOf("Install pinned Netlify CLI"))
      .toBeLessThan(rollback.indexOf("Validate required staging rollback inputs"));
    expect(rollback.indexOf("Setup pinned Fly CLI"))
      .toBeLessThan(rollback.indexOf("Validate required staging rollback inputs"));
    expect(rollback).not.toContain('>> "$GITHUB_ENV"');
    expect(rollback).not.toMatch(/uses:\s+[^\s]+@v\d/u);
    expect(rollback).not.toContain("NETLIFY_AUTH_TOKEN=");
    expect(rollback).not.toContain("FLY_API_TOKEN=");
  });

  it("pins rollback mutations to the exact staging Netlify site and canonical Fly app", () => {
    expect(rollback).toContain("NETLIFY_PRODUCTION_SITE_ID: ${{ vars.NETLIFY_PRODUCTION_SITE_ID }}");
    expect(rollback).toContain("EMPIRE_PRE_ALPHA_STAGING_FLY_APP: empire-streets-staging-worker");
    expect(rollback).toContain("Verify exact staging Netlify site target before rollback mutation");
    expect(rollback).toContain('[[ "$NETLIFY_SITE_ID" != "$NETLIFY_PRODUCTION_SITE_ID" ]]');
    expect(rollback).toContain("https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}");
    expect(rollback).toContain(".id == $id");
    expect(rollback).toContain('any(. == "staging.empirestreets.cz")');
    expect(rollback).toContain('. != "empirestreets.cz"');
    expect(rollback).toContain('. != "www.empirestreets.cz"');
    expect(rollback).toContain('[[ "$FLY_STAGING_APP" == "empire-streets-staging-worker" ]]');
    expect(rollback).toContain('[[ "$FLY_STAGING_APP" == "$EMPIRE_PRE_ALPHA_STAGING_FLY_APP" ]]');

    const targetGuard = rollback.indexOf("Verify exact staging Netlify site target before rollback mutation");
    expect(targetGuard).toBeGreaterThan(0);
    expect(rollback.indexOf('[[ "$FLY_STAGING_APP" == "empire-streets-staging-worker" ]]'))
      .toBeLessThan(rollback.indexOf("flyctl auth docker"));
    expect(targetGuard).toBeLessThan(rollback.indexOf("Restore previous staging code with registration closed"));
    expect(targetGuard).toBeLessThan(rollback.indexOf("Restore exact staging candidate"));
  });
});
