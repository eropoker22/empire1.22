import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertRequiredRemoteSuitesRegistered,
  parsePreAlphaStagingArguments,
  PRE_ALPHA_CODE_PHASES,
  PRE_ALPHA_ALL_REMOTE_SUITE_NAMES,
  PRE_ALPHA_REQUIRED_REMOTE_SUITE_NAMES,
  PRE_ALPHA_STAGING_FIXTURE_GUARD,
  PRE_ALPHA_STAGING_ORIGIN,
  PRE_ALPHA_STAGING_PHASES,
  PRE_ALPHA_STAGING_REMOTE_GUARD,
  validateClosedRegistrationEvidence,
  validatePreAlphaEvidenceBundleSummary,
  validatePreAlphaStagingInvocation,
  validateRemoteLoadEvidence,
  validateReleaseCriticalSuiteSummary,
  validateRemoteReleaseEvidence
} from "../../scripts/pre-alpha-staging-contract.mjs";
import { databaseTargetHash } from "../../scripts/remote-staging-fixture-safety.mjs";
import {
  getRemoteStagingAcceptanceSuite,
  REMOTE_STAGING_ACCEPTANCE_SUITES
} from "../../scripts/remote-staging-acceptance-suites.mjs";

const SHA = "a".repeat(40);
const NOW = new Date("2026-08-06T12:00:00.000Z");
const DIRECT_STAGING_DATABASE = "postgresql://staging-user:secret@ep-staging.eu-central-1.aws.neon.tech/empire_staging?sslmode=require";
const phase = (name) => PRE_ALPHA_STAGING_PHASES.find((candidate) => candidate.name === name);

const baseStagingEnvironment = () => ({
  NODE_ENV: "production",
  EMPIRE_RELEASE_ENVIRONMENT: "staging",
  EMPIRE_PUBLIC_ORIGIN: PRE_ALPHA_STAGING_ORIGIN,
  EMPIRE_BUILD_SHA: SHA,
  EMPIRE_PRE_ALPHA_STAGING_REMOTE_APPROVED: PRE_ALPHA_STAGING_REMOTE_GUARD,
  FLY_STAGING_APP: "empire-staging-worker",
  EMPIRE_PRE_ALPHA_STAGING_FLY_APP: "empire-staging-worker",
  EMPIRE_HOSTED_WORKER_ORIGIN: "https://empire-staging-worker.fly.dev",
  EMPIRE_RUNTIME_REGION: "fra",
  EMPIRE_HOSTED_WORKER_REGION: "fra"
});

const suiteStagingEnvironment = () => ({
  ...baseStagingEnvironment(),
  EMPIRE_ADMIN_BOOTSTRAP_USERNAME: "staging-release-owner",
  EMPIRE_ADMIN_BOOTSTRAP_PASSWORD: "not-logged-by-the-contract",
  EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "true",
  EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT: "2026-08-06T13:00:00.000Z",
  EMPIRE_DATABASE_TARGET_ENVIRONMENT: "staging",
  EMPIRE_REMOTE_STAGING_FIXTURE_APPROVED: PRE_ALPHA_STAGING_FIXTURE_GUARD,
  EMPIRE_DATABASE_URL: DIRECT_STAGING_DATABASE,
  GAMEPLAY_DATABASE_URL: DIRECT_STAGING_DATABASE,
  EMPIRE_STAGING_DATABASE_TARGET_HASH: databaseTargetHash(DIRECT_STAGING_DATABASE),
  FLY_API_TOKEN: "staging-worker-restart-token"
});

const cleanCounts = () => ({
  total: 1,
  executed: 1,
  passed: 1,
  failed: 0,
  skipped: 0,
  notRun: 0,
  retries: 0,
  flaky: 0
});

const passingClosedRegistrationEvidence = () => ({
  status: "automated-pass",
  environment: "staging",
  buildSha: SHA,
  workflowRunId: "12345",
  registrationClosed: true,
  requiredRemoteSuites: [...PRE_ALPHA_ALL_REMOTE_SUITE_NAMES],
  jobResults: {
    code: "success",
    openRegistration: "success",
    remoteSuites: "success",
    workerRedeploy: "success",
    loadSoak: "success",
    closeRegistration: "success"
  }
});

