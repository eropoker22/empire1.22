import type { PostgresDatabase } from "../../runtime/persistence/postgres";
import type { AdminDurableRepositories } from "./admin-repositories";
import { createPostgresAdminMonitoringRepository } from "./postgres-admin-monitoring-repository";
import {
  createPostgresAdminAuditRepository,
  createPostgresAdminLoginRateLimitRepository,
  createPostgresAdminSessionRepository,
  createPostgresAdminUserRepository
} from "./postgres-admin-security-repositories";
import { createPostgresHostedControlPlaneRepository } from "../hosted/postgres-hosted-control-plane-repository";

export const createPostgresAdminDurableRepositories = (
  database: PostgresDatabase,
  now: () => Date = () => new Date()
): AdminDurableRepositories => ({
  kind: "postgres",
  monitoring: createPostgresAdminMonitoringRepository(database, now),
  users: createPostgresAdminUserRepository(database),
  sessions: createPostgresAdminSessionRepository(database),
  audit: createPostgresAdminAuditRepository(database),
  loginRateLimit: createPostgresAdminLoginRateLimitRepository(database),
  hosted: createPostgresHostedControlPlaneRepository(database)
});
