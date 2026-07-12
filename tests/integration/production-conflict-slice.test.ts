import { describe, expect, it } from "vitest";
import type { GameplaySliceView } from "@empire/shared-types";
import { createClientApp } from "../../apps/client/src/app";
import { renderGameplaySliceStatus } from "../../apps/client/src/browser/gameplay-slice-page";
import {
  createAttackDistrictCommand,
  createPlaceTrapCommand,
  createSpyDistrictCommand
} from "../../apps/client/src/features";
import { createInMemoryClientTransport } from "../../apps/client/src/transport";
import { createServerApp } from "../../apps/server/src/app";
import { applyCommand } from "../../packages/game-core/src/engine";
import {
  createPlaceTrapCommandFixture as createCorePlaceTrapCommandFixture,
  createSpyDistrictCommandFixture as createCoreSpyDistrictCommandFixture
} from "../fixtures/command-fixtures";
import { createCombatStateFixture } from "../fixtures/game-state-fixtures";
import { createDevGameplaySession } from "../helpers/gameplay-session-test-helpers";

describe("production conflict gameplay slice", () => {
  it("keeps trap state hidden from enemies, reveals it via spy report, and renders reports from server-fed data", async () => {
    const server = createServerApp();
    const instanceId = "instance:production-conflict-slice";
    const attackerId = "player:1";
    const defenderId = "player:2";
    const sourceDistrictId = "district:1";
    const targetDistrictId = "district:2";
    const runtime = server.instanceManager.createInstance(instanceId, "free");
    const worldSeed = findTrapRevealSeed();

    expect(worldSeed, "Expected at least one deterministic trap reveal seed.").toBeTruthy();
    runtime.state = createCombatStateFixture(instanceId);
    runtime.state.serverInstance.worldSeed = worldSeed!;
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
      enabled: true
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
    expect(
      (await server.gameplaySliceTransport.load({
        ...attackerSession.loadRequest,
        districtId: sourceDistrictId
      })).readModel?.reports[0]
    ).toMatchObject({
      reportType: "spy",
      targetDistrictId,
      trapDetected: true
    });
    expect(spied.reports[0]).toMatchObject({
      category: "spy",
      result: "success"
    });
    expect(spied.districtPanel?.attackTargets).toContainEqual(expect.objectContaining({
      districtId: targetDistrictId,
      ownerLabel: "Vlastník player:2",
      disabled: false
    }));
    expect(spied.districtPanel?.occupyTargets.some((target) => target.districtId === targetDistrictId)).toBe(false);
    expect(spied.sidePanelHtml).toContain("Poslední reporty");
    expect(spied.sidePanelHtml).toContain("Špehování success v district:2");
    expect(spied.sidePanelHtml).toContain("data-attack-target-id=\"district:2\"");
    expect(spied.sidePanelHtml).not.toContain("data-occupy-target-id=\"district:2\"");
    expect(spied.sidePanelHtml).toContain("data-report-highlight=\"latest-command\"");
    expect(spied.sidePanelHtml).toContain("Past odhalena");

    const attacked = await attackerClient.dispatch(
      createAttackDistrictCommand({
        commandId: "command:attack:district:2",
        slice: attackerClient.getGameplaySlice() as GameplaySliceView,
        targetDistrictId,
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(attacked.errors).toEqual([]);
    const afterAttackReadModel = (await server.gameplaySliceTransport.load({
        ...attackerSession.loadRequest,
        districtId: sourceDistrictId
      })).readModel as GameplaySliceView;

    expect(afterAttackReadModel.reports[0]).toMatchObject({
      reportType: "battle",
      targetDistrictId,
      trapTriggered: true
    });
    expect(afterAttackReadModel.commandHints.cooldowns).toContainEqual(expect.objectContaining({
      commandType: "attack-district",
      targetId: targetDistrictId,
      remainingTicks: expect.any(Number)
    }));
    expect(attacked.districtPanel?.attackTargets.find((target) => target.districtId === targetDistrictId)?.cooldownLabel).toContain("ticks");
    expect(attacked.sidePanelHtml).toContain("čekání");
    expect(server.instanceManager.getInstanceById(instanceId)?.state.trapsById["trap:district:2"]?.status).toBe("triggered");
  });

  it("returns a basic battle report and updated owner projection when attack succeeds without a trap", async () => {
    const server = createServerApp();
    const instanceId = "instance:production-conflict-capture";
    const attackerId = "player:1";
    const sourceDistrictId = "district:1";
    const targetDistrictId = "district:2";
    const runtime = server.instanceManager.createInstance(instanceId, "free");
    const worldSeed = findSpyOutcomeSeed("success");

    expect(worldSeed, "Expected at least one deterministic successful spy seed.").toBeTruthy();
    runtime.state = createCombatStateFixture(instanceId);
    runtime.state.serverInstance.worldSeed = worldSeed!;
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
    expect(spied.reports[0]).toMatchObject({
      category: "spy",
      result: "success"
    });

    const attacked = await attackerClient.dispatch(
      createAttackDistrictCommand({
        commandId: "command:attack:capture:district:2",
        slice: attackerClient.getGameplaySlice() as GameplaySliceView,
        targetDistrictId,
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(attacked.errors).toEqual([]);
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
    expect(attacked.reports[0]).toMatchObject({
      category: "battle",
      result: "success"
    });
    expect(attacked.sidePanelHtml).toContain("Poslední reporty");
    expect(attacked.sidePanelHtml).toContain("Útok success v district:2");
    expect(attacked.sidePanelHtml).toContain("data-report-highlight=\"latest-command\"");
    expect(attacked.sidePanelHtml).toContain("Ztráty útočníka");
    expect(attacked.sidePanelHtml).toContain("Ztráty obránce");
    expect(
      server.instanceManager.getInstanceById(instanceId)?.state.districtsById[targetDistrictId]?.ownerPlayerId
    ).toBe(attackerId);
    expect(attacked.lastCommandStatus).toEqual({
      commandId: "command:attack:capture:district:2",
      accepted: true
    });
    expect(renderGameplaySliceStatus(attacked)).toContain("Akce přijata");
  });

  it("shows a server rejection when a stale spy command hits an active cooldown", async () => {
    const server = createServerApp();
    const instanceId = "instance:production-conflict-cooldown";
    const attackerId = "player:1";
    const sourceDistrictId = "district:1";
    const targetDistrictId = "district:2";
    const runtime = server.instanceManager.createInstance(instanceId, "free");
    const worldSeed = findSpyOutcomeSeed("success");

    expect(worldSeed, "Expected at least one deterministic successful spy seed.").toBeTruthy();
    runtime.state = createCombatStateFixture(instanceId);
    runtime.state.serverInstance.worldSeed = worldSeed!;
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
    expect(firstSpy.reports[0]).toMatchObject({
      category: "spy",
      result: "success"
    });

    const rejectedSpy = await attackerClient.dispatch(
      createSpyDistrictCommand({
        commandId: "command:spy:cooldown:2",
        slice: initialSlice,
        targetDistrictId,
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(rejectedSpy.errors[0]).toMatchObject({
      code: "spy_cooldown_active"
    });
    expect(rejectedSpy.connection).toMatchObject({
      status: "ready",
      staleData: true,
      lastErrorMessage: expect.stringContaining("čeká ještě")
    });
    expect(rejectedSpy.lastCommandStatus).toEqual({
      commandId: "command:spy:cooldown:2",
      accepted: false
    });
    expect(renderGameplaySliceStatus(rejectedSpy)).toContain("Akce odmítnuta");
    expect(renderGameplaySliceStatus(rejectedSpy)).toContain("čeká ještě");
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
    const worldSeed = findSpyOutcomeSeed("success");

    expect(worldSeed, "Expected at least one deterministic successful spy seed.").toBeTruthy();
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
    runtime.state.serverInstance.worldSeed = worldSeed!;
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
    expect(spied.reports[0]).toMatchObject({
      category: "spy",
      result: "success"
    });

    const attacked = await attackerClient.dispatch(
      createAttackDistrictCommand({
        commandId: "command:attack:catastrophe:district:2",
        slice: attackerClient.getGameplaySlice() as GameplaySliceView,
        targetDistrictId,
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(attacked.errors).toEqual([]);
    expect(attacked.reports[0]).toMatchObject({
      category: "battle",
      result: "catastrophe",
      severity: "critical"
    });
    expect(attacked.sidePanelHtml).toContain("data-catastrophe-alert=\"true\"");
    expect(attacked.sidePanelHtml).toContain("Stav distriktu: zničený a nepoužitelný.");
    expect(attacked.mapHtml).toContain(`data-district-id="${targetDistrictId}"`);
    expect(attacked.mapHtml).toContain("data-destroyed=\"true\"");
    expect(attacked.mapHtml).toContain("V piči, zničen.");

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

const seedSearchContext = {
  config: {
    mode: "free" as const,
    tickRateMs: 5000,
    balance: {
      incomeMultiplier: 1,
      productionMultiplier: 1,
      cooldownMultiplier: 1,
      maxPlayersPerServer: 100,
      maxAllianceSize: 10,
      buildSlotLimit: 3,
      eventFrequencyMultiplier: 1,
      policePressureMultiplier: 1,
      raidIntensityMultiplier: 1,
      expansionSpeedMultiplier: 1,
      dayLengthTicks: 12,
      nightLengthTicks: 12,
      victoryConditionKey: "default-control",
      startingResources: {
        cash: 1000
      },
      conflict: {
        spyCooldownTicks: 2,
        attackCooldownTicks: 2,
        spyBaseSuccessChance: 0.72,
        spyTrapRevealChance: 0.22,
        trapAttackLosses: 1,
        reportsLimit: 6
      }
    },
    technical: {
      sessionTtlMs: 1,
      gameDurationMs: 1,
      storageKeyPrefix: "test",
      snapshotIntervalTicks: 1,
      notificationBatchWindowMs: 1,
      debug: {
        allowDebugTools: false,
        enableDeterministicSeeds: true
      }
    },
    publicMeta: {
      mode: "free" as const,
      label: "Free",
      matchStyle: "short" as const,
      tickRateMs: 5000,
      sessionKeyPrefix: "test"
    }
  }
};

const findTrapRevealSeed = () =>
  Array.from({ length: 500 }, (_, index) => `production-spy-trap-reveal-${index}`).find((worldSeed) => {
    const state = createCombatStateFixture();
    state.serverInstance.worldSeed = worldSeed;
    const trappedState = applyCommand(state, createCorePlaceTrapCommandFixture(), seedSearchContext).nextState;
    const result = applyCommand(trappedState, createCoreSpyDistrictCommandFixture(), seedSearchContext);
    const payload = result.nextState.notificationsById["notification:command:spy:1:spy-report"]?.payload;
    return payload?.result === "success" && payload.trapDetected === true;
  });

const findSpyOutcomeSeed = (outcome: "success" | "partial" | "failed" | "critical_failed") =>
  Array.from({ length: 500 }, (_, index) => `production-spy-${outcome}-${index}`).find((worldSeed) => {
    const state = createCombatStateFixture();
    state.serverInstance.worldSeed = worldSeed;
    const result = applyCommand(state, createCoreSpyDistrictCommandFixture(), seedSearchContext);
    return result.nextState.notificationsById["notification:command:spy:1:spy-report"]?.payload.result === outcome;
  });
