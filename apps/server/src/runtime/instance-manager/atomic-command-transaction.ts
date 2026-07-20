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

export interface RuntimeLeaseFence {
  workerId: string;
  workerIncarnationId: string;
}

export interface RuntimeTickLeaseFence extends RuntimeLeaseFence {
  isCurrent?: () => Promise<boolean>;
}

export interface AtomicCommandTransactionOptions {
  runtimeLeaseFence?: RuntimeLeaseFence;
  hostedStatusFence?: "running-if-present";
}

export class RuntimeLeaseFenceRejectedError extends Error {
  readonly safeCode = "RUNTIME_LEASE_FENCE_REJECTED";

  constructor(instanceId: string) {
    super(`Runtime lease fence rejected tick commit for ${instanceId}.`);
    this.name = "RuntimeLeaseFenceRejectedError";
  }
}

export const isRuntimeLeaseFenceRejectedError = (
  error: unknown
): error is RuntimeLeaseFenceRejectedError => error instanceof RuntimeLeaseFenceRejectedError;

export class HostedRuntimeStatusFenceRejectedError extends Error {
  readonly safeCode = "HOSTED_RUNTIME_NOT_RUNNING";

  constructor(instanceId: string) {
    super(`Hosted runtime status fence rejected command commit for ${instanceId}.`);
    this.name = "HostedRuntimeStatusFenceRejectedError";
  }
}

export interface AtomicCommandTransactionBoundary {
  run<TResult>(
    instanceId: string,
    callback: (repositories: AtomicCommandTransactionRepositories) => Promise<TResult>,
    options?: AtomicCommandTransactionOptions
  ): Promise<TResult>;
}
