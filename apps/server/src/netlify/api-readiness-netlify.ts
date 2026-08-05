import { getProductionSchemaStatus, type PostgresDatabase } from "../runtime/persistence/postgres";
import { createJsonResponse, type NetlifyFunctionResponse } from "./netlify-json-response";
import { evaluateSupportedNodeVersion } from "../../../../scripts/supported-node-policy.mjs";

export const handleApiReadinessRequest = (
  method: string,
  database: PostgresDatabase | null,
  environment: Record<string, string | undefined>
): Promise<NetlifyFunctionResponse> => method.toUpperCase() === "GET"
  ? createApiReadinessResponse(database, environment)
  : Promise.resolve(readinessJson(405, { status: "unavailable", service: "empire-api", code: "METHOD_NOT_ALLOWED" }));

export const createApiReadinessResponse = async (
  database: PostgresDatabase | null,
  environment: Record<string, string | undefined>,
  runtimeVersion: string = process.versions.node
): Promise<NetlifyFunctionResponse> => {
  const buildSha = normalizeBuildSha(environment.EMPIRE_BUILD_SHA);
  const runtime = safeRuntimeMetadata(runtimeVersion);
  const release = safeReleaseMetadata(environment);
  if (!runtime.supported) return unavailable("NODE_RUNTIME_UNSUPPORTED", buildSha, "unavailable", "unavailable", runtime, release);
  if (environment.NODE_ENV === "production" && !release.environment) {
    return unavailable("RELEASE_ENVIRONMENT_UNAVAILABLE", buildSha, "unavailable", "unavailable", runtime, release);
  }
  if (!database) return unavailable("DATABASE_UNAVAILABLE", buildSha, "unavailable", "unavailable", runtime, release);
  try {
    await database.query("SELECT 1 AS connected");
  } catch {
    return unavailable("DATABASE_UNAVAILABLE", buildSha, "unavailable", "unavailable", runtime, release);
  }
  let schema: Awaited<ReturnType<typeof getProductionSchemaStatus>>;
  try {
    schema = await getProductionSchemaStatus(database);
  } catch {
    return unavailable("DATABASE_SCHEMA_UNAVAILABLE", buildSha, "available", "unavailable", runtime, release);
  }
  if (!schema.current) {
    return unavailable("DATABASE_MIGRATIONS_PENDING", buildSha, "available", "pending", runtime, release, schema);
  }
  if (!buildSha) return unavailable("BUILD_SHA_UNAVAILABLE", null, "available", "current", runtime, release, schema);
  return readinessJson(200, {
    status: "ready",
    service: "empire-api",
    code: null,
    database: "available",
    schema: "current",
    schemaVersion: schema.appliedVersion,
    expectedSchemaVersion: schema.expectedVersion,
    buildSha,
    apiBuildSha: buildSha,
    environment: release.environment ?? "local",
    region: release.region,
    runtime
  });
};

const unavailable = (
  code: string,
  buildSha: string | null,
  database: "available" | "unavailable",
  schema: "current" | "pending" | "unavailable" = "unavailable",
  runtime: ReturnType<typeof safeRuntimeMetadata> = safeRuntimeMetadata(process.versions.node),
  release: ReturnType<typeof safeReleaseMetadata> = { environment: null, region: null },
  schemaStatus?: Awaited<ReturnType<typeof getProductionSchemaStatus>>
) => readinessJson(503, {
  status: "unavailable",
  service: "empire-api",
  code,
  database,
  schema,
  schemaVersion: schemaStatus?.appliedVersion ?? null,
  expectedSchemaVersion: schemaStatus?.expectedVersion ?? null,
  buildSha,
  apiBuildSha: buildSha,
  environment: release.environment ?? "local",
  region: release.region,
  runtime
});

const readinessJson = (statusCode: number, body: Record<string, unknown>) => createJsonResponse(statusCode, body, {
  "cache-control": "no-store"
});

const normalizeBuildSha = (value: string | undefined): string | null => {
  const normalized = String(value ?? "").trim();
  return /^[0-9a-f]{40}$/u.test(normalized) ? normalized : null;
};

const safeReleaseMetadata = (environment: Record<string, string | undefined>) => {
  const releaseEnvironment = String(environment.EMPIRE_RELEASE_ENVIRONMENT ?? "").trim();
  const region = String(environment.EMPIRE_RUNTIME_REGION ?? "").trim();
  return {
    environment: ["staging", "production"].includes(releaseEnvironment) ? releaseEnvironment : null,
    region: /^[a-z0-9._:-]{2,64}$/u.test(region) ? region : null
  };
};

const safeRuntimeMetadata = (value: string) => {
  const result = evaluateSupportedNodeVersion(value);
  return {
    nodeVersion: result.detectedVersion,
    nodeMajor: result.detectedMajor,
    supported: result.supported
  };
};
