import type { PostgresDatabase } from "../../../apps/server/src/runtime/persistence/postgres";
import { migrateDatabase } from "../../../apps/server/src/runtime/persistence/postgres/migration-runner";

process.loadEnvFile?.(".env.local");

export interface LivePostgresSmokeConfig {
  databaseUrl: string | null;
  run: boolean;
  skipReason: string | null;
}

const MIGRATIONS_DIRECTORY = new URL(
  "../../../apps/server/src/runtime/persistence/postgres/migrations/",
  import.meta.url
);

export const resolveLivePostgresSmokeConfig = (
  environment: Record<string, string | undefined> = process.env
): LivePostgresSmokeConfig => {
  const databaseUrl = String(environment.EMPIRE_TEST_DATABASE_URL ?? "").trim();
  if (!databaseUrl) {
    return {
      databaseUrl: null,
      run: false,
      skipReason: "Live Postgres smoke skipped because EMPIRE_TEST_DATABASE_URL is not set."
    };
  }

  if (!isSafeTestDatabaseUrl(databaseUrl) && environment.EMPIRE_ALLOW_LIVE_POSTGRES_SMOKE !== "true") {
    throw new Error(
      "Live Postgres smoke refused to run because the configured database does not look like an isolated test target."
    );
  }

  return {
    databaseUrl,
    run: true,
    skipReason: null
  };
};

export const applyPostgresTestMigrations = async (
  database: PostgresDatabase
): Promise<void> => {
  const status = await migrateDatabase(database, MIGRATIONS_DIRECTORY);
  if (!status.current) throw new Error("Test database migrations are not current.");
};

const isSafeTestDatabaseUrl = (databaseUrl: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch (_error) {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  const databaseName = parsed.pathname.replace(/^\/+/, "").toLowerCase();
  const looksLocalHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local");
  const looksLikeTestDatabase =
    databaseName.includes("test") ||
    databaseName.includes("smoke") ||
    databaseName.includes("dev") ||
    databaseName.includes("local");

  return looksLocalHost || looksLikeTestDatabase;
};
