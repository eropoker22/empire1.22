import type { ServerInstanceId } from "@empire/shared-types";
import type { RuntimeTickLock } from "../tick-lock";
import type { PostgresDatabase } from "./postgres-client";
import { ensurePostgresServerInstanceRow } from "./postgres-server-instance-row";

const DEFAULT_TICK_LOCK_TTL_MS = 30_000;

export interface PostgresTickLockOptions {
  ownerId?: string;
  ttlMs?: number;
  now?: () => Date;
}

export interface PostgresTickLockAcquireResult {
  acquired: boolean;
  serverInstanceId: ServerInstanceId;
  ownerId: string;
  lockedUntil: string | null;
}

export const createPostgresRuntimeTickLock = (
  database: PostgresDatabase,
  options: PostgresTickLockOptions = {}
): RuntimeTickLock => {
  const ownerId = normalizeLockOwner(options.ownerId);
  const ttlMs = normalizeTtlMs(options.ttlMs);
  const now = options.now ?? (() => new Date());

  return {
    withTickLock: async (serverInstanceId, callback) => {
      const acquired = await acquirePostgresTickLock(database, {
        serverInstanceId,
        ownerId,
        ttlMs,
        now
      });

      if (!acquired.acquired) {
        return {
          acquired: false,
          result: null
        };
      }

      try {
        return {
          acquired: true,
          result: await callback()
        };
      } finally {
        await releasePostgresTickLock(database, serverInstanceId, ownerId, now);
      }
    }
  };
};

export const acquirePostgresTickLock = async (
  database: PostgresDatabase,
  options: {
    serverInstanceId: ServerInstanceId;
    ownerId: string;
    ttlMs?: number;
    now?: () => Date;
  }
): Promise<PostgresTickLockAcquireResult> => {
  const ttlMs = normalizeTtlMs(options.ttlMs);
  const ownerId = normalizeLockOwner(options.ownerId);
  const now = options.now ?? (() => new Date());
  const nowDate = now();
  const lockedUntil = new Date(nowDate.getTime() + ttlMs);

  return database.transaction(async (client) => {
    await ensurePostgresServerInstanceRow(client, options.serverInstanceId, {
      mode: "unknown",
      status: "unknown"
    });

    const existing = await client.query<{
      lock_owner: string;
      locked_until: Date | string;
    }>(
      `
        SELECT lock_owner, locked_until
        FROM empire_tick_locks
        WHERE server_instance_id = $1
        FOR UPDATE
      `,
      [options.serverInstanceId]
    );

    const current = existing.rows[0];
    if (!current) {
      await client.query(
        `
          INSERT INTO empire_tick_locks (
            id,
            server_instance_id,
            schema_version,
            lock_owner,
            locked_until,
            payload,
            created_at,
            updated_at
          )
          VALUES ($1, $2, 1, $3, $4::timestamptz, $5::jsonb, now(), now())
        `,
        [
          createTickLockId(options.serverInstanceId),
          options.serverInstanceId,
          ownerId,
          lockedUntil.toISOString(),
          JSON.stringify({ acquiredAt: nowDate.toISOString() })
        ]
      );

      return {
        acquired: true,
        serverInstanceId: options.serverInstanceId,
        ownerId,
        lockedUntil: lockedUntil.toISOString()
      };
    }

    const currentUntil = new Date(current.locked_until).getTime();
    const expired = currentUntil <= nowDate.getTime();
    if (!expired && current.lock_owner !== ownerId) {
      return {
        acquired: false,
        serverInstanceId: options.serverInstanceId,
        ownerId,
        lockedUntil: new Date(current.locked_until).toISOString()
      };
    }

    await client.query(
      `
        UPDATE empire_tick_locks
        SET lock_owner = $2,
            locked_until = $3::timestamptz,
            payload = $4::jsonb,
            updated_at = now()
        WHERE server_instance_id = $1
      `,
      [
        options.serverInstanceId,
        ownerId,
        lockedUntil.toISOString(),
        JSON.stringify({ acquiredAt: nowDate.toISOString() })
      ]
    );

    return {
      acquired: true,
      serverInstanceId: options.serverInstanceId,
      ownerId,
      lockedUntil: lockedUntil.toISOString()
    };
  });
};

export const releasePostgresTickLock = async (
  database: PostgresDatabase,
  serverInstanceId: ServerInstanceId,
  ownerId: string,
  now: () => Date = () => new Date()
): Promise<void> => {
  const releasedAt = now().toISOString();
  await database.query(
    `
      UPDATE empire_tick_locks
      SET locked_until = $3::timestamptz,
          payload = payload || $4::jsonb,
          updated_at = now()
      WHERE server_instance_id = $1
        AND lock_owner = $2
    `,
    [
      serverInstanceId,
      normalizeLockOwner(ownerId),
      releasedAt,
      JSON.stringify({ releasedAt })
    ]
  );
};

const normalizeLockOwner = (ownerId: string | undefined): string => {
  const normalized = String(ownerId ?? "").trim();
  if (normalized) {
    return normalized;
  }
  const pid = typeof process !== "undefined" ? process.pid : 0;
  return `runtime:${pid}:${Math.random().toString(36).slice(2)}`;
};

const normalizeTtlMs = (ttlMs: number | undefined): number =>
  typeof ttlMs === "number" && Number.isFinite(ttlMs)
    ? Math.max(1, Math.floor(ttlMs))
    : DEFAULT_TICK_LOCK_TTL_MS;

const createTickLockId = (serverInstanceId: ServerInstanceId): string =>
  `tick-lock:${serverInstanceId}`;
