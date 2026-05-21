import { afterEach, describe, expect, it } from "vitest";
import { createClientApp } from "../../apps/client/src/app";
import { createInMemoryClientTransport } from "../../apps/client/src/transport";
import { createServerApp } from "../../apps/server/src/app";
import { resolveLiveGameplaySliceBootstrap } from "../../tools/debug/src/live-gameplay-slice-bootstrap";
import { createDistrictBuildingSliceSeed } from "../../tools/seed/src";

describe("onboarding gameplay bootstrap", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("loads the locked onboarding identity, faction, color and fixed district buildings into gameplay", async () => {
    globalThis.window = {
      empireStreetsServerSession: {
        registration: {
          identity: "Neon Boss",
          serverId: "war-eu-01",
          serverMode: "war",
          startDistrictId: 27,
          factionId: "hackeri",
          gangColor: "#3b82f6"
        },
        inventory: {
          weapons: {
            pistol: 1
          }
        },
        world: {
          ownedDistrictIds: [27],
          destroyedDistrictIds: [],
          districtDefenseLoadoutById: {}
        }
      },
      Empire: {
        districts: [
          {
            id: 27,
            name: "Starter 27",
            type: "commercial",
            buildings: ["Lékárna", "Restaurace"],
            buildingNameOverrides: ["Pulse Pharmacy", "Neon Bite"],
            buildingSetKey: "early-stable-2"
          },
          {
            id: 28,
            name: "Neighbor 28",
            type: "industrial",
            buildings: ["Sklad"],
            buildingSetKey: "ind-early-1"
          }
        ]
      },
      localStorage: {
        getItem: () => null
      }
    } as unknown as Window & typeof globalThis;

    const bootstrap = resolveLiveGameplaySliceBootstrap();

    expect(bootstrap).toMatchObject({
      instanceId: "instance:war:eu-central:public-1",
      playerId: "Neon Boss",
      playerName: "Neon Boss",
      playerFactionId: "hackeri",
      playerColor: "#3b82f6",
      districtId: "district:27",
      mode: "war"
    });
    expect(bootstrap.homeDistrict.legacyBuildingNames).toEqual(["Lékárna", "Restaurace"]);

    const server = createServerApp();
    const runtime = server.instanceManager.createInstance(bootstrap.instanceId, bootstrap.mode);

    runtime.state = createDistrictBuildingSliceSeed(bootstrap);
    server.instanceManager.startInstance(bootstrap.instanceId);

    const client = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });
    const render = await client.load({
      serverInstanceId: bootstrap.instanceId,
      playerId: bootstrap.playerId,
      districtId: bootstrap.districtId
    });
    const player = runtime.state.playersById[bootstrap.playerId];

    expect(player?.factionId).toBe("hackeri");
    expect(player?.color).toBe("#3b82f6");
    expect(runtime.state.districtsById[bootstrap.districtId].buildingIds).toHaveLength(2);
    expect(client.getGameplaySlice()?.player.factionId).toBe("hackeri");
    expect(client.getGameplaySlice()?.player.color).toBe("#3b82f6");
    expect(render.mapDistricts.find((district) => district.districtId === bootstrap.districtId)?.ownerColor).toBe("#3b82f6");
    expect(render.mapHtml).toContain("data-owner-color=\"#3b82f6\"");
    expect(render.sidePanelHtml).toContain("Pulse Pharmacy");
    expect(render.sidePanelHtml).toContain("Produce Chemicals");
  });
});
