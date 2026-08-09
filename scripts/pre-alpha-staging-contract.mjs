import path from "node:path";
import { validatePublicRegistrationWindow } from "./registration-window-contract.mjs";
import { assertSafeRemoteStagingFixtureEnvironment } from "./remote-staging-fixture-safety.mjs";
import { REMOTE_STAGING_ACCEPTANCE_SUITES } from "./remote-staging-acceptance-suites.mjs";
import { STAGING_FLY_APP } from "./staging-release-contract.mjs";
import {
  assertCanonicalInvariantEvidence,
  assertCanonicalQuietHoursEvidence,
  assertCanonicalScenarioProvenance
} from "./release-critical-evidence-contract.mjs";

export const PRE_ALPHA_STAGING_ORIGIN = "https://staging.empirestreets.cz";
export const PRE_ALPHA_STAGING_FLY_APP = STAGING_FLY_APP;
export const PRE_ALPHA_STAGING_REMOTE_GUARD = "staging-only-remote-acceptance";
export const PRE_ALPHA_STAGING_FIXTURE_GUARD = "staging-only-fixture-write";
export const PRE_ALPHA_FINAL_REGISTRATION_MODES = Object.freeze(["closed", "open"]);
export const PRE_ALPHA_REQUIRED_REMOTE_SUITE_NAMES = Object.freeze([
  "manual-admin-player",
  "canonical-20p-registration",
  "full-lifecycle-20p",
  "ui-parity",
  "income",
  "social-concurrency-privacy",
  "lifecycle-stop"
]);
export const PRE_ALPHA_ALL_REMOTE_SUITE_NAMES = Object.freeze(
  REMOTE_STAGING_ACCEPTANCE_SUITES.map(({ name }) => name)
);

const npm = (id, script, args = []) => Object.freeze({ id, script, args: Object.freeze(args) });
const phase = (name, commands = []) => Object.freeze({ name, commands: Object.freeze(commands) });

export const PRE_ALPHA_CODE_PHASES = Object.freeze([
  phase("static", [
    npm("node-policy", "check:node"),
    npm("static-guards", "lint")
  ]),
  phase("typecheck", [npm("typecheck", "typecheck")]),
  phase("build", [
    npm("frontend-api-build", "build:admin:page"),
    npm("worker-build", "build:hosted-worker")
  ]),
  phase("test", [
    npm("unit", "test:unit"),
    npm("server", "test:server"),
    npm("integration", "test:integration"),
    npm("read-models", "test:read-models"),
    npm("non-live-persistence", "test:persistence")
  ]),
  phase("security", [npm("release-security", "verify:closed-alpha:code")]),
  phase("concurrency", [npm("authoritative-concurrency", "test:concurrency")]),
  phase("recovery", [npm("critical-recovery", "test:recovery:critical")]),
  phase("simulation", [
    npm("simulation-tests", "test:simulation"),
    npm("20-player-sanity", "simulate:20p", [
      "--seed=pre-alpha-staging-sanity",
      "--steps=100",
      "--report-dir=artifacts/pre-alpha-staging/simulation"
    ])
  ])
]);

export const PRE_ALPHA_STAGING_PHASES = Object.freeze([
  phase("staging-parity", [
    npm("staging-code-manifest", "release:staging:manifest:code-level"),
    npm("staging-release-build", "build:admin:page"),
    npm("staging-asset-manifest", "release:asset-manifest"),
    npm("remote-release-parity", "verify:remote-release")
  ]),
  phase("staging-suites", REMOTE_STAGING_ACCEPTANCE_SUITES.map((suite) => (
    npm(`remote-suite:${suite.name}`, "test:remote-staging:suite", [`--suite=${suite.name}`])
  ))),
  phase("staging-load", [
    npm("remote-load-soak", "test:remote-staging:load-soak")
  ]),
  phase("staging-final"),
  phase("staging-evidence", [
    npm("pre-alpha-evidence-bundle", "release:pre-alpha:evidence", [
      "--artifact-root={artifactRoot}",
      "--build-sha={buildSha}"
    ])
  ])
]);

export const PRE_ALPHA_PHASES = Object.freeze([
  ...PRE_ALPHA_CODE_PHASES,
  ...PRE_ALPHA_STAGING_PHASES
]);

