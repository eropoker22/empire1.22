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
      targetId: "building:restaurant:1:restaurant_collect_revenue",
      remainingTicks: 3,
      reason: "Cooldown 3 ticks."
    }],
    disabledReasons: [{
      commandType: "run-building-action",
      targetId: "building:restaurant:1:restaurant_collect_revenue",
      reason: "Cooldown 3 ticks."
    }]
  },
  districts: [],
  reports: [],
  district: {
    districtId: "district:1",
    conflictRevision: 1,
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
        buildingId: "building:restaurant:1",
        buildingTypeId: "restaurant",
        label: "Restaurace",
        displayName: "Restaurace",
        variantName: "Restaurace",
        zone: "downtown",
        role: "Cashflow",
        info: "Vybírá lokální tržby.",
        stats: [],
        specialActions: [
          {
            actionId: "restaurant_collect_revenue",
            label: "Vybrat tržby",
            description: "Vybere lokální tržby.",
            effectSummary: "+cash",
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
          restaurant_collect_revenue: 4
        },
        actions: [
          {
            buildingId: "building:restaurant:1",
            buildingTypeId: "restaurant",
            actionId: "restaurant_collect_revenue",
            label: "Vybrat tržby",
            description: "Vybere lokální tržby.",
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
            reportText: "Tržby byly vybrány.",
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
        selectedBuildingId: "building:restaurant:1",
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

  it("prefers real phase preview numbers over generic phase tooltip copy", () => {
    const slice = createCooldownSlice();
    if (!slice.district) {
      throw new Error("Missing test district.");
    }
    const action = slice.district.buildings[0]?.actions[0];
    if (!action) {
      throw new Error("Missing test action.");
    }
    action.phaseTooltip = "Akce jde spustit, ale teď má vyšší cenu.";
    action.phaseEffectSummary = ["Cena cash 1500 -> 1725", "Heat +2 -> +3"];

    const panel = createDistrictPanelViewModel(
      slice,
      {
        selectedDistrictId: "district:1",
        selectedBuildingId: "building:restaurant:1",
        activeSidePanel: "building-panel",
        activeModal: null,
        isMapFocused: false,
        pendingCommandIds: [],
        lastCommandStatus: null
      },
      { nowMs: 1000 }
    );

    expect(panel?.buildings[0]?.actions[0]?.phaseEffectLabel).toBe("Cena cash 1500 -> 1725, Heat +2 -> +3");
  });
});
