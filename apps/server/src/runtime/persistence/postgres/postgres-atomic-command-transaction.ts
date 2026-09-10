import {
  HostedRuntimeStatusFenceRejectedError,
  RuntimeLeaseFenceRejectedError,
  type AtomicCommandTransactionBoundary,
  type RuntimeLeaseFence
} from "../../instance-manager/atomic-command-transaction";
import { createPostgresCommandReservationRepositoryForTransaction } from "./postgres-command-reservation-repository";
import { createPostgresCommandResultRepository } from "./postgres-command-result-repository";
import type { PostgresDatabase, PostgresQueryable } from "./postgres-client";
import {
  createPostgresCommandLogRepository,
  createPostgresEventLogRepository
} from "./postgres-log-repositories";
import { createPostgresRuntimeOutboxRepository } from "./postgres-outbox-repository";
import { ensurePostgresServerInstanceRow } from "./postgres-server-instance-row";
import { createPostgresSnapshotRepositoryForTransaction } from "./postgres-snapshot-repository";
import {
  createSnapshotPersistenceMetrics,
  type SnapshotPersistenceMetrics
} from "../repositories";

/**
 * Responsibility: Single Postgres transaction boundary for command execution.
 * Belongs here: DB row lock and transaction-scoped repository composition.
 * Does not belong here: gameplay command application or event publishing.
 */
export const createPostgresAtomicCommandTransaction = (
  database: PostgresDatabase,
  snapshotMetrics: SnapshotPersistenceMetrics = createSnapshotPersistenceMetrics()
): AtomicCommandTransactionBoundary => ({
  run: (instanceId, callback, options) =>
    database.transaction(async (client) => {
      const startedAt = performance.now();
      let queryCount = 0;
      let queryTimeMs = 0;
      const measuredClient: PostgresQueryable = {
        query: async (sql, params) => {
          queryCount += 1;
          const queryStartedAt = performance.now();
          try {
            return await client.query(sql, params);
          } finally {
            queryTimeMs += Math.max(0, performance.now() - queryStartedAt);
          }
        }
      };
      const transactionClient = options?.diagnosticsKind ? measuredClient : client;
      try {
      if (options?.runtimeLeaseFence) {
        await assertCurrentPostgresRuntimeLease(transactionClient, instanceId, options.runtimeLeaseFence, true);
      } else if (options?.hostedStatusFence === "running-if-present") {
        await assertHostedRuntimeRunning(transactionClient, instanceId);
      }
      await lockPostgresServerInstanceRow(transactionClient, instanceId);
      const result = await callback({
        commandLogRepository: createPostgresCommandLogRepository(transactionClient),
        commandReservationRepository: createPostgresCommandReservationRepositoryForTransaction(transactionClient),
        commandResultRepository: createPostgresCommandResultRepository(transactionClient),
        eventLogRepository: createPostgresEventLogRepository(transactionClient),
        outboxRepository: createPostgresRuntimeOutboxRepository(transactionClient),
        snapshotRepository: createPostgresSnapshotRepositoryForTransaction(transactionClient, snapshotMetrics)
      });
      if (options?.runtimeLeaseFence) {
        await assertPostgresRuntimeLeaseOwner(transactionClient, instanceId, options.runtimeLeaseFence);
      }
      return result;
      } finally {
        if (options?.diagnosticsKind) {
          recordTransactionDiagnostics(
            snapshotMetrics,
            options.diagnosticsKind,
            queryCount + 2,
            Math.max(queryTimeMs, performance.now() - startedAt)
          );
        }
      }
    })
});

const recordTransactionDiagnostics = (
  metrics: SnapshotPersistenceMetrics,
  kind: "tick" | "command",
  roundTrips: number,
  databaseTimeMs: number
): void => {
  if (kind === "tick") {
    metrics.tickTransactions += 1;
    metrics.totalTickDbRoundTrips += roundTrips;
    metrics.averageTickDbRoundTrips = metrics.totalTickDbRoundTrips / metrics.tickTransactions;
    metrics.maxTickDbRoundTrips = Math.max(metrics.maxTickDbRoundTrips, roundTrips);
    metrics.totalDatabaseTimePerTickMs += databaseTimeMs;
    metrics.databaseTimePerTickMs = metrics.totalDatabaseTimePerTickMs / metrics.tickTransactions;
    return;
  }
  metrics.commandTransactions += 1;
  metrics.totalCommandDbRoundTrips += roundTrips;
  metrics.queriesPerCommandSubmit = metrics.totalCommandDbRoundTrips / metrics.commandTransactions;
};

const assertHostedRuntimeRunning = async (
  client: PostgresQueryable,
  instanceId: string
): Promise<void> => {
  const result = await client.query<{ provisioning_state: string; status: string }>(
    `SELECT provisioning_state,status
     FROM empire_hosted_server_instances
     WHERE server_instance_id=$1
     FOR UPDATE`,
    [instanceId]
  );
  const hosted = result.rows[0];
  if (hosted && (hosted.provisioning_state !== "ready" || hosted.status !== "running")) {
    throw new HostedRuntimeStatusFenceRejectedError(instanceId);
  }
};

export const assertCurrentPostgresRuntimeLease = async (
  client: PostgresQueryable,
  instanceId: string,
  fence: RuntimeLeaseFence,
  lock: boolean
): Promise<void> => {
  const result = await client.query(
    `SELECT server_instance_id
     FROM empire_hosted_server_instances
     WHERE server_instance_id=$1
       AND runtime_lease_owner_id=$2
       AND runtime_lease_incarnation_id=$3
       AND runtime_lease_expires_at > clock_timestamp()
     ${lock ? "FOR UPDATE" : ""}`,
    [instanceId, fence.workerId, fence.workerIncarnationId]
  );
  if ((result.rowCount ?? 0) !== 1) throw new RuntimeLeaseFenceRejectedError(instanceId);
};

const assertPostgresRuntimeLeaseOwner = async (
  client: PostgresQueryable,
  instanceId: string,
  fence: RuntimeLeaseFence
): Promise<void> => {
  const result = await client.query(
    `SELECT server_instance_id
     FROM empire_hosted_server_instances
     WHERE server_instance_id=$1
       AND runtime_lease_owner_id=$2
       AND runtime_lease_incarnation_id=$3`,
    [instanceId, fence.workerId, fence.workerIncarnationId]
  );
  if ((result.rowCount ?? 0) !== 1) throw new RuntimeLeaseFenceRejectedError(instanceId);
};

export const lockPostgresServerInstanceRow = async (
  client: PostgresQueryable,
  instanceId: string
): Promise<void> => {
  await ensurePostgresServerInstanceRow(client, instanceId, {
    mode: "unknown",
    status: "unknown"
  });
  await client.query(
    `
      SELECT id
      FROM empire_server_instances
      WHERE server_instance_id = $1
      FOR UPDATE
    `,
    [instanceId]
  );
};