const knownPhaseNames = new Set(PRE_ALPHA_PHASES.map(({ name }) => name));
const stagingPhaseNames = new Set(PRE_ALPHA_STAGING_PHASES.map(({ name }) => name));

export const assertRequiredRemoteSuitesRegistered = (suites = REMOTE_STAGING_ACCEPTANCE_SUITES) => {
  const registered = new Set(suites.map(({ name }) => name));
  const missing = PRE_ALPHA_REQUIRED_REMOTE_SUITE_NAMES.filter((name) => !registered.has(name));
  if (missing.length > 0) throw new Error(`PRE_ALPHA_REMOTE_SUITES_MISSING:${missing.join(",")}`);
  return true;
};

export const parsePreAlphaStagingArguments = (argv) => {
  let staging = false;
  let planOnly = false;
  const requested = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--staging") {
      staging = true;
      continue;
    }
    if (argument === "--plan") {
      planOnly = true;
      continue;
    }
    if (argument === "--help") {
      return Object.freeze({ help: true, staging, planOnly, phases: Object.freeze([]) });
    }
    if (argument === "--phase") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("PRE_ALPHA_PHASE_VALUE_REQUIRED");
      requested.push(...value.split(","));
      index += 1;
      continue;
    }
    if (argument.startsWith("--phase=")) {
      requested.push(...argument.slice("--phase=".length).split(","));
      continue;
    }
    throw new Error(`PRE_ALPHA_ARGUMENT_UNKNOWN:${argument}`);
  }

  const requestedNames = [...new Set(requested.map((name) => name.trim()).filter(Boolean))];
  for (const name of requestedNames) {
    if (!knownPhaseNames.has(name)) throw new Error(`PRE_ALPHA_PHASE_UNKNOWN:${name}`);
    if (stagingPhaseNames.has(name) && !staging) throw new Error(`PRE_ALPHA_STAGING_FLAG_REQUIRED:${name}`);
  }
  const defaults = staging ? PRE_ALPHA_PHASES : PRE_ALPHA_CODE_PHASES;
  const phases = requestedNames.length > 0
    ? requestedNames.map((name) => PRE_ALPHA_PHASES.find((candidate) => candidate.name === name))
    : defaults;
  return Object.freeze({
    help: false,
    staging,
    planOnly,
    phases: Object.freeze(phases)
  });
};

