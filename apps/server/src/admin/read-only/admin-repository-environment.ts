import {
  createPostgresDatabase,
  type PostgresDatabase
} from "../../runtime/persistence/postgres";
import type { AdminDurableRepositories } from "./admin-repositories";
import { createInMemoryAdminDurableRepositories } from "./in-memory-admin-repositories";
import { createPostgresAdminDurableRepositories } from "./postgres-admin-repositories";

export type AdminRepositoryResolution =
  | { accepted: true; repositories: AdminDurableRepositories }
  | { accepted: false; repositories: null; code: "ADMIN_CONFIGURATION_UNAVAILABLE" };

export const resolveAdminDurableRepositories = (
  environment: Record<string, string | undefined>,
  provided?: AdminDurableRepositories,
  database?: PostgresDatabase
): AdminRepositoryResolution => {
  if (provided) {
    if (environment.NODE_ENV === "production" && (provided.kind !== "postgres" || !allDurable(provided))) {
      return unavailable();
    }
    return { accepted: true, repositories: provided };
  }
  const driver = String(environment.EMPIRE_PERSISTENCE_DRIVER ?? environment.GAMEPLAY_PERSISTENCE_DRIVER ?? "").trim().toLowerCase();
  const databaseUrl = String(environment.EMPIRE_DATABASE_URL ?? environment.GAMEPLAY_DATABASE_URL ?? "").trim();
  if (driver === "postgres" && databaseUrl) {
    return {
      accepted: true,
      repositories: createPostgresAdminDurableRepositories(database ?? createPostgresDatabase(databaseUrl))
    };
  }
  if (environment.NODE_ENV === "production") return unavailable();
  return { accepted: true, repositories: createInMemoryAdminDurableRepositories() };
};

const allDurable = (repositories: AdminDurableRepositories): boolean =>
  repositories.monitoring.durable && repositories.users.durable && repositories.sessions.durable
  && repositories.audit.durable && repositories.loginRateLimit.durable && repositories.hosted.durable;

const unavailable = (): AdminRepositoryResolution => ({
  accepted: false,
  repositories: null,
  code: "ADMIN_CONFIGURATION_UNAVAILABLE"
});
