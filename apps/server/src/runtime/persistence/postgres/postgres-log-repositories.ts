import type { ServerInstanceId } from "@empire/shared-types";
import type { CommandRecord, DiagnosticRecord, EventRecord } from "../dto";
import type {
  CommandLogRepository,
  DiagnosticLogRepository,
  EventLogRepository
} from "../repositories";
import type { PostgresDatabase, PostgresQueryable } from "./postgres-client";
import { ensurePostgresServerInstanceRow } from "./postgres-server-instance-row";

export const createPostgresCommandLogRepository = (
  database: PostgresDatabase
): CommandLogRepository => ({
  append: async (record) => {
    const commandId = normalizeCommandId(record);
    await ensurePostgresServerInstanceRow(database, record.instanceId, {
      mode: record.command.mode,
      status: "unknown"
    });

    await database.query(
      `
        INSERT INTO empire_command_log (
          id, server_instance_id, schema_version, command_id, actor_id,
          correlation_id, tick_at_receive, payload, created_at, updated_at
        )
        VALUES ($1, $2, 1, $3, $4, $5, $6, $7::jsonb, $8::timestamptz, now())
        ON CONFLICT (server_instance_id, command_id) DO NOTHING
      `,
      [
        record.id,
        record.instanceId,
        commandId,
        record.actorId,
        record.correlationId,
        record.tickAtReceive,
        JSON.stringify(record),
        record.receivedAt
      ]
    );
  },
  listByInstance: async (instanceId) =>
    listPayloads<CommandRecord>(database, "empire_command_log", instanceId)
});

export const createPostgresEventLogRepository = (
  database: PostgresDatabase
): EventLogRepository => ({
  append: async (record) => {
    await ensurePostgresServerInstanceRow(database, record.instanceId, {
      mode: "unknown",
      status: "unknown"
    });

    await database.query(
      `
        INSERT INTO empire_event_log (
          id, server_instance_id, schema_version, caused_by_command_id,
          tick_at_emit, payload, created_at, updated_at
        )
        VALUES ($1, $2, 1, $3, $4, $5::jsonb, $6::timestamptz, now())
        ON CONFLICT (id) DO NOTHING
      `,
      [
        record.id,
        record.instanceId,
        record.causedByCommandId,
        record.tickAtEmit,
        JSON.stringify(record),
        record.recordedAt
      ]
    );
  },
  listByInstance: async (instanceId) =>
    listPayloads<EventRecord>(database, "empire_event_log", instanceId)
});

export const createPostgresDiagnosticLogRepository = (
  database: PostgresDatabase
): DiagnosticLogRepository => ({
  append: async (record) => {
    await ensurePostgresServerInstanceRow(database, record.instanceId, {
      mode: "unknown",
      status: "unknown"
    });

    await database.query(
      `
        INSERT INTO empire_diagnostic_log (
          id, server_instance_id, schema_version, level, category,
          payload, created_at, updated_at
        )
        VALUES ($1, $2, 1, $3, $4, $5::jsonb, $6::timestamptz, now())
        ON CONFLICT (id) DO NOTHING
      `,
      [
        record.id,
        record.instanceId,
        record.level,
        record.category,
        JSON.stringify(record),
        record.occurredAt
      ]
    );
  },
  listByInstance: async (instanceId) =>
    listPayloads<DiagnosticRecord>(database, "empire_diagnostic_log", instanceId)
});

const listPayloads = async <TRecord>(
  database: PostgresQueryable,
  tableName: "empire_command_log" | "empire_event_log" | "empire_diagnostic_log",
  instanceId: ServerInstanceId
): Promise<TRecord[]> => {
  const result = await database.query<{ payload: unknown }>(
    `
      SELECT payload
      FROM ${tableName}
      WHERE server_instance_id = $1
      ORDER BY sequence ASC, created_at ASC, id ASC
    `,
    [instanceId]
  );

  return result.rows.map((row) => coercePayload<TRecord>(row.payload));
};

const coercePayload = <TPayload>(payload: unknown): TPayload => {
  if (typeof payload === "string") {
    return JSON.parse(payload) as TPayload;
  }
  return payload as TPayload;
};

const normalizeCommandId = (record: CommandRecord): string => {
  const commandId = String(record.command?.id ?? "").trim();
  if (!commandId) {
    throw new Error("Postgres command log append requires record.command.id for idempotence.");
  }
  return commandId;
};
