import { describe, expect, it } from "vitest";
import type { QueryResult, QueryResultRow } from "pg";
import {
  acquirePostgresTickLock,
  createPostgresCommandLogRepository,
  createPostgresDiagnosticLogRepository,
  createPostgresEventLogRepository,
  createPostgresSnapshotRepository,
  releasePostgresTickLock,
  type PostgresDatabase,
  type PostgresQueryable
} from "../../apps/server/src/runtime/persistence/postgres";
import type {
  CommandRecord,
  DiagnosticRecord,
  EventRecord
} from "../../apps/server/src/runtime";
import {
  createInstanceSnapshot,
  createServerInstanceRuntime
} from "../../apps/server/src/runtime";
import { createAttackDistrictCommandFixture } from "../fixtures/command-fixtures";

describe("postgres persistence repositories", () => {
  it("stores command records idempotently by server instance and command id", async () => {
    const database = new FakePostgresDatabase();
    const repository = createPostgresCommandLogRepository(database);
    const record = createCommandRecord("instance:postgres:commands", "command:postgres:1");

    await repository.append(record);
    await repository.append({ ...record, id: "cmd:duplicate", actorId: "player:changed" });

    const records = await repository.listByInstance(record.instanceId);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: record.id,
      actorId: "player:1",
      command: {
        id: "command:postgres:1"
      }
    });
  });

  it("requires a command id before appending a command record", async () => {
    const repository = createPostgresCommandLogRepository(new FakePostgresDatabase());
    const record = createCommandRecord("instance:postgres:missing-command", "");

    await expect(repository.append(record)).rejects.toThrow(
      "Postgres command log append requires record.command.id for idempotence."
    );
  });

  it("keeps event and diagnostic records ordered by append sequence", async () => {
    const database = new FakePostgresDatabase();
    const eventRepository = createPostgresEventLogRepository(database);
    const diagnosticRepository = createPostgresDiagnosticLogRepository(database);

    await eventRepository.append(createEventRecord("instance:postgres:logs", "command:2", 2));
    await eventRepository.append(createEventRecord("instance:postgres:other", "command:other", 9));
    await eventRepository.append(createEventRecord("instance:postgres:logs", "command:3", 3));
    await diagnosticRepository.append(createDiagnosticRecord("instance:postgres:logs", "Instance started."));
    await diagnosticRepository.append(createDiagnosticRecord("instance:postgres:logs", "Tick completed."));

    expect((await eventRepository.listByInstance("instance:postgres:logs")).map((record) => record.causedByCommandId)).toEqual([
      "command:2",
      "command:3"
    ]);
    expect((await diagnosticRepository.listByInstance("instance:postgres:logs")).map((record) => record.message)).toEqual([
      "Instance started.",
      "Tick completed."
    ]);
  });

  it("saves and loads latest snapshots with rootVersion compare-and-swap", async () => {
    const database = new FakePostgresDatabase();
    const repository = createPostgresSnapshotRepository(database);
    const runtime = createServerInstanceRuntime("instance:postgres:snapshot", "free");
    runtime.state.root.version = 4;
    runtime.state.root.tick = 1;
    const first = createInstanceSnapshot(runtime);

    await repository.save(first);
    expect(await repository.loadLatest(runtime.record.id)).toMatchObject({
      snapshotId: first.snapshotId,
      integrity: {
        rootVersion: 4
      }
    });

    runtime.state.root.version = 5;
    runtime.state.root.tick = 2;
    const second = createInstanceSnapshot(runtime);
    await repository.save(second);
    expect((await repository.loadLatest(runtime.record.id))?.snapshotId).toBe(second.snapshotId);

    await expect(repository.save(first)).rejects.toThrow(
      "Refusing to overwrite snapshot"
    );
  });

  it("keeps idempotent snapshot saves with the same rootVersion valid", async () => {
    const database = new FakePostgresDatabase();
    const repository = createPostgresSnapshotRepository(database);
    const runtime = createServerInstanceRuntime("instance:postgres:idempotent-snapshot", "free");
    runtime.state.root.version = 7;
    const snapshot = createInstanceSnapshot(runtime);

    await repository.save(snapshot);
    await repository.save(snapshot);

    expect((await repository.loadLatest(runtime.record.id))?.integrity.rootVersion).toBe(7);
  });
});

