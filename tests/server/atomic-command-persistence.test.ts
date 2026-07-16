import { describe, expect, it } from "vitest";
import type { InstanceRuntimeEvent } from "@empire/shared-types";
import { createServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceSessionResult } from "../../apps/server/src/bootstrap";
import {
  publishOutbox,
  recoverPendingCommandReservations
} from "../../apps/server/src/runtime";
import {
  createCommandReservationPayload,
  createCommandReservationPayloadHash,
  createFixedClock
} from "../../apps/server/src/runtime";
import { sharedCitySpawnDistrictIds } from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";
import {
  createPlaceTrapCommandFixture,
  createSelectSpawnDistrictCommandFixture
} from "../fixtures/command-fixtures";

describe("atomic command persistence", () => {
  it("does not update runtime state or publish events when persistence fails before snapshot", async () => {
    const fixture = await createFixture("before-snapshot");
    const rootBefore = fixture.runtime.state.root.version;

    fixture.runtime.atomicCommandCrashInjector = async (point) => {
      if (point === "afterApplyBeforeSnapshot") {
        throw new Error("Injected crash before snapshot.");
      }
    };

    await expect(fixture.server.instanceManager.dispatchCommand(fixture.instanceId, fixture.command))
      .rejects.toThrow("Injected crash before snapshot.");

    expect(fixture.runtime.state.root.version).toBe(rootBefore);
    expect(fixture.published).toEqual([]);
    expect((await fixture.server.instanceManager.listEventRecords(fixture.instanceId))
      .filter((record) => record.causedByCommandId === fixture.command.id)).toHaveLength(0);
    await expect(
      fixture.server.instanceManager.getPersistenceRepositories().commandReservationRepository
        ?.getByCommandId(fixture.instanceId, fixture.command.id)
    ).resolves.toMatchObject({ status: "pending" });
  });

  it("replays an applied command result without applying the command twice", async () => {
    const fixture = await createFixture("duplicate-applied");

    const first = await fixture.server.instanceManager.dispatchCommand(fixture.instanceId, fixture.command);
    const rootAfterFirst = fixture.runtime.state.root.version;
    const second = await fixture.server.instanceManager.dispatchCommand(fixture.instanceId, fixture.command, {
      expectedStateVersion: rootAfterFirst + 100
    });

    expect(first?.errors).toEqual([]);
    expect(second?.errors).toEqual([]);
    expect(second?.commandResult).toMatchObject({
      commandId: fixture.command.id,
      status: "applied",
      rootVersionAfter: rootAfterFirst
    });
    expect(fixture.runtime.state.root.version).toBe(rootAfterFirst);
    expect((await fixture.server.instanceManager.listCommandRecords(fixture.instanceId))
      .filter((record) => record.command.id === fixture.command.id)).toHaveLength(1);
    expect((await fixture.server.instanceManager.listEventRecords(fixture.instanceId))
      .filter((record) => record.causedByCommandId === fixture.command.id)).toHaveLength(1);
  });

  it("assigns authoritative command time and ignores client issuedAt in replay identity", async () => {
    const serverTime = "2026-07-15T10:30:00.000Z";
    const fixture = await createFixture("authoritative-time", serverTime);
    const futureCommand = {
      ...fixture.command,
      issuedAt: "2036-07-15T10:30:00.000Z"
    };

    const first = await fixture.server.instanceManager.dispatchCommand(fixture.instanceId, futureCommand);
    const rootAfterFirst = fixture.runtime.state.root.version;
    const replay = await fixture.server.instanceManager.dispatchCommand(fixture.instanceId, {
      ...futureCommand,
      issuedAt: "not-a-date"
    });
    const commandRecords = await fixture.server.instanceManager.listCommandRecords(fixture.instanceId);

    expect(first?.errors).toEqual([]);
    expect(replay?.errors).toEqual([]);
    expect(fixture.runtime.state.root.version).toBe(rootAfterFirst);
    expect(fixture.runtime.state.playersById[fixture.playerId]?.lastActionAt).toBe(serverTime);
    expect(commandRecords.filter((record) => record.command.id === futureCommand.id)).toHaveLength(1);
    expect(commandRecords.find((record) => record.command.id === futureCommand.id)?.command.issuedAt).toBe(serverTime);
    expect(createCommandReservationPayloadHash(futureCommand)).toBe(
      createCommandReservationPayloadHash({ ...futureCommand, issuedAt: "invalid" })
    );
  });

  it("rejects duplicate command ids with different payloads before mutation", async () => {
    const fixture = await createFixture("payload-conflict");
    await fixture.server.instanceManager.dispatchCommand(fixture.instanceId, fixture.command);
    const rootAfterFirst = fixture.runtime.state.root.version;

    const conflict = await fixture.server.instanceManager.dispatchCommand(fixture.instanceId, {
      ...fixture.command,
      payload: {
        districtId: `${fixture.focusDistrictId}:changed`
      }
    });

    expect(conflict?.errors[0]?.code).toBe("server.command_payload_conflict");
    expect(fixture.runtime.state.root.version).toBe(rootAfterFirst);
  });

  it("persists committed outbox events and can publish them after a post-commit failure", async () => {
    const fixture = await createFixture("outbox-retry");

    fixture.runtime.atomicCommandCrashInjector = async (point) => {
      if (point === "duringOutboxPublish") {
        throw new Error("Injected publisher failure.");
      }
    };

    await expect(fixture.server.instanceManager.dispatchCommand(fixture.instanceId, fixture.command))
      .rejects.toThrow("Injected publisher failure.");

    expect(fixture.runtime.state.root.version).toBeGreaterThan(0);
    expect(fixture.published).toEqual([]);
    const outbox = fixture.server.instanceManager.getPersistenceRepositories().outboxRepository!;
    await expect(outbox.listUnpublished(fixture.instanceId)).resolves.toHaveLength(1);

    fixture.runtime.atomicCommandCrashInjector = undefined;
    await publishOutbox(fixture.runtime);

    expect(fixture.published.map((event) => event.type)).toEqual(["command-applied"]);
    await expect(outbox.listUnpublished(fixture.instanceId)).resolves.toHaveLength(0);
  });

  it("serializes concurrent commands for one instance", async () => {
    const fixture = await createFixture("concurrent");
    const secondCommand = {
      ...fixture.command,
      id: `${fixture.command.id}:2`
    };
    const rootBefore = fixture.runtime.state.root.version;

    const [first, second] = await Promise.all([
      fixture.server.instanceManager.dispatchCommand(fixture.instanceId, fixture.command, { expectedStateVersion: rootBefore }),
      fixture.server.instanceManager.dispatchCommand(fixture.instanceId, secondCommand, { expectedStateVersion: rootBefore })
    ]);

    expect(first?.errors).toEqual([]);
    expect(second?.errors[0]?.code).toBe("trap_already_active");
    expect(fixture.runtime.state.root.version).toBe(rootBefore + 1);
    expect((await fixture.server.instanceManager.listCommandRecords(fixture.instanceId))
      .filter((record) => record.command.id === fixture.command.id || record.command.id === secondCommand.id))
      .toHaveLength(2);
  });

  it("rejects stale expectedStateVersion for new commands but not applied retries", async () => {
    const fixture = await createFixture("stale-version");
    const staleCommand = createSelectSpawnDistrictCommandFixture({
      id: `${fixture.command.id}:stale-non-conflict`,
      playerId: fixture.playerId,
      serverInstanceId: fixture.instanceId,
      payload: { districtId: fixture.focusDistrictId }
    });
    const stale = await fixture.server.instanceManager.dispatchCommand(fixture.instanceId, staleCommand, {
      expectedStateVersion: fixture.runtime.state.root.version + 1
    });
    expect(stale?.errors[0]?.code).toBe("server.state_version_conflict");

    const applied = await fixture.server.instanceManager.dispatchCommand(fixture.instanceId, {
      ...fixture.command,
      id: `${fixture.command.id}:applied`
    });
    const retry = await fixture.server.instanceManager.dispatchCommand(fixture.instanceId, {
      ...fixture.command,
      id: `${fixture.command.id}:applied`
    }, {
      expectedStateVersion: fixture.runtime.state.root.version + 100
    });

    expect(applied?.errors).toEqual([]);
    expect(retry?.errors).toEqual([]);
    expect(retry?.commandResult?.status).toBe("applied");
  });

  it("recovers stale pending reservations as deterministic rejected results", async () => {
    const fixture = await createFixture("pending-recovery");
    const reservationRepository = fixture.server.instanceManager.getPersistenceRepositories().commandReservationRepository!;
    await reservationRepository.reserve({
      serverInstanceId: fixture.instanceId,
      commandId: "command:atomic:pending-recovery",
      commandType: fixture.command.type,
      playerId: fixture.playerId,
      payloadHash: createCommandReservationPayloadHash(fixture.command),
      payload: createCommandReservationPayload(fixture.command),
      reservedAt: "2026-01-01T00:00:00.000Z"
    });

    const recovered = await recoverPendingCommandReservations(fixture.runtime, {
      olderThanIso: "2026-01-01T00:00:01.000Z"
    });

    expect(recovered).toHaveLength(1);
    expect(recovered[0]?.status).toBe("rejected");
    expect(recovered[0]?.responseErrors[0]?.code).toBe("server.command_abandoned_after_crash");
    await expect(reservationRepository.getByCommandId(fixture.instanceId, "command:atomic:pending-recovery"))
      .resolves.toMatchObject({ status: "rejected" });
  });
});

