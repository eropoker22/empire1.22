import type { DomainError, ServerInstanceId } from "@empire/shared-types";

export type CommandReservationStatus = "pending" | "applied" | "rejected";

export interface CommandReservationRecord {
  id: string;
  serverInstanceId: ServerInstanceId;
  commandId: string;
  status: CommandReservationStatus;
  commandType: string;
  playerId: string;
  payloadHash: string;
  payload: unknown;
  reservedAt: string;
  updatedAt: string;
  appliedAt: string | null;
  rejectedAt: string | null;
  appliedMetadata: Record<string, unknown> | null;
  rejectionErrors: DomainError[] | null;
}

export interface CommandReservationDraft {
  serverInstanceId: ServerInstanceId;
  commandId: string;
  commandType: string;
  playerId: string;
  payloadHash?: string | null;
  payload?: unknown;
  reservedAt: string;
  metadata?: Record<string, unknown> | null;
}

export interface CommandReservationReserveResult {
  created: boolean;
  record: CommandReservationRecord;
}

/**
 * Responsibility: Persistence boundary for command id reservation state.
 * Belongs here: idempotent command reservation records scoped by server instance.
 * Does not belong here: gameplay validation, transport parsing, or dispatch decisions.
 */
export interface CommandReservationRepository {
  reserve(record: CommandReservationDraft): Promise<CommandReservationReserveResult>;
  getByCommandId(
    instanceId: ServerInstanceId,
    commandId: string
  ): Promise<CommandReservationRecord | null>;
  listPendingByInstance?(
    instanceId: ServerInstanceId
  ): Promise<CommandReservationRecord[]>;
  markApplied(
    instanceId: ServerInstanceId,
    commandId: string,
    metadata: Record<string, unknown>
  ): Promise<CommandReservationRecord>;
  markRejected(
    instanceId: ServerInstanceId,
    commandId: string,
    errors: DomainError[]
  ): Promise<CommandReservationRecord>;
}
