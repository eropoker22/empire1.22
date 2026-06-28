import { describe, expect, it } from "vitest";
import {
  PRODUCTION_GAME_LIFECYCLE_PHASES,
  isDevSetupGameLifecyclePhase,
  isProductionGameLifecyclePhase
} from "@empire/shared-types";
import type { GameplaySliceView } from "@empire/shared-types";
import { createServerApp } from "../../apps/server/src/app";
import {
  createCommandReservationPayload,
  createCommandReservationPayloadHash,
  createFixedClock
} from "../../apps/server/src/runtime";
import {
  createAttackDistrictCommandFixture,
  createPlaceTrapCommandFixture
} from "../fixtures/command-fixtures";
import { createInstanceManagerFixture } from "../fixtures/runtime-fixtures";
import { createDevGameplaySession } from "../helpers/gameplay-session-test-helpers";
import { createDistrictBuildingSliceSeed } from "../../tools/seed/src";

describe("ServerInstanceManager", () => {
  it("keeps instances isolated", () => {
    const manager = createInstanceManagerFixture();
    manager.createInstance("instance:1", "free");
    manager.createInstance("instance:2", "war");

    expect(manager.listInstances()).toHaveLength(2);
    expect(manager.getInstanceById("instance:1")?.record.mode).toBe("free");
    expect(manager.getInstanceById("instance:2")?.record.mode).toBe("war");
  });

  it("starts free and war instances without requiring dev setup phases", () => {
    const server = createServerApp();
    const freeRuntime = server.instanceManager.createInstance("instance:free", "free");
    const warRuntime = server.instanceManager.createInstance("instance:war", "war");

    server.instanceManager.startInstance(freeRuntime.record.id);
    server.instanceManager.startInstance(warRuntime.record.id);

    [freeRuntime, warRuntime].forEach((runtime) => {
      expect(runtime.record.status).toBe("running");
      expect(runtime.state.root.phase).toBe(PRODUCTION_GAME_LIFECYCLE_PHASES.live);
      expect(isProductionGameLifecyclePhase(runtime.state.root.phase)).toBe(true);
      expect(isDevSetupGameLifecyclePhase(runtime.state.root.phase)).toBe(false);
    });
  });

  it("uses the injected clock for lifecycle start timestamps", () => {
    const fixedNow = "2026-05-17T12:34:56.789Z";
    const server = createServerApp({
      clock: createFixedClock(fixedNow)
    });
    const runtime = server.instanceManager.createInstance("instance:fixed-clock-start", "free");

    server.instanceManager.startInstance(runtime.record.id);

    expect(runtime.record.createdAt).toBe(fixedNow);
    expect(runtime.record.startedAt).toBe(fixedNow);
  });

  it("uses the injected clock for command audit and runtime event timestamps", async () => {
    const fixedNow = "2026-05-17T13:45:00.000Z";
    const server = createServerApp({
      clock: createFixedClock(fixedNow)
    });
    const request = {
      serverInstanceId: "instance:fixed-clock-command",
      playerId: "player:fixed-clock-command",
      districtId: "district:fixed-clock-command"
    };
    const runtime = server.instanceManager.createInstance(request.serverInstanceId, "free");
    runtime.state = createDistrictBuildingSliceSeed({
      instanceId: request.serverInstanceId,
      playerId: request.playerId,
      districtId: request.districtId,
      mode: "free",
      homeDistrict: {
        zone: "industrial",
        buildingSetKey: "ind-early-1"
      }
    });
    server.instanceManager.startInstance(request.serverInstanceId);

    const session = await createDevGameplaySession(server, {
      ...request
    });

    if (!runtime) {
      throw new Error("Fixed clock command fixture failed to create runtime.");
    }

    const load = await server.gameplaySliceTransport.load(session.loadRequest);
    const readModel = load.readModel as GameplaySliceView;
    expect(readModel.player.serverTime).toBe(fixedNow);
    expect(readModel.player.police?.updatedAt).toBe(fixedNow);
    expect(readModel.police?.updatedAt).toBe(fixedNow);
    const focusDistrictId = readModel.district!.districtId;
    const building = readModel.district!.buildings.find((candidate) => candidate.actions.length > 0);

    if (!building) {
      throw new Error("Fixed clock command fixture failed to find an actionable building.");
    }

    const action = building.actions[0]!;
    const response = await server.gameplaySliceTransport.submit({
      sessionToken: session.sessionToken,
      focusDistrictId,
      command: {
        id: "command:fixed-clock:building-action:1",
        type: "run-building-action",
        mode: readModel.mode.mode,
        playerId: request.playerId,
        serverInstanceId: request.serverInstanceId,
        issuedAt: new Date(0).toISOString(),
        payload: {
          districtId: focusDistrictId,
          buildingId: building.buildingId,
          actionId: action.actionId
        },
        clientRequestId: null
      }
    });

    expect(response.accepted).toBe(true);
    const commandRecords = await server.instanceManager.listCommandRecords(request.serverInstanceId);
    const eventRecords = await server.instanceManager.listEventRecords(request.serverInstanceId);
    const diagnosticRecords = await server.instanceManager.listDiagnosticRecords(request.serverInstanceId);

    expect(commandRecords[0]?.receivedAt).toBe(fixedNow);
    expect(eventRecords[0]?.recordedAt).toBe(fixedNow);
    expect(eventRecords[0]?.event.occurredAt).toBe(fixedNow);
    expect(eventRecords[0]?.causedByCommandId).toBe("command:fixed-clock:building-action:1");
    expect(eventRecords[0]?.tickAtEmit).toBe(runtime.state.root.tick);
    expect(diagnosticRecords.at(-1)?.occurredAt).toBe(fixedNow);
    expect(commandRecords[0]?.receivedAt).not.toBe("1970-01-01T00:00:00.000Z");
    expect(diagnosticRecords.some((record) => record.category === "command_rejected")).toBe(false);
  });

  it("writes lifecycle and rejected-command diagnostics to the manager persistence repositories", async () => {
    const server = createServerApp({
      clock: createFixedClock("2026-05-17T15:00:00.000Z")
    });
    const runtime = server.instanceManager.createInstance("instance:diagnostic-log", "free");

    server.instanceManager.startInstance(runtime.record.id);
    server.instanceManager.pauseInstance(runtime.record.id);
    server.instanceManager.stopInstance(runtime.record.id);

    let diagnostics = await server.instanceManager.listDiagnosticRecords(runtime.record.id);
    expect(diagnostics.map((record) => record.message)).toEqual([
      "Instance started.",
      "Instance paused.",
      "Stop triggered snapshot save."
    ]);

    await server.instanceManager.dispatchCommand(
      runtime.record.id,
      createAttackDistrictCommandFixture({
        serverInstanceId: "instance:other"
      })
    );

    diagnostics = await server.instanceManager.listDiagnosticRecords(runtime.record.id);
    expect(diagnostics.at(-1)).toMatchObject({
      level: "warn",
      category: "command_rejected",
      message: "Command rejected before core dispatch.",
      occurredAt: "2026-05-17T15:00:00.000Z",
      context: {
        commandId: expect.any(String),
        commandType: "attack-district",
        playerId: "player:1",
        serverInstanceId: "instance:other",
        currentTick: 0,
        rootVersion: runtime.state.root.version,
        errorCodes: ["server.instance_mismatch"],
        errorMessages: ["Command serverInstanceId does not match the target server instance."],
        expectedStateVersion: null,
        currentStateVersion: runtime.state.root.version,
        focusDistrictId: null,
        clientRequestId: null
      }
    });
  });

  it("rejects commands before core dispatch when server runtime gates fail", async () => {
    const server = createServerApp();
    const runtime = server.instanceManager.createInstance("instance:free", "free");
    const assertNoPreDispatchMutation = (rootBefore: typeof runtime.state.root, commandId: string) => {
      expect(runtime.state.root).toEqual(rootBefore);
      expect(runtime.processedCommandIds.has(commandId)).toBe(false);
      expect(runtime.commandRateLimitWindow.commandCountsByPlayerId["player:1"]).toBeUndefined();
    };

    const instanceMismatchRoot = { ...runtime.state.root };
    const instanceMismatchCommand = createAttackDistrictCommandFixture({
      serverInstanceId: "instance:other"
    });
    const instanceMismatch = await server.instanceManager.dispatchCommand(
      runtime.record.id,
      instanceMismatchCommand
    );

    expect(instanceMismatch?.errors.map((error) => error.code)).toEqual(["server.instance_mismatch"]);
    assertNoPreDispatchMutation(instanceMismatchRoot, instanceMismatchCommand.id);

    const modeMismatchRoot = { ...runtime.state.root };
    const modeMismatchCommand = createAttackDistrictCommandFixture({
      id: "command:attack:mode-mismatch",
      mode: "war",
      serverInstanceId: runtime.record.id
    });
    const modeMismatch = await server.instanceManager.dispatchCommand(
      runtime.record.id,
      modeMismatchCommand
    );

    expect(modeMismatch?.errors).toEqual([
      {
        code: "server.mode_mismatch",
        message: "Command mode does not match the target server instance mode."
      }
    ]);
    assertNoPreDispatchMutation(modeMismatchRoot, modeMismatchCommand.id);

    runtime.state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.resolved;
    const resolvedRoot = { ...runtime.state.root };
    const resolvedCommand = createAttackDistrictCommandFixture({
      id: "command:attack:resolved",
      serverInstanceId: runtime.record.id
    });
    const resolved = await server.instanceManager.dispatchCommand(
      runtime.record.id,
      resolvedCommand
    );

    expect(resolved?.errors.map((error) => error.code)).toEqual(["server.instance_resolved"]);
    assertNoPreDispatchMutation(resolvedRoot, resolvedCommand.id);

    runtime.state.root.phase = PRODUCTION_GAME_LIFECYCLE_PHASES.live;
    runtime.state.root.playerIds = Array.from({ length: runtime.config.balance.maxPlayersPerServer + 1 }, (_, index) => `player:${index}`);
    const playerCapRoot = { ...runtime.state.root };
    const playerCapCommand = createAttackDistrictCommandFixture({
      id: "command:attack:player-cap",
      serverInstanceId: runtime.record.id
    });
    const playerCap = await server.instanceManager.dispatchCommand(
      runtime.record.id,
      playerCapCommand
    );

    expect(playerCap?.errors.map((error) => error.code)).toEqual(["server.player_cap_exceeded"]);
    assertNoPreDispatchMutation(playerCapRoot, playerCapCommand.id);
  });

  it("rejects expired sessions and per-tick command floods before core dispatch", async () => {
    const server = createServerApp();
    const runtime = server.instanceManager.createInstance("instance:free", "free");

    const sessionTtlTicks = Math.ceil(runtime.config.technical.sessionTtlMs / runtime.config.tickRateMs);
    runtime.state.root.tick = sessionTtlTicks;
    const expired = await server.instanceManager.dispatchCommand(
      runtime.record.id,
      createAttackDistrictCommandFixture({
        id: "command:attack:expired",
        serverInstanceId: runtime.record.id
      })
    );

    expect(expired?.errors.map((error) => error.code)).toEqual(["server.session_expired"]);

    runtime.state.root.tick = 1;
    await createDevGameplaySession(server, {
      serverInstanceId: runtime.record.id,
      playerId: "player:1"
    });
    runtime.commandRateLimitWindow = {
      tick: 1,
      commandCountsByPlayerId: {
        "player:1": 5
      }
    };

    const rootBeforeRateLimit = { ...runtime.state.root };
    const rateLimited = await server.instanceManager.dispatchCommand(
      runtime.record.id,
      createAttackDistrictCommandFixture({
        id: "command:attack:flood:6",
        serverInstanceId: runtime.record.id
      })
    );

    expect(rateLimited?.errors.map((error) => error.code)).toEqual(["server.rate_limited"]);
    expect(runtime.state.root).toEqual(rootBeforeRateLimit);
    await expect(runtime.commandReservationRepository?.getByCommandId(runtime.record.id, "command:attack:flood:6"))
      .resolves.toMatchObject({
        status: "rejected",
        rejectionErrors: [
          {
            code: "server.rate_limited"
          }
        ]
      });
  });

  it("rejects state version conflicts before command replay or rate accounting", async () => {
    const server = createServerApp();
    const runtime = server.instanceManager.createInstance("instance:free", "free");
    const rootBefore = { ...runtime.state.root };
    const command = createAttackDistrictCommandFixture({
      id: "command:attack:state-version-conflict",
      serverInstanceId: runtime.record.id
    });

    const result = await server.instanceManager.dispatchCommand(runtime.record.id, command, {
      expectedStateVersion: runtime.state.root.version + 1
    });

    expect(result?.errors).toEqual([
      {
        code: "server.state_version_conflict",
        message: "Command expectedStateVersion does not match the current server state version.",
        details: {
          expectedStateVersion: rootBefore.version + 1,
          currentStateVersion: rootBefore.version
        }
      }
    ]);
    expect(runtime.state.root).toEqual(rootBefore);
    expect(runtime.processedCommandIds.has(command.id)).toBe(false);
    expect(runtime.commandRateLimitWindow.commandCountsByPlayerId[command.playerId]).toBeUndefined();
    await expect(runtime.commandReservationRepository?.getByCommandId(runtime.record.id, command.id))
      .resolves.toMatchObject({
        status: "rejected",
        rejectionErrors: [
          {
            code: "server.state_version_conflict"
          }
        ]
      });

    const diagnostics = await server.instanceManager.listDiagnosticRecords(runtime.record.id);
    expect(diagnostics.at(-1)).toMatchObject({
      level: "warn",
      category: "command_rejected",
      context: {
        commandId: command.id,
        commandType: "attack-district",
        playerId: command.playerId,
        serverInstanceId: runtime.record.id,
        errorCodes: ["server.state_version_conflict"],
        expectedStateVersion: rootBefore.version + 1,
        currentStateVersion: rootBefore.version
      }
    });
  });

  it("rejects unsupported command types without mutating authoritative state", async () => {
    const server = createServerApp();
    const runtime = server.instanceManager.createInstance("instance:free", "free");
    const stateBefore = runtime.state;
    const rootBefore = { ...runtime.state.root };
    const invalidCommand = {
      ...createAttackDistrictCommandFixture({
        id: "command:invalid:type",
        serverInstanceId: runtime.record.id
      }),
      type: "not-a-real-command"
    };

    const result = await server.instanceManager.dispatchCommand(runtime.record.id, invalidCommand as never);

    expect(result?.errors).toEqual([
      {
        code: "unsupported_command",
        message: "Unsupported command type."
      }
    ]);
    expect(runtime.state).toBe(stateBefore);
    expect(runtime.state.root).toEqual(rootBefore);
    await expect(runtime.commandReservationRepository?.getByCommandId(runtime.record.id, invalidCommand.id))
      .resolves.toMatchObject({
        status: "rejected",
        rejectionErrors: [
          {
            code: "unsupported_command"
          }
        ]
      });

    const diagnostics = await server.instanceManager.listDiagnosticRecords(runtime.record.id);
    expect(diagnostics.at(-1)).toMatchObject({
      level: "warn",
      category: "command_rejected",
      message: "Command rejected.",
      context: {
        commandId: invalidCommand.id,
        commandType: "not-a-real-command",
        errorCodes: ["unsupported_command"],
        errorMessages: ["Unsupported command type."]
      }
    });
  });

  it("rejects inactive players without changing authoritative state", async () => {
    const server = createServerApp();
    const runtime = server.instanceManager.createInstance("instance:free", "free");
    runtime.state.playersById["player:1"] = {
      ...runtime.state.playersById["player:1"],
      id: "player:1",
      displayName: "Player 1",
      factionId: "street_crew",
      status: "defeated"
    } as never;
    const stateBefore = runtime.state;
    const rootBefore = { ...runtime.state.root };
    const command = createAttackDistrictCommandFixture({
      id: "command:attack:defeated-player",
      serverInstanceId: runtime.record.id
    });

    const result = await server.instanceManager.dispatchCommand(runtime.record.id, command);

    expect(result?.errors).toContainEqual(expect.objectContaining({
      code: "player_not_active",
      details: expect.objectContaining({
        playerId: "player:1",
        status: "defeated"
      })
    }));
    expect(runtime.state).toBe(stateBefore);
    expect(runtime.state.root).toEqual(rootBefore);

    const diagnostics = await server.instanceManager.listDiagnosticRecords(runtime.record.id);
    expect(diagnostics.at(-1)).toMatchObject({
      level: "warn",
      category: "command_rejected",
      context: {
        commandId: command.id,
        commandType: "attack-district",
        errorCodes: ["player_not_active"]
      }
    });
  });

  it("returns stored rejection for duplicate rejected command ids without replaying core dispatch", async () => {
    const server = createServerApp();
    const runtime = server.instanceManager.createInstance("instance:free", "free");
    const command = createAttackDistrictCommandFixture({
      serverInstanceId: runtime.record.id
    });

    const firstResult = await server.instanceManager.dispatchCommand(runtime.record.id, command);
    const rootAfterFirstAttempt = { ...runtime.state.root };
    const duplicateResult = await server.instanceManager.dispatchCommand(runtime.record.id, command);

    expect(firstResult?.errors.map((error) => error.code)).toEqual(["attacker_not_found"]);
    expect(duplicateResult?.errors.map((error) => error.code)).toEqual(["attacker_not_found"]);
    expect(runtime.state.root).toEqual(rootAfterFirstAttempt);

    const diagnostics = await server.instanceManager.listDiagnosticRecords(runtime.record.id);
    expect(diagnostics.at(-1)).toMatchObject({
      level: "warn",
      category: "command_rejected",
      context: {
        commandId: command.id,
        commandType: "attack-district",
        errorCodes: ["attacker_not_found"]
      }
    });
  });

  it("returns command-in-flight for pending duplicate reservations without mutating state", async () => {
    const server = createServerApp();
    const runtime = server.instanceManager.createInstance("instance:pending-duplicate", "free");
    const command = createAttackDistrictCommandFixture({
      id: "command:pending-duplicate",
      serverInstanceId: runtime.record.id
    });
    await runtime.commandReservationRepository!.reserve({
      serverInstanceId: runtime.record.id,
      commandId: command.id,
      commandType: command.type,
      playerId: command.playerId,
      payloadHash: createCommandReservationPayloadHash(command),
      payload: createCommandReservationPayload(command),
      reservedAt: "2026-05-17T16:00:00.000Z"
    });
    const rootBefore = { ...runtime.state.root };

    const result = await server.instanceManager.dispatchCommand(runtime.record.id, command);

    expect(result?.errors[0]).toMatchObject({
      code: "server.command_in_flight"
    });
    expect(runtime.state.root).toEqual(rootBefore);
  });

  it("does not apply an already applied duplicate command twice", async () => {
    const server = createServerApp();
    const request = {
      serverInstanceId: "instance:applied-duplicate",
      playerId: "player:applied-duplicate",
      districtId: "district:applied-duplicate"
    };

    const session = await createDevGameplaySession(server, {
      ...request,
      autoSelectSpawn: true
    });
    const load = await server.gameplaySliceTransport.load(session.loadRequest);
    const focusDistrictId = load.readModel?.district?.districtId ?? request.districtId;
    const command = createPlaceTrapCommandFixture({
      id: "command:applied-duplicate",
      mode: load.readModel!.mode.mode,
      playerId: request.playerId,
      serverInstanceId: request.serverInstanceId,
      payload: {
        districtId: focusDistrictId
      }
    });

    const first = await server.instanceManager.dispatchCommand(request.serverInstanceId, command);
    const rootAfterFirst = server.instanceManager.getInstanceById(request.serverInstanceId)!.state.root.version;
    const second = await server.instanceManager.dispatchCommand(request.serverInstanceId, command);

    expect(first?.errors).toEqual([]);
    expect(second?.errors).toEqual([]);
    expect(server.instanceManager.getInstanceById(request.serverInstanceId)!.state.root.version).toBe(rootAfterFirst);
    await expect(server.instanceManager.getPersistenceRepositories().commandReservationRepository
      ?.getByCommandId(request.serverInstanceId, command.id))
      .resolves.toMatchObject({
        status: "applied",
        appliedMetadata: {
          rootVersion: rootAfterFirst
        }
      });
  });
});
