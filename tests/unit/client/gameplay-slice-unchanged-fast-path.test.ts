import { describe, expect, it } from "vitest";
import type { GameplaySliceView } from "@empire/shared-types";
import { createControllerClientApp } from "../../../apps/client/src/app/create-controller-client-app";

describe("gameplay slice unchanged fast path", () => {
  it("sends the known version and keeps the authoritative model on changed:false", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const view = createView();
    const client = createControllerClientApp({
      transport: {
        load: async (request) => {
          requests.push(request as unknown as Record<string, unknown>);
          return requests.length === 1
            ? { accepted: true, changed: true, readModel: view, errors: [] }
            : {
                accepted: true,
                changed: false,
                readModel: null,
                errors: [],
                metadata: { serverTick: 12, stateVersion: 23 }
              };
        },
        send: async () => ({ accepted: false, readModel: null, errors: [] })
      }
    });
    const request = {
      serverInstanceId: "instance:fast-path",
      playerId: "player:fast-path",
      districtId: "district:501"
    };

    await client.load(request);
    const before = client.getGameplaySlice();
    const state = await client.load(request);

    expect(requests[1]).toMatchObject({
      knownStateVersion: 23,
      knownFocusDistrictId: "district:501"
    });
    expect(client.getGameplaySlice()).toBe(before);
    expect(state.connection).toMatchObject({ status: "ready", staleData: false });
  });
});

const createView = (): GameplaySliceView => ({
  server: {
    serverInstanceId: "instance:fast-path",
    mode: "free",
    status: "running",
    currentTick: 12,
    stateVersion: 23,
    maxPlayersPerServer: 20,
    selectedDistrictId: "district:501",
    mapManifestId: "empire-streets-city",
    mapManifestVersion: 1,
    mapManifestHash: "test",
    generatedAt: new Date(0).toISOString()
  },
  mode: { mode: "free", label: "Free", matchStyle: "short", tickRateMs: 10_000, sessionKeyPrefix: "free" },
  player: {
    playerId: "player:fast-path",
    instanceId: "instance:fast-path",
    mode: "free",
    factionId: "mafian",
    homeDistrictId: "district:501",
    color: "#000000",
    serverTime: new Date(0).toISOString(),
    resourceBalances: {},
    economy: { cleanCash: 0, dirtyCash: 0, influence: 0, population: 0, resources: {}, materials: {}, drugs: {}, weapons: {} },
    police: null,
    dayNight: null,
    elimination: null,
    notifications: [],
    victoryState: null
  },
  commandHints: { selectedDistrictId: "district:501", availableBuildingActionCount: 0, availableSpyTargetCount: 0, availableAttackTargetCount: 0, availableOccupyTargetCount: 0, cooldowns: [], disabledReasons: [] },
  dayNight: null,
  elimination: null,
  onboarding: null,
  police: null,
  cityFeed: null,
  districts: [],
  district: { districtId: "district:501", name: "Home", zone: "downtown", status: "claimed", ownerPlayerId: "player:fast-path", isOwnedByPlayer: true, heat: 0, influence: 0, slotCount: 0, filledSlotCount: 0, buildings: [], attackTargets: [], spyTargets: [], occupyTargets: [], trap: { enabled: true, disabledReason: null, activeTrap: null }, slots: [] },
  reports: []
} as unknown as GameplaySliceView);
