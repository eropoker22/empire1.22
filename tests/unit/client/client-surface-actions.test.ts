import { describe, expect, it } from "vitest";
import type { GameplaySliceView } from "@empire/shared-types";
import { empireStreetsCityMapManifestHash } from "@empire/game-config";
import { closeOverlay, getTopOverlay, isOverlayOpen, openOverlay, resetOverlayStateForTests } from "../../../apps/client/src/modals";
import {
  createClientSurfaceActionRouter,
  resolveClientSurfaceAction,
  type ClientSurfaceActionElement
} from "../../../apps/client/src/app";
import { createInitialClientRenderState } from "../../../apps/client/src/app";

const createGameplaySliceFixture = (): GameplaySliceView => ({
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
    availableBuildingActionCount: 1,
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
            actionId: "produce_neon_dust",
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
            actionId: "produce_neon_dust",
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
        disabledReason: null,
        selectedLoadout: { pistol: 2 },
        expectedSourceVersion: 3,
        expectedTargetVersion: 4
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
  afterEach(() => {
    while (isOverlayOpen()) {
      closeOverlay("test:cleanup");
    }

    resetOverlayStateForTests();
  });

  it("resolves spy, occupy, and trap click targets from surface dataset hooks", () => {
    const spyButton = createMockElement({ spyTargetId: "district:2" });
    spyButton.setClosest("button[data-spy-target-id]", spyButton.element);

    expect(resolveClientSurfaceAction(spyButton.element)).toEqual({
      kind: "spy",
      targetDistrictId: "district:2"
    });

    const attackButton = createMockElement({ attackTargetId: "district:2" });
    attackButton.setClosest("button[data-attack-target-id]", attackButton.element);

    expect(resolveClientSurfaceAction(attackButton.element)).toEqual({
      kind: "attack",
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
      buildingActionId: "produce_neon_dust"
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
      actionId: "produce_neon_dust"
    });
  });

  it("reads building action inputs without building selector strings from input ids", () => {
    const amountInput = createMockElement({
      buildingActionInput: "amount",
      value: "7"
    });
    const selectorTrapInput = createMockElement({
      buildingActionInput: 'mode"] [data-building-action-input="amount',
      value: "999"
    });
    const controls = createMockElement({});
    controls.element.querySelector = vi.fn(() => null) as never;
    controls.element.querySelectorAll = vi.fn((selector) =>
      selector === "[data-building-action-input]"
        ? ([selectorTrapInput.element, amountInput.element] as unknown as NodeListOf<Element>)
        : ([] as unknown as NodeListOf<Element>)
    ) as never;

    const actionButton = createMockElement({
      buildingActionBuildingId: "building:pharmacy:1",
      buildingActionId: "produce_neon_dust"
    });
    actionButton.setClosest(
      "button[data-building-action-building-id][data-building-action-id]",
      actionButton.element
    );
    actionButton.setClosest("[data-building-action-controls]", controls.element);

    expect(resolveClientSurfaceAction(actionButton.element)).toEqual({
      kind: "building-action",
      buildingId: "building:pharmacy:1",
      actionId: "produce_neon_dust",
      amount: 7
    });
    expect(controls.element.querySelectorAll).toHaveBeenCalledWith("[data-building-action-input]");
    expect(controls.element.querySelector).not.toHaveBeenCalledWith(
      '[data-building-action-input="mode"] [data-building-action-input="amount"]'
    );
  });

  it("resolves production collect click targets", () => {
    const collectButton = createMockElement({
      collectBuildingId: "building:factory:1"
    });
    collectButton.setClosest(
      "button[data-collect-building-id]",
      collectButton.element
    );

    expect(resolveClientSurfaceAction(collectButton.element)).toEqual({
      kind: "collect",
      buildingId: "building:factory:1"
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
      buildingActionId: "produce_neon_dust"
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
          actionId: "produce_neon_dust"
        }
      }
    ]);
  });

  it("dispatches collect-production commands through the migrated client router", async () => {
    const slice = createGameplaySliceFixture();
    slice.district!.slots = [
      {
        slotIndex: 0,
        buildingId: "building:factory:1",
        buildingTypeId: "factory",
        status: "active",
        canBuild: false,
        production: {
          resourceKey: "metal-parts",
          resourceLabel: "Metal Parts",
          storedAmount: 8,
          storageCap: 24,
          amountPerTick: 4,
          canCollect: true,
          collectDisabledReason: null
        },
        processing: null,
        craftOptions: [],
        buildOptions: []
      }
    ];
    const renderState = createInitialClientRenderState();
    const dispatched: Array<{ type: string; payload: Record<string, unknown>; serverInstanceId: string }> = [];

    const router = createClientSurfaceActionRouter({
      client: {
        load: async () => renderState,
        selectDistrict: async () => renderState,
        selectBuilding: async () => renderState,
        dispatch: async (command) => {
          dispatched.push({
            type: command.type,
            payload: command.payload as unknown as Record<string, unknown>,
            serverInstanceId: command.serverInstanceId
          });
          return renderState;
        },
        getRenderState: () => renderState,
        getGameplaySlice: () => slice
      },
      createCommandId: (prefix) => `${prefix}:1`,
      getIssuedAt: () => new Date(0).toISOString()
    });

    const collectButton = createMockElement({
      collectBuildingId: "building:factory:1"
    });
    collectButton.setClosest(
      "button[data-collect-building-id]",
      collectButton.element
    );

    await router.handleTarget(collectButton.element);

    expect(dispatched).toEqual([
      {
        type: "collect-production",
        serverInstanceId: "instance:1",
        payload: {
          districtId: "district:1",
          buildingId: "building:factory:1"
        }
      }
    ]);
  });

  it("dispatches rob commands when the rob target is stale or absent from the local slice", async () => {
    const slice = createGameplaySliceFixture();
    slice.district!.robTargets = [];
    const renderState = createInitialClientRenderState();
    const dispatched: Array<{ type: string; payload: Record<string, unknown>; playerId: string; serverInstanceId: string }> = [];

    const router = createClientSurfaceActionRouter({
      client: {
        load: async () => renderState,
        selectDistrict: async () => renderState,
        selectBuilding: async () => renderState,
        dispatch: async (command) => {
          dispatched.push({
            type: command.type,
            payload: command.payload as unknown as Record<string, unknown>,
            playerId: command.playerId,
            serverInstanceId: command.serverInstanceId
          });
          return renderState;
        },
        getRenderState: () => renderState,
        getGameplaySlice: () => slice
      },
      createCommandId: (prefix) => `${prefix}:1`,
      getIssuedAt: () => new Date(0).toISOString()
    });

    const robButton = createMockElement({ robTargetId: "district:2" });
    robButton.setClosest("button[data-rob-target-id]", robButton.element);

    await router.handleTarget(robButton.element);

    expect(dispatched).toEqual([
      {
        type: "rob-district",
        playerId: "player:1",
        serverInstanceId: "instance:1",
        payload: {
          targetDistrictId: "district:2",
          sourceDistrictId: "district:1"
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

  it("dispatches heist commands when heist styles are missing in local data", async () => {
    const slice = createGameplaySliceFixture();
    slice.district!.heistTargets = [
      {
        districtId: "district:4",
        name: "Heist Target",
        ownerPlayerId: "player:4",
        status: "claimed",
        enabled: false,
        disabledCode: null,
        disabledReason: null,
        expectedTargetVersion: 9,
        expectedSourceVersion: 7,
        styles: []
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

    const heistButton = createMockElement({ heistTargetId: "district:4" });
    heistButton.setClosest("button[data-heist-target-id]", heistButton.element);

    await router.handleTarget(heistButton.element);

    expect(dispatched).toEqual([
      {
        type: "heist-district",
        payload: {
          targetDistrictId: "district:4",
          sourceDistrictId: "district:1",
          expectedTargetVersion: 9,
          expectedSourceVersion: 7,
          style: "balanced",
          gangMembersSent: 1
        }
      }
    ]);
  });

  it("dispatches heist commands when the heist target is absent from the local slice", async () => {
    const slice = createGameplaySliceFixture();
    slice.district!.heistTargets = [];
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

    const heistButton = createMockElement({ heistTargetId: "district:4" });
    heistButton.setClosest("button[data-heist-target-id]", heistButton.element);

    await router.handleTarget(heistButton.element);

    expect(dispatched).toEqual([
      {
        type: "heist-district",
        payload: {
          targetDistrictId: "district:4",
          sourceDistrictId: "district:1",
          style: "balanced",
          gangMembersSent: 1
        }
      }
    ]);
  });

  it("dispatches attack commands through the migrated client router", async () => {
    const slice = createGameplaySliceFixture();
    const renderState = createInitialClientRenderState();
    const dispatched: Array<{ type: string; payload: Record<string, unknown>; playerId: string; serverInstanceId: string }> = [];

    const router = createClientSurfaceActionRouter({
      client: {
        load: async () => renderState,
        selectDistrict: async () => renderState,
        selectBuilding: async () => renderState,
        dispatch: async (command) => {
          dispatched.push({
            type: command.type,
            payload: command.payload as unknown as Record<string, unknown>,
            playerId: command.playerId,
            serverInstanceId: command.serverInstanceId
          });
          return renderState;
        },
        getRenderState: () => renderState,
        getGameplaySlice: () => slice
      },
      createCommandId: (prefix) => `${prefix}:1`,
      getIssuedAt: () => new Date(0).toISOString()
    });

    const attackButton = createMockElement({ attackTargetId: "district:2" });
    attackButton.setClosest("button[data-attack-target-id]", attackButton.element);

    await router.handleTarget(attackButton.element);

    expect(dispatched).toEqual([
      {
        type: "attack-district",
        playerId: "player:1",
        serverInstanceId: "instance:1",
        payload: {
          districtId: "district:2",
          sourceDistrictId: "district:1",
          weapons: { pistol: 2 },
          expectedSourceVersion: 3,
          expectedTargetVersion: 4
        }
      }
    ]);
  });

  it("does not dispatch attack commands for disabled server-fed targets", async () => {
    const slice = createGameplaySliceFixture();
    slice.district!.attackTargets[0] = {
      ...slice.district!.attackTargets[0],
      enabled: false,
      disabledReason: "Attack route is cooling down."
    };
    const renderState = createInitialClientRenderState();
    const dispatched: string[] = [];

    const router = createClientSurfaceActionRouter({
      client: {
        load: async () => renderState,
        selectDistrict: async () => renderState,
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

    const attackButton = createMockElement({ attackTargetId: "district:2" });
    attackButton.setClosest("button[data-attack-target-id]", attackButton.element);

    await router.handleTarget(attackButton.element);
    expect(dispatched).toEqual([]);
  });

  it("does not dispatch attack commands when the target is absent from the local slice", async () => {
    const slice = createGameplaySliceFixture();
    slice.district!.attackTargets = [];
    const renderState = createInitialClientRenderState();
    const dispatched: Array<{ type: string; payload: Record<string, unknown>; playerId: string; serverInstanceId: string }> = [];

    const router = createClientSurfaceActionRouter({
      client: {
        load: async () => renderState,
        selectDistrict: async () => renderState,
        selectBuilding: async () => renderState,
        dispatch: async (command) => {
          dispatched.push({
            type: command.type,
            payload: command.payload as unknown as Record<string, unknown>,
            playerId: command.playerId,
            serverInstanceId: command.serverInstanceId
          });
          return renderState;
        },
        getRenderState: () => renderState,
        getGameplaySlice: () => slice
      },
      createCommandId: (prefix) => `${prefix}:1`,
      getIssuedAt: () => new Date(0).toISOString()
    });

    const attackButton = createMockElement({ attackTargetId: "district:2" });
    attackButton.setClosest("button[data-attack-target-id]", attackButton.element);

    await router.handleTarget(attackButton.element);

    expect(dispatched).toEqual([]);
  });

  it("dispatches spy commands when target is absent from the local slice", async () => {
    const slice = createGameplaySliceFixture();
    slice.district!.spyTargets = [];
    const renderState = createInitialClientRenderState();
    const dispatched: Array<{ type: string; payload: Record<string, unknown>; playerId: string; serverInstanceId: string }> = [];

    const router = createClientSurfaceActionRouter({
      client: {
        load: async () => renderState,
        selectDistrict: async () => renderState,
        selectBuilding: async () => renderState,
        dispatch: async (command) => {
          dispatched.push({
            type: command.type,
            payload: command.payload as unknown as Record<string, unknown>,
            playerId: command.playerId,
            serverInstanceId: command.serverInstanceId
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

    expect(dispatched).toEqual([
      {
        type: "spy-district",
        playerId: "player:1",
        serverInstanceId: "instance:1",
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
          influence: 5,
          population: 50
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

  it("dispatches occupy commands when the occupy target is stale in the local slice", async () => {
    const slice = createGameplaySliceFixture();
    slice.district!.occupyTargets = [];
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

  it("keeps bottom sheet open when closing a stacked modal overlay", async () => {
    const slice = createGameplaySliceFixture();
    const renderState = createInitialClientRenderState();
    const selected: string[] = [];

    const router = createClientSurfaceActionRouter({
      client: {
        load: async () => renderState,
        selectDistrict: async (districtId) => {
          selected.push(districtId);
          return renderState;
        },
        selectBuilding: async () => renderState,
        dispatch: async () => renderState,
        getRenderState: () => renderState,
        getGameplaySlice: () => slice
      },
      createCommandId: (prefix) => `${prefix}:1`,
      getIssuedAt: () => new Date(0).toISOString()
    });

    const districtButton = createMockElement({ districtId: "district:2" });
    districtButton.setClosest("button[data-district-id]", districtButton.element);

    openOverlay("district_sheet");
    openOverlay("confirmation_modal");
    expect(isOverlayOpen()).toBe(true);
    expect(getTopOverlay()).toBe("confirmation_modal");

    await router.handleTarget(districtButton.element);
    expect(selected).toEqual([]);

    closeOverlay("close confirmation");
    expect(isOverlayOpen()).toBe(true);
    expect(getTopOverlay()).toBe("district_sheet");

    await router.handleTarget(districtButton.element);
    expect(selected).toEqual([]);

    closeOverlay("close sheet");
    expect(isOverlayOpen()).toBe(false);
    expect(getTopOverlay()).toBe(null);

    await router.handleTarget(districtButton.element);
    expect(selected).toEqual(["district:2"]);
  });
});
