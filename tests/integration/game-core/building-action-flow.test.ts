import { describe, expect, it } from "vitest";
import { applyCommand, collectIncome, completeProduction, createConflictReportViews } from "@empire/game-core";
import { getAllPublicBuildingDefinitions, resolveModeConfig } from "@empire/game-config";
import {
  createCoreStateWithFixedBuildingFixture,
  createDistrictFixture,
  createFixedBuildingFixture,
  createResourceStateFixture
} from "../../fixtures/game-state-fixtures";
import { createRunBuildingActionCommandFixture } from "../../fixtures/command-fixtures";
import { createCollectProductionCommandFixture } from "../../fixtures/command-fixtures";

const context = {
  config: resolveModeConfig("free")
};

const createStateWithFixedBuilding = (buildingTypeId = "pharmacy", options = {}) => {
  const { playerBalances, productionResourceKey, productionStoredAmount, ...buildingOverrides } = options as {
    playerBalances?: Record<string, number>;
    productionResourceKey?: string;
    productionStoredAmount?: number;
    [key: string]: unknown;
  };
  return createCoreStateWithFixedBuildingFixture(buildingTypeId, {
    buildingOverrides,
    productionResourceKey,
    productionStoredAmount,
    playerBalances: {
      cash: 1000,
      "dirty-cash": 250,
      chemicals: 10,
      biomass: 6,
      "metal-parts": 8,
      "tech-core": 2,
      ...(playerBalances ?? {})
    }
  });
};