export const validatePreAlphaStagingInvocation = ({
  environment,
  gitSha,
  worktreeStatus,
  phases,
  now = new Date()
}) => {
  const phaseNames = new Set(phases.map(({ name }) => name));
  const failures = [];
  const requireValue = (condition, code) => {
    if (!condition) failures.push(code);
  };

  requireValue(environment.EMPIRE_PRE_ALPHA_STAGING_REMOTE_APPROVED === PRE_ALPHA_STAGING_REMOTE_GUARD,
    "PRE_ALPHA_STAGING_REMOTE_NOT_APPROVED");
  requireValue(environment.NODE_ENV === "production", "PRE_ALPHA_STAGING_NODE_ENV_INVALID");
  requireValue(environment.EMPIRE_RELEASE_ENVIRONMENT === "staging", "PRE_ALPHA_STAGING_ENVIRONMENT_INVALID");
  requireValue(environment.EMPIRE_PUBLIC_ORIGIN === PRE_ALPHA_STAGING_ORIGIN,
    "PRE_ALPHA_STAGING_ORIGIN_INVALID");
  requireValue(/^[0-9a-f]{40}$/u.test(String(gitSha ?? "")), "PRE_ALPHA_STAGING_HEAD_INVALID");
  requireValue(/^[0-9a-f]{40}$/u.test(String(environment.EMPIRE_BUILD_SHA ?? "")),
    "PRE_ALPHA_STAGING_BUILD_SHA_INVALID");
  requireValue(environment.EMPIRE_BUILD_SHA === gitSha, "PRE_ALPHA_STAGING_BUILD_SHA_MISMATCH");
  requireValue(!String(worktreeStatus ?? "").trim(), "PRE_ALPHA_STAGING_WORKTREE_DIRTY");
  requireValue(!String(environment.EMPIRE_TEST_DATABASE_URL ?? "").trim(),
    "PRE_ALPHA_STAGING_LOCAL_TEST_DATABASE_FORBIDDEN");

  if (phaseNames.has("staging-parity")) {
    const flyApp = String(environment.FLY_STAGING_APP ?? "").trim();
    requireValue(flyApp === PRE_ALPHA_STAGING_FLY_APP, "PRE_ALPHA_STAGING_FLY_APP_INVALID");
    requireValue(environment.EMPIRE_PRE_ALPHA_STAGING_FLY_APP === PRE_ALPHA_STAGING_FLY_APP
      && environment.EMPIRE_PRE_ALPHA_STAGING_FLY_APP === flyApp,
      "PRE_ALPHA_STAGING_FLY_APP_NOT_PINNED");
    requireValue(environment.EMPIRE_HOSTED_WORKER_ORIGIN === `https://${flyApp}.fly.dev`,
      "PRE_ALPHA_STAGING_WORKER_ORIGIN_INVALID");
    requireValue(Boolean(String(environment.EMPIRE_RUNTIME_REGION ?? "").trim()),
      "PRE_ALPHA_STAGING_RUNTIME_REGION_REQUIRED");
    requireValue(Boolean(String(environment.EMPIRE_HOSTED_WORKER_REGION ?? "").trim()),
      "PRE_ALPHA_STAGING_WORKER_REGION_REQUIRED");
  }

  if (phaseNames.has("staging-suites") || phaseNames.has("staging-load")) {
    const flyApp = String(environment.FLY_STAGING_APP ?? "").trim();
    requireValue(flyApp === PRE_ALPHA_STAGING_FLY_APP, "PRE_ALPHA_STAGING_FLY_APP_INVALID");
    requireValue(environment.EMPIRE_PRE_ALPHA_STAGING_FLY_APP === PRE_ALPHA_STAGING_FLY_APP
      && environment.EMPIRE_PRE_ALPHA_STAGING_FLY_APP === flyApp,
      "PRE_ALPHA_STAGING_FLY_APP_NOT_PINNED");
    requireValue(Boolean(String(environment.EMPIRE_ADMIN_BOOTSTRAP_USERNAME ?? "").trim()),
      "PRE_ALPHA_STAGING_ADMIN_USERNAME_REQUIRED");
    requireValue(Boolean(String(environment.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD ?? "").trim()),
      "PRE_ALPHA_STAGING_ADMIN_PASSWORD_REQUIRED");
    requireValue(environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED === "true",
      "PRE_ALPHA_STAGING_REGISTRATION_NOT_OPEN");
    requireValue(validatePublicRegistrationWindow({
      enabled: true,
      expiresAt: environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT,
      now
    }).valid, "PRE_ALPHA_STAGING_REGISTRATION_WINDOW_INVALID");
    requireValue(environment.EMPIRE_DATABASE_TARGET_ENVIRONMENT === "staging",
      "PRE_ALPHA_STAGING_DATABASE_ENVIRONMENT_INVALID");
    requireValue(environment.EMPIRE_REMOTE_STAGING_FIXTURE_APPROVED === PRE_ALPHA_STAGING_FIXTURE_GUARD,
      "PRE_ALPHA_STAGING_FIXTURE_NOT_APPROVED");
    requireValue(Boolean(String(environment.FLY_API_TOKEN ?? "").trim()),
      "PRE_ALPHA_STAGING_FLY_TOKEN_REQUIRED");
    try {
      assertSafeRemoteStagingFixtureEnvironment(environment);
    } catch (error) {
      failures.push(String(error?.message ?? "PRE_ALPHA_STAGING_FIXTURE_INVALID").split(":", 1)[0]);
    }
  }

  if (phaseNames.has("staging-load")) {
    const soakMinutes = Number(environment.EMPIRE_REMOTE_LOAD_SOAK_MINUTES);
    requireValue(Number.isInteger(soakMinutes) && soakMinutes >= 60 && soakMinutes <= 360,
      "PRE_ALPHA_STAGING_LOAD_DURATION_INVALID");
    requireValue(Boolean(String(environment.FLY_ORG_SLUG ?? "").trim()),
      "PRE_ALPHA_STAGING_FLY_ORG_REQUIRED");
    requireValue(Boolean(String(environment.FLY_METRICS_TOKEN ?? "").trim()),
      "PRE_ALPHA_STAGING_FLY_METRICS_TOKEN_REQUIRED");
    for (const [name, value] of [
      ["DB_CONNECTIONS", environment.EMPIRE_REMOTE_MAX_DB_CONNECTIONS],
      ["WORKER_MEMORY", environment.EMPIRE_REMOTE_MAX_WORKER_MEMORY_BYTES],
      ["WORKER_CPU", environment.EMPIRE_REMOTE_MAX_WORKER_CPU_PCT]
    ]) {
      requireValue(Number.isFinite(Number(value)) && Number(value) > 0,
        `PRE_ALPHA_STAGING_LOAD_${name}_THRESHOLD_INVALID`);
    }
    const throttleThreshold = Number(environment.EMPIRE_REMOTE_MAX_WORKER_THROTTLE_INCREASE);
    requireValue(Number.isFinite(throttleThreshold) && throttleThreshold >= 0,
      "PRE_ALPHA_STAGING_LOAD_WORKER_THROTTLE_THRESHOLD_INVALID");
  }

  if (failures.length > 0) {
    throw new Error([...new Set(failures)].join(","));
  }
  return true;
};

