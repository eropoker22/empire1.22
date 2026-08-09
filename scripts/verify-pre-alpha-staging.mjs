import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  assertRequiredRemoteSuitesRegistered,
  parsePreAlphaStagingArguments,
  PRE_ALPHA_CODE_PHASES,
  PRE_ALPHA_STAGING_PHASES,
  preAlphaEvidenceOutputDirectory,
  remoteLoadSummaryPath,
  remoteSuiteSummaryPath,
  PRE_ALPHA_FINAL_REGISTRATION_MODES,
  validateFinalRegistrationEvidence,
  validatePreAlphaEvidenceBundleSummary,
  validatePreAlphaReleaseSource,
  validatePreAlphaStagingInvocation,
  validateRemoteLoadEvidence,
  validateReleaseCriticalSuiteSummary,
  validateRemoteReleaseEvidence
} from "./pre-alpha-staging-contract.mjs";
import {
  getRemoteStagingAcceptanceSuite,
  REMOTE_STAGING_ACCEPTANCE_SUITES
} from "./remote-staging-acceptance-suites.mjs";
import { assertSupportedNodeVersion } from "./supported-node-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const runPreAlphaStaging = (argv = process.argv.slice(2), environment = process.env) => {
  assertSupportedNodeVersion(process.versions.node);
  assertRequiredRemoteSuitesRegistered();
  const options = parsePreAlphaStagingArguments(argv);
  if (options.help) {
    printHelp();
    return Object.freeze({ status: "help" });
  }
  if (options.planOnly) {
    printPlan(options);
    return Object.freeze({ status: "plan", phases: options.phases.map(({ name }) => name) });
  }

  const gitSha = git(["rev-parse", "HEAD"]);
  const worktreeStatus = git(["status", "--porcelain", "--untracked-files=all"]);
  const source = validatePreAlphaReleaseSource({ gitSha, worktreeStatus });
  const selectedStagingPhases = options.phases.filter(({ name }) => name.startsWith("staging-"));
  if (selectedStagingPhases.length > 0) {
    validatePreAlphaStagingInvocation({
      environment,
      gitSha,
      worktreeStatus,
      phases: selectedStagingPhases
    });
  }

  const artifactRoot = path.resolve(root, String(
    environment.EMPIRE_PRE_ALPHA_STAGING_ARTIFACT_ROOT || "artifacts/pre-alpha-staging"
  ));
  mkdirSync(artifactRoot, { recursive: true });
  const summary = {
    buildSha: gitSha,
    worktreeClean: source.worktreeClean,
    sourceVerified: source.sourceVerified,
    status: "running",
    stagingRequested: selectedStagingPhases.length > 0,
    phases: []
  };
  let validatedFinalEvidence = null;

  try {
    for (const selectedPhase of options.phases) {
      const result = { name: selectedPhase.name, status: "running", commands: [] };
      summary.phases.push(result);
      console.log(`[pre-alpha] phase=${selectedPhase.name}`);
      if (selectedPhase.name === "staging-final" || selectedPhase.name === "staging-evidence") {
        const { evidence: finalRegistrationEvidence, mode: finalRegistrationMode } =
          validateDownloadedFinalRegistrationEvidence(environment, gitSha);
        if (selectedPhase.name === "staging-final") {
          validatedFinalEvidence = {
            workflowRunId: String(finalRegistrationEvidence.workflowRunId),
            requiredRemoteSuiteCount: finalRegistrationEvidence.requiredRemoteSuites.length,
            registrationMode: finalRegistrationMode,
            registrationOpen: finalRegistrationMode === "open",
            registrationClosed: finalRegistrationMode === "closed",
            registrationExpiresAt: finalRegistrationEvidence.registrationExpiresAt
          };
        }
      }
      for (const command of selectedPhase.commands) {
        const commandEnvironment = selectedPhase.name.startsWith("staging-")
          ? stagingCommandEnvironment(environment, artifactRoot, command.id)
          : codeLevelEnvironment(environment);
        runNpmCommand(command, commandEnvironment, { artifactRoot, gitSha });
        result.commands.push({ id: command.id, status: "passed" });
        if (command.id === "remote-release-parity") {
          validateRemoteReleaseEvidence(
            readJson(path.join(artifactRoot, "remote-release-health.json"), "PRE_ALPHA_REMOTE_RELEASE_EVIDENCE_MISSING"),
            gitSha
          );
        }
        if (command.id.startsWith("remote-suite:")) {
          const suiteName = command.id.slice("remote-suite:".length);
          validateReleaseCriticalSuiteSummary(
            readJson(remoteSuiteSummaryPath(artifactRoot, suiteName), "PRE_ALPHA_REMOTE_SUMMARY_MISSING"),
            { suite: getRemoteStagingAcceptanceSuite(suiteName), buildSha: gitSha }
          );
        }
        if (command.id === "remote-load-soak") {
          validateRemoteLoadEvidence(
            readJson(remoteLoadSummaryPath(artifactRoot), "PRE_ALPHA_REMOTE_LOAD_EVIDENCE_MISSING"),
            gitSha
          );
        }
        if (command.id === "pre-alpha-evidence-bundle") {
          validatePreAlphaEvidenceBundleSummary(
            readJson(
              path.join(preAlphaEvidenceOutputDirectory(artifactRoot, gitSha), "summary.json"),
              "PRE_ALPHA_EVIDENCE_BUNDLE_MISSING"
            ),
            gitSha
          );
        }
      }
      result.status = "passed";
      writeCompletedPhaseEvidence(artifactRoot, selectedPhase, result, gitSha);
      writeCompletedCodeEvidenceIfReady(artifactRoot, summary, gitSha);
    }
    const ranFinal = options.phases.some(({ name }) => name === "staging-final");
    if (ranFinal && !validatedFinalEvidence) {
      throw new Error("PRE_ALPHA_STAGING_FINAL_COMPOSITE_EVIDENCE_REQUIRED");
    }
    summary.status = ranFinal
      ? "staging-passed"
      : selectedStagingPhases.length > 0 ? "phase-passed" : "code-passed";
    if (validatedFinalEvidence) summary.validatedFinalEvidence = validatedFinalEvidence;
    writeSummary(artifactRoot, summary);
    if (ranFinal) {
      console.log(`[pre-alpha] STAGING PASS sha=${gitSha}`);
    } else if (selectedStagingPhases.length > 0) {
      console.log(`[pre-alpha] Selected staging phases passed; final registration-policy verdict NOT RUN.`);
    } else {
      console.log(`[pre-alpha] CODE PASS sha=${gitSha}; staging was not requested.`);
    }
    return Object.freeze(summary);
  } catch (error) {
    const active = summary.phases.at(-1);
    if (active) active.status = "failed";
    summary.status = "failed";
    summary.errorCode = safeErrorCode(error);
    writeSummary(artifactRoot, summary);
    throw error;
  }
};

