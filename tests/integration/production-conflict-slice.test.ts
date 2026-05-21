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
import { createCombatStateFixture } from "../fixtures/game-state-fixtures";

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
    runtime.state.serverInstance.worldSeed = "spy-seed-10";
    server.instanceManager.startInstance(instanceId);

    const attackerClient = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });
    const defenderClient = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });

    await attackerClient.load({
      serverInstanceId: instanceId,
      playerId: attackerId,
      districtId: sourceDistrictId
    });
    await defenderClient.load({
      serverInstanceId: instanceId,
      playerId: defenderId,
      districtId: targetDistrictId
    });

    const defenderSlice = server.gameplaySliceTransport.load({
      serverInstanceId: instanceId,
      playerId: defenderId,
      districtId: targetDistrictId
    }).readModel as GameplaySliceView;

    const trapped = await defenderClient.dispatch(
      createPlaceTrapCommand({
        commandId: "command:trap:district:2",
        slice: defenderSlice,
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(trapped.errors).toEqual([]);
    expect(trapped.districtPanel?.trap?.activeLabel).toContain("Hidden trap armed");

    const enemyProjection = server.gameplaySliceTransport.load({
      serverInstanceId: instanceId,
      playerId: attackerId,
      districtId: targetDistrictId
    }).readModel;

    expect(enemyProjection?.district?.trap).toBeNull();

    await attackerClient.load({
      serverInstanceId: instanceId,
      playerId: attackerId,
      districtId: sourceDistrictId
    });
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
      server.gameplaySliceTransport.load({
        serverInstanceId: instanceId,
        playerId: attackerId,
        districtId: sourceDistrictId
      }).readModel?.reports[0]
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
      ownerLabel: "Owner player:2",
      disabled: false
    }));
    expect(spied.districtPanel?.occupyTargets.some((target) => target.districtId === targetDistrictId)).toBe(false);
    expect(spied.sidePanelHtml).toContain("Latest reports");
    expect(spied.sidePanelHtml).toContain("Spy success on district:2");
    expect(spied.sidePanelHtml).toContain("data-attack-target-id=\"district:2\"");
    expect(spied.sidePanelHtml).not.toContain("data-occupy-target-id=\"district:2\"");
    expect(spied.sidePanelHtml).toContain("data-report-highlight=\"latest-command\"");
    expect(spied.sidePanelHtml).toContain("Trap detected");

    const attacked = await attackerClient.dispatch(
      createAttackDistrictCommand({
        commandId: "command:attack:district:2",
        serverInstanceId: instanceId,
        playerId: attackerId,
        mode: "free",
        sourceDistrictId,
        targetDistrictId,
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(attacked.errors).toEqual([]);
    expect(
      server.gameplaySliceTransport.load({
        serverInstanceId: instanceId,
        playerId: attackerId,
        districtId: sourceDistrictId
      }).readModel?.reports[0]
    ).toMatchObject({
      reportType: "battle",
      targetDistrictId,
      trapTriggered: true
    });
    expect(server.instanceManager.getInstanceById(instanceId)?.state.trapsById["trap:district:2"]?.status).toBe("triggered");
  });

  it("returns a basic battle report and updated owner projection when attack succeeds without a trap", async () => {
    const server = createServerApp();
    const instanceId = "instance:production-conflict-capture";
    const attackerId = "player:1";
    const sourceDistrictId = "district:1";
    const targetDistrictId = "district:2";
    const runtime = server.instanceManager.createInstance(instanceId, "free");

    runtime.state = createCombatStateFixture(instanceId);
    runtime.state.districtsById[targetDistrictId] = {
      ...runtime.state.districtsById[targetDistrictId],
      defenseLoadout: {}
    };
    server.instanceManager.startInstance(instanceId);

    const attackerClient = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });

    await attackerClient.load({
      serverInstanceId: instanceId,
      playerId: attackerId,
      districtId: sourceDistrictId
    });

    const attacked = await attackerClient.dispatch(
      createAttackDistrictCommand({
        commandId: "command:attack:capture:district:2",
        serverInstanceId: instanceId,
        playerId: attackerId,
        mode: "free",
        sourceDistrictId,
        targetDistrictId,
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(attacked.errors).toEqual([]);
    expect(
      server.gameplaySliceTransport.load({
        serverInstanceId: instanceId,
        playerId: attackerId,
        districtId: sourceDistrictId
      }).readModel?.reports[0]
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
    expect(attacked.sidePanelHtml).toContain("Latest reports");
    expect(attacked.sidePanelHtml).toContain("Attack success on district:2");
    expect(attacked.sidePanelHtml).toContain("data-report-highlight=\"latest-command\"");
    expect(attacked.sidePanelHtml).toContain("Attacker losses");
    expect(attacked.sidePanelHtml).toContain("Defender losses");
    expect(
      server.instanceManager.getInstanceById(instanceId)?.state.districtsById[targetDistrictId]?.ownerPlayerId
    ).toBe(attackerId);
    expect(attacked.lastCommandStatus).toEqual({
      commandId: "command:attack:capture:district:2",
      accepted: true
    });
    expect(renderGameplaySliceStatus(attacked)).toContain("Command accepted");
  });

  it("shows a server rejection when a stale spy command hits an active cooldown", async () => {
    const server = createServerApp();
    const instanceId = "instance:production-conflict-cooldown";
    const attackerId = "player:1";
    const sourceDistrictId = "district:1";
    const targetDistrictId = "district:2";
    const runtime = server.instanceManager.createInstance(instanceId, "free");

    runtime.state = createCombatStateFixture(instanceId);
    runtime.state.serverInstance.worldSeed = "spy-cooldown-seed";
    server.instanceManager.startInstance(instanceId);

    const attackerClient = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });
    const initialRender = await attackerClient.load({
      serverInstanceId: instanceId,
      playerId: attackerId,
      districtId: sourceDistrictId
    });
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
      lastErrorMessage: expect.stringContaining("cooling down")
    });
    expect(rejectedSpy.lastCommandStatus).toEqual({
      commandId: "command:spy:cooldown:2",
      accepted: false
    });
    expect(renderGameplaySliceStatus(rejectedSpy)).toContain("Command rejected");
    expect(renderGameplaySliceStatus(rejectedSpy)).toContain("cooling down");
    expect(rejectedSpy.sidePanelHtml).toContain("Latest reports");
    expect(rejectedSpy.sidePanelHtml).toContain("Command rejected");
    expect(rejectedSpy.sidePanelHtml).not.toContain("data-report-command-status=\"accepted-without-report\"");
    expect(rejectedSpy.sidePanelHtml).toContain("Spy success on district:2");
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
    server.instanceManager.startInstance(instanceId);

    const attackerClient = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });

    await attackerClient.load({
      serverInstanceId: instanceId,
      playerId: attackerId,
      districtId: sourceDistrictId
    });

    const attacked = await attackerClient.dispatch(
      createAttackDistrictCommand({
        commandId: "command:attack:catastrophe:district:2",
        serverInstanceId: instanceId,
        playerId: attackerId,
        mode: "free",
        sourceDistrictId,
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
    expect(attacked.sidePanelHtml).toContain("District state: destroyed and unusable.");
    expect(attacked.mapHtml).toContain(`data-district-id="${targetDistrictId}"`);
    expect(attacked.mapHtml).toContain("data-destroyed=\"true\"");
    expect(attacked.mapHtml).toContain("V piči, zničen.");

    const destroyedTargetRender = await attackerClient.selectDistrict(targetDistrictId);

    expect(destroyedTargetRender.districtPanel?.statusLabel).toBe("destroyed");
    expect(destroyedTargetRender.districtPanel?.ownershipLabel).toBe("Destroyed district");
    expect(destroyedTargetRender.sidePanelHtml).toContain("data-feature=\"district-destroyed-notice\"");
    expect(destroyedTargetRender.sidePanelHtml).toContain("data-district-destroyed=\"true\"");
    expect(destroyedTargetRender.sidePanelHtml).toContain("V piči, zničen.");
    expect(destroyedTargetRender.sidePanelHtml).not.toContain("data-feature=\"district-panel\"");
    expect(destroyedTargetRender.sidePanelHtml).not.toContain("Spy Targets");
    expect(destroyedTargetRender.sidePanelHtml).not.toContain("Attack Targets");
    expect(destroyedTargetRender.sidePanelHtml).not.toContain("District buildings");
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
