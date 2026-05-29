import type { DomainError, ServerInstanceId } from "@empire/shared-types";
import { join } from "node:path";
import type {
  CommandReservationRecord,
  CommandReservationRepository
} from "./command-reservation-repository";
import {
  createInstancePersistenceDir,
  encodePathSegment,
  readJsonFile,
  type FilePersistenceOptions,
  writeJsonFileAtomic
} from "./file-persistence-utils";

/**
 * Responsibility: Local durable command reservation storage using readable JSON files.
 * Belongs here: file-backed idempotent reservation lifecycle for dev/local parity.
 * Does not belong here: distributed locking, Postgres transactions, or gameplay dispatch.
 */
export const createFileCommandReservationRepository = (
  options: FilePersistenceOptions
): CommandReservationRepository => ({
  reserve: async (record) => {
    const existing = await loadReservation(options.rootDir, record.serverInstanceId, record.commandId);
    if (existing) {
      return {
        created: false,
        record: existing
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
      payload: record.payload ?? null,
      reservedAt: record.reservedAt,
      updatedAt: record.reservedAt,
      appliedAt: null,
      rejectedAt: null,
      appliedMetadata: record.metadata ? { ...record.metadata } : null,
      rejectionErrors: null
    };

    await saveReservation(options.rootDir, nextRecord);

    return {
      created: true,
      record: nextRecord
    };
  },
  getByCommandId: async (instanceId, commandId) =>
    loadReservation(options.rootDir, instanceId, commandId),
  markApplied: async (instanceId, commandId, metadata) => {
    const record = await requireReservation(options.rootDir, instanceId, commandId);
    if (record.status === "rejected") {
      throw new Error("Cannot mark a rejected command reservation as applied.");
    }

    if (record.status === "pending") {
      const updatedAt = resolveUpdatedAt(metadata);
      record.status = "applied";
      record.updatedAt = updatedAt;
      record.appliedAt = updatedAt;
      record.appliedMetadata = { ...metadata };
      await saveReservation(options.rootDir, record);
    }

    return record;
  },
  markRejected: async (instanceId, commandId, errors) => {
    const record = await requireReservation(options.rootDir, instanceId, commandId);
    if (record.status === "applied") {
      throw new Error("Cannot mark an applied command reservation as rejected.");
    }

    if (record.status === "pending") {
      const updatedAt = resolveRejectedAt(errors, record.updatedAt);
      record.status = "rejected";
      record.updatedAt = updatedAt;
      record.rejectedAt = updatedAt;
      record.rejectionErrors = cloneDomainErrors(errors);
      await saveReservation(options.rootDir, record);
    }

    return record;
  }
});

const loadReservation = (
  rootDir: string,
  instanceId: ServerInstanceId,
  commandId: string
): Promise<CommandReservationRecord | null> =>
  readJsonFile<CommandReservationRecord>(createReservationPath(rootDir, instanceId, commandId));

const requireReservation = async (
  rootDir: string,
  instanceId: ServerInstanceId,
  commandId: string
): Promise<CommandReservationRecord> => {
  const record = await loadReservation(rootDir, instanceId, commandId);
  if (!record) {
    throw new Error(`Command reservation was not found for command "${commandId}".`);
  }
  return record;
};

const saveReservation = (
  rootDir: string,
  record: CommandReservationRecord
): Promise<void> =>
  writeJsonFileAtomic(createReservationPath(rootDir, record.serverInstanceId, record.commandId), record);

const createReservationPath = (
  rootDir: string,
  instanceId: ServerInstanceId,
  commandId: string
): string => join(
  createInstancePersistenceDir(rootDir, instanceId),
  "command-reservations",
  `${encodePathSegment(commandId)}.json`
);

const createReservationId = (
  instanceId: ServerInstanceId,
  commandId: string
): string => `command-reservation:${instanceId}:${commandId}`;

const normalizePayloadHash = (payloadHash: string | null | undefined): string =>
  String(payloadHash ?? "").trim();

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

const cloneDomainErrors = (errors: DomainError[]): DomainError[] =>
  errors.map((error) => ({
    ...error,
    details: error.details ? { ...error.details } : undefined
  }));