export const validateReleaseCriticalSuiteSummary = (summary, { suite, buildSha }) => {
  const fail = (code) => { throw new Error(`${code}:${suite.name}`); };
  if (!summary || typeof summary !== "object") fail("PRE_ALPHA_REMOTE_SUMMARY_INVALID");
  if (summary.status !== "passed" || summary.environment !== "staging"
    || summary.publicOrigin !== PRE_ALPHA_STAGING_ORIGIN || summary.buildSha !== buildSha
    || summary.suite !== suite.name || summary.errorCode) {
    fail("PRE_ALPHA_REMOTE_SUMMARY_NOT_PASSED");
  }
  const acceptedCleanup = suite.manual
    ? new Set(["archived", "archived-by-visible-admin-flow"])
    : new Set(["archived"]);
  if (!acceptedCleanup.has(summary.cleanup)) fail("PRE_ALPHA_REMOTE_CLEANUP_NOT_PASSED");
  if (suite.restartWorkerBeforeSpec && summary.workerRestart !== "passed") {
    fail("PRE_ALPHA_REMOTE_WORKER_RECOVERY_NOT_PASSED");
  }
  if (suite.pauseResumeBeforeSpec && summary.pauseResume !== "passed") {
    fail("PRE_ALPHA_REMOTE_LIFECYCLE_NOT_PASSED");
  }
  if (!suite.manual && (summary.bootstrap?.verified !== true
    || summary.bootstrap?.capacity !== suite.capacity
    || summary.bootstrap?.committedPlayers !== suite.bootstrapCount
    || summary.bootstrap?.readyPlayers !== suite.bootstrapCount)) {
    fail("PRE_ALPHA_REMOTE_BOOTSTRAP_NOT_PASSED");
  }
  if (suite.fullLifecycle) {
    const lifecycle = summary.fullLifecycle;
    if (lifecycle?.status !== "passed" || lifecycle.playerCount !== 20
      || lifecycle.registration?.closed !== true || lifecycle.registration?.baselinePlayers !== 20
      || lifecycle.workerRecovery !== "passed"
      || !Array.isArray(lifecycle.eliminationTransitions) || lifecycle.eliminationTransitions.length !== 12
      || lifecycle.finalLockdown?.status !== "resolved" || lifecycle.finalLockdown?.activePlayers !== 8
      || lifecycle.result?.activePlayers !== 8
      || lifecycle.result?.eliminatedPlayers !== 12
      || lifecycle.result?.eliminationCount !== 12
      || lifecycle.result?.persistedMatchResultCount !== 1
      || lifecycle.result?.rankedMembershipCount !== 20
      || lifecycle.result?.defeatedMembershipCount !== 0
      || lifecycle.result?.completedMembershipCount !== 20
      || !/^[0-9a-f]{64}$/u.test(String(lifecycle.result?.matchResultHash ?? ""))
      || lifecycle.result?.snapshotMatchResultHash !== lifecycle.result?.persistedMatchResultHash
      || lifecycle.result?.snapshotMatchResultHash !== lifecycle.result?.matchResultHash
      || lifecycle.result?.resultPayloadMatchesSnapshot !== true
      || lifecycle.result?.snapshotRankingHash !== lifecycle.result?.persistedRankingHash
      || lifecycle.result?.snapshotRankingHash !== lifecycle.result?.membershipRankingHash
      || lifecycle.result?.rankingPayloadMatchesSnapshot !== true
      || lifecycle.result?.membershipRankingMatchesSnapshot !== true
      || lifecycle.invariants?.status !== "passed"
      || !Array.isArray(lifecycle.invariants?.violationCodes)
      || lifecycle.invariants.violationCodes.length !== 0) {
      fail("PRE_ALPHA_REMOTE_FULL_LIFECYCLE_NOT_PASSED");
    }
    try {
      assertCanonicalQuietHoursEvidence(lifecycle);
      assertCanonicalInvariantEvidence(lifecycle.invariants);
      assertCanonicalScenarioProvenance(lifecycle.provenance, {
        buildSha,
        environment: "public-staging"
      });
      assertCanonicalScenarioProvenance(lifecycle.invariants.provenance, {
        buildSha,
        environment: "public-staging"
      });
    } catch {
      fail("PRE_ALPHA_REMOTE_FULL_LIFECYCLE_NOT_PASSED");
    }
  }
  const expectedRuns = suite.preLifecyclePlaywrightRuns.length
    + suite.playwrightRuns.length
    + (suite.manual ? 0 : 1);
  if (!Array.isArray(summary.playwrightRuns) || summary.playwrightRuns.length !== expectedRuns) {
    fail("PRE_ALPHA_REMOTE_RUN_COUNT_INVALID");
  }
  const expectedRunNames = [
    ...(suite.manual ? [] : ["bootstrap"]),
    ...suite.preLifecyclePlaywrightRuns.map(({ name }) => name),
    ...suite.playwrightRuns.map(({ name }) => name)
  ];
  if (summary.playwrightRuns.some((run, index) => run?.name !== expectedRunNames[index])) {
    fail("PRE_ALPHA_REMOTE_RUN_IDENTITY_INVALID");
  }
  for (const run of summary.playwrightRuns) {
    const counts = run?.counts;
    if (run?.status !== "passed" || !counts || !(counts.total > 0)
      || counts.executed !== counts.total || counts.passed !== counts.total
      || counts.failed !== 0 || counts.skipped !== 0 || counts.notRun !== 0
      || counts.retries !== 0 || counts.flaky !== 0) {
      fail("PRE_ALPHA_REMOTE_RELEASE_CRITICAL_NOT_PASSED");
    }
  }
  return true;
};

