import type {
  CommandLogRepository,
  CommandReservationRepository,
  CommandResultRepository,
  EventLogRepository,
  RuntimeOutboxRepository,
  SnapshotRepository
} from "../persistence/repositories";

export interface AtomicCommandTransactionRepositories {
  commandLogRepository: CommandLogRepository;
  commandReservationRepository: CommandReservationRepository;
  commandResultRepository: CommandResultRepository;
  eventLogRepository: EventLogRepository;
  outboxRepository: RuntimeOutboxRepository;
  snapshotRepository: SnapshotRepository;
}

export interface AtomicCommandTransactionBoundary {
  run<TResult>(
    instanceId: string,
    callback: (repositories: AtomicCommandTransactionRepositories) => Promise<TResult>
  ): Promise<TResult>;
}
