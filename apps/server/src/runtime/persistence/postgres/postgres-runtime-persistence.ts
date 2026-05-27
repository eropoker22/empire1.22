import type {
  CommandLogRepository,
  DiagnosticLogRepository,
  EventLogRepository,
  SnapshotRepository
} from "../repositories";

export interface PostgresRuntimePersistenceOptions {
  databaseUrl: string;
}

export interface PostgresRuntimePersistenceRepositories {
  commandLogRepository: CommandLogRepository;
  eventLogRepository: EventLogRepository;
  diagnosticLogRepository: DiagnosticLogRepository;
  snapshotRepository: SnapshotRepository;
}

/**
 * Responsibility: Postgres/Supabase repository composition boundary.
 * Belongs here: production shared storage adapter wiring.
 * Does not belong here: gameplay rules, runtime ticking, or legacy UI behavior.
 */
export const createPostgresRuntimePersistenceRepositories = (
  options: PostgresRuntimePersistenceOptions
): PostgresRuntimePersistenceRepositories => {
  const databaseUrl = options.databaseUrl.trim();
  if (!databaseUrl) {
    throw new Error("Postgres persistence requires EMPIRE_DATABASE_URL or GAMEPLAY_DATABASE_URL.");
  }

  const notImplemented = createPostgresNotImplementedRepository(databaseUrl);

  return {
    commandLogRepository: notImplemented,
    eventLogRepository: notImplemented,
    diagnosticLogRepository: notImplemented,
    snapshotRepository: notImplemented
  };
};

const createPostgresNotImplementedRepository = (
  _databaseUrl: string
): CommandLogRepository & EventLogRepository & DiagnosticLogRepository & SnapshotRepository => ({
  append: async () => {
    throw createNotImplementedError();
  },
  listByInstance: async () => {
    throw createNotImplementedError();
  },
  save: async () => {
    throw createNotImplementedError();
  },
  loadLatest: async () => {
    throw createNotImplementedError();
  }
});

const createNotImplementedError = (): Error =>
  new Error(
    "Postgres persistence adapter is configured but runtime repository methods are not implemented yet. " +
    "Apply the SQL migration and add the DB client-backed repository implementation before using this driver in production."
  );