export const validateRemoteReleaseEvidence = (evidence, buildSha) => {
  if (!evidence || evidence.environment !== "staging"
    || evidence.publicOrigin !== PRE_ALPHA_STAGING_ORIGIN
    || evidence.frontendSha !== buildSha || evidence.apiSha !== buildSha || evidence.workerSha !== buildSha
    || !/^\d{3}_[a-z0-9_]+\.sql$/u.test(String(evidence.schemaVersion ?? ""))
    || !Array.isArray(evidence.assets) || evidence.assets.length === 0) {
    throw new Error("PRE_ALPHA_REMOTE_RELEASE_PARITY_NOT_PASSED");
  }
  return true;
};

export const validateFinalRegistrationEvidence = (
  evidence,
  buildSha,
  expectedMode = "closed",
  now = new Date()
) => {
  if (!PRE_ALPHA_FINAL_REGISTRATION_MODES.includes(expectedMode)) {
    throw new Error("PRE_ALPHA_STAGING_FINAL_REGISTRATION_MODE_INVALID");
  }
  const recordedSuites = Array.isArray(evidence?.requiredRemoteSuites)
    ? [...evidence.requiredRemoteSuites].sort()
    : [];
  const expectedSuites = [...PRE_ALPHA_ALL_REMOTE_SUITE_NAMES].sort();
  const jobResults = evidence?.jobResults;
  const registrationOpen = expectedMode === "open";
  const verifiedAtMs = Date.parse(String(evidence?.verifiedAt ?? ""));
  const validationNowMs = now instanceof Date ? now.getTime() : Date.parse(String(now ?? ""));
  const expiresAtValue = evidence?.registrationExpiresAt;
  const validExpiry = registrationOpen
    ? validatePublicRegistrationWindow({
      enabled: true,
      expiresAt: expiresAtValue,
      now
    }).valid
    : expiresAtValue === null;
  if (!evidence || evidence.status !== "automated-pass" || evidence.environment !== "staging"
    || evidence.buildSha !== buildSha || evidence.registrationMode !== expectedMode
    || evidence.registrationOpen !== registrationOpen || evidence.registrationClosed !== !registrationOpen
    || !Number.isFinite(verifiedAtMs) || new Date(verifiedAtMs).toISOString() !== evidence.verifiedAt
    || !Number.isFinite(validationNowMs) || verifiedAtMs > validationNowMs + 5 * 60_000
    || !validExpiry
    || !/^\d+$/u.test(String(evidence.workflowRunId ?? ""))
    || JSON.stringify(recordedSuites) !== JSON.stringify(expectedSuites)
    || !jobResults
    || jobResults.code !== "success"
    || jobResults.openRegistration !== "success"
    || jobResults.remoteSuites !== "success"
    || jobResults.workerRedeploy !== "success"
    || jobResults.loadSoak !== "success"
    || jobResults.finalizeRegistrationPolicy !== "success") {
    throw new Error("PRE_ALPHA_STAGING_FINAL_REGISTRATION_EVIDENCE_INVALID");
  }
  return true;
};

