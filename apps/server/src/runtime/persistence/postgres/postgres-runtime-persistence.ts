import type {
  CommandLogRepository,
  CommandReservationRepository,
  CommandResultRepository,
  DiagnosticLogRepository,
  EventLogRepository,
  RuntimeOutboxRepository,
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
import { createPostgresCommandResultRepository } from "./postgres-command-result-repository";
import { createPostgresRuntimeOutboxRepository } from "./postgres-outbox-repository";
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
  commandResultRepository: CommandResultRepository;
  eventLogRepository: EventLogRepository;
  outboxRepository: RuntimeOutboxRepository;
  diagnosticLogRepository: DiagnosticLogRepository;
  snapshotRepository: SnapshotRepository;
  tickLock: RuntimeTickLock;
  atomicCommandPersistenceMode: "best-effort";
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
    commandResultRepository: createPostgresCommandResultRepository(database),
    eventLogRepository: createPostgresEventLogRepository(database),
    outboxRepository: createPostgresRuntimeOutboxRepository(database),
    diagnosticLogRepository: createPostgresDiagnosticLogRepository(database),
    snapshotRepository: createPostgresSnapshotRepository(database),
    tickLock: createPostgresRuntimeTickLock(database, {
      ownerId: options.tickLockOwnerId,
      ttlMs: options.tickLockTtlMs
    }),
    atomicCommandPersistenceMode: "best-effort",
    close: () => database.close()
  };
};
