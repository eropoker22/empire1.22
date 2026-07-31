import type {
  AdminCommandSummaryView,
  AdminDiagnosticSummaryView,
  AdminEventSummaryView
} from "@empire/shared-types";
import type { PostgresQueryable } from "../../runtime/persistence/postgres";

export const listCommandSummaries = async (
  database: PostgresQueryable,
  id: string,
  limit: number
): Promise<AdminCommandSummaryView[]> => {
  const result = await database.query<{
    command_id: string;
    command_type: string;
    actor_id: string;
    created_at: Date | string;
    tick_at_receive: number;
  }>(
    `SELECT command_id, payload #>> '{command,type}' AS command_type, actor_id, created_at, tick_at_receive
     FROM empire_command_log WHERE server_instance_id = $1 ORDER BY sequence DESC LIMIT $2`,
    [id, cap(limit)]
  );
  return result.rows.reverse().map((row) => ({
    serverInstanceId: id,
    commandId: row.command_id,
    commandType: row.command_type || "unknown",
    actorId: row.actor_id,
    status: "recorded",
    receivedAt: iso(row.created_at),
    tickAtReceive: Number(row.tick_at_receive)
  }));
};

export const listEventSummaries = async (
  database: PostgresQueryable,
  id: string,
  limit: number
): Promise<AdminEventSummaryView[]> => {
  const result = await database.query<{
    id: string;
    event_type: string;
    caused_by_command_id: string | null;
    created_at: Date | string;
    tick_at_emit: number;
  }>(
    `SELECT id, payload #>> '{event,type}' AS event_type, caused_by_command_id, created_at, tick_at_emit
     FROM empire_event_log WHERE server_instance_id = $1 ORDER BY sequence DESC LIMIT $2`,
    [id, cap(limit)]
  );
  return result.rows.reverse().map((row) => ({
    serverInstanceId: id,
    eventId: row.id,
    eventType: row.event_type || "unknown",
    causedByCommandId: row.caused_by_command_id,
    occurredAt: iso(row.created_at),
    tick: Number(row.tick_at_emit)
  }));
};

export const listDiagnosticSummaries = async (
  database: PostgresQueryable,
  id: string,
  limit: number
): Promise<AdminDiagnosticSummaryView[]> => {
  const result = await database.query<{
    id: string;
    level: "info" | "warn" | "error";
    category: string;
    created_at: Date | string;
    command_id: string | null;
  }>(
    `SELECT id, level, category, created_at, payload #>> '{context,commandId}' AS command_id
     FROM empire_diagnostic_log WHERE server_instance_id = $1 ORDER BY sequence DESC LIMIT $2`,
    [id, cap(limit)]
  );
  return result.rows.reverse().map((row) => ({
    serverInstanceId: id,
    diagnosticId: row.id,
    level: row.level,
    category: row.category,
    messageCode: `diagnostic.${safeCode(row.category)}`,
    occurredAt: iso(row.created_at),
    commandId: row.command_id
  }));
};

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const cap = (value: number): number => Math.max(1, Math.min(200, Math.floor(value)));
const safeCode = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9._-]+/gu, "-").slice(0, 80) || "unknown";
