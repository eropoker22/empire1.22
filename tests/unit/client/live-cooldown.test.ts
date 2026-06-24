import { describe, expect, it } from "vitest";
import type { GameplaySliceView } from "@empire/shared-types";
import { empireStreetsCityMapManifestHash } from "@empire/game-config";
import { createDistrictPanelViewModel } from "../../../apps/client/src/selectors";
import { renderDistrictPanel } from "../../../apps/client/src/features";
import { formatLiveCooldownLabel } from "../../../apps/client/src/shared-ui";

const createCooldownSlice = (): GameplaySliceView => ({
  server: {
    serverInstanceId: "instance:1",
    mode: "free",
    currentTick: 0,
    stateVersion: 1,
    selectedDistrictId: "district:1",
    mapManifestId: "empire-streets-city",
    mapManifestVersion: 1,
    mapManifestHash: empireStreetsCityMapManifestHash,
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
    notifications: [],
    victoryState: null
  },
  commandHints: {
    selectedDistrictId: "district:1",
    availableBuildingActionCount: 0,
    availableSpyTargetCount: 0,
    availableAttackTargetCount: 0,
    availableOccupyTargetCount: 0,
    cooldowns: [{
      commandType: "run-building-action",
      targetId: "building:armory:1:armory_fortify",
      remainingTicks: 3,
      reason: "Cooldown 3 ticks."
    }],
    disabledReasons: [{
      commandType: "run-building-action",
      targetId: "building:armory:1:armory_fortify",
      reason: "Cooldown 3 ticks."
    }]
  },
  districts: [],
  reports: [],
  district: {
    districtId: "district:1",
    name: "Owned District",
    zone: "downtown",
    status: "claimed",
    ownerPlayerId: "player:1",
    isOwnedByPlayer: true,
    heat: 0,
    influence: 0,
    slotCount: 1,
    filledSlotCount: 1,
    buildings: [
      {
        buildingId: "building:armory:1",
        buildingTypeId: "armory",
        label: "Zbrojovka",
        displayName: "Iron Ward",
        variantName: "Iron Ward",
        zone: "industrial",
        role: "Defense",
        info: "Defense building.",
        stats: [],
        specialActions: [
          {
            actionId: "armory_fortify",
            label: "Fortify",
            description: "Adds defenses.",
            effectSummary: "+defense",
            durationMs: 5000,
            cooldownMs: 10000,
            cooldownRemainingTicks: 3,
            heatGain: 1,
            enabled: false,
            disabledReason: "Cooldown 3 ticks."
          }
        ],
        level: 1,
        status: "active",
        actionCooldowns: {
          armory_fortify: 4
        },
        actions: [
          {
            buildingId: "building:armory:1",
            buildingTypeId: "armory",
            actionId: "armory_fortify",
            label: "Fortify",
            description: "Adds defenses.",
            status: "cooldown",
            cost: {},
            expectedEffectSummary: [],
            riskSummary: ["Heat +1"],
            requiresInput: [],
            durationMs: 5000,
            cooldownMs: 10000,
            cooldownRemainingTicks: 3,
            inputCost: {},
            outputGain: {},
            heatGain: 1,
            influenceChange: 0,
            reportText: "Fortified.",
            enabled: false,
            disabledReason: "Cooldown 3 ticks."
          }
        ]
      }
    ],
    attackTargets: [],
    spyTargets: [],
    occupyTargets: [],
    trap: null,
    slots: []
  }
});

describe("live cooldown labels", () => {
  it("renders fixed-building cooldowns with client-side countdown metadata", () => {
    const panel = createDistrictPanelViewModel(
      createCooldownSlice(),
      {
        selectedDistrictId: "district:1",
        selectedBuildingId: "building:armory:1",
        activeSidePanel: "building-panel",
        activeModal: null,
        isMapFocused: false,
        pendingCommandIds: [],
        lastCommandStatus: null
      },
      { nowMs: 1000 }
    );

    expect(panel?.buildings[0]?.actions[0]?.cooldownLabel).toBe("Čekání 15s");
    expect(panel?.buildings[0]?.actions[0]?.cooldownEndsAtMs).toBe(16000);

    const html = renderDistrictPanel(panel!);

    expect(html).toContain('data-live-cooldown="true"');
    expect(html).toContain('data-cooldown-ends-at-ms="16000"');
    expect(html).toContain("Čekání 15s");
    expect(html).toContain("CD <span");
  });

  it("formats countdown text as wall-clock time between server refreshes", () => {
    expect(formatLiveCooldownLabel({ endsAtMs: 16000, nowMs: 6500 })).toBe("Čekání 10s");
    expect(formatLiveCooldownLabel({ endsAtMs: 16000, nowMs: 16000 })).toBe("Připraveno");
  });
});