export const validateClosedRegistrationEvidence = (evidence, buildSha) => {
  try {
    return validateFinalRegistrationEvidence(evidence, buildSha, "closed");
  } catch {
    throw new Error("PRE_ALPHA_STAGING_CLOSED_EVIDENCE_INVALID");
  }
};

export const validateRemoteLoadEvidence = (evidence, buildSha) => {
  const counts = evidence?.browser?.counts;
  const metrics = evidence?.performance?.metrics;
  if (!evidence || evidence.status !== "passed" || evidence.environment !== "staging"
    || evidence.buildSha !== buildSha || evidence.cleanup !== "archived"
    || !counts || !(counts.total > 0) || counts.executed !== counts.total
    || counts.passed !== counts.total || counts.failed !== 0 || counts.skipped !== 0
    || counts.notRun !== 0 || counts.retries !== 0 || counts.flaky !== 0
    || evidence.database?.passed !== true || evidence.fly?.passed !== true
    || evidence.performance?.status !== "passed" || evidence.performance?.buildSha !== buildSha
    || metrics?.passed !== true || !Array.isArray(metrics?.violations) || metrics.violations.length !== 0
    || Number(metrics?.actionMix?.distinctActualActionCount) < 5
    || Number(metrics?.actionMix?.distinctAcceptedActionCount) < 4
    || Number(metrics?.actionMix?.districtSelectionChangeCount) < 1
    || Number(metrics?.rejectionClassification?.auth) !== 0
    || Number(metrics?.rejectionClassification?.rateLimit) !== 0
    || Number(metrics?.rejectionClassification?.unexpected) !== 0) {
    throw new Error("PRE_ALPHA_REMOTE_LOAD_NOT_PASSED");
  }
  return true;
};

export const validatePreAlphaEvidenceBundleSummary = (summary, buildSha) => {
  const reports = Array.isArray(summary?.reports) ? summary.reports : [];
  if (!summary || summary.status !== "passed" || summary.verdict !== "passed"
    || summary.buildSha !== buildSha || summary.counts?.required !== 9
    || summary.counts?.passed !== 9 || summary.counts?.failed !== 0
    || summary.counts?.notPassed !== 0 || summary.counts?.notRun !== 0
    || reports.length !== 9
    || reports.some((report) => report?.status !== "passed" || report?.availability !== "present")) {
    throw new Error("PRE_ALPHA_EVIDENCE_BUNDLE_NOT_PASSED");
  }
  return true;
};

export const preAlphaEvidenceOutputDirectory = (artifactRoot, buildSha) => (
  path.join(artifactRoot, `pre-alpha-hardening-${String(buildSha).slice(0, 7)}`)
);

export const remoteSuiteSummaryPath = (artifactRoot, suiteName) => (
  path.join(artifactRoot, "remote-suites", suiteName, "summary.json")
);

export const remoteLoadSummaryPath = (artifactRoot) => (
  path.join(artifactRoot, "load-soak", "summary.json")
);
