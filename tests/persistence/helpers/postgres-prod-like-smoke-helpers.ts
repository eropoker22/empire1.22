import * as fs from "node:fs";
import * as path from "node:path";
import type { PostgresDatabase } from "../../../apps/server/src/runtime/persistence/postgres";

export interface LivePostgresSmokeConfig {
  databaseUrl: string | null;
  run: boolean;
  skipReason: string | null;
}

const MIGRATIONS_DIR = "apps/server/src/runtime/persistence/postgres/migrations";
const MIGRATION_FILES = [
  "001_initial_runtime_persistence.sql",
  "002_command_reservations.sql",
  "003_gameplay_identity_sessions.sql",
  "004_atomic_command_execution.sql",
  "005_gameplay_identity_session_invariants.sql"
];

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
  for (const fileName of MIGRATION_FILES) {
    const sql = (await fs.promises.readFile(path.join(MIGRATIONS_DIR, fileName), "utf8")).trim();
    if (!sql) continue;
    await database.query(sql);
  }
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