describe("postgres tick lock", () => {
  it("acquires, rejects competing owners, releases, and reacquires expired locks", async () => {
    const database = new FakePostgresDatabase();
    let now = new Date("2026-05-28T08:00:00.000Z");
    const clock = () => now;

    const first = await acquirePostgresTickLock(database, {
      serverInstanceId: "instance:postgres:lock",
      ownerId: "owner:1",
      ttlMs: 1_000,
      now: clock
    });
    expect(first.acquired).toBe(true);

    const blocked = await acquirePostgresTickLock(database, {
      serverInstanceId: "instance:postgres:lock",
      ownerId: "owner:2",
      ttlMs: 1_000,
      now: clock
    });
    expect(blocked.acquired).toBe(false);

    await releasePostgresTickLock(database, "instance:postgres:lock", "owner:1", clock);
    const afterRelease = await acquirePostgresTickLock(database, {
      serverInstanceId: "instance:postgres:lock",
      ownerId: "owner:2",
      ttlMs: 1_000,
      now: clock
    });
    expect(afterRelease.acquired).toBe(true);

    now = new Date("2026-05-28T08:00:02.000Z");
    const afterExpiry = await acquirePostgresTickLock(database, {
      serverInstanceId: "instance:postgres:lock",
      ownerId: "owner:3",
      ttlMs: 1_000,
      now: clock
    });
    expect(afterExpiry.acquired).toBe(true);
  });
});

class FakePostgresDatabase implements PostgresDatabase {
  private sequence = 0;
  private readonly commandRows: StoredRow[] = [];
  private readonly eventRows: StoredRow[] = [];
  private readonly diagnosticRows: StoredRow[] = [];
  private readonly latestSnapshots = new Map<string, LatestSnapshotRow>();
  private readonly tickLocks = new Map<string, TickLockRow>();

  async query<TRow extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: readonly unknown[] = []
  ): Promise<QueryResult<TRow>> {
    const compactSql = sql.replace(/\s+/gu, " ").trim();

    if (compactSql.startsWith("INSERT INTO empire_server_instances")) {
      return result([]);
    }

    if (compactSql.startsWith("INSERT INTO empire_command_log")) {
      const serverInstanceId = String(params[1]);
      const commandId = String(params[2]);
      if (!this.commandRows.some((row) => row.serverInstanceId === serverInstanceId && row.commandId === commandId)) {
        this.commandRows.push({
          id: String(params[0]),
          serverInstanceId,
          commandId,
          sequence: ++this.sequence,
          payload: parsePayload(params[6])
        });
      }
      return result([]);
    }

    if (compactSql.includes("FROM empire_command_log")) {
      return result(this.commandRows
        .filter((row) => row.serverInstanceId === params[0])
        .sort(sortStoredRows)
        .map((row) => ({ payload: row.payload })));
    }

    if (compactSql.startsWith("INSERT INTO empire_event_log")) {
      this.eventRows.push({
        id: String(params[0]),
        serverInstanceId: String(params[1]),
        commandId: typeof params[2] === "string" ? params[2] : null,
        sequence: ++this.sequence,
        payload: parsePayload(params[4])
      });
      return result([]);
    }

    if (compactSql.includes("FROM empire_event_log")) {
      return result(this.eventRows
        .filter((row) => row.serverInstanceId === params[0])
        .sort(sortStoredRows)
        .map((row) => ({ payload: row.payload })));
    }

    if (compactSql.startsWith("INSERT INTO empire_diagnostic_log")) {
      this.diagnosticRows.push({
        id: String(params[0]),
        serverInstanceId: String(params[1]),
        commandId: null,
        sequence: ++this.sequence,
        payload: parsePayload(params[4])
      });
      return result([]);
    }

    if (compactSql.includes("FROM empire_diagnostic_log")) {
      return result(this.diagnosticRows
        .filter((row) => row.serverInstanceId === params[0])
        .sort(sortStoredRows)
        .map((row) => ({ payload: row.payload })));
    }

    if (compactSql.startsWith("INSERT INTO empire_snapshots")) {
      return result([]);
    }

    if (compactSql.startsWith("INSERT INTO empire_snapshot_latest")) {
      const serverInstanceId = String(params[1]);
      const incoming: LatestSnapshotRow = {
        snapshotId: String(params[3]),
        rootVersion: Number(params[4]),
        payload: parsePayload(params[5])
      };
      const current = this.latestSnapshots.get(serverInstanceId);
      if (!current || current.rootVersion <= incoming.rootVersion) {
        this.latestSnapshots.set(serverInstanceId, incoming);
        return result([{ snapshot_id: incoming.snapshotId, root_version: incoming.rootVersion }]);
      }
      return result([]);
    }

    if (compactSql.startsWith("SELECT snapshot_id, root_version FROM empire_snapshot_latest")) {
      const current = this.latestSnapshots.get(String(params[0]));
      return result(current ? [{ snapshot_id: current.snapshotId, root_version: current.rootVersion }] : []);
    }

    if (compactSql.startsWith("SELECT payload FROM empire_snapshot_latest")) {
      const current = this.latestSnapshots.get(String(params[0]));
      return result(current ? [{ payload: current.payload }] : []);
    }

    if (compactSql.startsWith("SELECT lock_owner, locked_until FROM empire_tick_locks")) {
      const current = this.tickLocks.get(String(params[0]));
      return result(current ? [{
        lock_owner: current.ownerId,
        locked_until: current.lockedUntil
      }] : []);
    }

    if (compactSql.startsWith("INSERT INTO empire_tick_locks")) {
      this.tickLocks.set(String(params[1]), {
        ownerId: String(params[2]),
        lockedUntil: String(params[3])
      });
      return result([]);
    }

    if (compactSql.startsWith("UPDATE empire_tick_locks SET lock_owner")) {
      this.tickLocks.set(String(params[0]), {
        ownerId: String(params[1]),
        lockedUntil: String(params[2])
      });
      return result([]);
    }

    if (compactSql.startsWith("UPDATE empire_tick_locks SET locked_until")) {
      const current = this.tickLocks.get(String(params[0]));
      if (current && current.ownerId === params[1]) {
        current.lockedUntil = String(params[2]);
      }
      return result([]);
    }

    throw new Error(`Unhandled fake Postgres SQL: ${compactSql}`);
  }

  async transaction<TResult>(
    callback: (client: PostgresQueryable) => Promise<TResult>
  ): Promise<TResult> {
    return callback(this);
  }

  async close(): Promise<void> {
    return;
  }
}