const passingSuiteSummary = (suite) => ({
  buildSha: SHA,
  environment: "staging",
  publicOrigin: PRE_ALPHA_STAGING_ORIGIN,
  suite: suite.name,
  status: "passed",
  cleanup: suite.manual ? "archived-by-visible-admin-flow" : "archived",
  workerRestart: suite.restartWorkerBeforeSpec ? "passed" : "not-requested",
  pauseResume: suite.pauseResumeBeforeSpec ? "passed" : "not-requested",
  bootstrap: suite.manual ? null : {
    capacity: suite.capacity,
    committedPlayers: suite.bootstrapCount,
    readyPlayers: suite.bootstrapCount,
    verified: true
  },
  fullLifecycle: suite.fullLifecycle ? {
    status: "passed",
    playerCount: 20,
    registration: { closed: true, baselinePlayers: 20 },
    statusTransitions: ["running", "paused", "running", "stopped"],
    eliminationTransitions: Array.from({ length: 12 }, (_, index) => ({ eliminationCount: index + 1 })),
    workerRecovery: "passed",
    finalLockdown: { status: "resolved", activePlayers: 8 },
    result: {
      matchResultHash: "c".repeat(64),
      snapshotMatchResultHash: "c".repeat(64),
      persistedMatchResultHash: "c".repeat(64),
      resultPayloadMatchesSnapshot: true,
      snapshotRankingHash: "d".repeat(64),
      persistedRankingHash: "d".repeat(64),
      membershipRankingHash: "d".repeat(64),
      rankingPayloadMatchesSnapshot: true,
      membershipRankingMatchesSnapshot: true,
      activePlayers: 8,
      eliminatedPlayers: 12,
      eliminationCount: 12,
      persistedMatchResultCount: 1,
      rankedMembershipCount: 20,
      defeatedMembershipCount: 0,
      completedMembershipCount: 20
    },
    invariants: { status: "passed", violationCodes: [] }
  } : null,
  playwrightRuns: [
    ...(suite.manual ? [] : ["bootstrap"]),
    ...suite.preLifecyclePlaywrightRuns.map(({ name }) => name),
    ...suite.playwrightRuns.map(({ name }) => name)
  ].map((name) => ({ name, status: "passed", counts: cleanCounts() }))
});

