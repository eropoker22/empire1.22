import { describe, expect, it } from "vitest";
import { createClientApp } from "../../apps/client/src/app";
import { createCollectProductionCommand } from "../../apps/client/src/features";
import { createInMemoryClientTransport } from "../../apps/client/src/transport";
import { createServerApp } from "../../apps/server/src/app";
import { createDistrictBuildingSliceSeed } from "../../tools/seed/src";
import type { GameplaySliceResponse, SubmitGameplayCommandRequest } from "@empire/shared-types";

describe("production collect gameplay slice", () => {
  it("runs a fixed production collection action through the migrated command flow", async () => {
    const server = createServerApp();
    const instanceId = "instance:production-slice";
    const playerId = "player:producer";
    const districtId = "district:producer";
    const runtime = server.instanceManager.createInstance(instanceId, "free");

    runtime.state = createDistrictBuildingSliceSeed({
      instanceId,
      playerId,
      districtId,
      mode: "free",
      homeDistrict: {
        zone: "industrial",
        buildingSetKey: "ind-early-1"
      }
    });
    server.instanceManager.startInstance(instanceId);
    server.instanceManager.tickInstance(instanceId);
    server.instanceManager.tickInstance(instanceId);

    const client = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });

    const initialRender = await client.load({
      serverInstanceId: instanceId,
      playerId,
      districtId
    });

    const buildingId = initialRender.districtPanel?.buildings.find(
      (building) => building.buildingTypeId === "factory"
    )?.buildingId;

    expect(buildingId).toBeTruthy();
    expect(initialRender.sidePanelHtml).toContain("Vybrat Metal Parts");
    expect(initialRender.sidePanelHtml).toContain("8/24 připraveno");

    const collected = await client.dispatch(
      createCollectProductionCommand({
        commandId: "command:collect:factory",
        serverInstanceId: instanceId,
        playerId,
        mode: "free",
        districtId,
        buildingId: buildingId!,
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(collected.errors).toEqual([]);
    expect(collected.player?.resourceSummary).toContain("Metal Parts 16");
    expect(
      collected.districtPanel?.buildings
        .find((building) => building.buildingId === buildingId)
    ).toBeTruthy();
    expect(
      server.instanceManager.getInstanceById(instanceId)?.state.resourceStatesById[`resource:${playerId}`]?.balances["metal-parts"]
    ).toBe(16);
    expect(
      server.instanceManager.getInstanceById(instanceId)?.state.resourceStatesById[`resource:${buildingId}`]?.balances["metal-parts"]
    ).toBe(0);
    expect(
      server.gameplaySliceTransport.load({
        serverInstanceId: instanceId,
        playerId,
        districtId
      }).readModel?.player.resourceBalances["metal-parts"]
    ).toBe(16);
  });

  it("uses a session token for collect submit and exposes pending state until the read model returns", async () => {
    const server = createServerApp();
    const instanceId = "instance:production-pending-slice";
    const playerId = "player:producer-pending";
    const districtId = "district:producer-pending";
    const runtime = server.instanceManager.createInstance(instanceId, "free");

    runtime.state = createDistrictBuildingSliceSeed({
      instanceId,
      playerId,
      districtId,
      mode: "free",
      homeDistrict: {
        zone: "industrial",
        buildingSetKey: "ind-early-1"
      }
    });
    server.instanceManager.startInstance(instanceId);
    server.instanceManager.tickInstance(instanceId);
    server.instanceManager.tickInstance(instanceId);

    let releaseSubmit!: () => void;
    let submittedRequest: SubmitGameplayCommandRequest | undefined;
    const submitGate = new Promise<void>((resolve) => {
      releaseSubmit = resolve;
    });
    const client = createClientApp({
      transport: createInMemoryClientTransport({
        load: (request) => server.gameplaySliceTransport.load(request),
        submit: async (request) => {
          submittedRequest = request;
          await submitGate;
          return server.gameplaySliceTransport.submit(request);
        }
      })
    });

    const initialRender = await client.load({
      serverInstanceId: instanceId,
      playerId,
      districtId
    });
    const loadStateVersion = server.gameplaySliceTransport.load({
      serverInstanceId: instanceId,
      playerId,
      districtId
    }).metadata?.stateVersion;
    const buildingId = initialRender.districtPanel?.buildings.find(
      (building) => building.buildingTypeId === "factory"
    )?.buildingId;

    expect(buildingId).toBeTruthy();

    const dispatchPromise = client.dispatch(
      createCollectProductionCommand({
        commandId: "command:collect:pending",
        serverInstanceId: instanceId,
        playerId,
        mode: "free",
        districtId,
        buildingId: buildingId!,
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(client.getRenderState().districtPanel?.hasPendingCommand).toBe(true);
    expect(client.getRenderState().sidePanelHtml).toContain("Akce se zpracovává");
    expect(client.getRenderState().sidePanelHtml).toContain("data-disabled-reason=\"Akce se zpracovává.\"");
    expect(submittedRequest?.sessionToken).toEqual(expect.any(String));
    expect(submittedRequest?.expectedStateVersion).toBe(loadStateVersion);

    releaseSubmit();
    const collected = await dispatchPromise;

    expect(collected.errors).toEqual([]);
    expect(collected.districtPanel?.hasPendingCommand).toBe(false);
    expect(collected.player?.resourceSummary).toContain("Metal Parts 16");
    expect(
      collected.districtPanel?.slots.find(
        (slot) => slot.production?.buildingId === buildingId
      )?.production?.storageLabel
    ).toBe("0/24 připraveno");
  });

  it("rejects collect submit without a gameplay session token before mutating state", async () => {
    const server = createServerApp();
    const instanceId = "instance:production-missing-session";
    const playerId = "player:producer-missing-session";
    const districtId = "district:producer-missing-session";
    const runtime = server.instanceManager.createInstance(instanceId, "free");

    runtime.state = createDistrictBuildingSliceSeed({
      instanceId,
      playerId,
      districtId,
      mode: "free",
      homeDistrict: {
        zone: "industrial",
        buildingSetKey: "ind-early-1"
      }
    });
    server.instanceManager.startInstance(instanceId);
    server.instanceManager.tickInstance(instanceId);
    server.instanceManager.tickInstance(instanceId);

    const load = server.gameplaySliceTransport.load({
      serverInstanceId: instanceId,
      playerId,
      districtId
    });
    const buildingId = load.readModel?.district?.buildings.find(
      (building) => building.buildingTypeId === "factory"
    )?.buildingId;

    expect(load.sessionToken).toEqual(expect.any(String));
    expect(buildingId).toBeTruthy();

    const playerBalanceBeforeSubmit =
      server.instanceManager.getInstanceById(instanceId)?.state.resourceStatesById[`resource:${playerId}`]?.balances["metal-parts"];
    const buildingBalanceBeforeSubmit =
      server.instanceManager.getInstanceById(instanceId)?.state.resourceStatesById[`resource:${buildingId}`]?.balances["metal-parts"];

    const response: GameplaySliceResponse = await server.gameplaySliceTransport.submit({
      focusDistrictId: districtId,
      command: createCollectProductionCommand({
        commandId: "command:collect:missing-session",
        serverInstanceId: instanceId,
        playerId,
        mode: "free",
        districtId,
        buildingId: buildingId!,
        issuedAt: new Date(0).toISOString()
      })
    });

    expect(response).toMatchObject({
      accepted: false,
      readModel: null,
      errors: [
        {
          code: "transport.session_token_missing"
        }
      ]
    });
    expect(
      server.instanceManager.getInstanceById(instanceId)?.state.resourceStatesById[`resource:${playerId}`]?.balances["metal-parts"]
    ).toBe(playerBalanceBeforeSubmit);
    expect(
      server.instanceManager.getInstanceById(instanceId)?.state.resourceStatesById[`resource:${buildingId}`]?.balances["metal-parts"]
    ).toBe(buildingBalanceBeforeSubmit);
  });
});
