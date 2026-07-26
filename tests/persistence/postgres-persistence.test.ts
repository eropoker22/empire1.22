import { describe, expect, it } from "vitest";
import type { QueryResult, QueryResultRow } from "pg";
import {
  acquirePostgresTickLock,
  createPostgresCommandLogRepository,
  createPostgresCommandReservationRepository,
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
  EventRecord,
  SnapshotCheckpointRecord
} from "../../apps/server/src/runtime";
import {
  SNAPSHOT_CHECKPOINT_KINDS,
  createInstanceSnapshot,
  createSnapshotCheckpoint,
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

  it("reserves command ids idempotently by server instance and command id", async () => {
    const repository = createPostgresCommandReservationRepository(new FakePostgresDatabase());
    const draft = createReservationDraft("instance:postgres:reservation", "command:postgres:reservation:1");

    const first = await repository.reserve(draft);
    const duplicate = await repository.reserve({
      ...draft,
      commandType: "spy-district",
      playerId: "player:changed",
      payloadHash: "sha256:changed",
      payload: {
        changed: true
      }
    });

    expect(first.created).toBe(true);
    expect(first.record).toMatchObject({
      status: "pending",
      commandId: "command:postgres:reservation:1",
      payloadHash: "sha256:reservation"
    });
    expect(duplicate.created).toBe(false);
    expect(duplicate.record).toEqual(first.record);
  });

  it("supports applied and rejected command reservation terminal states", async () => {
    const repository = createPostgresCommandReservationRepository(new FakePostgresDatabase());
    await repository.reserve(createReservationDraft("instance:postgres:reservation-states", "command:postgres:applied"));
    await repository.reserve(createReservationDraft("instance:postgres:reservation-states", "command:postgres:rejected"));

    const applied = await repository.markApplied("instance:postgres:reservation-states", "command:postgres:applied", {
      updatedAt: "2026-05-29T12:10:00.000Z",
      rootVersion: 3,
      eventCount: 1
    });
    const appliedAgain = await repository.markApplied("instance:postgres:reservation-states", "command:postgres:applied", {
      updatedAt: "2026-05-29T12:11:00.000Z",
      rootVersion: 4
    });
    const rejected = await repository.markRejected("instance:postgres:reservation-states", "command:postgres:rejected", [
      {
        code: "unsupported_command",
        message: "Unsupported command type.",
        details: {
          updatedAt: "2026-05-29T12:12:00.000Z"
        }
      }
    ]);
    const rejectedAgain = await repository.markRejected("instance:postgres:reservation-states", "command:postgres:rejected", [
      {
        code: "later_rejection",
        message: "Should not overwrite."
      }
    ]);

    expect(applied).toMatchObject({
      status: "applied",
      appliedAt: "2026-05-29T12:10:00.000Z",
      appliedMetadata: {
        rootVersion: 3,
        eventCount: 1
      }
    });
    expect(appliedAgain).toEqual(applied);
    expect(rejected).toMatchObject({
      status: "rejected",
      rejectedAt: "2026-05-29T12:12:00.000Z",
      rejectionErrors: [
        {
          code: "unsupported_command"
        }
      ]
    });
    expect(rejectedAgain).toEqual(rejected);
    await expect(repository.markRejected("instance:postgres:reservation-states", "command:postgres:applied", [
      {
        code: "later_rejection",
        message: "Should not overwrite applied."
      }
    ])).rejects.toThrow("Cannot mark an applied command reservation as rejected.");
    await expect(repository.markApplied("instance:postgres:reservation-states", "command:postgres:rejected", {
      updatedAt: "2026-05-29T12:13:00.000Z"
    })).rejects.toThrow("Cannot mark a rejected command reservation as applied.");
  });

  it("scopes postgres command reservation ids by server instance", async () => {
    const repository = createPostgresCommandReservationRepository(new FakePostgresDatabase());

    const first = await repository.reserve(createReservationDraft("instance:postgres:reservation-a", "command:shared"));
    const second = await repository.reserve(createReservationDraft("instance:postgres:reservation-b", "command:shared"));

    expect(first.created).toBe(true);
    expect(second.created).toBe(true);
    await expect(repository.getByCommandId("instance:postgres:reservation-a", "command:shared"))
      .resolves.toMatchObject({ serverInstanceId: "instance:postgres:reservation-a" });
    await expect(repository.getByCommandId("instance:postgres:reservation-b", "command:shared"))
      .resolves.toMatchObject({ serverInstanceId: "instance:postgres:reservation-b" });
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

  it("rejects divergent snapshot payloads with the same rootVersion", async () => {
    const database = new FakePostgresDatabase();
    const repository = createPostgresSnapshotRepository(database);
    const runtime = createServerInstanceRuntime("instance:postgres:divergent-snapshot", "free");
    runtime.state.root.version = 8;
    const snapshot = createInstanceSnapshot(runtime);
    const divergent = structuredClone(snapshot);
    divergent.lobby!.displayName = "Divergent server";

    await repository.save(snapshot);
    await expect(repository.save(divergent)).rejects.toThrow("Refusing divergent snapshot");
    await expect(repository.loadLatest(runtime.record.id)).resolves.toEqual(snapshot);
  });

  it("accepts only an identical checkpoint when a checkpoint id already exists", async () => {
    const database = new FakePostgresDatabase();
    const repository = createPostgresSnapshotRepository(database);
    const runtime = createServerInstanceRuntime("instance:postgres:checkpoint-conflict", "free");
    runtime.state.root.tick = 30;
    runtime.state.root.version = 31;
    const checkpoint = createSnapshotCheckpoint(createInstanceSnapshot(runtime), {
      kind: SNAPSHOT_CHECKPOINT_KINDS.periodic,
      reasonCode: "periodic-cadence"
    });

    await expect(repository.saveCheckpoint(checkpoint)).resolves.toBe("created");
    await expect(repository.saveCheckpoint(structuredClone(checkpoint))).resolves.toBe("idempotent");
    await expect(repository.saveCheckpoint({
      ...structuredClone(checkpoint),
      kind: SNAPSHOT_CHECKPOINT_KINDS.lifecycle
    })).rejects.toThrow("collides with a different persisted checkpoint");

    const divergentPayload = structuredClone(checkpoint);
    divergentPayload.snapshot.lobby!.displayName = "Divergent checkpoint";
    await expect(repository.saveCheckpoint(divergentPayload))
      .rejects.toThrow("collides with a different persisted checkpoint");
  });

  it("searches checkpoint fallback in bounded batches until valid history is exhausted", async () => {
    const database = new FakePostgresDatabase();
    const repository = createPostgresSnapshotRepository(database);
    const runtime = createServerInstanceRuntime("instance:postgres:checkpoint-pages", "free");
    runtime.state.root.tick = 1;
    runtime.state.root.version = 2;
    const valid = createSnapshotCheckpoint(createInstanceSnapshot(runtime), {
      kind: SNAPSHOT_CHECKPOINT_KINDS.periodic,
      reasonCode: "valid-fallback"
    });

    for (let index = 0; index < 21; index += 1) {
      runtime.state.root.tick = 100 + index;
      runtime.state.root.version = 200 + index;
      const corrupt = createSnapshotCheckpoint(createInstanceSnapshot(runtime), {
        kind: SNAPSHOT_CHECKPOINT_KINDS.periodic,
        reasonCode: `corrupt-${index}`
      });
      corrupt.snapshot.integrity.entityCounts.players += 1;
      database.seedCheckpoint(corrupt);
    }
    database.seedCheckpoint(valid);

    await expect(repository.loadForRecovery(runtime.record.id)).resolves.toMatchObject({
      source: "checkpoint-fallback",
      snapshot: {
        snapshotId: valid.snapshot.snapshotId,
        integrity: { rootVersion: valid.rootVersion }
      }
    });
    expect(database.checkpointCandidateCursorRoots).toEqual([null, 201]);
    await expect(repository.loadRecoveryHead(runtime.record.id))
      .resolves.toMatchObject({ snapshotId: valid.snapshot.snapshotId });
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
  private readonly commandReservationRows: CommandReservationStoredRow[] = [];
  private readonly latestSnapshots = new Map<string, LatestSnapshotRow>();
  private readonly checkpoints = new Map<string, SnapshotCheckpointStoredRow>();
  private readonly tickLocks = new Map<string, TickLockRow>();
  readonly checkpointCandidateCursorRoots: Array<number | null> = [];

  seedCheckpoint(checkpoint: SnapshotCheckpointRecord): void {
    const row = checkpointRow(checkpoint);
    this.checkpoints.set(checkpointKey(checkpoint.instanceId, checkpoint.checkpointId), row);
  }

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

    if (compactSql.startsWith("INSERT INTO empire_command_reservations")) {
      const serverInstanceId = String(params[1]);
      const commandId = String(params[2]);
      const existing = this.commandReservationRows.some((row) =>
        row.server_instance_id === serverInstanceId && row.command_id === commandId
      );
      if (existing) {
        return result([]);
      }

      const row: CommandReservationStoredRow = {
        id: String(params[0]),
        server_instance_id: serverInstanceId,
        command_id: commandId,
        status: "pending",
        command_type: String(params[3]),
        actor_id: String(params[4]),
        payload_hash: String(params[5]),
        payload: parsePayload(params[6]),
        result: null,
        rejection_reason: null,
        reserved_at: String(params[7]),
        updated_at: String(params[7]),
        applied_at: null,
        rejected_at: null
      };
      this.commandReservationRows.push(row);
      return result([row]);
    }

    if (compactSql.startsWith("SELECT * FROM empire_command_reservations")) {
      const row = this.commandReservationRows.find((candidate) =>
        candidate.server_instance_id === params[0] && candidate.command_id === params[1]
      );
      return result(row ? [row] : []);
    }

    if (compactSql.startsWith("UPDATE empire_command_reservations SET status = 'applied'")) {
      const row = this.commandReservationRows.find((candidate) =>
        candidate.server_instance_id === params[0] &&
        candidate.command_id === params[1] &&
        candidate.status === "pending"
      );
      if (!row) {
        return result([]);
      }
      row.status = "applied";
      row.result = parsePayload(params[2]);
      row.updated_at = String(params[3]);
      row.applied_at = String(params[3]);
      return result([row]);
    }

    if (compactSql.startsWith("UPDATE empire_command_reservations SET status = 'rejected'")) {
      const row = this.commandReservationRows.find((candidate) =>
        candidate.server_instance_id === params[0] &&
        candidate.command_id === params[1] &&
        candidate.status === "pending"
      );
      if (!row) {
        return result([]);
      }
      row.status = "rejected";
      row.rejection_reason = parsePayload(params[2]);
      row.updated_at = String(params[3]);
      row.rejected_at = String(params[3]);
      return result([row]);
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
      const row: SnapshotCheckpointStoredRow = {
        snapshot_id: String(params[3]),
        checkpoint_kind: String(params[6]),
        reason_code: String(params[7]),
        lifecycle_phase: params[8] === null ? null : String(params[8]),
        is_protected: params[9] === true,
        root_version: Number(params[4]),
        tick: Number(params[5]),
        created_at: String(params[11]),
        payload: parsePayload(params[10])
      };
      const key = checkpointKey(String(params[1]), row.snapshot_id);
      if (this.checkpoints.has(key)) return result([]);
      this.checkpoints.set(key, row);
      return result([{ snapshot_id: row.snapshot_id }]);
    }

    if (compactSql.startsWith("SELECT snapshot_id, checkpoint_kind, reason_code")) {
      const instanceId = String(params[0]);
      if (compactSql.includes("AND snapshot_id = $2")) {
        const row = this.checkpoints.get(checkpointKey(instanceId, String(params[1])));
        return result(row ? [row] : []);
      }
      const limit = Number(params[1]);
      const cursor = params[2] === null ? null : {
        rootVersion: Number(params[2]),
        tick: Number(params[3]),
        createdAt: String(params[4]),
        checkpointId: String(params[5])
      };
      this.checkpointCandidateCursorRoots.push(cursor?.rootVersion ?? null);
      const rows = [...this.checkpoints.entries()]
        .filter(([key]) => key.startsWith(`${instanceId}\u0000`))
        .map(([, row]) => row)
        .sort(compareCheckpointRows)
        .filter((row) => !cursor || compareCheckpointRows(row, {
          snapshot_id: cursor.checkpointId,
          checkpoint_kind: "",
          reason_code: "",
          lifecycle_phase: null,
          is_protected: false,
          root_version: cursor.rootVersion,
          tick: cursor.tick,
          created_at: cursor.createdAt,
          payload: null
        }) > 0)
        .slice(0, limit);
      return result(rows);
    }

    if (compactSql.startsWith("INSERT INTO empire_snapshot_latest")) {
      const serverInstanceId = String(params[1]);
      const incoming: LatestSnapshotRow = {
        snapshotId: String(params[3]),
        rootVersion: Number(params[4]),
        payload: parsePayload(params[6])
      };
      const current = this.latestSnapshots.get(serverInstanceId);
      if (!current || current.rootVersion < incoming.rootVersion) {
        this.latestSnapshots.set(serverInstanceId, incoming);
        return result([{ snapshot_id: incoming.snapshotId, root_version: incoming.rootVersion }]);
      }
      return result([]);
    }

    if (compactSql.startsWith("SELECT snapshot_id, root_version, payload FROM empire_snapshot_latest")) {
      const current = this.latestSnapshots.get(String(params[0]));
      return result(current ? [{
        snapshot_id: current.snapshotId,
        root_version: current.rootVersion,
        payload: current.payload
      }] : []);
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

interface CommandReservationStoredRow extends QueryResultRow {
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

interface LatestSnapshotRow {
  snapshotId: string;
  rootVersion: number;
  payload: unknown;
}

interface SnapshotCheckpointStoredRow extends QueryResultRow {
  snapshot_id: string;
  checkpoint_kind: string;
  reason_code: string;
  lifecycle_phase: string | null;
  is_protected: boolean;
  root_version: number;
  tick: number;
  created_at: string;
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

const checkpointKey = (instanceId: string, checkpointId: string): string =>
  `${instanceId}\u0000${checkpointId}`;

const checkpointRow = (checkpoint: SnapshotCheckpointRecord): SnapshotCheckpointStoredRow => ({
  snapshot_id: checkpoint.checkpointId,
  checkpoint_kind: checkpoint.kind,
  reason_code: checkpoint.reasonCode,
  lifecycle_phase: checkpoint.lifecyclePhase,
  is_protected: checkpoint.protected,
  root_version: checkpoint.rootVersion,
  tick: checkpoint.tick,
  created_at: checkpoint.createdAt,
  payload: structuredClone(checkpoint.snapshot)
});

const compareCheckpointRows = (
  left: SnapshotCheckpointStoredRow,
  right: SnapshotCheckpointStoredRow
): number => right.root_version - left.root_version ||
  right.tick - left.tick ||
  right.created_at.localeCompare(left.created_at) ||
  right.snapshot_id.localeCompare(left.snapshot_id);

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

const createReservationDraft = (
  instanceId: string,
  commandId: string
) => ({
  serverInstanceId: instanceId,
  commandId,
  commandType: "attack-district",
  playerId: "player:postgres-reservation",
  payloadHash: "sha256:reservation",
  payload: {
    commandId
  },
  reservedAt: "2026-05-29T12:00:00.000Z"
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
