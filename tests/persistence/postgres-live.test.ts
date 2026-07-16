import { describe, expect, it } from "vitest";
import {
  acquirePostgresTickLock,
  createInstanceSnapshot,
  createPostgresDatabase,
  createPostgresRuntimePersistenceRepositories,
  createServerInstanceRuntime,
  type CommandRecord,
  type DiagnosticRecord,
  type EventRecord
} from "../../apps/server/src/runtime";
import { createAttackDistrictCommandFixture } from "../fixtures/command-fixtures";
import { createPostgresAdminDurableRepositories } from "../../apps/server/src/admin/read-only";

const databaseUrl = process.env.EMPIRE_TEST_DATABASE_URL?.trim();
const describeWhenDatabaseConfigured = databaseUrl ? describe : describe.skip;

describeWhenDatabaseConfigured("postgres persistence live smoke", () => {
  it("stores logs, snapshots, and tick locks against a migrated database", async () => {
    const database = createPostgresDatabase(databaseUrl!);
    const persistence = createPostgresRuntimePersistenceRepositories({
      databaseUrl: databaseUrl!,
      database
    });
    const instanceId = `instance:postgres:live:${Date.now()}`;
    const command = createAttackDistrictCommandFixture({
      id: `command:postgres:live:${Date.now()}`,
      serverInstanceId: instanceId
    });
    const commandRecord: CommandRecord = {
      id: `cmd:${command.id}`,
      instanceId,
      command,
      receivedAt: new Date().toISOString(),
      actorId: command.playerId,
      correlationId: null,
      tickAtReceive: 0
    };
    const eventRecord: EventRecord = {
      id: `evt:${command.id}`,
      instanceId,
      event: {
        type: "command-applied",
        payload: { commandId: command.id, eventCount: 0 },
        occurredAt: commandRecord.receivedAt
      },
      causedByCommandId: command.id,
      recordedAt: commandRecord.receivedAt,
      tickAtEmit: 0
    };
    const diagnosticRecord: DiagnosticRecord = {
      id: `diag:${command.id}`,
      instanceId,
      level: "info",
      category: "lifecycle",
      message: "Live Postgres smoke diagnostic.",
      occurredAt: commandRecord.receivedAt,
      context: {}
    };

    try {
      await persistence.commandLogRepository.append(commandRecord);
      await persistence.eventLogRepository.append(eventRecord);
      await persistence.diagnosticLogRepository.append(diagnosticRecord);

      const runtime = createServerInstanceRuntime(instanceId, "free", { persistence });
      runtime.state.root.version = 3;
      const snapshot = createInstanceSnapshot(runtime);
      await persistence.snapshotRepository.save(snapshot);

      expect(await persistence.commandLogRepository.listByInstance(instanceId)).toHaveLength(1);
      expect(await persistence.eventLogRepository.listByInstance(instanceId)).toHaveLength(1);
      expect(await persistence.diagnosticLogRepository.listByInstance(instanceId)).toHaveLength(1);
      expect((await persistence.snapshotRepository.loadLatest(instanceId))?.snapshotId).toBe(snapshot.snapshotId);
      expect((await acquirePostgresTickLock(database, {
        serverInstanceId: instanceId,
        ownerId: "live-smoke",
        ttlMs: 1_000
      })).acquired).toBe(true);
      const admin = createPostgresAdminDurableRepositories(database);
      expect(await admin.monitoring.listKnownInstances()).toContainEqual(expect.objectContaining({
        serverInstanceId: instanceId,
        displayName: runtime.lobby.displayName,
        region: runtime.lobby.region,
        capacity: runtime.lobby.maxPlayers
      }));
      const adminDetail = await admin.monitoring.getInstanceRuntimeProjection(instanceId);
      expect(adminDetail).toMatchObject({ serverInstanceId: instanceId });
      expect(adminDetail?.commands.every((row) => row.serverInstanceId === instanceId)).toBe(true);
    } finally {
      await persistence.close();
    }
  });
});
