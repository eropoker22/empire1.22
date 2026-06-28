import type { ServerInstanceId } from "@empire/shared-types";
import type { RuntimeOutboxRecord } from "../dto";
import type { RuntimeOutboxRepository } from "../repositories";
import type { PostgresQueryable } from "./postgres-client";
import { ensurePostgresServerInstanceRow } from "./postgres-server-instance-row";

export const createPostgresRuntimeOutboxRepository = (
  database: PostgresQueryable
): RuntimeOutboxRepository => ({
  append: async (record) => {
    await ensurePostgresServerInstanceRow(database, record.serverInstanceId, {
      mode: "unknown",
      status: "unknown"
    });
    await database.query(
      `
        INSERT INTO empire_runtime_outbox (
          outbox_id, server_instance_id, command_id, event_type, payload,
          created_at, published_at, attempts, last_error, updated_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, $7::timestamptz, $8, $9, now())
        ON CONFLICT (outbox_id) DO NOTHING
      `,
      [
        record.outboxId,
        record.serverInstanceId,
        record.commandId,
        record.eventType,
        JSON.stringify(record.payload),
        record.createdAt,
        record.publishedAt,
        record.attempts,
        record.lastError
      ]
    );
  },
  listUnpublished: async (instanceId?: ServerInstanceId) => {
    const result = await database.query<{
      outbox_id: string;
      server_instance_id: string;
      command_id: string;
      event_type: string;
      payload: unknown;
      created_at: string;
      published_at: string | null;
      attempts: number;
      last_error: string | null;
    }>(
      `
        SELECT outbox_id, server_instance_id, command_id, event_type, payload,
               created_at, published_at, attempts, last_error
        FROM empire_runtime_outbox
        WHERE published_at IS NULL
          AND ($1::text IS NULL OR server_instance_id = $1)
        ORDER BY created_at ASC, outbox_id ASC
      `,
      [instanceId ?? null]
    );
    return result.rows.map((row) => ({
      outboxId: row.outbox_id,
      serverInstanceId: row.server_instance_id,
      commandId: row.command_id,
      eventType: row.event_type,
      payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
      createdAt: row.created_at,
      publishedAt: row.published_at,
      attempts: Number(row.attempts),
      lastError: row.last_error
    }));
  },
  markPublished: async (outboxId, publishedAt) => {
    await database.query(
      `
        UPDATE empire_runtime_outbox
        SET published_at = $2::timestamptz,
            last_error = NULL,
            updated_at = now()
        WHERE outbox_id = $1
      `,
      [outboxId, publishedAt]
    );
  },
  markPublishFailed: async (outboxId, error) => {
    await database.query(
      `
        UPDATE empire_runtime_outbox
        SET attempts = attempts + 1,
            last_error = $2,
            updated_at = now()
        WHERE outbox_id = $1
      `,
      [outboxId, error]
    );
  }
});
