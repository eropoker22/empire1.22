import { describe, expect, it } from "vitest";
import type { GameplaySliceView } from "@empire/shared-types";
import { createClientApp } from "../../apps/client/src/app";
import { renderGameplaySliceStatus } from "../../apps/client/src/browser/gameplay-slice-page-helpers";
import {
  createAttackDistrictCommand,
  createPlaceTrapCommand,
  createSpyDistrictCommand
} from "../../apps/client/src/features";
import { createInMemoryClientTransport } from "../../apps/client/src/transport";
import { createServerApp } from "../../apps/server/src/app";
import type { ServerInstanceRuntime } from "../../apps/server/src/runtime/instance/server-instance-runtime";
import { runTick } from "../../packages/game-core/src/engine";
import { createCombatStateFixture } from "../fixtures/game-state-fixtures";
import { createDevGameplaySession } from "../helpers/gameplay-session-test-helpers";
import { deterministicUnitInterval } from "../../packages/game-core/src/utils/math";

describe("production conflict gameplay slice", () => {
  it("keeps trap state hidden from enemies, reveals it via spy report, and renders reports from server-fed data", async () => {
    const server = createServerApp();
    const instanceId = "instance:production-conflict-slice";
    const attackerId = "player:1";
    const defenderId = "player:2";
    const sourceDistrictId = "district:1";
    const targetDistrictId = "district:2";
    const runtime = server.instanceManager.createInstance(instanceId, "free");
    runtime.state = createCombatStateFixture(instanceId);
    runtime.state.serverInstance.worldSeed = "pending-spy-trap-seed";
    runtime.state.notificationsById = {};
    server.instanceManager.startInstance(instanceId);

    const attackerClient = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });
    const defenderClient = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });
    const attackerSession = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId: attackerId,
      districtId: sourceDistrictId
    });
    const defenderSession = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId: defenderId,
      districtId: targetDistrictId
    });

    await attackerClient.load(attackerSession.loadRequest);
    await defenderClient.load(defenderSession.loadRequest);

    const defenderSlice = (await server.gameplaySliceTransport.load(defenderSession.loadRequest)).readModel as GameplaySliceView;

    const trapped = await defenderClient.dispatch(
      createPlaceTrapCommand({
        commandId: "command:trap:district:2",
        slice: defenderSlice,
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(trapped.errors).toEqual([]);
    expect(trapped.districtPanel?.trap?.activeLabel).toContain("Skrytá past nastražená");

    const enemyProjection = (await server.gameplaySliceTransport.load({
      ...attackerSession.loadRequest,
      districtId: targetDistrictId
    })).readModel;

    expect(enemyProjection?.district?.trap).toBeNull();

    await attackerClient.load(attackerSession.loadRequest);
    const attackerSlice = attackerClient.getGameplaySlice() as GameplaySliceView;

    expect(attackerSlice.district?.attackTargets).toContainEqual(expect.objectContaining({
      districtId: targetDistrictId,
      ownerPlayerId: defenderId,
      enabled: false
    }));
    expect(attackerSlice.district?.occupyTargets.some((target) => target.districtId === targetDistrictId)).toBe(false);

    const spied = await attackerClient.dispatch(
      createSpyDistrictCommand({
        commandId: "command:spy:district:2",
        slice: attackerSlice,
        targetDistrictId,
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(spied.errors).toEqual([]);
    expect(spied.reports).not.toContainEqual(expect.objectContaining({ category: "spy" }));
    expect(attackerClient.getGameplaySlice()?.mapEffects).toContainEqual(expect.objectContaining({
      type: "spy",
      source: "server-pending-operation",
      playerId: attackerId,
      districtId: targetDistrictId
    }));
    runtime.state.serverInstance.worldSeed = findPendingSpySeed(runtime, "command:spy:district:2", {
      outcome: "success",
      trapDetected: true
    });
    advanceRuntimeActionToDue(runtime, "command:spy:district:2");
    const resolvedSpyView = (await server.gameplaySliceTransport.load({
      ...attackerSession.loadRequest,
      districtId: sourceDistrictId
    })).readModel as GameplaySliceView;

    expect(resolvedSpyView.reports[0]).toMatchObject({
      reportType: "spy",
      targetDistrictId,
      trapDetected: true
    });
    expect(resolvedSpyView.mapEffects).not.toContainEqual(expect.objectContaining({
      type: "spy",
      source: "server-pending-operation"
    }));
    expect((await server.gameplaySliceTransport.load(defenderSession.loadRequest)).readModel?.mapEffects)
      .not.toContainEqual(expect.objectContaining({ type: "spy", playerId: attackerId }));

    const resolvedSpy = await attackerClient.load(attackerSession.loadRequest);
    expect(resolvedSpy.reports[0]).toMatchObject({
      category: "spy",
      result: "success"
    });
    expect(resolvedSpy.districtPanel?.attackTargets).toContainEqual(expect.objectContaining({
      districtId: targetDistrictId,
      ownerLabel: "Vlastník player:2",
      disabled: false
    }));
    expect(resolvedSpy.districtPanel?.occupyTargets.some((target) => target.districtId === targetDistrictId)).toBe(false);
    expect(resolvedSpy.sidePanelHtml).toContain("Poslední reporty");
    expect(resolvedSpy.sidePanelHtml).toContain("Špehování success v district:2");
    expect(resolvedSpy.sidePanelHtml).toContain("data-attack-target-id=\"district:2\"");
    expect(resolvedSpy.sidePanelHtml).not.toContain("data-occupy-target-id=\"district:2\"");
    expect(resolvedSpy.sidePanelHtml).toContain("Past odhalena");

    const attacked = await attackerClient.dispatch(
      createAttackDistrictCommand({
        commandId: "command:attack:district:2",
        slice: attackerClient.getGameplaySlice() as GameplaySliceView,
        targetDistrictId,
        issuedAt: new Date(0).toISOString(),
        weapons: { "baseball-bat": 1, pistol: 1, grenade: 1, smg: 1, bazooka: 1 }
      })
    );

    expect(attacked.errors).toEqual([]);
    expect(attacked.reports).not.toContainEqual(expect.objectContaining({ category: "battle" }));
    const pendingAttackReadModel = (await server.gameplaySliceTransport.load({
        ...attackerSession.loadRequest,
        districtId: sourceDistrictId
      })).readModel as GameplaySliceView;
    expect(pendingAttackReadModel.reports).not.toContainEqual(expect.objectContaining({
      reportType: "battle",
      targetDistrictId
    }));
    expect(pendingAttackReadModel.mapEffects).toContainEqual(expect.objectContaining({
      type: "attack",
      source: "server-public-operation",
      playerId: attackerId,
      districtId: targetDistrictId
    }));
    expect((await server.gameplaySliceTransport.load(defenderSession.loadRequest)).readModel?.mapEffects)
      .toContainEqual(expect.objectContaining({ type: "attack", playerId: attackerId }));
    expect(pendingAttackReadModel.commandHints.cooldowns).toContainEqual(expect.objectContaining({
      commandType: "attack-district",
      targetId: targetDistrictId,
      remainingTicks: expect.any(Number)
    }));
    expect(attacked.districtPanel?.attackTargets.find((target) => target.districtId === targetDistrictId)?.cooldownLabel).toContain("ticks");
    expect(attacked.sidePanelHtml).toContain("čekání");
    expect(runtime.state.trapsById["trap:district:2"]?.status).toBe("active");
    advanceRuntimeActionToDue(runtime, "command:attack:district:2");
    const afterAttackReadModel = (await server.gameplaySliceTransport.load({
      ...attackerSession.loadRequest,
      districtId: sourceDistrictId
    })).readModel as GameplaySliceView;
    expect(afterAttackReadModel.reports[0]).toMatchObject({
      reportType: "battle",
      targetDistrictId,
      trapTriggered: true
    });
    expect(afterAttackReadModel.mapEffects).not.toContainEqual(expect.objectContaining({
      type: "attack",
      source: "server-public-operation",
      districtId: targetDistrictId
    }));
    expect(runtime.state.trapsById["trap:district:2"]?.status).toBe("triggered");
  });

  it("returns a basic battle report and updated owner projection when attack succeeds without a trap", async () => {
    const server = createServerApp();
    const instanceId = "instance:production-conflict-capture";
    const attackerId = "player:1";
    const sourceDistrictId = "district:1";
    const targetDistrictId = "district:2";
    const runtime = server.instanceManager.createInstance(instanceId, "free");
    runtime.state = createCombatStateFixture(instanceId);
    runtime.state.serverInstance.worldSeed = "pending-spy-capture-seed";
    runtime.state.notificationsById = {};
    runtime.state.districtsById[targetDistrictId] = {
      ...runtime.state.districtsById[targetDistrictId],
      defenseLoadout: {}
    };
    server.instanceManager.startInstance(instanceId);

    const attackerClient = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });
    const attackerSession = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId: attackerId,
      districtId: sourceDistrictId
    });

    await attackerClient.load(attackerSession.loadRequest);
    const spied = await attackerClient.dispatch(
      createSpyDistrictCommand({
        commandId: "command:spy:capture:district:2",
        slice: attackerClient.getGameplaySlice() as GameplaySliceView,
        targetDistrictId,
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(spied.errors).toEqual([]);
    expect(spied.reports).not.toContainEqual(expect.objectContaining({ category: "spy" }));
    runtime.state.serverInstance.worldSeed = findPendingSpySeed(runtime, "command:spy:capture:district:2", {
      outcome: "success"
    });
    advanceRuntimeActionToDue(runtime, "command:spy:capture:district:2");
    const resolvedSpy = await attackerClient.load(attackerSession.loadRequest);
    expect(resolvedSpy.reports[0]).toMatchObject({
      category: "spy",
      result: "success"
    });

    const attacked = await attackerClient.dispatch(
      createAttackDistrictCommand({
        commandId: "command:attack:capture:district:2",
        slice: attackerClient.getGameplaySlice() as GameplaySliceView,
        targetDistrictId,
        issuedAt: new Date(0).toISOString(),
        weapons: { "baseball-bat": 1, pistol: 1, grenade: 1, smg: 1, bazooka: 1 }
      })
    );

    expect(attacked.errors).toEqual([]);
    expect(attacked.reports).not.toContainEqual(expect.objectContaining({ category: "battle" }));
    expect(runtime.state.districtsById[targetDistrictId]?.ownerPlayerId).toBe("player:2");
    advanceRuntimeActionToDue(runtime, "command:attack:capture:district:2");
    const resolvedAttack = await attackerClient.load(attackerSession.loadRequest);
    expect(
      (await server.gameplaySliceTransport.load({
        ...attackerSession.loadRequest,
        districtId: sourceDistrictId
      })).readModel?.reports[0]
    ).toMatchObject({
      reportType: "battle",
      targetDistrictId,
      districtCaptured: true,
      result: "success"
    });
    expect(resolvedAttack.reports[0]).toMatchObject({
      category: "battle",
      result: "success"
    });
    expect(resolvedAttack.sidePanelHtml).toContain("Poslední reporty");
    expect(resolvedAttack.sidePanelHtml).toContain("Útok success v district:2");
    expect(resolvedAttack.sidePanelHtml).toContain("Ztráty útočníka");
    expect(resolvedAttack.sidePanelHtml).toContain("Ztráty obránce");
    expect(
      server.instanceManager.getInstanceById(instanceId)?.state.districtsById[targetDistrictId]?.ownerPlayerId
    ).toBe(attackerId);
    expect(attacked.lastCommandStatus).toEqual({
      commandId: "command:attack:capture:district:2",
      accepted: true
    });
    expect(renderGameplaySliceStatus(attacked)).toContain("Akce přijata");
  });

  it("rejects a duplicate spy while immediately resolved intel remains active", async () => {
    const server = createServerApp();
    const instanceId = "instance:production-conflict-cooldown";
    const attackerId = "player:1";
    const sourceDistrictId = "district:1";
    const targetDistrictId = "district:2";
    const runtime = server.instanceManager.createInstance(instanceId, "free");
    runtime.state = createCombatStateFixture(instanceId);
    runtime.state.serverInstance.worldSeed = "pending-spy-cooldown-seed";
    runtime.state.notificationsById = {};
    server.instanceManager.startInstance(instanceId);

    const attackerClient = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });
    const attackerSession = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId: attackerId,
      districtId: sourceDistrictId
    });
    const initialRender = await attackerClient.load(attackerSession.loadRequest);
    const initialSlice = attackerClient.getGameplaySlice() as GameplaySliceView;

    expect(initialRender.districtPanel?.spyTargets).toContainEqual(expect.objectContaining({
      districtId: targetDistrictId,
      disabled: false
    }));

    const firstSpy = await attackerClient.dispatch(
      createSpyDistrictCommand({
        commandId: "command:spy:cooldown:1",
        slice: initialSlice,
        targetDistrictId,
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(firstSpy.errors).toEqual([]);
    expect(firstSpy.reports).not.toContainEqual(expect.objectContaining({ category: "spy" }));
    runtime.state.serverInstance.worldSeed = findPendingSpySeed(runtime, "command:spy:cooldown:1", {
      outcome: "success"
    });
    advanceRuntimeActionToDue(runtime, "command:spy:cooldown:1");
    const resolvedFirstSpy = await attackerClient.load(attackerSession.loadRequest);
    expect(resolvedFirstSpy.reports[0]).toMatchObject({ category: "spy", result: "success" });

    const rejectedSpy = await attackerClient.dispatch(
      createSpyDistrictCommand({
        commandId: "command:spy:cooldown:2",
        slice: initialSlice,
        targetDistrictId,
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(rejectedSpy.errors[0]).toMatchObject({
      code: "SPY_INTEL_ALREADY_ACTIVE"
    });
    expect(rejectedSpy.connection).toMatchObject({
      status: "ready",
      staleData: true,
      lastErrorMessage: expect.stringContaining("stále platné informace")
    });
    expect(rejectedSpy.lastCommandStatus).toEqual({
      commandId: "command:spy:cooldown:2",
      accepted: false
    });
    expect(renderGameplaySliceStatus(rejectedSpy)).toContain("Akce odmítnuta");
    expect(renderGameplaySliceStatus(rejectedSpy)).toContain("stále platné informace");
    expect(rejectedSpy.sidePanelHtml).toContain("Poslední reporty");
    expect(rejectedSpy.sidePanelHtml).toContain("Akce odmítnuta");
    expect(rejectedSpy.sidePanelHtml).not.toContain("data-report-command-status=\"accepted-without-report\"");
    expect(rejectedSpy.sidePanelHtml).toContain("Špehování success v district:2");
  });

  it("renders a catastrophe report window and destroyed district state after a catastrophic attack", async () => {
    const server = createServerApp();
    const instanceId = "instance:production-conflict-catastrophe";
    const attackerId = "player:1";
    const sourceDistrictId = "district:1";
    const targetDistrictId = "district:2";
    const runtime = server.instanceManager.createInstance(instanceId, "free");
    runtime.config = {
      ...runtime.config,
      balance: {
        ...runtime.config.balance,
        conflict: {
          ...runtime.config.balance.conflict!,
          catastropheChance: 1
        }
      }
    };
    runtime.state = createCombatStateFixture(instanceId);
    runtime.state.serverInstance.worldSeed = "pending-spy-catastrophe-seed";
    runtime.state.notificationsById = {};
    server.instanceManager.startInstance(instanceId);

    const attackerClient = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });
    const attackerSession = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId: attackerId,
      districtId: sourceDistrictId
    });

    await attackerClient.load(attackerSession.loadRequest);
    const spied = await attackerClient.dispatch(
      createSpyDistrictCommand({
        commandId: "command:spy:catastrophe:district:2",
        slice: attackerClient.getGameplaySlice() as GameplaySliceView,
        targetDistrictId,
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(spied.errors).toEqual([]);
    expect(spied.reports).not.toContainEqual(expect.objectContaining({ category: "spy" }));
    runtime.state.serverInstance.worldSeed = findPendingSpySeed(runtime, "command:spy:catastrophe:district:2", {
      outcome: "success"
    });
    advanceRuntimeActionToDue(runtime, "command:spy:catastrophe:district:2");
    const resolvedSpy = await attackerClient.load(attackerSession.loadRequest);
    expect(resolvedSpy.reports[0]).toMatchObject({
      category: "spy",
      result: "success"
    });
    const attacked = await attackerClient.dispatch(
      createAttackDistrictCommand({
        commandId: "command:attack:catastrophe:district:2",
        slice: attackerClient.getGameplaySlice() as GameplaySliceView,
        targetDistrictId,
        issuedAt: new Date(0).toISOString(),
        weapons: { "baseball-bat": 1, pistol: 1, grenade: 1, smg: 1, bazooka: 1 }
      })
    );

    expect(attacked.errors).toEqual([]);
    expect(attacked.reports).not.toContainEqual(expect.objectContaining({ category: "battle" }));
    const pendingAttack = Object.values(runtime.state.pendingDistrictActionOperationsById ?? {})
      .find((operation) => operation.command.id === "command:attack:catastrophe:district:2")!;
    runtime.state.serverInstance.worldSeed = findCatastropheSeed({
      commandId: "command:attack:catastrophe:district:2",
      playerId: attackerId,
      targetDistrictId,
      tick: pendingAttack.resolveAtTick
    });
    advanceRuntimeActionToDue(runtime, "command:attack:catastrophe:district:2");
    const resolvedAttack = await attackerClient.load(attackerSession.loadRequest);
    expect(resolvedAttack.reports[0]).toMatchObject({
      category: "battle",
      result: "catastrophe",
      severity: "critical"
    });
    expect(resolvedAttack.sidePanelHtml).toContain("data-catastrophe-alert=\"true\"");
    expect(resolvedAttack.sidePanelHtml).toContain("Stav distriktu: zničený a nepoužitelný.");
    expect(resolvedAttack.mapHtml).toContain(`data-district-id="${targetDistrictId}"`);
    expect(resolvedAttack.mapHtml).toContain("data-destroyed=\"true\"");
    expect(resolvedAttack.mapHtml).toContain("V piči, zničen.");

    const destroyedTargetRender = await attackerClient.selectDistrict(targetDistrictId);

    expect(destroyedTargetRender.districtPanel?.statusLabel).toBe("destroyed");
    expect(destroyedTargetRender.districtPanel?.ownershipLabel).toBe("Zničený distrikt");
    expect(destroyedTargetRender.sidePanelHtml).toContain("data-feature=\"district-destroyed-notice\"");
    expect(destroyedTargetRender.sidePanelHtml).toContain("data-district-destroyed=\"true\"");
    expect(destroyedTargetRender.sidePanelHtml).toContain("V piči, zničen.");
    expect(destroyedTargetRender.sidePanelHtml).not.toContain("data-feature=\"district-panel\"");
    expect(destroyedTargetRender.sidePanelHtml).not.toContain("Cíle špehování");
    expect(destroyedTargetRender.sidePanelHtml).not.toContain("Cíle útoku");
    expect(destroyedTargetRender.sidePanelHtml).not.toContain("Budovy distriktu");
    expect(
      server.instanceManager.getInstanceById(instanceId)?.state.districtsById[targetDistrictId]
    ).toMatchObject({
      ownerPlayerId: null,
      controllerAllianceId: null,
      status: "destroyed",
      heat: 0,
      influence: 0,
      buildingIds: [],
      defenseLoadout: {}
    });
  });
});

const findCatastropheSeed = (input: {
  commandId: string;
  playerId: string;
  targetDistrictId: string;
  tick: number;
}): string => {
  const seed = Array.from({ length: 500 }, (_, index) => `production-catastrophe-${index}`).find((worldSeed) => (
    deterministicUnitInterval(
      `${worldSeed}:attack:catastrophe:${input.commandId}:${input.playerId}:${input.targetDistrictId}:${input.tick}`
    ) < 0.18
  ));
  if (!seed) throw new Error("Expected at least one deterministic catastrophe seed.");
  return seed;
};

const advanceRuntimeActionToDue = (runtime: ServerInstanceRuntime, commandId: string): void => {
  const operation = Object.values(runtime.state.pendingDistrictActionOperationsById ?? {})
    .find((candidate) => candidate.command.id === commandId);
  if (!operation) throw new Error(`Expected pending district action ${commandId}.`);
  if (runtime.state.root.tick < operation.resolveAtTick - 1) {
    runtime.state = {
      ...runtime.state,
      root: {
        ...runtime.state.root,
        tick: operation.resolveAtTick - 1,
        version: runtime.state.root.version + 1
      },
      serverInstance: {
        ...runtime.state.serverInstance,
        currentTick: operation.resolveAtTick - 1
      }
    };
  }
  while (runtime.state.root.tick < operation.resolveAtTick) {
    const tick = runTick(runtime.state, { config: runtime.config });
    if (tick.nextState.root.tick <= runtime.state.root.tick) {
      throw new Error(`Runtime stopped before ${commandId} reached its due tick.`);
    }
    runtime.state = tick.nextState;
  }
};

const findPendingSpySeed = (
  runtime: ServerInstanceRuntime,
  commandId: string,
  expected: { outcome: "success" | "partial" | "failed" | "critical_failed"; trapDetected?: boolean }
): string => {
  const operation = Object.values(runtime.state.pendingDistrictActionOperationsById ?? {})
    .find((candidate) => candidate.command.id === commandId);
  if (!operation) throw new Error(`Expected pending spy ${commandId}.`);
  for (let index = 0; index < 2_000; index += 1) {
    const worldSeed = `production-pending-spy-${commandId}-${index}`;
    const beforeDue = {
      ...runtime.state,
      root: { ...runtime.state.root, tick: operation.resolveAtTick - 1 },
      serverInstance: {
        ...runtime.state.serverInstance,
        currentTick: operation.resolveAtTick - 1,
        worldSeed
      }
    };
    const resolved = runTick(beforeDue, { config: runtime.config }).nextState;
    const payload = resolved.notificationsById[`notification:${commandId}:spy-report`]?.payload;
    if (
      payload?.result === expected.outcome
      && (expected.trapDetected === undefined || payload.trapDetected === expected.trapDetected)
    ) {
      return worldSeed;
    }
  }
  throw new Error(`Expected deterministic ${expected.outcome} seed for ${commandId}.`);
};
