import {
  createPostgresDatabase,
  type PostgresDatabase,
  type PostgresDatabasePoolOptions
} from "../runtime/persistence/postgres";

export type NetlifyPostgresDatabaseFactory = (
  databaseUrl: string,
  poolOptions?: PostgresDatabasePoolOptions
) => PostgresDatabase;

const NETLIFY_POOL_OPTIONS: PostgresDatabasePoolOptions = {
  max: 4,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  statementTimeoutMillis: 15_000,
  allowExitOnIdle: true
};

export const createNetlifyPostgresDatabase = (
  environment: Record<string, string | undefined>,
  factory: NetlifyPostgresDatabaseFactory = createPostgresDatabase
): PostgresDatabase | null => {
  const driver = String(
    environment.EMPIRE_PERSISTENCE_DRIVER ?? environment.GAMEPLAY_PERSISTENCE_DRIVER ?? ""
  ).trim().toLowerCase();
  const databaseUrl = String(
    environment.EMPIRE_DATABASE_URL ?? environment.GAMEPLAY_DATABASE_URL ?? ""
  ).trim();

  return driver === "postgres" && databaseUrl
    ? factory(databaseUrl, NETLIFY_POOL_OPTIONS)
    : null;
};