const runNpmCommand = (command, environment, context) => {
  console.log(`[pre-alpha] run=${command.id}`);
  const npmExecPath = String(environment.npm_execpath ?? "").trim();
  const commandArguments = command.args.map((argument) => resolveCommandArgument(argument, context));
  const args = ["run", command.script, ...(commandArguments.length > 0 ? ["--", ...commandArguments] : [])];
  const result = npmExecPath
    ? spawnSync(process.execPath, [npmExecPath, ...args], processOptions(environment))
    : spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, processOptions(environment));
  if (result.error || result.status !== 0) {
    throw new Error(`PRE_ALPHA_COMMAND_FAILED:${command.id}:${result.status ?? "spawn"}`);
  }
};

const resolveCommandArgument = (argument, { artifactRoot, gitSha }) => String(argument)
  .replaceAll("{artifactRoot}", artifactRoot)
  .replaceAll("{buildSha}", gitSha);

const validateDownloadedFinalRegistrationEvidence = (environment, gitSha) => {
  const mode = String(environment.EMPIRE_PRE_ALPHA_FINAL_REGISTRATION_MODE ?? "closed").trim();
  if (!PRE_ALPHA_FINAL_REGISTRATION_MODES.includes(mode)) {
    throw new Error("PRE_ALPHA_STAGING_FINAL_REGISTRATION_MODE_INVALID");
  }
  const configuredPath = String(
    environment.EMPIRE_PRE_ALPHA_STAGING_FINAL_REGISTRATION_EVIDENCE_PATH
      ?? (mode === "closed" ? environment.EMPIRE_PRE_ALPHA_STAGING_CLOSED_EVIDENCE_PATH : "")
      ?? ""
  ).trim();
  if (!configuredPath) throw new Error("PRE_ALPHA_STAGING_FINAL_REGISTRATION_EVIDENCE_REQUIRED");
  const evidence = readJson(
    path.resolve(root, configuredPath),
    "PRE_ALPHA_STAGING_FINAL_REGISTRATION_EVIDENCE_MISSING"
  );
  validateFinalRegistrationEvidence(evidence, gitSha, mode);
  return Object.freeze({ evidence, mode });
};

const writeCompletedPhaseEvidence = (artifactRoot, selectedPhase, result, gitSha) => {
  const destination = selectedPhase.name === "security"
    ? path.join(artifactRoot, "security", "summary.json")
    : selectedPhase.name === "concurrency"
      ? path.join(artifactRoot, "concurrency", "code-summary.json")
    : selectedPhase.name === "simulation"
      ? path.join(artifactRoot, "simulation", "balance-report.json")
      : null;
  if (!destination) return;
  writeJson(destination, {
    schemaVersion: 1,
    status: "passed",
    buildSha: gitSha,
    evidenceKind: "canonical-command-results",
    phase: selectedPhase.name,
    commands: result.commands.map((command) => ({ ...command }))
  });
};

