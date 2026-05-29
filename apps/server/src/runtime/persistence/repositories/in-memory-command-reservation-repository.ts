import type { DomainError, ServerInstanceId } from "@empire/shared-types";
import type {
  CommandReservationDraft,
  CommandReservationRecord,
  CommandReservationRepository,
  CommandReservationReserveResult
} from "./command-reservation-repository";

/**
 * Responsibility: Development/test command reservation store kept in process memory.
 * Belongs here: idempotent reservation lifecycle for local parity.
 * Does not belong here: distributed locking or production exactly-once guarantees.
 */
export const createInMemoryCommandReservationRepository = (): CommandReservationRepository => {
  const recordsByKey = new Map<string, CommandReservationRecord>();

  return {
    reserve: async (record) => {
      const key = createReservationKey(record.serverInstanceId, record.commandId);
      const existing = recordsByKey.get(key);

      if (existing) {
        return {
          created: false,
          record: cloneReservationRecord(existing)
        };
      }

      const nextRecord: CommandReservationRecord = {
        id: createReservationId(record.serverInstanceId, record.commandId),
        serverInstanceId: record.serverInstanceId,
        commandId: record.commandId,
        status: "pending",
        commandType: record.commandType,
        playerId: record.playerId,
        payloadHash: normalizePayloadHash(record.payloadHash),
        payload: clonePayload(record.payload ?? null),
        reservedAt: record.reservedAt,
        updatedAt: record.reservedAt,
        appliedAt: null,
        rejectedAt: null,
        appliedMetadata: record.metadata ? { ...record.metadata } : null,
        rejectionErrors: null
      };

      recordsByKey.set(key, nextRecord);

      return {
        created: true,
        record: cloneReservationRecord(nextRecord)
      };
    },
    getByCommandId: async (instanceId, commandId) => {
      const record = recordsByKey.get(createReservationKey(instanceId, commandId));
      return record ? cloneReservationRecord(record) : null;
    },
    markApplied: async (instanceId, commandId, metadata) => {
      const record = requireReservationRecord(recordsByKey, instanceId, commandId);
      if (record.status === "rejected") {
        throw new Error("Cannot mark a rejected command reservation as applied.");
      }

      if (record.status === "pending") {
        const updatedAt = resolveUpdatedAt(metadata);
        record.status = "applied";
        record.updatedAt = updatedAt;
        record.appliedAt = updatedAt;
        record.appliedMetadata = { ...metadata };
      }

      return cloneReservationRecord(record);
    },
    markRejected: async (instanceId, commandId, errors) => {
      const record = requireReservationRecord(recordsByKey, instanceId, commandId);
      if (record.status === "applied") {
        throw new Error("Cannot mark an applied command reservation as rejected.");
      }

      if (record.status === "pending") {
        const updatedAt = resolveRejectedAt(errors, record.updatedAt);
        record.status = "rejected";
        record.updatedAt = updatedAt;
        record.rejectedAt = updatedAt;
        record.rejectionErrors = cloneDomainErrors(errors);
      }

      return cloneReservationRecord(record);
    }
  };
};

const createReservationKey = (
  instanceId: ServerInstanceId,
  commandId: string
): string => `${instanceId}\u0000${commandId}`;

const createReservationId = (
  instanceId: ServerInstanceId,
  commandId: string
): string => `command-reservation:${instanceId}:${commandId}`;

const normalizePayloadHash = (payloadHash: string | null | undefined): string =>
  String(payloadHash ?? "").trim();

const requireReservationRecord = (
  recordsByKey: Map<string, CommandReservationRecord>,
  instanceId: ServerInstanceId,
  commandId: string
): CommandReservationRecord => {
  const record = recordsByKey.get(createReservationKey(instanceId, commandId));
  if (!record) {
    throw new Error(`Command reservation was not found for command "${commandId}".`);
  }
  return record;
};

const resolveUpdatedAt = (metadata: Record<string, unknown>): string =>
  typeof metadata.updatedAt === "string" && metadata.updatedAt.trim()
    ? metadata.updatedAt
    : new Date(0).toISOString();

const resolveRejectedAt = (
  errors: DomainError[],
  fallback: string
): string => {
  const firstUpdatedAt = errors
    .map((error) => error.details?.updatedAt)
    .find((updatedAt): updatedAt is string => typeof updatedAt === "string" && updatedAt.trim().length > 0);
  return firstUpdatedAt ?? fallback;
};

const cloneReservationRecord = (
  record: CommandReservationRecord
): CommandReservationRecord => ({
  ...record,
  payload: clonePayload(record.payload),
  appliedMetadata: record.appliedMetadata ? { ...record.appliedMetadata } : null,
  rejectionErrors: record.rejectionErrors ? cloneDomainErrors(record.rejectionErrors) : null
});

const clonePayload = (payload: unknown): unknown => {
  if (payload === null || typeof payload !== "object") {
    return payload;
  }
  return JSON.parse(JSON.stringify(payload)) as unknown;
};

const cloneDomainErrors = (errors: DomainError[]): DomainError[] =>
  errors.map((error) => ({
    ...error,
    details: error.details ? { ...error.details } : undefined
  }));
