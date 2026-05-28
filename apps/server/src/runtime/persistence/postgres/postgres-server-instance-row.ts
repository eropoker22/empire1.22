import type { ServerInstanceId } from "@empire/shared-types";
import type { PostgresQueryable } from "./postgres-client";

export const ensurePostgresServerInstanceRow = async (
  client: PostgresQueryable,
  serverInstanceId: ServerInstanceId,
  options: {
    mode?: string | null;
    status?: string | null;
    payload?: Record<string, unknown>;
    createdAt?: string | null;
  } = {}
): Promise<void> => {
  const mode = normalizeNonEmptyText(options.mode, "unknown");
  const status = normalizeNonEmptyText(options.status, "unknown");
  const payload = {
    serverInstanceId,
    mode,
    status,
    ...(options.payload ?? {})
  };

  await client.query(
    `
      INSERT INTO empire_server_instances (
        id,
        server_instance_id,
        schema_version,
        mode,
        status,
        payload,
        created_at,
        updated_at
      )
      VALUES ($1, $2, 1, $3, $4, $5::jsonb, COALESCE($6::timestamptz, now()), now())
      ON CONFLICT (server_instance_id) DO UPDATE
      SET mode = CASE
            WHEN empire_server_instances.mode = 'unknown' AND EXCLUDED.mode <> 'unknown'
              THEN EXCLUDED.mode
            ELSE empire_server_instances.mode
          END,
          status = CASE
            WHEN EXCLUDED.status <> 'unknown'
              THEN EXCLUDED.status
            ELSE empire_server_instances.status
          END,
          payload = empire_server_instances.payload || EXCLUDED.payload,
          updated_at = now()
    `,
    [
      createServerInstancePersistenceId(serverInstanceId),
      serverInstanceId,
      mode,
      status,
      JSON.stringify(payload),
      options.createdAt ?? null
    ]
  );
};

const normalizeNonEmptyText = (value: unknown, fallback: string): string => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const createServerInstancePersistenceId = (serverInstanceId: ServerInstanceId): string =>
  `server-instance:${serverInstanceId}`;
