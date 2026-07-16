import type { PostgresDatabase } from "../../runtime/persistence/postgres";
import type { AdminDurableRepositories } from "./admin-repositories";
import { createPostgresAdminMonitoringRepository } from "./postgres-admin-monitoring-repository";
import {
  createPostgresAdminAuditRepository,
  createPostgresAdminLoginRateLimitRepository,
  createPostgresAdminSessionRepository
} from "./postgres-admin-security-repositories";

export const createPostgresAdminDurableRepositories = (
  database: PostgresDatabase,
  now: () => Date = () => new Date()
): AdminDurableRepositories => ({
  kind: "postgres",
  monitoring: createPostgresAdminMonitoringRepository(database, now),
  sessions: createPostgresAdminSessionRepository(database),
  audit: createPostgresAdminAuditRepository(database),
  loginRateLimit: createPostgresAdminLoginRateLimitRepository(database)
});
