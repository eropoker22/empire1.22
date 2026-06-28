import type { AtomicCommandTransactionBoundary } from "../../instance-manager/atomic-command-transaction";
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
  run: (instanceId, callback) =>
    database.transaction(async (client) => {
      await lockServerInstanceRow(client, instanceId);
      return callback({
        commandLogRepository: createPostgresCommandLogRepository(client),
        commandReservationRepository: createPostgresCommandReservationRepositoryForTransaction(client),
        commandResultRepository: createPostgresCommandResultRepository(client),
        eventLogRepository: createPostgresEventLogRepository(client),
        outboxRepository: createPostgresRuntimeOutboxRepository(client),
        snapshotRepository: createPostgresSnapshotRepositoryForTransaction(client)
      });
    })
});

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
