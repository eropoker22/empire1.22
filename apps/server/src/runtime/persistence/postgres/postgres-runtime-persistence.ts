import type {
  CommandLogRepository,
  CommandReservationRepository,
  CommandResultRepository,
  DiagnosticLogRepository,
  EventLogRepository,
  RuntimeOutboxRepository,
  SnapshotRepository
} from "../repositories";
import { createSnapshotPersistenceMetrics } from "../repositories";
import {
  createSnapshotMaintenanceRunner,
  resolveSnapshotRetentionPolicy,
  type SnapshotRetentionPolicy,
  type SnapshotMaintenanceRunner
} from "../services";
import type { RuntimeTickLock } from "../tick-lock";
import type { AtomicCommandTransactionBoundary } from "../../instance-manager/atomic-command-transaction";
import { createPostgresAtomicCommandTransaction } from "./postgres-atomic-command-transaction";
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
  snapshotRetentionPolicy?: Partial<SnapshotRetentionPolicy>;
  snapshotMaintenanceIntervalMs?: number;
}

export interface PostgresRuntimePersistenceRepositories {
  commandLogRepository: CommandLogRepository;
  commandReservationRepository: CommandReservationRepository;
  commandResultRepository: CommandResultRepository;
  eventLogRepository: EventLogRepository;
  outboxRepository: RuntimeOutboxRepository;
  atomicCommandTransaction: AtomicCommandTransactionBoundary;
  diagnosticLogRepository: DiagnosticLogRepository;
  snapshotRepository: SnapshotRepository;
  snapshotMaintenance: SnapshotMaintenanceRunner;
  tickLock: RuntimeTickLock;
  atomicCommandPersistenceMode: "transactional";
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
  const snapshotMetrics = createSnapshotPersistenceMetrics();
  const snapshotRepository = createPostgresSnapshotRepository(database, snapshotMetrics);

  return {
    commandLogRepository: createPostgresCommandLogRepository(database),
    commandReservationRepository: createPostgresCommandReservationRepository(database),
    commandResultRepository: createPostgresCommandResultRepository(database),
    eventLogRepository: createPostgresEventLogRepository(database),
    outboxRepository: createPostgresRuntimeOutboxRepository(database),
    atomicCommandTransaction: createPostgresAtomicCommandTransaction(database, snapshotMetrics),
    diagnosticLogRepository: createPostgresDiagnosticLogRepository(database),
    snapshotRepository,
    snapshotMaintenance: createSnapshotMaintenanceRunner(
      snapshotRepository,
      resolveSnapshotRetentionPolicy(options.snapshotRetentionPolicy),
      { intervalMs: options.snapshotMaintenanceIntervalMs }
    ),
    tickLock: createPostgresRuntimeTickLock(database, {
      ownerId: options.tickLockOwnerId,
      ttlMs: options.tickLockTtlMs
    }),
    atomicCommandPersistenceMode: "transactional",
    close: () => database.close()
  };
};
