import { describe, expect, it } from "vitest";
import type { CommandRecord, DiagnosticRecord, EventRecord } from "../../apps/server/src/runtime";
import {
  createInMemoryCommandLogRepository,
  createInMemoryDiagnosticLogRepository,
  createInMemoryEventLogRepository
} from "../../apps/server/src/runtime";
import { createAttackDistrictCommandFixture } from "../fixtures/command-fixtures";

describe("in-memory persistence repositories", () => {
  it("keeps command records ordered and scoped by instance", async () => {
    const repository = createInMemoryCommandLogRepository();

    await repository.append(createCommandRecord("instance:1", "command:1"));
    await repository.append(createCommandRecord("instance:2", "command:2"));
    await repository.append(createCommandRecord("instance:1", "command:3"));

    expect((await repository.listByInstance("instance:1")).map((record) => record.command.id)).toEqual([
      "command:1",
      "command:3"
    ]);
    expect((await repository.listByInstance("instance:2")).map((record) => record.command.id)).toEqual([
      "command:2"
    ]);
  });

  it("keeps event records ordered and scoped by instance", async () => {
    const repository = createInMemoryEventLogRepository();

    await repository.append(createEventRecord("instance:1", "command:1", 1));
    await repository.append(createEventRecord("instance:2", "command:2", 2));
    await repository.append(createEventRecord("instance:1", "command:3", 3));

    expect((await repository.listByInstance("instance:1")).map((record) => record.causedByCommandId)).toEqual([
      "command:1",
      "command:3"
    ]);
    expect((await repository.listByInstance("instance:2")).map((record) => record.tickAtEmit)).toEqual([2]);
  });

  it("keeps diagnostic records ordered and scoped by instance", async () => {
    const repository = createInMemoryDiagnosticLogRepository();

    await repository.append(createDiagnosticRecord("instance:1", "Instance started."));
    await repository.append(createDiagnosticRecord("instance:2", "Instance paused."));
    await repository.append(createDiagnosticRecord("instance:1", "Command rejected."));

    expect((await repository.listByInstance("instance:1")).map((record) => record.message)).toEqual([
      "Instance started.",
      "Command rejected."
    ]);
    expect((await repository.listByInstance("instance:2")).map((record) => record.message)).toEqual([
      "Instance paused."
    ]);
  });
});

const createCommandRecord = (
  instanceId: string,
  commandId: string
): CommandRecord => ({
  id: `cmd:${commandId}`,
  instanceId,
  command: createAttackDistrictCommandFixture({
    id: commandId,
    serverInstanceId: instanceId
  }),
  receivedAt: "2026-05-17T16:00:00.000Z",
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
    occurredAt: "2026-05-17T16:00:00.000Z"
  },
  causedByCommandId: commandId,
  recordedAt: "2026-05-17T16:00:00.000Z",
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
  occurredAt: "2026-05-17T16:00:00.000Z",
  context: {}
});
