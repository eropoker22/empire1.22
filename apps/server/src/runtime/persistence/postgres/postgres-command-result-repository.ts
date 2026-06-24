import type { ServerInstanceId } from "@empire/shared-types";
import type { CommandResultRecord } from "../dto";
import type { CommandResultRepository } from "../repositories";
import type { PostgresDatabase, PostgresQueryable } from "./postgres-client";
import { ensurePostgresServerInstanceRow } from "./postgres-server-instance-row";

export const createPostgresCommandResultRepository = (
  database: PostgresDatabase
): CommandResultRepository => ({
  save: async (record) => {
    await ensurePostgresServerInstanceRow(database, record.serverInstanceId, {
      mode: record.command.mode,
      status: "unknown"
    });
    await database.query(
      `
        INSERT INTO empire_command_results (
          id, server_instance_id, command_id, command_type, player_id, status,
          payload_hash, root_version_before, root_version_after, event_count,
          event_ids, snapshot_id, snapshot_version, response_errors, payload,
          created_at, applied_at, rejected_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11::jsonb, $12, $13, $14::jsonb, $15::jsonb,
          $16::timestamptz, $17::timestamptz, $18::timestamptz, now()
        )
        ON CONFLICT (server_instance_id, command_id) DO NOTHING
      `,
      [
        createCommandResultId(record.serverInstanceId, record.commandId),
        record.serverInstanceId,
        record.commandId,
        record.commandType,
        record.playerId,
        record.status,
        record.payloadHash,
        record.rootVersionBefore,
        record.rootVersionAfter,
        record.eventCount,
        JSON.stringify(record.eventIds),
        record.snapshotId,
        record.snapshotVersion,
        JSON.stringify(record.responseErrors),
        JSON.stringify(record),
        record.createdAt,
        record.appliedAt,
        record.rejectedAt
      ]
    );
  },
  getByCommandId: async (instanceId, commandId) => {
    const result = await database.query<{ payload: unknown }>(
      `
        SELECT payload
        FROM empire_command_results
        WHERE server_instance_id = $1 AND command_id = $2
      `,
      [instanceId, commandId]
    );
    return result.rows[0] ? coercePayload<CommandResultRecord>(result.rows[0].payload) : null;
  },
  listByInstance: async (instanceId) => listCommandResults(database, instanceId)
});

const listCommandResults = async (
  database: PostgresQueryable,
  instanceId: ServerInstanceId
): Promise<CommandResultRecord[]> => {
  const result = await database.query<{ payload: unknown }>(
    `
      SELECT payload
      FROM empire_command_results
      WHERE server_instance_id = $1
      ORDER BY created_at ASC, command_id ASC
    `,
    [instanceId]
  );
  return result.rows.map((row) => coercePayload<CommandResultRecord>(row.payload));
};

const coercePayload = <TPayload>(payload: unknown): TPayload =>
  typeof payload === "string" ? JSON.parse(payload) as TPayload : payload as TPayload;

const createCommandResultId = (instanceId: ServerInstanceId, commandId: string): string =>
  `command-result:${instanceId}:${commandId}`;