interface StoredRow {
  id: string;
  serverInstanceId: string;
  commandId: string | null;
  sequence: number;
  payload: unknown;
}

interface LatestSnapshotRow {
  snapshotId: string;
  rootVersion: number;
  payload: unknown;
}

interface TickLockRow {
  ownerId: string;
  lockedUntil: string;
}

const result = <TRow extends QueryResultRow>(rows: QueryResultRow[]): QueryResult<TRow> => ({
  rows: rows as TRow[],
  rowCount: rows.length,
  command: "",
  oid: 0,
  fields: []
});

const parsePayload = (value: unknown): unknown =>
  typeof value === "string" ? JSON.parse(value) : value;

const sortStoredRows = (left: StoredRow, right: StoredRow): number =>
  left.sequence - right.sequence || left.id.localeCompare(right.id);

const createCommandRecord = (
  instanceId: string,
  commandId: string
): CommandRecord => ({
  id: `cmd:${commandId || "missing"}`,
  instanceId,
  command: createAttackDistrictCommandFixture({
    id: commandId,
    serverInstanceId: instanceId
  }),
  receivedAt: "2026-05-28T08:00:00.000Z",
  actorId: "player:1",
  correlationId: null,
  tickAtReceive: 0
});

const createEventRecord = (
  instanceId: string,
  commandId: string,
  tick: number
): EventRecord => ({
  id: `evt:${commandId}`,
  instanceId,
  event: {
    type: "command-applied",
    payload: {
      commandId,
      eventCount: 0
    },
    occurredAt: "2026-05-28T08:00:00.000Z"
  },
  causedByCommandId: commandId,
  recordedAt: "2026-05-28T08:00:00.000Z",
  tickAtEmit: tick
});

const createDiagnosticRecord = (
  instanceId: string,
  message: string
): DiagnosticRecord => ({
  id: `diag:${instanceId}:${message}`,
  instanceId,
  level: "info",
  category: "lifecycle",
  message,
  occurredAt: "2026-05-28T08:00:00.000Z",
  context: {}
});
