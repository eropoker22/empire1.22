import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  HOSTED_ACCEPTANCE_SUITES,
  REMOTE_STAGING_ACCEPTANCE_SUITES
} from "./remote-staging-acceptance-suites.mjs";
import { assertSupportedNodeVersion } from "./supported-node-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const renderHostedAcceptanceMatrix = () => HOSTED_ACCEPTANCE_SUITES
  .map((suite) => [
    `          - label: ${suite.name}`,
    `            suite: ${suite.name}`,
    `            timeout: ${suite.workflowTimeoutMinutes}`
  ].join("\n"))
  .join("\n");

const renderRemoteStagingMatrix = () => REMOTE_STAGING_ACCEPTANCE_SUITES
  .map((suite) => [
    `          - label: remote-${suite.name}`,
    `            suite: ${suite.name}`,
    `            timeout: ${suite.workflowTimeoutMinutes}`,
    `            fixture: ${Boolean(suite.scenario || suite.fullLifecycle)}`,
    `            restart_worker: ${suite.restartWorkerBeforeSpec || suite.fullLifecycle}`
  ].join("\n"))
  .join("\n");

const renderHostedAcceptanceEvidenceJobs = () => (
  `          expected=(${HOSTED_ACCEPTANCE_SUITES.map(({ name }) => name).join(" ")})`
);

export const RELEASE_SUITE_MATRIX_TARGETS = Object.freeze([
  Object.freeze({
    relativePath: ".github/workflows/hosted-acceptance.yml",
    marker: "hosted-acceptance",
    render: renderHostedAcceptanceMatrix
  }),
  Object.freeze({
    relativePath: ".github/workflows/staging-remote-acceptance.yml",
    marker: "staging-remote-acceptance",
    render: renderRemoteStagingMatrix
  }),
  Object.freeze({
    relativePath: ".github/workflows/deploy-staging.yml",
    marker: "hosted-acceptance-evidence",
    render: renderHostedAcceptanceEvidenceJobs
  })
]);

export const generatedSuiteMarkers = (marker) => Object.freeze({
  start: `# BEGIN GENERATED RELEASE SUITES: ${marker}`,
  end: `# END GENERATED RELEASE SUITES: ${marker}`
});

export const replaceGeneratedSuiteBlock = (source, target) => {
  const newline = String(source).includes("\r\n") ? "\r\n" : "\n";
  const markers = generatedSuiteMarkers(target.marker);
  const startIndex = source.indexOf(markers.start);
  const endIndex = source.indexOf(markers.end);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new Error(`RELEASE_SUITE_MATRIX_MARKERS_INVALID:${target.relativePath}:${target.marker}`);
  }
  const contentStart = source.indexOf(newline, startIndex);
  if (contentStart < 0 || contentStart >= endIndex) {
    throw new Error(`RELEASE_SUITE_MATRIX_MARKERS_INVALID:${target.relativePath}:${target.marker}`);
  }
  const endLineStart = source.lastIndexOf(newline, endIndex) + newline.length;
  const generated = target.render().replaceAll("\n", newline);
  return `${source.slice(0, contentStart + newline.length)}${generated}${newline}${source.slice(endLineStart)}`;
};

export const checkReleaseSuiteMatrixSources = (sources) => {
  const drift = [];
  for (const target of RELEASE_SUITE_MATRIX_TARGETS) {
    const source = sources[target.relativePath];
    if (typeof source !== "string") {
      drift.push(target.relativePath);
      continue;
    }
    if (replaceGeneratedSuiteBlock(source, target) !== source) drift.push(target.relativePath);
  }
  return Object.freeze(drift);
};

export const findMissingHostedAcceptanceSuites = (runnerSource) => {
  const start = String(runnerSource).indexOf("const hostedSuites = Object.freeze([");
  const end = String(runnerSource).indexOf("\n]);", start);
  if (start < 0 || end <= start) return Object.freeze([...HOSTED_ACCEPTANCE_SUITES.map(({ name }) => name)]);
  const registrySource = runnerSource.slice(start, end);
  return Object.freeze(HOSTED_ACCEPTANCE_SUITES
    .map(({ name }) => name)
    .filter((name) => !registrySource.includes(`name: "${name}"`)));
};

export const synchronizeReleaseSuiteMatrices = ({ check = false } = {}) => {
  const missingHostedSuites = findMissingHostedAcceptanceSuites(
    readFileSync(path.join(root, "scripts/run-local-hosted-full.mjs"), "utf8")
  );
  if (missingHostedSuites.length > 0) {
    throw new Error(`RELEASE_SUITE_LOCAL_RUNNER_DRIFT:${missingHostedSuites.join(",")}`);
  }
  const drift = [];
  for (const target of RELEASE_SUITE_MATRIX_TARGETS) {
    const absolutePath = path.join(root, target.relativePath);
    const source = readFileSync(absolutePath, "utf8");
    const expected = replaceGeneratedSuiteBlock(source, target);
    if (expected === source) continue;
    drift.push(target.relativePath);
    if (!check) writeFileSync(absolutePath, expected, "utf8");
  }
  if (check && drift.length > 0) {
    throw new Error(`RELEASE_SUITE_MATRIX_DRIFT:${drift.join(",")}`);
  }
  return Object.freeze(drift);
};

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  assertSupportedNodeVersion(process.versions.node);
  const check = process.argv.includes("--check");
  const drift = synchronizeReleaseSuiteMatrices({ check });
  console.log(check
    ? `Release suite matrices match ${REMOTE_STAGING_ACCEPTANCE_SUITES.length} registered suites.`
    : `Updated ${drift.length} release suite matrix file(s).`);
}
