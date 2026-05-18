import { describe, expect, it } from "vitest";
import type { GameplaySliceView } from "@empire/shared-types";
import {
  createClientSurfaceActionRouter,
  resolveClientSurfaceAction,
  type ClientSurfaceActionElement
} from "../../../apps/client/src/app";
import { createInitialClientRenderState } from "../../../apps/client/src/app";

const createGameplaySliceFixture = (): GameplaySliceView => ({
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
        buildingId: "building:pharmacy:1",
        buildingTypeId: "pharmacy",
        label: "Lékárna",
        displayName: "Pulse Pharmacy",
        variantName: "Pulse Pharmacy",
        zone: "commercial",
        role: "Production",
        info: "Support building.",
        stats: [
          { label: "Clean / h", value: "$0" },
          { label: "Dirty / h", value: "$0" }
        ],
        specialActions: [
          {
            actionId: "produce_chemicals",
            label: "Produce Chemicals",
            description: "Produce chemicals.",
            effectSummary: "+chemicals, +heat",
            durationMs: 5000,
            cooldownMs: 10000,
            cooldownRemainingTicks: 0,
            heatGain: 1,
            enabled: true,
            disabledReason: null
          }
        ],
        level: 1,
        status: "active",
        actionCooldowns: {},
        actions: [
          {
            buildingId: "building:pharmacy:1",
            buildingTypeId: "pharmacy",
            actionId: "produce_chemicals",
            label: "Produce Chemicals",
            description: "Produce chemicals.",
            status: "available",
            cost: {},
            expectedEffectSummary: ["+6 Chemicals"],
            riskSummary: ["Heat +1"],
            requiresInput: [],
            durationMs: 5000,
            cooldownMs: 10000,
            cooldownRemainingTicks: 0,
            inputCost: {},
            outputGain: {
              chemicals: 6
            },
            heatGain: 1,
            influenceChange: 0,
            reportText: "Produced chemicals.",
            enabled: true,
            disabledReason: null
          }
        ]
      }
    ],
    attackTargets: [
      {
        districtId: "district:2",
        name: "Target District",
        ownerPlayerId: "player:2",
        status: "claimed",
        enabled: true,
        disabledReason: null
      }
    ],
    spyTargets: [
      {
        districtId: "district:2",
        name: "Target District",
        ownerPlayerId: "player:2",
        status: "claimed",
        enabled: true,
        disabledReason: null
      }
    ],
    occupyTargets: [],
    trap: {
      enabled: true,
      disabledReason: null,
      activeTrap: null
    },
    slots: [
      {
        slotIndex: 0,
        buildingId: "building:pharmacy:1",
        buildingTypeId: "pharmacy",
        status: "active",
        canBuild: false,
        production: null,
        processing: null,
        craftOptions: [],
        buildOptions: []
      }
    ]
  }
});

const createMockElement = (
  dataset: Record<string, string | undefined> = {}
): {
  element: ClientSurfaceActionElement;
  setClosest(selector: string, value: ClientSurfaceActionElement | null): void;
} => {
  const matches: Record<string, ClientSurfaceActionElement | null> = {};
  const element: ClientSurfaceActionElement = {
    dataset,
    closest: (selector) => (matches[selector] as unknown as ClientSurfaceActionElement | null) as never
  };

  return {
    element,
    setClosest: (selector, value) => {
      matches[selector] = value;
    }
  };
};

