import { describe, expect, it } from "vitest";
import type {
  GameCommand,
  GameplaySliceResponse,
  GameplaySliceView,
  SubmitGameplayCommandRequest
} from "@empire/shared-types";
import { createClientApp } from "../../../apps/client/src/app";
import type { ClientTransport } from "../../../apps/client/src/transport";

describe("client optimistic concurrency", () => {
  it("sends expectedStateVersion and clears pending state after a stale response", async () => {
    const sent: SubmitGameplayCommandRequest[] = [];
    const view = createGameplaySliceView(7);
    const transport: ClientTransport = {
      load: async () => ({
        accepted: true,
        readModel: view,
        errors: [],
        metadata: {
          serverTick: 0,
          stateVersion: 7
        }
      }),
      send: async (request) => {
        sent.push(request);
        return {
          accepted: false,
          readModel: createGameplaySliceView(8),
          errors: [
            {
              code: "server.state_version_conflict",
              message: "Command expectedStateVersion does not match the current server state version.",
              details: {
                expectedStateVersion: request.expectedStateVersion,
                currentStateVersion: 8
              }
            }
          ],
          metadata: {
            serverTick: 0,
            stateVersion: 8
          }
        };
      }
    };
    const client = createClientApp({ transport });

    await client.load({
      serverInstanceId: "instance:client-concurrency",
      playerId: "player:client-concurrency",
      districtId: "district:client-concurrency"
    });
    const render = await client.dispatch(createCommand());

    expect(sent[0]?.expectedStateVersion).toBe(7);
    expect(render.lastCommandStatus).toEqual({
      commandId: "command:client-concurrency:1",
      accepted: false
    });
    expect(render.errors[0]?.code).toBe("server.state_version_conflict");
    expect(render.connection.staleData).toBe(true);
    expect(render.sidePanelHtml).not.toContain("Command pending");
  });
});

const createCommand = (): GameCommand => ({
  id: "command:client-concurrency:1",
  type: "place-trap",
  mode: "free",
  serverInstanceId: "instance:client-concurrency",
  playerId: "player:client-concurrency",
  issuedAt: new Date(0).toISOString(),
  payload: {
    districtId: "district:client-concurrency"
  },
  clientRequestId: null
});

const createGameplaySliceView = (stateVersion: number): GameplaySliceView => ({
  server: {
    serverInstanceId: "instance:client-concurrency",
    mode: "free",
    currentTick: 0,
    stateVersion,
    selectedDistrictId: "district:client-concurrency",
    generatedAt: new Date(0).toISOString()
  },
  mode: {
    mode: "free",
    label: "Empire Streets Free",
    matchStyle: "short",
    tickRateMs: 5000,
    sessionKeyPrefix: "empire:free"
  },
  player: {
    playerId: "player:client-concurrency",
    instanceId: "instance:client-concurrency",
    mode: "free",
    factionId: "mafian",
    homeDistrictId: "district:client-concurrency",
    color: "#ef4444",
    serverTime: new Date(0).toISOString(),
    resourceBalances: {},
    economy: {
      cleanCash: 0,
      dirtyCash: 0,
      influence: 0,
      population: 0,
      gangMembers: 0,
      resources: {},
      materials: {},
      drugs: {},
      weapons: {}
    },
    police: null,
    dayNight: null,
    elimination: null,
    notifications: [],
    victoryState: null
  },
  commandHints: {
    selectedDistrictId: "district:client-concurrency",
    availableBuildingActionCount: 0,
    availableSpyTargetCount: 0,
    availableAttackTargetCount: 0,
    availableOccupyTargetCount: 0,
    cooldowns: [],
    disabledReasons: []
  },
  dayNight: null,
  elimination: null,
  onboarding: null,
  police: null,
  cityFeed: null,
  districts: [
    {
      districtId: "district:client-concurrency",
      name: "Home",
      zone: "downtown",
      status: "claimed",
      ownerPlayerId: "player:client-concurrency",
      isOwnedByPlayer: true,
      heat: 0,
      influence: 0,
      adjacentDistrictIds: []
    }
  ],
  district: {
    districtId: "district:client-concurrency",
    name: "Home",
    zone: "downtown",
    status: "claimed",
    ownerPlayerId: "player:client-concurrency",
    isOwnedByPlayer: true,
    heat: 0,
    influence: 0,
    slotCount: 0,
    filledSlotCount: 0,
    buildings: [],
    attackTargets: [],
    spyTargets: [],
    occupyTargets: [],
    trap: {
      enabled: true,
      disabledReason: null,
      activeTrap: null
    },
    slots: []
  },
  reports: []
} as unknown as GameplaySliceView);
