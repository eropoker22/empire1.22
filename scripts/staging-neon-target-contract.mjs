import { createHash } from "node:crypto";
import { releaseDatabaseTargetHash } from "./release-database-target-hash.mjs";

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const PROVIDER_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/u;
const TLS_MODES = new Set(["require", "verify-ca", "verify-full"]);

const fail = (code) => {
  throw new Error(code);
};

const safeHash = (value) => createHash("sha256").update(value).digest("hex");
const TARGET_BINDING_KEYS = [
  "branchIdHash",
  "databaseTargetHash",
  "endpointIdHash",
  "environment",
  "projectIdHash",
  "releaseSha",
  "schemaVersion",
  "status"
];
const hasExactKeys = (value, expectedKeys) => value && typeof value === "object"
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expectedKeys);

const readDatabaseTarget = (value, connectionMode) => {
  let parsed;
  try {
    parsed = new URL(String(value ?? "").trim());
  } catch {
    fail("STAGING_NEON_DATABASE_URL_INVALID");
  }
  const hostname = parsed.hostname.toLowerCase();
  const endpointLabel = hostname.split(".")[0] ?? "";
  const pooled = endpointLabel.endsWith("-pooler");
  let databaseName;
  try {
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
  } catch {
    fail("STAGING_NEON_DATABASE_URL_INVALID");
  }
  if (!(["postgres:", "postgresql:"].includes(parsed.protocol))
    || !parsed.username
    || !parsed.password
    || !hostname.endsWith(".neon.tech")
    || !TLS_MODES.has(parsed.searchParams.get("sslmode") ?? "")
    || !databaseName
    || databaseName.includes("/")
    || (connectionMode === "direct" && pooled)
    || (connectionMode === "pooled" && !pooled)) {
    fail("STAGING_NEON_DATABASE_URL_INVALID");
  }
  return Object.freeze({
    databaseName,
    hostname,
    targetHash: releaseDatabaseTargetHash(parsed)
  });
};

export const verifyStagingNeonTargetBinding = ({
  environment,
  branchResponse,
  endpointsResponse
}) => {
  if (environment.EMPIRE_RELEASE_ENVIRONMENT !== "staging"
    || environment.EMPIRE_DATABASE_TARGET_ENVIRONMENT !== "staging") {
    fail("STAGING_NEON_ENVIRONMENT_INVALID");
  }
  const expectedTargetHash = String(environment.EMPIRE_STAGING_DATABASE_TARGET_HASH ?? "").trim();
  const projectId = String(environment.NEON_PROJECT_ID ?? "").trim();
  const branchId = String(environment.NEON_BRANCH_ID ?? "").trim();
  const productionProjectId = String(environment.NEON_PRODUCTION_PROJECT_ID ?? "").trim();
  const productionBranchId = String(environment.NEON_PRODUCTION_ROOT_BRANCH_ID ?? "").trim();
  const productionTargetHash = String(environment.EMPIRE_PRODUCTION_DATABASE_TARGET_HASH ?? "").trim();
  const releaseSha = String(environment.RELEASE_SHA ?? "").trim();
  if (!SHA256_PATTERN.test(expectedTargetHash)
    || !PROVIDER_ID_PATTERN.test(projectId)
    || !PROVIDER_ID_PATTERN.test(branchId)
    || !PROVIDER_ID_PATTERN.test(productionProjectId)
    || !PROVIDER_ID_PATTERN.test(productionBranchId)
    || !SHA256_PATTERN.test(productionTargetHash)
    || !SHA_PATTERN.test(releaseSha)) {
    fail("STAGING_NEON_BINDING_INPUT_INVALID");
  }
  if (projectId === productionProjectId
    || branchId === productionBranchId
    || expectedTargetHash === productionTargetHash) {
    fail("STAGING_NEON_PRODUCTION_TARGET_REJECTED");
  }

  const directTargets = [
    readDatabaseTarget(environment.EMPIRE_DATABASE_URL, "direct"),
    readDatabaseTarget(environment.GAMEPLAY_DATABASE_URL, "direct")
  ];
  const pooledTargets = [
    readDatabaseTarget(environment.EMPIRE_RELEASE_DATABASE_URL_POOLED, "pooled"),
    readDatabaseTarget(environment.GAMEPLAY_RELEASE_DATABASE_URL_POOLED, "pooled")
  ];
  const targets = [...directTargets, ...pooledTargets];
  const productionUrl = String(environment.EMPIRE_PRODUCTION_DATABASE_URL ?? "").trim();
  if (productionUrl && readDatabaseTarget(productionUrl, "direct").targetHash === expectedTargetHash) {
    fail("STAGING_NEON_PRODUCTION_TARGET_REJECTED");
  }
  if (targets.some((target) => target.targetHash !== expectedTargetHash)
    || new Set(targets.map((target) => target.databaseName)).size !== 1
    || new Set(directTargets.map((target) => target.hostname)).size !== 1) {
    fail("STAGING_NEON_DATABASE_TARGET_MISMATCH");
  }

  const branch = branchResponse?.branch;
  if (!branch || branch.id !== branchId || branch.project_id !== projectId) {
    fail("STAGING_NEON_BRANCH_BINDING_MISMATCH");
  }
  const endpoints = endpointsResponse?.endpoints;
  if (!Array.isArray(endpoints) || endpoints.length === 0
    || endpoints.some((endpoint) => endpoint?.project_id !== projectId || endpoint?.branch_id !== branchId)) {
    fail("STAGING_NEON_ENDPOINT_BINDING_MISMATCH");
  }
  const directHostname = directTargets[0].hostname;
  const readWriteEndpoints = endpoints.filter((endpoint) => endpoint?.type === "read_write");
  if (readWriteEndpoints.length !== 1
    || String(readWriteEndpoints[0]?.host ?? "").toLowerCase() !== directHostname
    || !PROVIDER_ID_PATTERN.test(String(readWriteEndpoints[0]?.id ?? ""))) {
    fail("STAGING_NEON_ENDPOINT_TARGET_MISMATCH");
  }

  return Object.freeze({
    schemaVersion: 1,
    status: "verified",
    environment: "staging",
    releaseSha,
    databaseTargetHash: expectedTargetHash,
    projectIdHash: safeHash(projectId),
    branchIdHash: safeHash(branchId),
    endpointIdHash: safeHash(readWriteEndpoints[0].id)
  });
};

