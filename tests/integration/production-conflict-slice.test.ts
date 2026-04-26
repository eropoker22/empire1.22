import { describe, expect, it } from "vitest";
import type { GameplaySliceView } from "@empire/shared-types";
import { createClientApp } from "../../apps/client/src/app";
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

    const attackerSlice = server.gameplaySliceTransport.load({
      serverInstanceId: instanceId,
      playerId: attackerId,
      districtId: sourceDistrictId
    }).readModel as GameplaySliceView;

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
    expect(spied.sidePanelHtml).toContain("Reports");
    expect(spied.sidePanelHtml).toContain("Spy success on district:2");

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
    expect(
      server.instanceManager.getInstanceById(instanceId)?.state.districtsById[targetDistrictId]?.ownerPlayerId
    ).toBe(attackerId);
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
