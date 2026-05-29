import type {
  CommandLogRepository,
  CommandReservationRepository,
  DiagnosticLogRepository,
  EventLogRepository,
  SnapshotRepository
} from "../repositories";
import type { RuntimeTickLock } from "../tick-lock";
import {
  createPostgresDatabase,
  validatePostgresDatabaseUrl,
  type PostgresDatabase
} from "./postgres-client";
import {
  createPostgresCommandLogRepository,
  createPostgresDiagnosticLogRepository,
  createPostgresEventLogRepository
} from "./postgres-log-repositories";
import { createPostgresCommandReservationRepository } from "./postgres-command-reservation-repository";
import { createPostgresSnapshotRepository } from "./postgres-snapshot-repository";
import { createPostgresRuntimeTickLock } from "./postgres-tick-lock";

export interface PostgresRuntimePersistenceOptions {
  databaseUrl: string;
  database?: PostgresDatabase;
  tickLockOwnerId?: string;
  tickLockTtlMs?: number;
}

export interface PostgresRuntimePersistenceRepositories {
  commandLogRepository: CommandLogRepository;
  commandReservationRepository: CommandReservationRepository;
  eventLogRepository: EventLogRepository;
  diagnosticLogRepository: DiagnosticLogRepository;
  snapshotRepository: SnapshotRepository;
  tickLock: RuntimeTickLock;
  close(): Promise<void>;
}

/**
 * Responsibility: Postgres/Supabase repository composition boundary.
 * Belongs here: production shared storage adapter wiring.
 * Does not belong here: gameplay rules, runtime ticking, or legacy UI behavior.
 */
export const createPostgresRuntimePersistenceRepositories = (
  options: PostgresRuntimePersistenceOptions
): PostgresRuntimePersistenceRepositories => {
  const databaseUrl = validatePostgresDatabaseUrl(options.databaseUrl);
  const database = options.database ?? createPostgresDatabase(databaseUrl);

  return {
    commandLogRepository: createPostgresCommandLogRepository(database),
    commandReservationRepository: createPostgresCommandReservationRepository(database),
    eventLogRepository: createPostgresEventLogRepository(database),
    diagnosticLogRepository: createPostgresDiagnosticLogRepository(database),
    snapshotRepository: createPostgresSnapshotRepository(database),
    tickLock: createPostgresRuntimeTickLock(database, {
      ownerId: options.tickLockOwnerId,
      ttlMs: options.tickLockTtlMs
    }),
    close: () => database.close()
  };
};
