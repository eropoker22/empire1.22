import {
  createPostgresDatabase,
  type PostgresDatabase,
  type PostgresDatabasePoolOptions
} from "../runtime/persistence/postgres";

export type LocalHostedPostgresDatabaseFactory = (
  databaseUrl: string,
  poolOptions?: PostgresDatabasePoolOptions
) => PostgresDatabase;

export const LOCAL_HOSTED_POSTGRES_POOL_OPTIONS: Readonly<PostgresDatabasePoolOptions> = Object.freeze({
  max: 4,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statementTimeoutMillis: 15_000,
  allowExitOnIdle: false
});

export const createLocalHostedPostgresDatabase = (
  environment: Record<string, string | undefined>,
  factory: LocalHostedPostgresDatabaseFactory = createPostgresDatabase
): PostgresDatabase | null => {
  const driver = String(
    environment.EMPIRE_PERSISTENCE_DRIVER ?? environment.GAMEPLAY_PERSISTENCE_DRIVER ?? ""
  ).trim().toLowerCase();
  const databaseUrl = String(
    environment.EMPIRE_DATABASE_URL ?? environment.GAMEPLAY_DATABASE_URL ?? ""
  ).trim();

  return driver === "postgres" && databaseUrl
    ? factory(databaseUrl, LOCAL_HOSTED_POSTGRES_POOL_OPTIONS)
    : null;
};
