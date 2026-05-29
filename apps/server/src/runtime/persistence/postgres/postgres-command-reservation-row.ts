import type { DomainError } from "@empire/shared-types";
import type { QueryResultRow } from "pg";
import type { CommandReservationRecord } from "../repositories";

export interface CommandReservationRow extends QueryResultRow {
  id: string;
  server_instance_id: string;
  command_id: string;
  status: "pending" | "applied" | "rejected";
  command_type: string;
  actor_id: string;
  payload_hash: string;
  payload: unknown;
  result: unknown | null;
  rejection_reason: unknown | null;
  reserved_at: string;
  updated_at: string;
  applied_at: string | null;
  rejected_at: string | null;
}

export const mapReservationRow = (
  row: CommandReservationRow
): CommandReservationRecord => ({
  id: row.id,
  serverInstanceId: row.server_instance_id,
  commandId: row.command_id,
  status: row.status,
  commandType: row.command_type,
  playerId: row.actor_id,
  payloadHash: row.payload_hash,
  payload: coercePayload(row.payload),
  reservedAt: coerceTimestamp(row.reserved_at),
  updatedAt: coerceTimestamp(row.updated_at),
  appliedAt: row.applied_at ? coerceTimestamp(row.applied_at) : null,
  rejectedAt: row.rejected_at ? coerceTimestamp(row.rejected_at) : null,
  appliedMetadata: row.result ? coercePayload(row.result) as Record<string, unknown> : null,
  rejectionErrors: row.rejection_reason ? coercePayload(row.rejection_reason) as DomainError[] : null
});

const coercePayload = (payload: unknown): unknown =>
  typeof payload === "string" ? JSON.parse(payload) : payload;

const coerceTimestamp = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value);