describe("run-building-action command flow", () => {
  it("wires every public fixed building into passive balance and command actions", () => {
    const definitions = getAllPublicBuildingDefinitions();
    const fixedBuildings = context.config.balance.fixedBuildings ?? {};
    const buildingActions = context.config.balance.buildingActions ?? {};

    expect(definitions).not.toHaveLength(0);
    for (const definition of definitions) {
      expect(fixedBuildings[definition.buildingTypeId]).toMatchObject(definition.stats);
      if (definition.buildingTypeId === "apartment_block") {
        expect(definition.stats).toMatchObject({
          cleanPerHour: 0,
          dirtyPerHour: 0,
          heatPerDay: 0,
          influencePerDay: 0
        });
      } else {
        expect(definition.stats.heatPerDay).toBeGreaterThan(0);
      }
      if (
        definition.buildingTypeId === "warehouse"
        || definition.buildingTypeId === "restaurant"
        || definition.buildingTypeId === "convenience_store"
        || definition.buildingTypeId === "shopping_mall"
        || definition.buildingTypeId === "recruitment_center"
        || definition.buildingTypeId === "garage"
        || definition.buildingTypeId === "car_dealer"
        || definition.buildingTypeId === "fitness_club"
      ) {
        expect(definition.specialActions).toHaveLength(0);
      } else {
        expect(definition.specialActions.length).toBeGreaterThan(0);
      }
      for (const action of definition.specialActions) {
        expect(buildingActions[action.actionId]).toMatchObject({
          actionId: action.actionId,
          buildingType: definition.buildingTypeId,
          inputCost: action.inputCost,
          outputGain: action.outputGain,
          heatGain: action.heatGain,
          influenceChange: action.influenceChange
        });
      }
    }
  });

  it("collects clean money, dirty money, heat, and influence from fixed buildings on income ticks", () => {
    const { state } = createStateWithFixedBuilding("central_bank", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      }
    });
    const result = collectIncome(state, context);

    expect(result.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(0);
    expect(result.resourceStatesById["resource:1"].balances["dirty-cash"]).toBeGreaterThan(0);
    expect(result.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(result.districtsById["district:1"].influence).toBeGreaterThan(0);
  });

  it("runs a valid fixed building action and updates resources, district heat, influence, cooldown, and report", () => {
    const { state, building } = createStateWithFixedBuilding("pharmacy");
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "produce_stim_pack"
        }
      }),
      context
    );

    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:1"].balances.chemicals).toBe(8);
    expect(result.nextState.resourceStatesById["resource:1"].balances.biomass).toBe(5);
    expect(result.nextState.resourceStatesById["resource:1"].balances["stim-pack"]).toBe(1);
    expect(result.nextState.districtsById["district:1"].heat).toBe(2);
    expect(result.nextState.districtsById["district:1"].influence).toBe(1);
    expect(result.nextState.buildingsById[building.id].actionCooldowns.produce_stim_pack).toBeGreaterThan(0);
    expect(Object.values(result.nextState.notificationsById).some((notification) => notification.category === "report.building-action")).toBe(true);
  });

  it("rejects an action when the building is not fixed in the district", () => {
    const { state, building } = createStateWithFixedBuilding("pharmacy");
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: []
    };
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "produce_chemicals"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("building_not_in_district");
  });

  it("rejects an action for the wrong building type", () => {
    const { state, building } = createStateWithFixedBuilding("factory");
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "produce_chemicals"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("building_action_type_mismatch");
  });

  it("rejects an action blocked by building cooldown", () => {
    const { state, building } = createStateWithFixedBuilding("pharmacy", {
      actionCooldowns: {
        produce_chemicals: 3
      }
    });
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "produce_chemicals"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("building_action_cooldown");
  });

  it("rejects an action when player resources do not cover input costs", () => {
    const { state, building } = createStateWithFixedBuilding("casino");
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        cash: 1000,
        "dirty-cash": 25
      }
    };
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "bribed_inspector"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("building_action_insufficient_resources");
  });

  it("runs casino quiet backroom as dynamic high-risk laundering", () => {
    const { state, building } = createStateWithFixedBuilding("casino", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 10000
      }
    });
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:casino:quiet",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "quiet_backroom"
        }
      }),
      context
    );
    const balances = result.nextState.resourceStatesById["resource:1"].balances;
    const report = createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(result.errors).toEqual([]);
    expect(balances["dirty-cash"]).toBe(7600);
    expect(balances.cash).toBe(2184);
    expect(result.nextState.districtsById["district:1"].heat).toBe(7);
    expect(result.nextState.districtsById["district:1"].influence).toBe(3);
    expect(result.nextState.buildingsById[building.id].metadata?.casino).toMatchObject({
      launderedEvents: [{ tick: 0, amount: 2400 }]
    });
    expect(report).toMatchObject({
      casinoResult: {
        launderedDirtyCash: 2400,
        cleanCashGained: 2184,
        feePaid: 216,
        heatGain: 7
      }
    });
  });

  it("rejects casino laundering below minimum dirty cash", () => {
    const { state, building } = createStateWithFixedBuilding("casino", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 1499
      }
    });
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "quiet_backroom"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("casino_insufficient_dirty_cash");
  });

  it("activates casino VIP night and blocks stacking while active", () => {
    const { state, building } = createStateWithFixedBuilding("casino");
    const first = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:casino:vip:1",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "vip_night"
        }
      }),
      context
    );
    const second = applyCommand(
      first.nextState,
      createRunBuildingActionCommandFixture({
        id: "command:casino:vip:2",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "vip_night"
        }
      }),
      context
    );

    expect(first.errors).toEqual([]);
    expect(first.nextState.buildingsById[building.id].metadata?.casino).toMatchObject({
      vipNightExpiresAtTick: 120
    });
    expect(second.errors.map((error) => error.code)).toContain("building_action_cooldown");
    expect(second.errors.map((error) => error.code)).toContain("casino_vip_night_active");
  });

  it("runs exchange office good rate as networked laundering", () => {
    const { state, building } = createStateWithFixedBuilding("exchange", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 10000
      }
    });
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:exchange:good-rate",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "good_rate"
        }
      }),
      context
    );
    const balances = result.nextState.resourceStatesById["resource:1"].balances;
    const report = createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(result.errors).toEqual([]);
    expect(balances["dirty-cash"]).toBe(8400);
    expect(balances.cash).toBe(1408);
    expect(result.nextState.districtsById["district:1"].heat).toBe(4);
    expect(result.nextState.districtsById["district:1"].influence).toBe(1.5);
    expect(result.nextState.buildingsById[building.id].metadata?.exchangeOffice).toMatchObject({
      launderedEvents: [{ tick: 0, amount: 1600 }]
    });
    expect(report).toMatchObject({
      exchangeResult: {
        launderedDirtyCash: 1600,
        cleanCashGained: 1408,
        feePaid: 192,
        heatGain: 4
      }
    });
  });

  it("rejects exchange office laundering below minimum dirty cash", () => {
    const { state, building } = createStateWithFixedBuilding("exchange", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 799
      }
    });
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "good_rate"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("exchange_office_insufficient_dirty_cash");
  });

  it("runs arcade back cashdesk as street laundering", () => {
    const { state, building } = createStateWithFixedBuilding("arcade", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 10000
      }
    });
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:arcade:back-cashdesk",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "back_cashdesk"
        }
      }),
      context
    );
    const balances = result.nextState.resourceStatesById["resource:1"].balances;
    const report = createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(result.errors).toEqual([]);
    expect(balances["dirty-cash"]).toBe(8700);
    expect(balances.cash).toBe(1105);
    expect(result.nextState.districtsById["district:1"].heat).toBe(3);
    expect(result.nextState.districtsById["district:1"].influence).toBe(1);
    expect(result.nextState.buildingsById[building.id].metadata?.arcade).toMatchObject({
      launderedEvents: [{ tick: 0, amount: 1300 }]
    });
    expect(report).toMatchObject({
      arcadeResult: {
        launderedDirtyCash: 1300,
        cleanCashGained: 1105,
        feePaid: 195,
        heatGain: 3
      }
    });
  });

  it("activates arcade night machines and blocks stacking while active", () => {
    const { state, building } = createStateWithFixedBuilding("arcade");
    const first = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:arcade:night:1",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "night_machines"
        }
      }),
      context
    );
    const second = applyCommand(
      first.nextState,
      createRunBuildingActionCommandFixture({
        id: "command:arcade:night:2",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "night_machines"
        }
      }),
      context
    );

    expect(first.errors).toEqual([]);
    expect(first.nextState.buildingsById[building.id].metadata?.arcade).toMatchObject({
      nightMachinesExpiresAtTick: 84
    });
    expect(second.errors.map((error) => error.code)).toContain("building_action_cooldown");
    expect(second.errors.map((error) => error.code)).toContain("arcade_night_machines_active");
  });

  it("applies armory fortify as real district defense", () => {
    const { state, building } = createStateWithFixedBuilding("armory");
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "armory_fortify"
        }
      }),
      context
    );

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:1"].defenseLoadout).toMatchObject({
      barricades: 2,
      cameras: 1,
      alarm: 1
    });
    expect(result.events[0]?.payload).toMatchObject({
      defenseAdded: {
        barricades: 2,
        cameras: 1,
        alarm: 1
      }
    });
    expect(createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })[0]).toMatchObject({
      reportType: "building-action",
      buildingActionId: "armory_fortify",
      defenseAdded: {
        barricades: 2,
        cameras: 1,
        alarm: 1
      }
    });
  });

  it("runs Shopping Mall as passive economy and market multiplier without actions", () => {
    const { state, building } = createStateWithFixedBuilding("shopping_mall", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      }
    });
    const secondMall = {
      ...building,
      id: "building:district-2:shopping_mall:2",
      districtId: "district:2"
    };
    state.buildingsById[secondMall.id] = secondMall;
    state.districtsById["district:2"] = createDistrictFixture({
      id: "district:2",
      buildingIds: [secondMall.id],
      ownerPlayerId: "player:1"
    });
    state.root.districtIds.push("district:2");

    const result = collectIncome(state, context);

    expect(result.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(0);
    expect(result.resourceStatesById["resource:1"].balances["dirty-cash"]).toBeGreaterThan(0);
    expect(result.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(result.districtsById["district:1"].influence).toBeGreaterThan(0);
    expect(context.config.balance.shoppingMall).toMatchObject({
      buildingTypeId: "shopping_mall",
      countOnMap: 10,
      noSpecialActions: true,
      noLaundering: true,
      noAuditRisk: true
    });
    expect((context.config.balance.buildingActions ?? {}).mall_expand_shops).toBeUndefined();
  });

  it("collects stored apartment block population into player population and gang members", () => {
    const { state, building } = createStateWithFixedBuilding("apartment_block", {
      metadata: {
        apartmentBlock: {
          storedPopulation: 12.7,
          lastUpdatedTick: 0,
          lastCapacity: 50,
          wasFull: false
        }
      }
    });
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      population: 20
    };

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "collect_population"
        }
      }),
      context
    );
    const nextBuilding = result.nextState.buildingsById[building.id];
    const report = createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(result.errors).toEqual([]);
    expect(result.nextState.playersById["player:1"].population).toBe(32);
    expect(result.nextState.resourceStatesById["resource:1"].balances.population).toBeUndefined();
    expect(result.nextState.resourceStatesById["resource:1"].balances["gang-members"]).toBe(12);
    expect(result.nextState.districtsById["district:1"].heat).toBe(0);
    expect(result.nextState.districtsById["district:1"].influence).toBe(0);
    expect(Number((nextBuilding.metadata?.apartmentBlock as { storedPopulation?: number })?.storedPopulation)).toBeCloseTo(0.7);
    expect(report).toMatchObject({
      buildingActionId: "collect_population",
      apartmentResult: {
        type: "collect",
        collectedPopulation: 12
      },
      heatGain: 0,
      influenceChange: 0
    });
  });

  it("fills apartment block local population up to capacity and stops there", () => {
    const { state, building } = createStateWithFixedBuilding("apartment_block", {
      metadata: {
        apartmentBlock: {
          storedPopulation: 49,
          lastUpdatedTick: 0,
          lastCapacity: 50,
          wasFull: false
        }
      },
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      }
    });
    state.root.tick = 12;

    const result = collectIncome(state, context);
    const metadata = result.buildingsById[building.id].metadata?.apartmentBlock as {
      storedPopulation?: number;
      lastCapacity?: number;
      wasFull?: boolean;
    };

    expect(result.resourceStatesById["resource:1"].balances.cash).toBe(0);
    expect(result.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(0);
    expect(result.districtsById["district:1"].heat).toBe(0);
    expect(result.districtsById["district:1"].influence).toBe(0);
    expect(metadata.storedPopulation).toBe(50);
    expect(metadata.lastCapacity).toBe(50);
    expect(metadata.wasFull).toBe(true);
  });

  it("applies recruitment center support after apartment block network multipliers", () => {
    const { state, building } = createStateWithFixedBuilding("apartment_block", {
      metadata: {
        apartmentBlock: {
          storedPopulation: 0,
          lastUpdatedTick: 0,
          lastCapacity: 50,
          wasFull: false
        }
      },
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      }
    });
    const recruitmentBuildings = Array.from({ length: 4 }, (_value, index) =>
      createFixedBuildingFixture("recruitment_center", {
        id: `building:district-1:recruitment_center:${index + 1}`
      })
    );
    for (const recruitmentBuilding of recruitmentBuildings) {
      state.buildingsById[recruitmentBuilding.id] = recruitmentBuilding;
    }
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: [building.id, ...recruitmentBuildings.map((recruitmentBuilding) => recruitmentBuilding.id)],
      slotCount: 5
    };
    state.root.tick = 12;

    const result = collectIncome(state, context);
    const metadata = result.buildingsById[building.id].metadata?.apartmentBlock as {
      storedPopulation?: number;
      lastCapacity?: number;
    };

    expect(metadata.storedPopulation).toBeCloseTo(2.24);
    expect(metadata.lastCapacity).toBeCloseTo(58);
    expect(result.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(0);
    expect(result.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(0);
    expect(result.resourceStatesById["resource:1"].balances.influence).toBeUndefined();
  });

  it("collects recruitment center income without dirty cash, influence, or actions", () => {
    const { state, building } = createStateWithFixedBuilding("recruitment_center", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      }
    });
    const secondBuilding = createFixedBuildingFixture("recruitment_center", {
      id: "building:district-1:recruitment_center:2"
    });
    state.buildingsById[secondBuilding.id] = secondBuilding;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: [building.id, secondBuilding.id],
      slotCount: 2
    };

    const result = collectIncome(state, context);
    const actions = context.config.balance.buildingActions ?? {};

    expect(result.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(0);
    expect(result.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(0);
    expect(result.resourceStatesById["resource:1"].balances.influence).toBeUndefined();
    expect(result.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(result.districtsById["district:1"].influence).toBe(0);
    expect(actions.recruitment_drive).toBeUndefined();
    expect(actions.recruitment_speedup).toBeUndefined();
    expect(actions.recruitment_screening).toBeUndefined();
  });

  it("collects garage income without dirty cash, influence, population, or actions", () => {
    const { state, building } = createStateWithFixedBuilding("garage", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      }
    });
    const secondBuilding = createFixedBuildingFixture("garage", {
      id: "building:district-1:garage:2"
    });
    state.buildingsById[secondBuilding.id] = secondBuilding;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: [building.id, secondBuilding.id],
      slotCount: 2
    };

    const result = collectIncome(state, context);
    const actions = context.config.balance.buildingActions ?? {};

    expect(result.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(0);
    expect(result.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(0);
    expect(result.resourceStatesById["resource:1"].balances.influence).toBeUndefined();
    expect(result.resourceStatesById["resource:1"].balances.population).toBeUndefined();
    expect(result.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(result.districtsById["district:1"].influence).toBe(0);
    expect(actions.garage_prepare_vehicles).toBeUndefined();
    expect(actions.garage_fast_route).toBeUndefined();
    expect(actions.garage_escape_routes).toBeUndefined();
  });

  it("collects car dealer income with clean money, dirty money, heat, and no influence, population, or actions", () => {
    const { state, building } = createStateWithFixedBuilding("car_dealer", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      }
    });
    const secondBuilding = createFixedBuildingFixture("car_dealer", {
      id: "building:district-1:car_dealer:2"
    });
    state.buildingsById[secondBuilding.id] = secondBuilding;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: [building.id, secondBuilding.id],
      slotCount: 2
    };

    const result = collectIncome(state, context);
    const actions = context.config.balance.buildingActions ?? {};

    expect(result.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(0);
    expect(result.resourceStatesById["resource:1"].balances["dirty-cash"]).toBeGreaterThan(0);
    expect(result.resourceStatesById["resource:1"].balances.influence).toBeUndefined();
    expect(result.resourceStatesById["resource:1"].balances.population).toBeUndefined();
    expect(result.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(result.districtsById["district:1"].influence).toBe(0);
    expect(context.config.balance.carDealer?.actions).toHaveLength(0);
    expect(actions.car_dealer).toBeUndefined();
  });

  it("collects fitness club income with clean money, heat, combat support, and no dirty cash or actions", () => {
    const { state, building } = createStateWithFixedBuilding("fitness_club", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      }
    });
    const secondBuilding = createFixedBuildingFixture("fitness_club", {
      id: "building:district-1:fitness_club:2"
    });
    state.buildingsById[secondBuilding.id] = secondBuilding;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: [building.id, secondBuilding.id],
      slotCount: 2
    };

    const result = collectIncome(state, context);
    const actions = context.config.balance.buildingActions ?? {};

    expect(result.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(0);
    expect(result.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(0);
    expect(result.resourceStatesById["resource:1"].balances.influence).toBeUndefined();
    expect(result.resourceStatesById["resource:1"].balances.population).toBeUndefined();
    expect(result.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(result.districtsById["district:1"].influence).toBe(0);
    expect(context.config.balance.fitnessClub?.actions).toHaveLength(0);
    expect(actions.fitness_collect_fees).toBeUndefined();
    expect(actions.fitness_gang_training).toBeUndefined();
    expect(actions.fitness_low_profile).toBeUndefined();
  });

  it("rejects apartment block collect when no whole population is stored", () => {
    const { state, building } = createStateWithFixedBuilding("apartment_block", {
      metadata: {
        apartmentBlock: {
          storedPopulation: 0.9,
          lastUpdatedTick: 0,
          lastCapacity: 50,
          wasFull: false
        }
      }
    });

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "collect_population"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("apartment_block_no_population");
  });

  it("runs warehouse as clean-only logistics income with heat and no actions", () => {
    const { state, building } = createStateWithFixedBuilding("warehouse", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      }
    });

    const incomeState = collectIncome(state, context);
    const actionResult = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "collect_stored_resources"
        }
      }),
      context
    );

    expect(incomeState.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(0);
    expect(incomeState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(0);
    expect(incomeState.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(incomeState.districtsById["district:1"].influence).toBe(0);
    expect(actionResult.errors.map((error) => error.code)).toContain("building_action_not_found");
  });

  it("runs clinic as clean-only recovery support income", () => {
    const { state } = createStateWithFixedBuilding("clinic", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      }
    });

    const result = collectIncome(state, context);

    expect(result.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(0);
    expect(result.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(0);
    expect(result.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(result.districtsById["district:1"].influence).toBe(0);
  });

  it("runs clinic stabilization protocol against the recovery pool", () => {
    const { state, building } = createStateWithFixedBuilding("clinic", {
      playerBalances: {
        cash: 5000,
        "dirty-cash": 0,
        chemicals: 0
      }
    });
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      population: 10,
      recoveryPool: [
        { id: "recovery:test:members", itemType: "gang-members", amount: 10, source: "attack", lostAtTick: 0 },
        { id: "recovery:test:pistol", itemType: "pistol", amount: 5, source: "attack", lostAtTick: 0 }
      ]
    };
    const warehouse = {
      ...building,
      id: "building:district-1:warehouse:1",
      buildingTypeId: "warehouse"
    };
    state.buildingsById[warehouse.id] = warehouse;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: [building.id, warehouse.id]
    };

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:clinic:stabilization",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "stabilization_protocol"
        }
      }),
      context
    );
    const balances = result.nextState.resourceStatesById["resource:1"].balances;
    const report = createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(result.errors).toEqual([]);
    expect(balances.cash).toBe(3800);
    expect(balances.chemicals).toBe(0);
    expect(balances["gang-members"]).toBe(1);
    expect(result.nextState.playersById["player:1"].population).toBe(11);
    expect(result.nextState.playersById["player:1"].recoveryPool).toEqual([
      { id: "recovery:test:pistol", itemType: "pistol", amount: 5, source: "attack", lostAtTick: 0 }
    ]);
    expect(result.nextState.districtsById["district:1"].heat).toBe(1);
    expect(report).toMatchObject({
      buildingActionId: "stabilization_protocol",
      clinicResult: {
        type: "recovery",
        recovered: {
          population: 1,
          "gang-members": 1
        },
        keptForRecycling: 5,
        cleanCashCost: 1200,
        heatGain: 1
      }
    });
  });

  it("does not let clinic stabilization consume non-clinic recovery items", () => {
    const { state, building } = createStateWithFixedBuilding("clinic", {
      playerBalances: {
        cash: 5000,
        "dirty-cash": 0
      }
    });
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      recoveryPool: [
        { id: "recovery:test:smg", itemType: "smg", amount: 2, source: "attack", lostAtTick: 0 }
      ]
    };

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:clinic:weapons-blocked",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "stabilization_protocol"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("clinic_recovery_pool_empty");
    expect(result.nextState.playersById["player:1"].recoveryPool).toEqual([
      { id: "recovery:test:smg", itemType: "smg", amount: 2, source: "attack", lostAtTick: 0 }
    ]);
  });

  it("rejects clinic stabilization when recovery pool is empty", () => {
    const { state, building } = createStateWithFixedBuilding("clinic", {
      playerBalances: {
        cash: 5000,
        "dirty-cash": 0
      }
    });

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "stabilization_protocol"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("clinic_recovery_pool_empty");
  });

  it("runs recycling center extract losses against item salvage pool only", () => {
    const { state, building } = createStateWithFixedBuilding("recycling_center", {
      playerBalances: {
        cash: 5000,
        "dirty-cash": 0,
        "metal-parts": 0,
        "baseball-bat": 0,
        vest: 0
      }
    });
    const warehouse = {
      ...building,
      id: "building:district-1:warehouse:1",
      buildingTypeId: "warehouse"
    };
    state.buildingsById[warehouse.id] = warehouse;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: [building.id, warehouse.id]
    };
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      population: 10,
      salvagePool: [
        { id: "salvage:test:metal", itemId: "metal-parts", itemName: "Metal Parts", category: "materials", amount: 20, source: "attack", lostAtTick: 0 },
        { id: "salvage:test:bat", itemId: "baseball-bat", itemName: "Baseballová pálka", category: "weapons", amount: 20, source: "attack", lostAtTick: 0 },
        { id: "salvage:test:vest", itemId: "vest", itemName: "Neprůstřelná vesta", category: "defenseItems", amount: 20, source: "defense", lostAtTick: 0 }
      ]
    };

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:recycling:extract",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "extract_losses"
        }
      }),
      context
    );
    const balances = result.nextState.resourceStatesById["resource:1"].balances;
    const report = createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(result.errors).toEqual([]);
    expect(balances.cash).toBe(4100);
    expect(balances["metal-parts"]).toBe(2);
    expect(balances["baseball-bat"]).toBe(2);
    expect(balances.vest).toBe(2);
    expect(result.nextState.playersById["player:1"].population).toBe(10);
    expect(result.nextState.playersById["player:1"].salvagePool).toEqual([]);
    expect(result.nextState.districtsById["district:1"].heat).toBe(2);
    expect(report).toMatchObject({
      buildingActionId: "extract_losses",
      recyclingResult: {
        type: "salvage_recovery",
        salvageRatePct: 12,
        recoveredByCategory: {
          materials: 2,
          weapons: 2,
          defenseItems: 2
        },
        cleanCashCost: 900,
        heatGain: 2,
        noPopulationRecovery: true
      }
    });
  });

  it("rejects recycling extract losses when salvage pool is empty", () => {
    const { state, building } = createStateWithFixedBuilding("recycling_center", {
      playerBalances: {
        cash: 5000,
        "dirty-cash": 0
      }
    });

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "extract_losses"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("recycling_salvage_pool_empty");
  });

  it("caps collected production by warehouse storage capacity", () => {
    const { state, building } = createStateWithFixedBuilding("pharmacy", {
      productionResourceKey: "chemicals",
      productionStoredAmount: 20,
      playerBalances: {
        cash: 0,
        "dirty-cash": 0,
        chemicals: 345
      }
    });
    const warehouse = {
      ...building,
      id: "building:district-1:warehouse:1",
      buildingTypeId: "warehouse"
    };
    state.buildingsById[warehouse.id] = warehouse;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: [building.id, warehouse.id]
    };

    const result = applyCommand(
      state,
      createCollectProductionCommandFixture({
        id: "command:collect:warehouse-cap",
        payload: {
          districtId: "district:1",
          buildingId: building.id
        }
      }),
      context
    );

    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:1"].balances.chemicals).toBe(350);
    expect(result.nextState.resourceStatesById[`resource:${building.id}`].balances.chemicals).toBe(15);
  });

  it("stores smuggling tunnel dirty cash locally and collects the batch with heat", () => {
    const { state, building } = createStateWithFixedBuilding("smuggling_tunnel", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0,
        influence: 0
      },
      metadata: {
        smugglingTunnel: {
          storedDirtyCash: 0,
          lastUpdatedTick: 0
        }
      }
    });
    state.root.tick = 250;

    const produced = collectIncome(state, context);
    const producedBuilding = produced.buildingsById[building.id];
    const smugglingMetadata = producedBuilding.metadata?.smugglingTunnel as { storedDirtyCash?: number } | undefined;
    const storedDirtyCash = Number(smugglingMetadata?.storedDirtyCash ?? 0);

    expect(produced.resourceStatesById["resource:1"].balances.cash).toBe(0);
    expect(produced.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(0);
    expect(storedDirtyCash).toBeGreaterThanOrEqual(300);
    expect(storedDirtyCash).toBeLessThanOrEqual(2500);
    expect(produced.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(produced.districtsById["district:1"].influence).toBe(0);

    const result = applyCommand(
      produced,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "collect_smuggling_batch"
        }
      }),
      context
    );
    const report = createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(Math.floor(storedDirtyCash));
    expect(result.nextState.buildingsById[building.id].metadata?.smugglingTunnel).toMatchObject({
      storedDirtyCash: 0,
      wasFull: false
    });
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(0);
    expect(result.nextState.resourceStatesById["resource:1"].balances.influence).toBe(0);
    expect(result.nextState.districtsById["district:1"].influence).toBe(0);
    expect(report).toMatchObject({
      reportType: "building-action",
      buildingActionId: "collect_smuggling_batch",
      smugglingTunnelResult: {
        type: "collect_dirty_cash",
        collectedDirtyCash: Math.floor(storedDirtyCash)
      }
    });
  });

  it("adds real district defense from non-production building actions", () => {
    const { state, building } = createStateWithFixedBuilding("court");

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "court_case_pressure"
        }
      }),
      context
    );
    const report = createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:1"].defenseLoadout).toMatchObject({
      cameras: 1,
      alarm: 1
    });
    expect(report).toMatchObject({
      reportType: "building-action",
      buildingActionId: "court_case_pressure",
      defenseAdded: {
        cameras: 1,
        alarm: 1
      }
    });
  });

  it("activates smuggling tunnel silent channel and blocks stacking while active", () => {
    const { state, building } = createStateWithFixedBuilding("smuggling_tunnel", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 1000
      }
    });

    const first = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:smuggling:silent:1",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "silent_channel"
        }
      }),
      context
    );
    const second = applyCommand(
      first.nextState,
      createRunBuildingActionCommandFixture({
        id: "command:smuggling:silent:2",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "silent_channel"
        }
      }),
      context
    );
    const report = createConflictReportViews(first.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(first.errors).toEqual([]);
    expect(first.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(400);
    expect(first.nextState.buildingsById[building.id].metadata?.smugglingTunnel).toMatchObject({
      silentChannelExpiresAtTick: 96
    });
    expect(first.nextState.buildingsById[building.id].actionCooldowns.silent_channel).toBe(192);
    expect(second.errors.map((error) => error.code)).toContain("building_action_cooldown");
    expect(second.errors.map((error) => error.code)).toContain("smuggling_tunnel_silent_channel_active");
    expect(report).toMatchObject({
      reportType: "building-action",
      buildingActionId: "silent_channel",
      smugglingTunnelResult: {
        type: "dirty_cash_boost_risk",
        raidChancePct: 12
      }
    });
  });

  it("runs Strip Club as networked cash, influence, heat, and rumor building without laundering", () => {
    const { state, building } = createStateWithFixedBuilding("strip_club", {
      id: "building:district-1:strip_club:1",
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      }
    });
    const secondClub = {
      ...building,
      id: "building:district-2:strip_club:2",
      districtId: "district:2"
    };
    state.buildingsById[secondClub.id] = secondClub;
    state.districtsById["district:2"] = createDistrictFixture({
      id: "district:2",
      buildingIds: [secondClub.id],
      ownerPlayerId: "player:1"
    });
    state.root.districtIds.push("district:2");

    const result = collectIncome(state, context);

    expect(result.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(0);
    expect(result.resourceStatesById["resource:1"].balances["dirty-cash"]).toBeGreaterThan(0);
    expect(result.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(result.districtsById["district:1"].influence).toBeGreaterThan(0);
    expect(context.config.balance.stripClub?.noLaundering).toBe(true);
    expect(context.config.balance.stripClub?.noAuditRisk).toBe(true);
  });

  it("runs Restaurant as passive clean, influence, heat, and rumor building without dirty cash or actions", () => {
    const { state, building } = createStateWithFixedBuilding("restaurant", {
      id: "building:district-1:restaurant:1",
      playerBalances: {
        cash: 0,
        "dirty-cash": 0,
        influence: 0
      }
    });
    const secondRestaurant = {
      ...building,
      id: "building:district-2:restaurant:2",
      districtId: "district:2"
    };
    state.buildingsById[secondRestaurant.id] = secondRestaurant;
    state.districtsById["district:2"] = createDistrictFixture({
      id: "district:2",
      buildingIds: [secondRestaurant.id],
      ownerPlayerId: "player:1"
    });
    state.root.districtIds.push("district:2");

    const result = collectIncome(state, context);

    expect(result.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(0);
    expect(result.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(0);
    expect(result.resourceStatesById["resource:1"].balances.influence).toBe(0);
    expect(result.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(result.districtsById["district:1"].influence).toBeGreaterThan(0);
    expect(context.config.balance.restaurant).toMatchObject({
      noSpecialActions: true,
      noLaundering: true,
      noAuditRisk: true,
      dirtyCashPerMinute: 0
    });
    expect((context.config.balance.buildingActions ?? {}).restaurant_collect_revenue).toBeUndefined();
  });

  it("generates Restaurant passive rumors without reliability visibility", () => {
    const rumorContext = {
      config: {
        ...context.config,
        balance: {
          ...context.config.balance,
          restaurant: context.config.balance.restaurant
            ? {
                ...context.config.balance.restaurant,
                baseRumorChancePct: 100
              }
            : undefined
        }
      }
    };
    const { state, building } = createStateWithFixedBuilding("restaurant", {
      metadata: {
        restaurant: {
          lastPassiveRumorCheckTick: 0,
          rumorEvents: []
        }
      }
    });
    state.root.tick = 120;
    let result = state;
    for (let tick = 120; tick <= 4000; tick += 120) {
      result = {
        ...result,
        root: {
          ...result.root,
          tick
        }
      };
      result = collectIncome(result, rumorContext);
      const events = result.buildingsById[building.id].metadata?.restaurant
        && Array.isArray((result.buildingsById[building.id].metadata?.restaurant as { rumorEvents?: unknown[] }).rumorEvents)
        ? (result.buildingsById[building.id].metadata?.restaurant as { rumorEvents: unknown[] }).rumorEvents
        : [];
      if (events.length > 0) {
        break;
      }
    }

    const metadata = result.buildingsById[building.id].metadata?.restaurant as { rumorEvents?: Array<Record<string, unknown>> } | undefined;
    expect(metadata?.rumorEvents?.length).toBeGreaterThan(0);
    expect(metadata?.rumorEvents?.[0]?.reliabilityVisible).toBe(false);
    expect(metadata?.rumorEvents?.[0]?.text).not.toContain("Spolehlivost:");
  });

  it("runs Convenience Store as passive street cash, influence, heat, and rumor building without actions", () => {
    const { state, building } = createStateWithFixedBuilding("convenience_store", {
      id: "building:district-1:convenience_store:1",
      playerBalances: {
        cash: 0,
        "dirty-cash": 0,
        influence: 0
      }
    });
    const secondStore = {
      ...building,
      id: "building:district-2:convenience_store:2",
      districtId: "district:2"
    };
    state.buildingsById[secondStore.id] = secondStore;
    state.districtsById["district:2"] = createDistrictFixture({
      id: "district:2",
      buildingIds: [secondStore.id],
      ownerPlayerId: "player:1"
    });
    state.root.districtIds.push("district:2");

    const result = collectIncome(state, context);

    expect(result.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(0);
    expect(result.resourceStatesById["resource:1"].balances["dirty-cash"]).toBeGreaterThan(0);
    expect(result.resourceStatesById["resource:1"].balances.influence).toBe(0);
    expect(result.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(result.districtsById["district:1"].influence).toBeGreaterThan(0);
    expect(context.config.balance.convenienceStore).toMatchObject({
      noSpecialActions: true,
      noLaundering: true,
      noAuditRisk: true,
      dirtyCashPerMinute: 18
    });
    expect((context.config.balance.buildingActions ?? {}).convenience_street_info).toBeUndefined();
  });

  it("generates Convenience Store passive rumors with restaurant synergy and without reliability visibility", () => {
    const rumorContext = {
      config: {
        ...context.config,
        balance: {
          ...context.config.balance,
          convenienceStore: context.config.balance.convenienceStore
            ? {
                ...context.config.balance.convenienceStore,
                baseRumorChancePct: 100
              }
            : undefined
        }
      }
    };
    const { state, building } = createStateWithFixedBuilding("convenience_store", {
      metadata: {
        convenienceStore: {
          lastPassiveRumorCheckTick: 0,
          rumorEvents: []
        }
      }
    });
    state.root.tick = 120;
    for (let index = 1; index <= 10; index += 1) {
      state.buildingsById[`building:restaurant:${index}`] = {
        ...building,
        id: `building:restaurant:${index}`,
        buildingTypeId: "restaurant",
        districtId: `district:restaurant:${index}`
      };
    }

    let result = state;
    for (let tick = 120; tick <= 4000; tick += 120) {
      result = {
        ...result,
        root: {
          ...result.root,
          tick
        }
      };
      result = collectIncome(result, rumorContext);
      const events = result.buildingsById[building.id].metadata?.convenienceStore
        && Array.isArray((result.buildingsById[building.id].metadata?.convenienceStore as { rumorEvents?: unknown[] }).rumorEvents)
        ? (result.buildingsById[building.id].metadata?.convenienceStore as { rumorEvents: unknown[] }).rumorEvents
        : [];
      if (events.length > 0) {
        break;
      }
    }

    const metadata = result.buildingsById[building.id].metadata?.convenienceStore as { rumorEvents?: Array<Record<string, unknown>> } | undefined;
    expect(metadata?.rumorEvents?.length).toBeGreaterThan(0);
    expect(metadata?.rumorEvents?.[0]?.reliabilityVisible).toBe(false);
    expect(metadata?.rumorEvents?.[0]?.text).not.toContain("Spolehlivost:");
  });

  it("activates Strip Club VIP lounge and blocks stacking while active", () => {
    const { state, building } = createStateWithFixedBuilding("strip_club", {
      playerBalances: {
        cash: 5000,
        "dirty-cash": 0
      }
    });
    const first = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:strip:vip:1",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "vip_lounge"
        }
      }),
      context
    );
    const second = applyCommand(
      first.nextState,
      createRunBuildingActionCommandFixture({
        id: "command:strip:vip:2",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "vip_lounge"
        }
      }),
      context
    );

    expect(first.errors).toEqual([]);
    expect(first.nextState.resourceStatesById["resource:1"].balances.cash).toBe(4200);
    expect(first.nextState.buildingsById[building.id].metadata?.stripClub).toMatchObject({
      vipLoungeExpiresAtTick: 96
    });
    expect(second.errors.map((error) => error.code)).toContain("building_action_cooldown");
    expect(second.errors.map((error) => error.code)).toContain("strip_club_vip_lounge_active");
  });

  it("runs bar whispers as an immediate probabilistic rumor without probability visibility", () => {
    const { state, building } = createStateWithFixedBuilding("strip_club", {
      playerBalances: {
        cash: 1000,
        "dirty-cash": 0
      }
    });
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      influence: 30
    };
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:strip:bar",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "bar_whispers"
        }
      }),
      context
    );
    const report = createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:1"].heat).toBe(2);
    expect(result.nextState.districtsById["district:1"].influence).toBe(5);
    expect(report).toMatchObject({
      buildingActionId: "bar_whispers",
      stripClubResult: {
        type: "rumor_generation",
        rumor: {
          probabilityVisible: false
        }
      }
    });
  });

  it("runs private party with influence boost and scandal fallout when the roll hits", () => {
    const { state, building } = createStateWithFixedBuilding("strip_club", {
      playerBalances: {
        cash: 5000,
        "dirty-cash": 0
      }
    });

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:strip:party:19",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "private_party"
        }
      }),
      context
    );
    const report = createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(3500);
    expect(result.nextState.districtsById["district:1"].heat).toBe(16);
    expect(result.nextState.districtsById["district:1"].influence).toBe(4);
    expect(result.nextState.buildingsById[building.id].metadata?.stripClub).toMatchObject({
      privatePartyExpiresAtTick: 120,
      scandalEvents: expect.any(Array)
    });
    expect(report).toMatchObject({
      buildingActionId: "private_party",
      stripClubResult: {
        type: "influence_contact_event",
        scandal: true
      }
    });
  });

  it("runs Power Station as clean-only infrastructure support with no energy resource", () => {
    const { state, building } = createStateWithFixedBuilding("power_station", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0,
        influence: 0,
        energy: 0,
        "power-capacity": 0
      }
    });
    const secondStation = {
      ...building,
      id: "building:district-2:power_station:2",
      districtId: "district:2"
    };
    state.buildingsById[secondStation.id] = secondStation;
    state.districtsById["district:2"] = createDistrictFixture({
      id: "district:2",
      buildingIds: [secondStation.id],
      ownerPlayerId: "player:1"
    });
    state.root.districtIds.push("district:2");

    const result = collectIncome(state, context);
    const balances = result.resourceStatesById["resource:1"].balances;

    expect(balances.cash).toBeGreaterThan(0);
    expect(balances["dirty-cash"]).toBe(0);
    expect(balances.influence).toBe(0);
    expect(balances.energy).toBe(0);
    expect(balances["power-capacity"]).toBe(0);
    expect(result.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(result.districtsById["district:1"].influence).toBe(0);
    expect(context.config.balance.powerStation?.noEnergyResource).toBe(true);
    expect(context.config.balance.powerStation?.noPowerCapacity).toBe(true);
    expect(context.config.balance.powerStation?.noLaundering).toBe(true);
    expect(context.config.balance.powerStation?.noAuditRisk).toBe(true);
  });

  it("activates backup grid switch and blocks stacking while active", () => {
    const { state, building } = createStateWithFixedBuilding("power_station", {
      playerBalances: {
        cash: 5000,
        "dirty-cash": 0
      }
    });
    const first = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:power:backup:1",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "backup_grid_switch"
        }
      }),
      context
    );
    const second = applyCommand(
      first.nextState,
      createRunBuildingActionCommandFixture({
        id: "command:power:backup:2",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "backup_grid_switch"
        }
      }),
      context
    );
    const report = createConflictReportViews(first.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(first.errors).toEqual([]);
    expect(first.nextState.resourceStatesById["resource:1"].balances.cash).toBe(3800);
    expect(first.nextState.districtsById["district:1"].heat).toBe(3);
    expect(first.nextState.districtsById["district:1"].influence).toBe(0);
    expect(first.nextState.buildingsById[building.id].metadata?.powerStation).toMatchObject({
      backupGridSwitchExpiresAtTick: 96
    });
    expect(first.nextState.buildingsById[building.id].actionCooldowns.backup_grid_switch).toBe(212);
    expect(second.errors.map((error) => error.code)).toContain("building_action_cooldown");
    expect(second.errors.map((error) => error.code)).toContain("power_station_backup_grid_active");
    expect(report).toMatchObject({
      buildingActionId: "backup_grid_switch",
      powerStationResult: {
        type: "infrastructure_defense_boost",
        temporaryInfrastructureBonusPct: 12
      }
    });
  });

  it("applies Power Station infrastructure bonus to factory production", () => {
    const { state, building } = createStateWithFixedBuilding("factory", {
      id: "building:district-1:factory:1",
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      }
    });
    state.resourceStatesById[`resource:${building.id}`] = createResourceStateFixture({
      id: `resource:${building.id}`,
      ownerType: "building",
      ownerId: building.id,
      balances: {
        "metal-parts": 0
      },
      lastUpdatedTick: 0
    });
    for (let index = 1; index <= 5; index += 1) {
      state.buildingsById[`building:power:${index}`] = {
        ...building,
        id: `building:power:${index}`,
        buildingTypeId: "power_station",
        districtId: "district:1"
      };
    }
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: [building.id, ...Array.from({ length: 5 }, (_value, index) => `building:power:${index + 1}`)]
    };
    state.root.tick = 1;

    const productionState = completeProduction(state, context);

    expect(productionState.resourceStatesById[`resource:${building.id}`].balances["metal-parts"]).toBe(5);
  });
});