describe("client surface actions", () => {
  it("resolves spy, occupy, and trap click targets from surface dataset hooks", () => {
    const spyButton = createMockElement({ spyTargetId: "district:2" });
    spyButton.setClosest("button[data-spy-target-id]", spyButton.element);

    expect(resolveClientSurfaceAction(spyButton.element)).toEqual({
      kind: "spy",
      targetDistrictId: "district:2"
    });

    const occupyButton = createMockElement({ occupyTargetId: "district:3" });
    occupyButton.setClosest("button[data-occupy-target-id]", occupyButton.element);

    expect(resolveClientSurfaceAction(occupyButton.element)).toEqual({
      kind: "occupy",
      targetDistrictId: "district:3"
    });

    const trapButton = createMockElement({ placeTrap: "true" });
    trapButton.setClosest("button[data-place-trap]", trapButton.element);

    expect(resolveClientSurfaceAction(trapButton.element)).toEqual({
      kind: "place-trap"
    });
  });

  it("resolves district building card clicks", () => {
    const buildingCard = createMockElement({
      buildingId: "building:pharmacy:1",
      buildingType: "pharmacy"
    });
    buildingCard.setClosest(
      "article[data-building-id][data-building-type]",
      buildingCard.element
    );

    expect(resolveClientSurfaceAction(buildingCard.element)).toEqual({
      kind: "open-building",
      buildingId: "building:pharmacy:1"
    });
  });

  it("resolves fixed building action click targets", () => {
    const actionButton = createMockElement({
      buildingActionBuildingId: "building:pharmacy:1",
      buildingActionId: "produce_chemicals"
    });
    const buildingCard = createMockElement({
      buildingId: "building:pharmacy:1",
      buildingType: "pharmacy"
    });
    actionButton.setClosest(
      "button[data-building-action-building-id][data-building-action-id]",
      actionButton.element
    );
    actionButton.setClosest(
      "article[data-building-id][data-building-type]",
      buildingCard.element
    );

    expect(resolveClientSurfaceAction(actionButton.element)).toEqual({
      kind: "building-action",
      buildingId: "building:pharmacy:1",
      actionId: "produce_chemicals"
    });
  });

  it("does not resolve legacy build slot hooks as main surface actions", () => {
    const buildButton = createMockElement({ buildingType: "safehouse" });
    const slot = createMockElement({ slotIndex: "0" });
    buildButton.setClosest("button[data-building-type]", buildButton.element);
    buildButton.setClosest("[data-slot-index]", slot.element);

    expect(resolveClientSurfaceAction(buildButton.element)).toBeNull();
  });

  it("dispatches fixed building action commands through the migrated client router", async () => {
    const slice = createGameplaySliceFixture();
    const renderState = createInitialClientRenderState();
    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];

    const router = createClientSurfaceActionRouter({
      client: {
        load: async () => renderState,
        selectDistrict: async () => renderState,
        selectBuilding: async () => renderState,
        dispatch: async (command) => {
          dispatched.push({
            type: command.type,
            payload: command.payload as unknown as Record<string, unknown>
          });
          return renderState;
        },
        getRenderState: () => renderState,
        getGameplaySlice: () => slice
      },
      createCommandId: (prefix) => `${prefix}:1`,
      getIssuedAt: () => new Date(0).toISOString()
    });

    const actionButton = createMockElement({
      buildingActionBuildingId: "building:pharmacy:1",
      buildingActionId: "produce_chemicals"
    });
    actionButton.setClosest(
      "button[data-building-action-building-id][data-building-action-id]",
      actionButton.element
    );

    await router.handleTarget(actionButton.element);

    expect(dispatched).toEqual([
      {
        type: "run-building-action",
        payload: {
          districtId: "district:1",
          buildingId: "building:pharmacy:1",
          actionId: "produce_chemicals"
        }
      }
    ]);
  });

  it("opens district building cards through the migrated client router", async () => {
    const slice = createGameplaySliceFixture();
    const renderState = createInitialClientRenderState();
    const opened: string[] = [];

    const router = createClientSurfaceActionRouter({
      client: {
        load: async () => renderState,
        selectDistrict: async () => renderState,
        selectBuilding: async (buildingId) => {
          opened.push(buildingId ?? "");
          return renderState;
        },
        dispatch: async () => renderState,
        getRenderState: () => renderState,
        getGameplaySlice: () => slice
      },
      createCommandId: (prefix) => `${prefix}:1`,
      getIssuedAt: () => new Date(0).toISOString()
    });

    const buildingCard = createMockElement({
      buildingId: "building:pharmacy:1",
      buildingType: "pharmacy"
    });
    buildingCard.setClosest(
      "article[data-building-id][data-building-type]",
      buildingCard.element
    );

    await router.handleTarget(buildingCard.element);

    expect(opened).toEqual(["building:pharmacy:1"]);
  });

  it("dispatches spy commands through the migrated client router", async () => {
    const slice = createGameplaySliceFixture();
    const renderState = createInitialClientRenderState();
    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const selected: string[] = [];

    const router = createClientSurfaceActionRouter({
      client: {
        load: async () => renderState,
        selectDistrict: async (districtId) => {
          selected.push(districtId);
          return renderState;
        },
        selectBuilding: async () => renderState,
        dispatch: async (command) => {
          dispatched.push({
            type: command.type,
            payload: command.payload as unknown as Record<string, unknown>
          });
          return renderState;
        },
        getRenderState: () => renderState,
        getGameplaySlice: () => slice
      },
      createCommandId: (prefix) => `${prefix}:1`,
      getIssuedAt: () => new Date(0).toISOString()
    });

    const spyButton = createMockElement({ spyTargetId: "district:2" });
    spyButton.setClosest("button[data-spy-target-id]", spyButton.element);

    await router.handleTarget(spyButton.element);

    expect(selected).toEqual([]);
    expect(dispatched).toEqual([
      {
        type: "spy-district",
        payload: {
          districtId: "district:2",
          sourceDistrictId: "district:1"
        }
      }
    ]);
  });

  it("dispatches occupy commands through the migrated client router", async () => {
    const slice = createGameplaySliceFixture();
    slice.district!.occupyTargets = [
      {
        districtId: "district:3",
        name: "Neutral District",
        ownerPlayerId: null,
        status: "neutral",
        enabled: true,
        disabledCode: null,
        disabledReason: null,
        cost: {
          influence: 5
        },
        heatGain: 2,
        cooldownRemainingTicks: 0
      }
    ];
    const renderState = createInitialClientRenderState();
    const dispatched: Array<{ type: string; payload: Record<string, unknown> }> = [];

    const router = createClientSurfaceActionRouter({
      client: {
        load: async () => renderState,
        selectDistrict: async () => renderState,
        selectBuilding: async () => renderState,
        dispatch: async (command) => {
          dispatched.push({
            type: command.type,
            payload: command.payload as unknown as Record<string, unknown>
          });
          return renderState;
        },
        getRenderState: () => renderState,
        getGameplaySlice: () => slice
      },
      createCommandId: (prefix) => `${prefix}:1`,
      getIssuedAt: () => new Date(0).toISOString()
    });

    const occupyButton = createMockElement({ occupyTargetId: "district:3" });
    occupyButton.setClosest("button[data-occupy-target-id]", occupyButton.element);

    await router.handleTarget(occupyButton.element);

    expect(dispatched).toEqual([
      {
        type: "occupy-district",
        payload: {
          districtId: "district:3",
          sourceDistrictId: "district:1"
        }
      }
    ]);
  });

  it("routes district selection and trap placement without needing legacy runtime handlers", async () => {
    const slice = createGameplaySliceFixture();
    const renderState = createInitialClientRenderState();
    const dispatched: string[] = [];
    const selected: string[] = [];

    const router = createClientSurfaceActionRouter({
      client: {
        load: async () => renderState,
        selectDistrict: async (districtId) => {
          selected.push(districtId);
          return renderState;
        },
        selectBuilding: async () => renderState,
        dispatch: async (command) => {
          dispatched.push(command.type);
          return renderState;
        },
        getRenderState: () => renderState,
        getGameplaySlice: () => slice
      },
      createCommandId: (prefix) => `${prefix}:1`,
      getIssuedAt: () => new Date(0).toISOString()
    });

    const districtButton = createMockElement({ districtId: "district:2" });
    districtButton.setClosest("button[data-district-id]", districtButton.element);

    await router.handleTarget(districtButton.element);

    const trapButton = createMockElement({ placeTrap: "true" });
    trapButton.setClosest("button[data-place-trap]", trapButton.element);

    await router.handleTarget(trapButton.element);

    expect(selected).toEqual(["district:2"]);
    expect(dispatched).toEqual(["place-trap"]);
  });
});