describe("pre-alpha staging orchestrator contract", () => {
  it("defaults to bounded code phases with no E2E, live Postgres, local-hosted or deploy command", () => {
    const plan = parsePreAlphaStagingArguments([]);
    expect(plan.staging).toBe(false);
    expect(plan.phases.map(({ name }) => name)).toEqual(PRE_ALPHA_CODE_PHASES.map(({ name }) => name));
    const scripts = plan.phases.flatMap(({ commands }) => commands.map(({ script }) => script));
    expect(scripts).toEqual(expect.arrayContaining([
      "check:node",
      "lint",
      "typecheck",
      "build:admin:page",
      "build:hosted-worker",
      "test:unit",
      "test:server",
      "test:integration",
      "test:read-models",
      "test:persistence",
      "verify:closed-alpha:code",
      "test:simulation",
      "simulate:20p"
    ]));
    expect(scripts.some((script) => /(?:e2e|postgres|local-hosted|db:migrate|deploy)/u.test(script))).toBe(false);
  });

  it("adds every registered release suite only behind explicit staging mode", () => {
    expect(() => parsePreAlphaStagingArguments(["--phase=staging-suites"]))
      .toThrow(/PRE_ALPHA_STAGING_FLAG_REQUIRED/u);
    const plan = parsePreAlphaStagingArguments(["--staging", "--phase=staging-suites"]);
    expect(plan.phases[0].commands.map(({ id }) => id)).toEqual(
      REMOTE_STAGING_ACCEPTANCE_SUITES.map(({ name }) => `remote-suite:${name}`)
    );
    expect(plan.phases[0].commands.map(({ id }) => id)).toContain("remote-suite:canonical-20p-registration");
  });

  it("keeps the guarded 20-player soak in the same explicit staging plan", () => {
    expect(() => parsePreAlphaStagingArguments(["--phase=staging-load"]))
      .toThrow(/PRE_ALPHA_STAGING_FLAG_REQUIRED/u);
    const plan = parsePreAlphaStagingArguments(["--staging", "--phase=staging-load"]);
    expect(plan.phases[0].commands).toEqual([
      expect.objectContaining({ id: "remote-load-soak", script: "test:remote-staging:load-soak" })
    ]);
    const loadEnvironment = {
      ...suiteStagingEnvironment(),
      EMPIRE_REMOTE_LOAD_SOAK_MINUTES: "120",
      FLY_ORG_SLUG: "staging-org",
      FLY_METRICS_TOKEN: "metrics-token",
      EMPIRE_REMOTE_MAX_DB_CONNECTIONS: "20",
      EMPIRE_REMOTE_MAX_WORKER_MEMORY_BYTES: "536870912",
      EMPIRE_REMOTE_MAX_WORKER_CPU_PCT: "90",
      EMPIRE_REMOTE_MAX_WORKER_THROTTLE_INCREASE: "0"
    };
    expect(validatePreAlphaStagingInvocation({
      environment: loadEnvironment,
      gitSha: SHA,
      worktreeStatus: "",
      phases: [phase("staging-load")],
      now: NOW
    })).toBe(true);
    for (const name of [
      "EMPIRE_REMOTE_MAX_DB_CONNECTIONS",
      "EMPIRE_REMOTE_MAX_WORKER_MEMORY_BYTES",
      "EMPIRE_REMOTE_MAX_WORKER_CPU_PCT"
    ]) {
      expect(() => validatePreAlphaStagingInvocation({
        environment: { ...loadEnvironment, [name]: "0" },
        gitSha: SHA,
        worktreeStatus: "",
        phases: [phase("staging-load")],
        now: NOW
      })).toThrow(/PRE_ALPHA_STAGING_LOAD_.+_THRESHOLD_INVALID/u);
    }
  });

  it("builds the fail-closed evidence bundle only behind explicit staging mode", () => {
    expect(() => parsePreAlphaStagingArguments(["--phase=staging-evidence"]))
      .toThrow(/PRE_ALPHA_STAGING_FLAG_REQUIRED/u);
    const plan = parsePreAlphaStagingArguments(["--staging", "--phase=staging-evidence"]);
    expect(plan.phases[0].commands).toEqual([
      expect.objectContaining({
        id: "pre-alpha-evidence-bundle",
        script: "release:pre-alpha:evidence",
        args: ["--artifact-root={artifactRoot}", "--build-sha={buildSha}"]
      })
    ]);
  });

  it("builds exact local release evidence before remote parity without deploy or database commands", () => {
    const plan = parsePreAlphaStagingArguments(["--staging", "--phase=staging-parity"]);
    expect(plan.phases[0].commands.map(({ script }) => script)).toEqual([
      "release:staging:manifest:code-level",
      "build:admin:page",
      "release:asset-manifest",
      "verify:remote-release"
    ]);
    expect(plan.phases[0].commands.some(({ script }) => /deploy|db:/u.test(script))).toBe(false);
  });

  it("fails closed when a named canonical coverage suite is absent", () => {
    expect(PRE_ALPHA_REQUIRED_REMOTE_SUITE_NAMES).toContain("canonical-20p-registration");
    expect(PRE_ALPHA_REQUIRED_REMOTE_SUITE_NAMES).toContain("full-lifecycle-20p");
    expect(assertRequiredRemoteSuitesRegistered()).toBe(true);
    expect(() => assertRequiredRemoteSuitesRegistered(
      REMOTE_STAGING_ACCEPTANCE_SUITES.filter(({ name }) => name !== "canonical-20p-registration")
    )).toThrow(/PRE_ALPHA_REMOTE_SUITES_MISSING:canonical-20p-registration/u);
  });

  it("accepts only the exact clean staging SHA and separately pinned worker target", () => {
    expect(validatePreAlphaStagingInvocation({
      environment: baseStagingEnvironment(),
      gitSha: SHA,
      worktreeStatus: "",
      phases: [phase("staging-parity")],
      now: NOW
    })).toBe(true);
    expect(() => validatePreAlphaStagingInvocation({
      environment: { ...baseStagingEnvironment(), EMPIRE_PUBLIC_ORIGIN: "https://empirestreets.cz" },
      gitSha: SHA,
      worktreeStatus: " M package.json",
      phases: [phase("staging-parity")],
      now: NOW
    })).toThrow(/PRE_ALPHA_STAGING_ORIGIN_INVALID.*PRE_ALPHA_STAGING_WORKTREE_DIRTY/u);
    expect(() => validatePreAlphaStagingInvocation({
      environment: { ...baseStagingEnvironment(), EMPIRE_PRE_ALPHA_STAGING_FLY_APP: "production-worker" },
      gitSha: SHA,
      worktreeStatus: "",
      phases: [phase("staging-parity")],
      now: NOW
    })).toThrow(/PRE_ALPHA_STAGING_FLY_APP_NOT_PINNED/u);
    expect(() => validatePreAlphaStagingInvocation({
      environment: {
        ...baseStagingEnvironment(),
        EMPIRE_RELEASE_ENVIRONMENT: "production",
        EMPIRE_BUILD_SHA: "b".repeat(40)
      },
      gitSha: SHA,
      worktreeStatus: "",
      phases: [phase("staging-parity")],
      now: NOW
    })).toThrow(/PRE_ALPHA_STAGING_ENVIRONMENT_INVALID.*PRE_ALPHA_STAGING_BUILD_SHA_MISMATCH/u);
  });

  it("requires an open bounded registration window and guarded direct staging fixture database for suites", () => {
    expect(validatePreAlphaStagingInvocation({
      environment: suiteStagingEnvironment(),
      gitSha: SHA,
      worktreeStatus: "",
      phases: [phase("staging-suites")],
      now: NOW
    })).toBe(true);
    expect(() => validatePreAlphaStagingInvocation({
      environment: {
        ...suiteStagingEnvironment(),
        EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "false",
        EMPIRE_TEST_DATABASE_URL: "postgresql://localhost/empire_test"
      },
      gitSha: SHA,
      worktreeStatus: "",
      phases: [phase("staging-suites")],
      now: NOW
    })).toThrow(/PRE_ALPHA_STAGING_LOCAL_TEST_DATABASE_FORBIDDEN.*PRE_ALPHA_STAGING_REGISTRATION_NOT_OPEN/u);
  });

  it("rejects skips, not-run tests, retries, flaky results and incomplete cleanup", () => {
    const suite = getRemoteStagingAcceptanceSuite("canonical-20p-registration");
    expect(validateReleaseCriticalSuiteSummary(passingSuiteSummary(suite), { suite, buildSha: SHA })).toBe(true);
    for (const countName of ["skipped", "notRun", "retries", "flaky"]) {
      const summary = passingSuiteSummary(suite);
      summary.playwrightRuns[1].counts[countName] = 1;
      expect(() => validateReleaseCriticalSuiteSummary(summary, { suite, buildSha: SHA }))
        .toThrow(/PRE_ALPHA_REMOTE_RELEASE_CRITICAL_NOT_PASSED/u);
    }
    const notCleaned = passingSuiteSummary(suite);
    notCleaned.cleanup = "failed";
    expect(() => validateReleaseCriticalSuiteSummary(notCleaned, { suite, buildSha: SHA }))
      .toThrow(/PRE_ALPHA_REMOTE_CLEANUP_NOT_PASSED/u);
  });

  it("requires the complete 20-player lifecycle report in addition to clean browser runs", () => {
    const suite = getRemoteStagingAcceptanceSuite("full-lifecycle-20p");
    const summary = passingSuiteSummary(suite);
    expect(validateReleaseCriticalSuiteSummary(summary, { suite, buildSha: SHA })).toBe(true);
    summary.fullLifecycle.result.persistedMatchResultCount = 2;
    expect(() => validateReleaseCriticalSuiteSummary(summary, { suite, buildSha: SHA }))
      .toThrow(/PRE_ALPHA_REMOTE_FULL_LIFECYCLE_NOT_PASSED/u);
    for (const [field, invalidValue] of [
      ["eliminatedPlayers", 11],
      ["eliminationCount", 11],
      ["defeatedMembershipCount", 12],
      ["completedMembershipCount", 19]
    ]) {
      const invalid = passingSuiteSummary(suite);
      invalid.fullLifecycle.result[field] = invalidValue;
      expect(() => validateReleaseCriticalSuiteSummary(invalid, { suite, buildSha: SHA }))
        .toThrow(/PRE_ALPHA_REMOTE_FULL_LIFECYCLE_NOT_PASSED/u);
    }
    const payloadMismatch = passingSuiteSummary(suite);
    payloadMismatch.fullLifecycle.result.persistedMatchResultHash = "e".repeat(64);
    payloadMismatch.fullLifecycle.result.resultPayloadMatchesSnapshot = false;
    expect(() => validateReleaseCriticalSuiteSummary(payloadMismatch, { suite, buildSha: SHA }))
      .toThrow(/PRE_ALPHA_REMOTE_FULL_LIFECYCLE_NOT_PASSED/u);
  });

  it("requires exact remote parity and separately produced closed-registration evidence", () => {
    expect(validateRemoteReleaseEvidence({
      environment: "staging",
      publicOrigin: PRE_ALPHA_STAGING_ORIGIN,
      frontendSha: SHA,
      apiSha: SHA,
      workerSha: SHA,
      schemaVersion: "017_controlled_snapshot_recovery.sql",
      assets: [{ publicPath: "/admin.html" }]
    }, SHA)).toBe(true);
    expect(validateClosedRegistrationEvidence(passingClosedRegistrationEvidence(), SHA)).toBe(true);
    expect(() => validateClosedRegistrationEvidence({
      ...passingClosedRegistrationEvidence(),
      registrationClosed: false
    }, SHA)).toThrow(/PRE_ALPHA_STAGING_CLOSED_EVIDENCE_INVALID/u);
    expect(() => validateClosedRegistrationEvidence({
      ...passingClosedRegistrationEvidence(),
      buildSha: "b".repeat(40),
    }, SHA)).toThrow(/PRE_ALPHA_STAGING_CLOSED_EVIDENCE_INVALID/u);
    expect(() => validateClosedRegistrationEvidence({
      ...passingClosedRegistrationEvidence(),
      requiredRemoteSuites: PRE_ALPHA_ALL_REMOTE_SUITE_NAMES.slice(1)
    }, SHA)).toThrow(/PRE_ALPHA_STAGING_CLOSED_EVIDENCE_INVALID/u);
    expect(() => validateClosedRegistrationEvidence({
      ...passingClosedRegistrationEvidence(),
      jobResults: { ...passingClosedRegistrationEvidence().jobResults, loadSoak: "failed" }
    }, SHA)).toThrow(/PRE_ALPHA_STAGING_CLOSED_EVIDENCE_INVALID/u);
  });

  it("requires clean browser, database, Fly and cleanup evidence from the load soak", () => {
    const passing = {
      status: "passed",
      environment: "staging",
      buildSha: SHA,
      cleanup: "archived",
      browser: { status: "passed", counts: cleanCounts() },
      performance: {
        status: "passed",
        buildSha: SHA,
        metrics: {
          passed: true,
          violations: [],
          actionMix: {
            distinctActualActionCount: 5,
            distinctAcceptedActionCount: 4,
            districtSelectionChangeCount: 1
          },
          rejectionClassification: { auth: 0, rateLimit: 0, unexpected: 0 }
        }
      },
      database: { passed: true },
      fly: { passed: true }
    };
    expect(validateRemoteLoadEvidence(passing, SHA)).toBe(true);
    expect(() => validateRemoteLoadEvidence({
      ...passing,
      browser: { status: "passed", counts: { ...cleanCounts(), skipped: 1 } }
    }, SHA)).toThrow(/PRE_ALPHA_REMOTE_LOAD_NOT_PASSED/u);
    expect(() => validateRemoteLoadEvidence({ ...passing, cleanup: "failed" }, SHA))
      .toThrow(/PRE_ALPHA_REMOTE_LOAD_NOT_PASSED/u);
    expect(() => validateRemoteLoadEvidence({
      ...passing,
      performance: {
        ...passing.performance,
        metrics: {
          ...passing.performance.metrics,
          actionMix: { ...passing.performance.metrics.actionMix, distinctAcceptedActionCount: 3 }
        }
      }
    }, SHA)).toThrow(/PRE_ALPHA_REMOTE_LOAD_NOT_PASSED/u);
  });

  it("accepts only a complete exact-SHA nine-report evidence bundle", () => {
    const passing = {
      status: "passed",
      verdict: "passed",
      buildSha: SHA,
      counts: { required: 9, passed: 9, failed: 0, notPassed: 0, notRun: 0 },
      reports: Array.from({ length: 9 }, (_, index) => ({
        reportType: `report-${index}`,
        status: "passed",
        availability: "present"
      }))
    };
    expect(validatePreAlphaEvidenceBundleSummary(passing, SHA)).toBe(true);
    expect(() => validatePreAlphaEvidenceBundleSummary({
      ...passing,
      counts: { ...passing.counts, passed: 8, notRun: 1 }
    }, SHA)).toThrow(/PRE_ALPHA_EVIDENCE_BUNDLE_NOT_PASSED/u);
    expect(() => validatePreAlphaEvidenceBundleSummary({ ...passing, buildSha: "b".repeat(40) }, SHA))
      .toThrow(/PRE_ALPHA_EVIDENCE_BUNDLE_NOT_PASSED/u);
  });

  it("wires the npm command to non-live persistence only", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    expect(packageJson.scripts["verify:pre-alpha:staging"]).toBe("node scripts/verify-pre-alpha-staging.mjs");
    expect(packageJson.scripts["release:pre-alpha:evidence"]).toBe("node scripts/pre-alpha-evidence-bundle.mjs");
    expect(packageJson.scripts["test:persistence"]).toContain("--exclude tests/persistence/**/*-live.test.ts");
    expect(packageJson.scripts["test:persistence"]).toContain("--exclude tests/persistence/postgres-prod-like-smoke.test.ts");
    expect(packageJson.scripts["test:unit"]).toContain("--exclude tests/unit/tools/closed-alpha-20p-simulation.test.ts");
    expect(packageJson.scripts["test:simulation"]).toContain("tests/unit/tools/closed-alpha-20p-simulation.test.ts");
  });
});