export const verifyStagingNeonSnapshotBinding = ({
  environment,
  snapshotResponse,
  targetBinding
}) => {
  const expectedTargetHash = String(environment.EMPIRE_STAGING_DATABASE_TARGET_HASH ?? "").trim();
  const projectId = String(environment.NEON_PROJECT_ID ?? "").trim();
  const branchId = String(environment.NEON_BRANCH_ID ?? "").trim();
  const releaseSha = String(environment.RELEASE_SHA ?? "").trim();
  const snapshotName = String(environment.EMPIRE_STAGING_NEON_SNAPSHOT_NAME ?? "").trim();
  if (environment.EMPIRE_RELEASE_ENVIRONMENT !== "staging"
    || environment.EMPIRE_DATABASE_TARGET_ENVIRONMENT !== "staging"
    || !SHA256_PATTERN.test(expectedTargetHash)
    || !PROVIDER_ID_PATTERN.test(projectId)
    || !PROVIDER_ID_PATTERN.test(branchId)
    || !SHA_PATTERN.test(releaseSha)
    || !snapshotName) {
    fail("STAGING_NEON_SNAPSHOT_INPUT_INVALID");
  }
  if (!hasExactKeys(targetBinding, TARGET_BINDING_KEYS)
    || targetBinding?.schemaVersion !== 1
    || targetBinding?.status !== "verified"
    || targetBinding?.environment !== "staging"
    || targetBinding?.releaseSha !== releaseSha
    || targetBinding?.databaseTargetHash !== expectedTargetHash
    || targetBinding?.projectIdHash !== safeHash(projectId)
    || targetBinding?.branchIdHash !== safeHash(branchId)
    || !SHA256_PATTERN.test(String(targetBinding?.endpointIdHash ?? ""))) {
    fail("STAGING_NEON_SNAPSHOT_TARGET_BINDING_INVALID");
  }

  const snapshot = snapshotResponse?.snapshot;
  const operations = snapshotResponse?.operations;
  if (!snapshot
    || !PROVIDER_ID_PATTERN.test(String(snapshot.id ?? ""))
    || snapshot.source_branch_id !== branchId) {
    fail("STAGING_NEON_SNAPSHOT_BRANCH_MISMATCH");
  }
  if (!Array.isArray(operations)
    || operations.some((operation) => !PROVIDER_ID_PATTERN.test(String(operation?.id ?? ""))
      || operation?.project_id !== projectId
      || (Object.hasOwn(operation ?? {}, "branch_id") && operation.branch_id !== branchId))) {
    fail("STAGING_NEON_SNAPSHOT_OPERATION_MISMATCH");
  }

  const operationSetHash = safeHash(operations.map((operation) => operation.id).sort().join("\n"));
  return Object.freeze({
    schemaVersion: 1,
    status: "verified",
    environment: "staging",
    name: snapshotName,
    snapshotIdHash: safeHash(snapshot.id).slice(0, 16),
    sha: releaseSha,
    databaseTargetHash: expectedTargetHash,
    projectIdHash: targetBinding.projectIdHash,
    branchIdHash: targetBinding.branchIdHash,
    endpointIdHash: targetBinding.endpointIdHash,
    operationSetHash,
    operationCount: operations.length
  });
};
