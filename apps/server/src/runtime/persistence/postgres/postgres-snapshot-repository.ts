import type { ServerInstanceId } from "@empire/shared-types";
import type { InstanceSnapshotDto } from "../dto";
import type { SnapshotRepository } from "../repositories";
import type { PostgresDatabase, PostgresQueryable } from "./postgres-client";
import { ensurePostgresServerInstanceRow } from "./postgres-server-instance-row";

export const createPostgresSnapshotRepository = (
  database: PostgresDatabase
): SnapshotRepository => createPostgresSnapshotRepositoryForQueryable(database, {
  wrapWritesInTransaction: true
});

export const createPostgresSnapshotRepositoryForTransaction = (
  client: PostgresQueryable
): SnapshotRepository => createPostgresSnapshotRepositoryForQueryable(client, {
  wrapWritesInTransaction: false
});

const createPostgresSnapshotRepositoryForQueryable = (
  database: PostgresQueryable,
  options: { wrapWritesInTransaction: boolean }
): SnapshotRepository => ({
  save: async (snapshot) => {
    await withOptionalTransaction(database, options, async (client) => {
      await ensurePostgresServerInstanceRow(client, snapshot.instanceId, {
        mode: snapshot.mode,
        status: snapshot.metadata.status,
        payload: {
          snapshotId: snapshot.snapshotId,
          displayName: snapshot.lobby?.displayName,
          region: snapshot.lobby?.region,
          capacity: snapshot.lobby?.capacity,
          joinPolicy: snapshot.lobby?.joinPolicy
        },
        createdAt: snapshot.metadata.createdAt
      });

      await client.query(
        `
          INSERT INTO empire_snapshots (
            id, server_instance_id, schema_version, snapshot_id, root_version,
            tick, payload, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz, now())
          ON CONFLICT (server_instance_id, snapshot_id) DO NOTHING
        `,
        [
          createSnapshotHistoryId(snapshot),
          snapshot.instanceId,
          snapshot.version.schemaVersion,
          snapshot.snapshotId,
          snapshot.integrity.rootVersion,
          snapshot.tick,
          JSON.stringify(snapshot),
          snapshot.createdAt
        ]
      );

      const upsert = await client.query(
        `
          INSERT INTO empire_snapshot_latest (
            id, server_instance_id, schema_version, snapshot_id,
            root_version, payload, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz, now())
          ON CONFLICT (server_instance_id) DO UPDATE
          SET schema_version = EXCLUDED.schema_version,
              snapshot_id = EXCLUDED.snapshot_id,
              root_version = EXCLUDED.root_version,
              payload = EXCLUDED.payload,
              updated_at = now()
          WHERE empire_snapshot_latest.root_version <= EXCLUDED.root_version
          RETURNING snapshot_id, root_version
        `,
        [
          createLatestSnapshotId(snapshot.instanceId),
          snapshot.instanceId,
          snapshot.version.schemaVersion,
          snapshot.snapshotId,
          snapshot.integrity.rootVersion,
          JSON.stringify(snapshot),
          snapshot.createdAt
        ]
      );

      if ((upsert.rowCount ?? upsert.rows.length) > 0) return;
      await throwStaleSnapshotError(client, snapshot);
    });
  },
  loadLatest: async (instanceId) => {
    const result = await database.query<{ payload: unknown }>(
      `
        SELECT payload
        FROM empire_snapshot_latest
        WHERE server_instance_id = $1
      `,
      [instanceId]
    );
    const row = result.rows[0];
    return row ? coercePayload<InstanceSnapshotDto>(row.payload) : null;
  }
});

const withOptionalTransaction = async <TResult>(
  database: PostgresQueryable,
  options: { wrapWritesInTransaction: boolean },
  callback: (client: PostgresQueryable) => Promise<TResult>
): Promise<TResult> => {
  if (options.wrapWritesInTransaction && "transaction" in database && typeof database.transaction === "function") {
    return database.transaction(callback);
  }
  return callback(database);
};

const throwStaleSnapshotError = async (
  database: PostgresQueryable,
  snapshot: InstanceSnapshotDto
): Promise<never> => {
  const latest = await database.query<{
    snapshot_id: string;
    root_version: string | number;
  }>(
    `
      SELECT snapshot_id, root_version
      FROM empire_snapshot_latest
      WHERE server_instance_id = $1
    `,
    [snapshot.instanceId]
  );
  const latestRow = latest.rows[0];
  const latestRootVersion = Number(latestRow?.root_version ?? Number.NaN);

  throw new Error(
    `Refusing to overwrite snapshot ${latestRow?.snapshot_id ?? "unknown"} rootVersion ${latestRootVersion} with stale rootVersion ${snapshot.integrity.rootVersion}.`
  );
};

const coercePayload = <TPayload>(payload: unknown): TPayload => {
  if (typeof payload === "string") {
    return JSON.parse(payload) as TPayload;
  }
  return payload as TPayload;
};

const createSnapshotHistoryId = (snapshot: InstanceSnapshotDto): string =>
  `snapshot-history:${snapshot.instanceId}:${snapshot.snapshotId}`;

const createLatestSnapshotId = (instanceId: ServerInstanceId): string =>
  `snapshot-latest:${instanceId}`;