const createFixture = async (name: string, fixedNow?: string) => {
  const server = createServerApp(fixedNow ? { clock: createFixedClock(fixedNow) } : undefined);
  const instanceId = `instance:free:atomic:${name}`;
  const playerId = `player:atomic:${name}`;
  const focusDistrictId = sharedCitySpawnDistrictIds[0] ?? "district:1";
  await ensureGameplaySliceSessionResult(server.instanceManager, {
    serverInstanceId: instanceId,
    playerId,
    districtId: focusDistrictId
  });
  const runtime = server.instanceManager.getInstanceById(instanceId);
  if (!runtime) {
    throw new Error("Atomic command fixture failed.");
  }

  const published: InstanceRuntimeEvent[] = [];
  runtime.eventPublisher = {
    publish: (event) => {
      published.push(event);
    }
  };
  const spawnCommand = createSelectSpawnDistrictCommandFixture({
    id: `command:atomic:${name}:spawn`,
    playerId,
    serverInstanceId: instanceId,
    payload: {
      districtId: focusDistrictId
    }
  });
  const spawn = await server.instanceManager.dispatchCommand(instanceId, spawnCommand);
  if (spawn?.errors.length) {
    throw new Error(`Atomic command fixture spawn failed: ${spawn.errors[0]?.code}`);
  }
  published.splice(0, published.length);

  return {
    server,
    runtime,
    instanceId,
    playerId,
    focusDistrictId,
    published,
    command: createPlaceTrapCommandFixture({
      id: `command:atomic:${name}:1`,
      playerId,
      serverInstanceId: instanceId,
      payload: {
        districtId: focusDistrictId
      }
    })
  };
};
