import {
  evaluateSupportedNodeVersion,
  SUPPORTED_NODE_MAJOR
} from "./supported-node-policy.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const SCHEMA_PATTERN = /^\d{3}_[a-z0-9_]+\.sql$/u;
const NPM_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u;

export const createProductionReleaseManifest = ({
  gitSha,
  expectedSchemaVersion,
  nodeVersion = process.versions.node,
  npmVersion,
  createdAt = new Date().toISOString()
}) => {
  const nodeRuntime = evaluateSupportedNodeVersion(nodeVersion);
  if (!SHA_PATTERN.test(String(gitSha ?? ""))) throw new Error("PRODUCTION_MANIFEST_SHA_INVALID");
  if (!SCHEMA_PATTERN.test(String(expectedSchemaVersion ?? ""))) {
    throw new Error("PRODUCTION_MANIFEST_SCHEMA_INVALID");
  }
  if (!nodeRuntime.supported || nodeRuntime.detectedMajor !== SUPPORTED_NODE_MAJOR) {
    throw new Error("PRODUCTION_MANIFEST_NODE_INVALID");
  }
  if (!NPM_VERSION_PATTERN.test(String(npmVersion ?? ""))) throw new Error("PRODUCTION_MANIFEST_NPM_INVALID");
  const createdAtValue = String(createdAt ?? "");
  const createdAtMs = Date.parse(createdAtValue);
  if (!Number.isFinite(createdAtMs) || new Date(createdAtMs).toISOString() !== createdAtValue) {
    throw new Error("PRODUCTION_MANIFEST_TIME_INVALID");
  }
  return Object.freeze({
    gitSha,
    frontendBuildSha: gitSha,
    apiBuildSha: gitSha,
    workerBuildSha: gitSha,
    expectedSchemaVersion,
    nodeVersion: nodeRuntime.detectedVersion,
    nodeMajor: nodeRuntime.detectedMajor,
    npmVersion,
    createdAt,
    buildTimestamp: createdAt,
    environment: "production",
    targetEnvironment: "production",
    verificationMode: "production-environment"
  });
};
