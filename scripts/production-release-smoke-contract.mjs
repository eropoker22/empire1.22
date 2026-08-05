import {
  evaluateSupportedNodeVersion,
  SUPPORTED_NODE_MAJOR
} from "./supported-node-policy.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/u;
const ADMIN_USERNAME_PATTERN = /^\S(?:.{1,126}\S)?$/u;
const FLY_APP_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/u;
const ARTIFACT_ROOT_PATTERN = /^artifacts\/release\/production\/smoke(?:\/[A-Za-z0-9._-]+)*$/u;
const EU_REGION_CODES = new Set(["ams", "arn", "cdg", "fra", "lhr", "mad", "waw"]);

export const validateProductionReleaseSmokeEnvironment = (environment, options = {}) => {
  requireValue(environment.EMPIRE_PRODUCTION_REMOTE_SMOKE === "1", "PRODUCTION_SMOKE_APPROVAL_REQUIRED");
  requireValue(environment.NODE_ENV === "production"
    && environment.EMPIRE_RELEASE_ENVIRONMENT === "production"
    && environment.EMPIRE_DATABASE_TARGET_ENVIRONMENT === "production",
  "PRODUCTION_SMOKE_ENVIRONMENT_INVALID");
  requireValue(environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED === "false"
    && !String(environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT ?? "").trim(),
  "PRODUCTION_SMOKE_REGISTRATION_OPEN");

  const buildSha = String(environment.EMPIRE_BUILD_SHA ?? "").trim();
  const gitSha = String(options.gitSha ?? "").trim();
  requireValue(SHA_PATTERN.test(buildSha) && buildSha === gitSha, "PRODUCTION_SMOKE_SHA_MISMATCH");
  requireValue(environment.EMPIRE_PUBLIC_ORIGIN === "https://empirestreets.cz", "PRODUCTION_SMOKE_ORIGIN_INVALID");

  const flyApp = String(environment.FLY_PRODUCTION_APP ?? "").trim();
  requireValue(flyApp.length >= 3 && FLY_APP_PATTERN.test(flyApp), "PRODUCTION_SMOKE_FLY_APP_INVALID");
  const workerOrigin = `https://${flyApp}.fly.dev`;
  requireValue(environment.EMPIRE_HOSTED_WORKER_ORIGIN === workerOrigin, "PRODUCTION_SMOKE_WORKER_ORIGIN_INVALID");
  const runtimeRegion = String(environment.EMPIRE_RUNTIME_REGION ?? "").trim().toLowerCase();
  requireValue(EU_REGION_CODES.has(runtimeRegion), "PRODUCTION_SMOKE_REGION_INVALID");

  const adminUsername = String(environment.PRODUCTION_ADMIN_USERNAME ?? "").normalize("NFKC").trim();
  const smokeUsername = String(environment.PRODUCTION_SMOKE_ACCOUNT_USERNAME ?? "").normalize("NFKC").trim();
  const adminPassword = String(environment.PRODUCTION_ADMIN_PASSWORD ?? "");
  const smokePassword = String(environment.PRODUCTION_SMOKE_ACCOUNT_PASSWORD ?? "");
  requireValue(ADMIN_USERNAME_PATTERN.test(adminUsername), "PRODUCTION_SMOKE_ADMIN_USERNAME_INVALID");
  requireValue(USERNAME_PATTERN.test(smokeUsername), "PRODUCTION_SMOKE_ACCOUNT_USERNAME_INVALID");
  requireValue(validPassword(adminPassword), "PRODUCTION_SMOKE_ADMIN_PASSWORD_INVALID");
  requireValue(validPassword(smokePassword), "PRODUCTION_SMOKE_ACCOUNT_PASSWORD_INVALID");
  requireValue(adminPassword !== smokePassword, "PRODUCTION_SMOKE_PASSWORD_REUSED");

  const artifactRoot = String(environment.EMPIRE_PRODUCTION_SMOKE_ARTIFACT_ROOT
    ?? "artifacts/release/production/smoke").replace(/\\/gu, "/").replace(/\/$/u, "");
  requireValue(ARTIFACT_ROOT_PATTERN.test(artifactRoot) && !artifactRoot.includes(".."),
    "PRODUCTION_SMOKE_ARTIFACT_ROOT_INVALID");
  const nodeRuntime = evaluateSupportedNodeVersion(options.nodeVersion ?? process.versions.node);
  requireValue(nodeRuntime.supported && nodeRuntime.detectedMajor === SUPPORTED_NODE_MAJOR,
    "PRODUCTION_SMOKE_NODE_INVALID");

  return Object.freeze({
    adminUsername,
    artifactRoot,
    buildSha,
    environment: "production",
    flyApp,
    publicOrigin: "https://empirestreets.cz",
    runtimeRegion,
    smokeUsername,
    workerOrigin
  });
};

const validPassword = (value) => value.length >= 20 && value.length <= 1024
  && !value.includes("\n") && !value.includes("\r");

const requireValue = (condition, code) => {
  if (!condition) throw new Error(code);
};
