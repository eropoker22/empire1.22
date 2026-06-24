import type { DomainError } from "@empire/shared-types";
import type {
  CommandReservationDraft,
  CommandReservationRepository
} from "../repositories";
import type { PostgresDatabase, PostgresQueryable } from "./postgres-client";
import { ensurePostgresServerInstanceRow } from "./postgres-server-instance-row";
import { mapReservationRow, type CommandReservationRow } from "./postgres-command-reservation-row";

export const createPostgresCommandReservationRepository = (
  database: PostgresDatabase
): CommandReservationRepository => ({
  reserve: async (record) =>
    database.transaction(async (client) => {
      await ensurePostgresServerInstanceRow(client, record.serverInstanceId, {
        mode: "unknown",
        status: "unknown"
      });

      const reservationId = createReservationId(record.serverInstanceId, record.commandId);
      const payloadHash = normalizePayloadHash(record.payloadHash);
      const inserted = await client.query<CommandReservationRow>(
        `
          INSERT INTO empire_command_reservations (
            id, server_instance_id, command_id, status, command_type,
            actor_id, payload_hash, payload, result, rejection_reason,
            reserved_at, updated_at, applied_at, rejected_at
          )
          VALUES (
            $1, $2, $3, 'pending', $4,
            $5, $6, $7::jsonb, NULL, NULL,
            $8::timestamptz, $8::timestamptz, NULL, NULL
          )
          ON CONFLICT (server_instance_id, command_id) DO NOTHING
          RETURNING *
        `,
        [
          reservationId,
          record.serverInstanceId,
          record.commandId,
          record.commandType,
          record.playerId,
          payloadHash,
          JSON.stringify(record.payload ?? null),
          record.reservedAt
        ]
      );

      if (inserted.rows[0]) {
        return {
          created: true,
          record: mapReservationRow(inserted.rows[0])
        };
      }

      const existing = await selectReservation(client, record.serverInstanceId, record.commandId);
      if (!existing) {
        throw new Error(`Postgres command reservation conflict could not be loaded for command "${record.commandId}".`);
      }

      return {
        created: false,
        record: existing
      };
    }),
  getByCommandId: async (instanceId, commandId) =>
    selectReservation(database, instanceId, commandId),
  listPendingByInstance: async (instanceId) => {
    const result = await database.query<CommandReservationRow>(
      `
        SELECT *
        FROM empire_command_reservations
        WHERE server_instance_id = $1
          AND status = 'pending'
        ORDER BY reserved_at ASC, command_id ASC
      `,
      [instanceId]
    );
    return result.rows.map(mapReservationRow);
  },
  markApplied: async (instanceId, commandId, metadata) =>
    database.transaction(async (client) => {
      const existing = await requireReservation(client, instanceId, commandId);
      if (existing.status === "rejected") {
        throw new Error("Cannot mark a rejected command reservation as applied.");
      }

      if (existing.status === "applied") {
        return existing;
      }

      const updatedAt = resolveUpdatedAt(metadata);
      const updated = await client.query<CommandReservationRow>(
        `
          UPDATE empire_command_reservations
          SET status = 'applied',
              result = $3::jsonb,
              updated_at = $4::timestamptz,
              applied_at = $4::timestamptz
          WHERE server_instance_id = $1
            AND command_id = $2
            AND status = 'pending'
          RETURNING *
        `,
        [
          instanceId,
          commandId,
          JSON.stringify(metadata),
          updatedAt
        ]
      );

      return mapReservationRow(updated.rows[0] ?? await requireReservationRow(client, instanceId, commandId));
    }),
  markRejected: async (instanceId, commandId, errors) =>
    database.transaction(async (client) => {
      const existing = await requireReservation(client, instanceId, commandId);
      if (existing.status === "applied") {
        throw new Error("Cannot mark an applied command reservation as rejected.");
      }

      if (existing.status === "rejected") {
        return existing;
      }

      const updatedAt = resolveRejectedAt(errors, existing.updatedAt);
      const updated = await client.query<CommandReservationRow>(
        `
          UPDATE empire_command_reservations
          SET status = 'rejected',
              rejection_reason = $3::jsonb,
              updated_at = $4::timestamptz,
              rejected_at = $4::timestamptz
          WHERE server_instance_id = $1
            AND command_id = $2
            AND status = 'pending'
          RETURNING *
        `,
        [
          instanceId,
          commandId,
          JSON.stringify(errors),
          updatedAt
        ]
      );

      return mapReservationRow(updated.rows[0] ?? await requireReservationRow(client, instanceId, commandId));
    })
});

const selectReservation = async (
  client: PostgresQueryable,
  instanceId: string,
  commandId: string
): Promise<ReturnType<typeof mapReservationRow> | null> => {
  const result = await client.query<CommandReservationRow>(
    `
      SELECT *
      FROM empire_command_reservations
      WHERE server_instance_id = $1
        AND command_id = $2
      LIMIT 1
    `,
    [instanceId, commandId]
  );

  return result.rows[0] ? mapReservationRow(result.rows[0]) : null;
};

const requireReservation = async (
  client: PostgresQueryable,
  instanceId: string,
  commandId: string
): Promise<ReturnType<typeof mapReservationRow>> => {
  const reservation = await selectReservation(client, instanceId, commandId);
  if (!reservation) {
    throw new Error(`Command reservation was not found for command "${commandId}".`);
  }
  return reservation;
};

const requireReservationRow = async (
  client: PostgresQueryable,
  instanceId: string,
  commandId: string
): Promise<CommandReservationRow> => {
  const result = await client.query<CommandReservationRow>(
    `
      SELECT *
      FROM empire_command_reservations
      WHERE server_instance_id = $1
        AND command_id = $2
      LIMIT 1
    `,
    [instanceId, commandId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error(`Command reservation was not found for command "${commandId}".`);
  }
  return row;
};

const createReservationId = (
  instanceId: string,
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