const writeCompletedCodeEvidenceIfReady = (artifactRoot, summary, gitSha) => {
  const resultsByName = new Map(summary.phases.map((entry) => [entry.name, entry]));
  if (!PRE_ALPHA_CODE_PHASES.every(({ name }) => resultsByName.get(name)?.status === "passed")) return;
  writeJson(path.join(artifactRoot, "code-level", "summary.json"), {
    schemaVersion: 1,
    status: "code-passed",
    buildSha: gitSha,
    worktreeClean: summary.worktreeClean,
    sourceVerified: summary.sourceVerified,
    evidenceKind: "canonical-command-results",
    phases: PRE_ALPHA_CODE_PHASES.map(({ name }) => ({
      name,
      status: resultsByName.get(name).status,
      commands: resultsByName.get(name).commands.map((command) => ({ ...command }))
    }))
  });
};

const processOptions = (environment) => ({
  cwd: root,
  env: environment,
  stdio: "inherit",
  windowsHide: true
});

const codeLevelEnvironment = (environment) => {
  const sanitized = { ...environment, NODE_ENV: "test" };
  for (const name of [
    "EMPIRE_RELEASE_ENVIRONMENT",
    "EMPIRE_BUILD_SHA",
    "EMPIRE_DATABASE_URL",
    "GAMEPLAY_DATABASE_URL",
    "EMPIRE_TEST_DATABASE_URL",
    "EMPIRE_DATABASE_TARGET_ENVIRONMENT",
    "EMPIRE_REMOTE_STAGING_FIXTURE_APPROVED",
    "EMPIRE_CLOSED_ALPHA_PREFLIGHT_STRICT",
    "EMPIRE_HOSTED_PREFLIGHT_STRICT",
    "NETLIFY"
  ]) delete sanitized[name];
  return sanitized;
};

const stagingCommandEnvironment = (environment, artifactRoot, commandId) => {
  if (commandId.startsWith("remote-suite:")) {
    const suiteName = commandId.slice("remote-suite:".length);
    return {
      ...environment,
      EMPIRE_REMOTE_STAGING_ARTIFACT_ROOT: path.dirname(remoteSuiteSummaryPath(artifactRoot, suiteName))
    };
  }
  if (commandId === "remote-load-soak") {
    return {
      ...environment,
      EMPIRE_REMOTE_STAGING_ARTIFACT_ROOT: path.dirname(remoteLoadSummaryPath(artifactRoot))
    };
  }
  const sanitized = { ...environment };
  for (const name of Object.keys(sanitized)) {
    if (/(?:SECRET|PASSWORD|TOKEN|PEPPER|DATABASE_URL)/u.test(name)) delete sanitized[name];
  }
  if (commandId === "remote-release-parity") {
    sanitized.EMPIRE_REMOTE_RELEASE_EVIDENCE_PATH = path.join(artifactRoot, "remote-release-health.json");
  }
  return sanitized;
};

const git = (args) => execFileSync("git", args, {
  cwd: root,
  encoding: "utf8",
  windowsHide: true
}).trim();

const readJson = (filePath, code) => {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    throw new Error(code);
  }
};

const writeSummary = (artifactRoot, summary) => {
  writeJson(path.join(artifactRoot, "summary.json"), {
    ...summary,
    completedAt: new Date().toISOString()
  });
};

const writeJson = (filePath, value) => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const safeErrorCode = (error) => String(error?.message ?? error ?? "PRE_ALPHA_UNKNOWN_FAILURE")
  .split(":", 1)[0]
  .replace(/[^A-Z0-9_.-]/giu, "_")
  .slice(0, 120);

const printPlan = (options) => {
  console.log(`[pre-alpha] mode=${options.staging ? "staging" : "code-level"}`);
  for (const selectedPhase of options.phases) {
    console.log(`[pre-alpha] phase=${selectedPhase.name}`);
    for (const command of selectedPhase.commands) console.log(`[pre-alpha]   ${command.id}`);
  }
  if (!options.staging) console.log("[pre-alpha] staging remote suites NOT RUN (use --staging with guarded environment).");
};

const printHelp = () => {
  console.log("Usage: npm run verify:pre-alpha:staging -- [--staging] [--phase=<name>[,<name>]] [--plan]");
  console.log(`Code phases: ${PRE_ALPHA_CODE_PHASES.map(({ name }) => name).join(", ")}`);
  console.log(`Staging phases: ${PRE_ALPHA_STAGING_PHASES.map(({ name }) => name).join(", ")}`);
  console.log("Staging execution requires the exact staging origin/SHA, a clean checkout, and explicit target guards.");
  console.log("Run staging-parity/staging-suites while the workflow registration window is open, then staging-final with its downloaded final-registration evidence.");
  console.log("Final registration defaults to closed; an explicit open mode accepts only a still-valid time-limited staging window.");
  console.log("Run staging-evidence only after mapping exact-SHA code, remote, load, release-health and final-policy artifacts into the configured artifact root.");
  console.log("The command never deploys, opens registration, closes registration, or starts a local database.");
};

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    runPreAlphaStaging();
  } catch (error) {
    console.error(`[pre-alpha] NO-GO ${safeErrorCode(error)}`);
    process.exitCode = 1;
  }
}
