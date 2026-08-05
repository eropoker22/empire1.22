import * as crypto from "node:crypto";

const PUBLIC_RELEASE_ENVIRONMENTS = new Set(["staging", "production"]);
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const EU_REGION_CODES = new Set(["ams", "arn", "cdg", "fra", "lhr", "mad", "waw"]);
const SECURE_SECRET_PATTERN = /^(?:[0-9a-f]{64,}|[A-Za-z0-9_-]{43,})$/u;
const SHA_PATTERN = /^[0-9a-f]{40}$/u;

export interface HostedRuntimeWorkerEnvironment {
  databaseUrl: string;
  workerId: string;
  region: string;
  runtimeRegion: string;
  buildSha: string;
  port: number;
  releaseEnvironment: string;
  publicRelease: boolean;
}

export const resolveHostedRuntimeWorkerEnvironment = (
  environment: Record<string, string | undefined>
): HostedRuntimeWorkerEnvironment => {
  const releaseEnvironment = String(environment.EMPIRE_RELEASE_ENVIRONMENT ?? "").trim();
  const publicRelease = PUBLIC_RELEASE_ENVIRONMENTS.has(releaseEnvironment);
  if (environment.NODE_ENV === "production" && !publicRelease) {
    throw new Error("HOSTED_WORKER_RELEASE_ENVIRONMENT_INVALID");
  }
  const databaseUrl = String(environment.EMPIRE_DATABASE_URL ?? "").trim();
  const gameplayDatabaseUrl = String(environment.GAMEPLAY_DATABASE_URL ?? "").trim();
  const workerId = String(environment.EMPIRE_HOSTED_WORKER_ID ?? "").trim();
  const region = String(environment.EMPIRE_HOSTED_WORKER_REGION ?? "").trim();
  const runtimeRegion = String(environment.EMPIRE_RUNTIME_REGION ?? region).trim();
  const buildSha = String(environment.EMPIRE_BUILD_SHA ?? "local").trim();
  const port = Number(environment.PORT ?? 8080);
  const sessionSecret = String(environment.GAMEPLAY_SLICE_SESSION_SECRET ?? "").trim();
  const snapshotSecret = String(environment.GAMEPLAY_SLICE_SNAPSHOT_SECRET ?? "").trim();
  if (!databaseUrl || !workerId) throw new Error("HOSTED_WORKER_DATABASE_OR_ID_MISSING");
  if (environment.EMPIRE_PERSISTENCE_DRIVER !== "postgres" || environment.GAMEPLAY_PERSISTENCE_DRIVER !== "postgres") {
    throw new Error("HOSTED_WORKER_POSTGRES_PERSISTENCE_REQUIRED");
  }
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error("HOSTED_WORKER_PORT_INVALID");
  if (publicRelease) {
    const empireTarget = parseDirectNeonTarget(databaseUrl);
    const gameplayTarget = parseDirectNeonTarget(gameplayDatabaseUrl);
    if (!empireTarget || !gameplayTarget) throw new Error("HOSTED_WORKER_DIRECT_TLS_DATABASE_REQUIRED");
    if (empireTarget !== gameplayTarget) throw new Error("HOSTED_WORKER_DATABASE_TARGET_MISMATCH");
    if (!SHA_PATTERN.test(buildSha)) throw new Error("HOSTED_WORKER_BUILD_SHA_INVALID");
    if (!isStablePublicIdentifier(workerId)) throw new Error("HOSTED_WORKER_ID_INVALID");
    if (!isEuRegion(region) || runtimeRegion !== region) throw new Error("HOSTED_WORKER_REGION_INVALID");
    if (environment.EMPIRE_TICK_WORKER_OWNER_ID !== workerId) throw new Error("HOSTED_WORKER_LEASE_OWNER_INVALID");
    if (!["1", "true"].includes(String(environment.EMPIRE_HOSTED_PREFLIGHT_STRICT ?? "").trim().toLowerCase())) {
      throw new Error("HOSTED_WORKER_STRICT_PREFLIGHT_REQUIRED");
    }
    if (!SECURE_SECRET_PATTERN.test(sessionSecret) || !SECURE_SECRET_PATTERN.test(snapshotSecret)
      || sessionSecret === snapshotSecret) {
      throw new Error("HOSTED_WORKER_SECRETS_INVALID");
    }
    if (releaseEnvironment === "production" && empireTarget.toLowerCase().includes("staging")) {
      throw new Error("HOSTED_WORKER_PRODUCTION_DATABASE_LOOKS_LIKE_STAGING");
    }
    if (releaseEnvironment === "production") {
      const expectedTargetHash = String(environment.EMPIRE_PRODUCTION_DATABASE_TARGET_HASH ?? "").trim();
      if (!/^[0-9a-f]{64}$/u.test(expectedTargetHash)
        || safeTargetHash(empireTarget) !== expectedTargetHash
        || safeTargetHash(gameplayTarget) !== expectedTargetHash) {
        throw new Error("HOSTED_WORKER_PRODUCTION_DATABASE_TARGET_MISMATCH");
      }
    }
  } else if (sessionSecret.length < 32 || snapshotSecret.length < 32 || sessionSecret === snapshotSecret) {
    throw new Error("HOSTED_WORKER_SECRETS_INVALID");
  }
  return {
    databaseUrl,
    workerId,
    region: region || "eu-central",
    runtimeRegion: runtimeRegion || "eu-central",
    buildSha,
    port,
    releaseEnvironment,
    publicRelease
  };
};

const parseDirectNeonTarget = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    const tls = ["require", "verify-ca", "verify-full"].includes(parsed.searchParams.get("sslmode") ?? "");
    const endpointLabel = parsed.hostname.toLowerCase().split(".")[0] ?? "";
    const direct = parsed.hostname.endsWith(".neon.tech") && !endpointLabel.endsWith("-pooler");
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
    if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.username || !parsed.password
      || LOOPBACK_HOSTNAMES.has(parsed.hostname) || !tls || !direct || !databaseName || databaseName.includes("/")) {
      return null;
    }
    return `${parsed.hostname.toLowerCase()}:${parsed.port || "5432"}/${databaseName}`;
  } catch {
    return null;
  }
};

const isStablePublicIdentifier = (value: string): boolean => /^[a-z0-9._:-]{3,128}$/u.test(value)
  && !value.includes("local") && !value.includes("localhost");
const isEuRegion = (value: string): boolean => EU_REGION_CODES.has(value.toLowerCase())
  || /^(?:eu|europe)[a-z0-9._:-]*$/iu.test(value);
const safeTargetHash = (value: string): string => crypto.createHash("sha256").update(value).digest("hex");
