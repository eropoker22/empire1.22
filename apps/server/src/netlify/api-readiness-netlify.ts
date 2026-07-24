import { isProductionSchemaCurrent, type PostgresDatabase } from "../runtime/persistence/postgres";
import { createJsonResponse, type NetlifyFunctionResponse } from "./netlify-json-response";

export const handleApiReadinessRequest = (
  method: string,
  database: PostgresDatabase | null,
  environment: Record<string, string | undefined>
): Promise<NetlifyFunctionResponse> => method.toUpperCase() === "GET"
  ? createApiReadinessResponse(database, environment)
  : Promise.resolve(createJsonResponse(405, { status: "unavailable", code: "METHOD_NOT_ALLOWED" }));

export const createApiReadinessResponse = async (
  database: PostgresDatabase | null,
  environment: Record<string, string | undefined>
): Promise<NetlifyFunctionResponse> => {
  const buildSha = normalizeBuildSha(environment.EMPIRE_BUILD_SHA);
  if (!database) return unavailable("DATABASE_UNAVAILABLE", buildSha, "unavailable");
  try {
    await database.query("SELECT 1 AS connected");
  } catch {
    return unavailable("DATABASE_UNAVAILABLE", buildSha, "unavailable");
  }
  const schemaCurrent = await isProductionSchemaCurrent(database);
  if (!schemaCurrent) return unavailable("DATABASE_MIGRATIONS_PENDING", buildSha, "available");
  if (!buildSha) return unavailable("BUILD_SHA_UNAVAILABLE", null, "available", "current");
  return createJsonResponse(200, {
    status: "ready",
    code: null,
    database: "available",
    schema: "current",
    buildSha
  });
};

const unavailable = (
  code: string,
  buildSha: string | null,
  database: "available" | "unavailable",
  schema: "current" | "unavailable" = "unavailable"
) => createJsonResponse(503, { status: "unavailable", code, database, schema, buildSha });

const normalizeBuildSha = (value: string | undefined): string | null => {
  const normalized = String(value ?? "").trim();
  return /^[0-9a-f]{40}$/u.test(normalized) ? normalized : null;
};
