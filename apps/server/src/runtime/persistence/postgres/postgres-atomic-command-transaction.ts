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

/**
 * Responsibility: Single Postgres transaction boundary for command execution.
 * Belongs here: DB row lock and transaction-scoped repository composition.
 * Does not belong here: gameplay command application or event publishing.
 */
export const createPostgresAtomicCommandTransaction = (
  database: PostgresDatabase
): AtomicCommandTransactionBoundary => ({
  run: (instanceId, callback, options) =>
    database.transaction(async (client) => {
      if (options?.runtimeLeaseFence) {
        await assertCurrentRuntimeLease(client, instanceId, options.runtimeLeaseFence, true);
      } else if (options?.hostedStatusFence === "running-if-present") {
        await assertHostedRuntimeRunning(client, instanceId);
      }
      await lockServerInstanceRow(client, instanceId);
      const result = await callback({
        commandLogRepository: createPostgresCommandLogRepository(client),
        commandReservationRepository: createPostgresCommandReservationRepositoryForTransaction(client),
        commandResultRepository: createPostgresCommandResultRepository(client),
        eventLogRepository: createPostgresEventLogRepository(client),
        outboxRepository: createPostgresRuntimeOutboxRepository(client),
        snapshotRepository: createPostgresSnapshotRepositoryForTransaction(client)
      });
      if (options?.runtimeLeaseFence) {
        await assertCurrentRuntimeLease(client, instanceId, options.runtimeLeaseFence, false);
      }
      return result;
    })
});

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

const assertCurrentRuntimeLease = async (
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

const lockServerInstanceRow = async (
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
