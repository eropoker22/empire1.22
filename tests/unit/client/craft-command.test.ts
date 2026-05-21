import { describe, expect, it } from "vitest";
import type { GameplaySliceView } from "@empire/shared-types";
import { createCraftItemCommand } from "../../../apps/client/src/features/building-panel/craft-command";

const createGameplaySliceFixture = (canCraft = true): GameplaySliceView => ({
  server: {
    serverInstanceId: "instance:1",
    mode: "free",
    currentTick: 0,
    stateVersion: 1,
    selectedDistrictId: "district:1",
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
    playerId: "player:1",
    instanceId: "instance:1",
    mode: "free",
    factionId: "mafian",
    homeDistrictId: "district:1",
    color: "#ef4444",
    serverTime: new Date(0).toISOString(),
    resourceBalances: {
      chemicals: 12
    },
    economy: {
      cleanCash: 0,
      dirtyCash: 0,
      influence: 0,
      population: 0,
      gangMembers: 0,
      resources: {
        chemicals: 12
      },
      materials: {
        chemicals: 12
      },
      drugs: {},
      weapons: {}
    },
    notifications: [],
    victoryState: null
  },
  commandHints: {
    selectedDistrictId: "district:1",
    availableBuildingActionCount: 0,
    availableSpyTargetCount: 0,
    availableAttackTargetCount: 0,
    availableOccupyTargetCount: 0,
    cooldowns: [],
    disabledReasons: []
  },
  districts: [],
  reports: [],
  district: {
    districtId: "district:1",
    name: "Starter District",
    zone: "downtown",
    status: "claimed",
    ownerPlayerId: "player:1",
    isOwnedByPlayer: true,
    heat: 0,
    influence: 0,
    slotCount: 1,
    filledSlotCount: 1,
    buildings: [],
    spyTargets: [],
    occupyTargets: [],
    trap: {
      enabled: true,
      disabledReason: null,
      activeTrap: null
    },
    attackTargets: [],
    slots: [
      {
        slotIndex: 0,
        buildingId: "building:pharmacy:1",
        buildingTypeId: "pharmacy",
        status: "active",
        canBuild: false,
        production: null,
        processing: null,
        craftOptions: [
          {
            recipeId: "stim-pack",
            label: "Stim Pack",
            inputSummary: "6 Chemicals",
            outputResourceKey: "stim-pack",
            outputResourceLabel: "Stim Pack",
            outputAmount: 1,
            canCraft,
            craftDisabledReason: canCraft ? null : "Processing already active."
          }
        ],
        buildOptions: []
      }
    ]
  }
});

describe("createCraftItemCommand", () => {
  it("builds the craft command from the current server-fed gameplay slice", () => {
    const slice = createGameplaySliceFixture();
    const command = createCraftItemCommand({
      commandId: "command:craft:stim-pack",
      slice,
      buildingId: "building:pharmacy:1",
      recipeId: "stim-pack",
      issuedAt: new Date(0).toISOString()
    });

    expect(command.serverInstanceId).toBe("instance:1");
    expect(command.playerId).toBe("player:1");
    expect(command.mode).toBe("free");
    expect(command.payload).toEqual({
      districtId: "district:1",
      buildingId: "building:pharmacy:1",
      recipeId: "stim-pack"
    });
  });

  it("rejects craft commands that are disabled in the current server-fed slice", () => {
    expect(() =>
      createCraftItemCommand({
        commandId: "command:craft:stim-pack",
        slice: createGameplaySliceFixture(false),
        buildingId: "building:pharmacy:1",
        recipeId: "stim-pack",
        issuedAt: new Date(0).toISOString()
      })
    ).toThrow("Craft commands can only be created from enabled craft options present in the current server-fed slice.");
  });
});
