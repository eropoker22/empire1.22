import { describe, expect, it } from "vitest";
import { applyCommand, buyResource, calculateMarketPrice, collectIncome, completeProduction, createCityFeedProjection, createConflictReportViews, runTick } from "@empire/game-core";
import { getAllPublicBuildingDefinitions, getPublicBuildingCatalog, resolveDistrictBuildingTypes, resolveModeConfig } from "@empire/game-config";
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

const MAFIAN_HEAT_GAIN_MULTIPLIER = 0.96;

const mafianHeat = (baseHeat: number): number => baseHeat * MAFIAN_HEAT_GAIN_MULTIPLIER;
const mafianIllegalHeat = (baseHeat: number): number => Math.floor(baseHeat * MAFIAN_HEAT_GAIN_MULTIPLIER);
const ticksForMs = (ms: number): number => Math.ceil(ms / context.config.tickRateMs);
const cooldownTicksForMs = (ms: number): number =>
  Math.ceil(ticksForMs(ms) * context.config.balance.cooldownMultiplier);

const expectMafianHeat = (actual: number, baseHeat: number): void => {
  expect(actual).toBeCloseTo(mafianHeat(baseHeat), 5);
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
    const downtownCountByType: Record<string, number> = {
      court: 2,
      central_bank: 3,
      lobby_club: 2,
      city_hall: 1,
      stock_exchange: 1,
      vip_lounge: 3
    };

    expect(definitions).not.toHaveLength(0);
    for (const definition of definitions) {
      const expectedDowntownCount = downtownCountByType[definition.buildingTypeId];
      if (expectedDowntownCount !== undefined) {
        expect(definition.nameVariants).toHaveLength(expectedDowntownCount);
      }
      expect(fixedBuildings[definition.buildingTypeId]).toMatchObject(definition.stats);
      if (definition.buildingTypeId === "apartment_block" || definition.buildingTypeId === "school") {
        expect(definition.stats).toMatchObject({
          cleanPerHour: definition.buildingTypeId === "school" ? 1080 : 0,
          dirtyPerHour: 0,
          heatPerDay: 0,
          influencePerDay: definition.buildingTypeId === "school" ? 72 : 0
        });
      } else {
        expect(definition.stats.heatPerDay).toBeGreaterThan(0);
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

  it("keeps downtown map building counts fixed for free mode", () => {
    const downtownDistrictIds = ["79", "80", "81", "82", "83", "58", "57", "59"];
    const counts = downtownDistrictIds
      .flatMap((districtId) => resolveDistrictBuildingTypes({ districtId, zone: "downtown" }))
      .reduce<Record<string, number>>((collection, buildingTypeId) => {
        collection[buildingTypeId] = (collection[buildingTypeId] ?? 0) + 1;
        return collection;
      }, {});

    expect(Object.keys(counts).sort()).toEqual([
      "airport",
      "central_bank",
      "city_hall",
      "court",
      "lobby_club",
      "parliament",
      "port",
      "stock_exchange",
      "vip_lounge"
    ]);
    expect(counts).toMatchObject({
      court: 2,
      central_bank: 2,
      lobby_club: 2,
      city_hall: 1,
      stock_exchange: 1,
      vip_lounge: 2,
      airport: 1,
      port: 1,
      parliament: 1
    });
  });

  it("collects clean money, dirty money, heat, and influence from fixed buildings on income ticks", () => {
    const { state } = createStateWithFixedBuilding("central_bank", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      }
    });
    const result = collectIncome(state, context);
    const clinicBalance = context.config.balance.fixedBuildings?.clinic;

    expect(clinicBalance?.cleanPerHour).toBe(3100);
    expect(clinicBalance?.dirtyPerHour).toBe(0);
    expect(clinicBalance?.heatPerDay).toBeCloseTo(85, 5);
    expect(clinicBalance?.influencePerDay).toBe(0);
    expect(result.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(0);
    expect(result.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(0);
    expect(result.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(result.districtsById["district:1"].influence).toBeGreaterThan(0);
  });

  it("keeps street dealers dirty-only passives and completes global drug sale slots", () => {
    const { state, building } = createStateWithFixedBuilding("street_dealers", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0,
        "neon-dust": 12
      }
    });
    const passive = collectIncome(state, context);

    expect(passive.resourceStatesById["resource:1"].balances.cash ?? 0).toBe(0);
    expect(passive.resourceStatesById["resource:1"].balances["dirty-cash"]).toBeGreaterThan(0);
    expect(passive.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(passive.districtsById["district:1"].influence).toBe(0);

    const saleContext = {
      config: {
        ...context.config,
        balance: {
          ...context.config.balance,
          fixedBuildings: {
            ...(context.config.balance.fixedBuildings ?? {}),
            street_dealers: {
              cleanPerHour: 0,
              dirtyPerHour: 0,
              heatPerDay: 0,
              influencePerDay: 0,
              maxLevel: 1
            }
          },
          streetDealers: {
            ...context.config.balance.streetDealers!,
            streetIncidents: {
              ...context.config.balance.streetDealers!.streetIncidents,
              maxStreetRiskPct: 0
            }
          }
        }
      }
    };
    const started = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:street-dealers:start",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "start_drug_sale",
          dealerSlotId: "slot-1",
          itemId: "neonDust",
          amount: 10
        }
      }),
      saleContext
    );

    expect(started.errors).toEqual([]);
    expect(started.nextState.resourceStatesById["resource:1"].balances["neon-dust"]).toBe(2);
    expect(started.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(0);
    expect(started.nextState.districtsById["district:1"].heat).toBe(0);
    expect(started.nextState.playersById["player:1"].metadata?.streetDealers).toMatchObject({
      slots: [
        {
          slotId: "slot-1",
          itemId: "neon-dust",
          amount: 10,
          rewardDirtyCash: 6250,
          heatGain: 26,
          streetRiskPct: 0
        }
      ]
    });

    let completedState = started.nextState;
    for (let index = 0; index < 48; index += 1) {
      completedState = runTick(completedState, saleContext).nextState;
    }
    const completedBalances = completedState.resourceStatesById["resource:1"].balances;
    const completedReport = createConflictReportViews(completedState, { playerId: "player:1", limit: 1 })[0];

    expect(completedBalances["dirty-cash"]).toBe(6250);
    expect(completedBalances.cash ?? 0).toBe(0);
    expect(completedState.districtsById["district:1"].heat).toBe(26);
    expect(completedState.districtsById["district:1"].influence).toBe(0);
    expect(completedState.playersById["player:1"].population ?? 0).toBe(0);
    expect(completedState.playersById["player:1"].metadata?.streetDealers).toMatchObject({
      slots: [],
      saleHistory: [
        {
          type: "sale_completed",
          slotId: "slot-1",
          itemId: "neon-dust",
          rewardDirtyCash: 6250,
          heatGain: 26
        }
      ]
    });
    expect(completedReport).toMatchObject({
      buildingActionId: "start_drug_sale",
      streetDealerResult: {
        type: "sale_completed",
        rewardDirtyCash: 6250,
        heatGain: 26
      }
    });
  });

  it("rejects removed Street Dealer shortcuts, fractional amounts, and strategic components", () => {
    const { state, building } = createStateWithFixedBuilding("street_dealers", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0,
        biomass: 3,
        "neon-dust": 4,
        "ghost-serum": 2
      }
    });
    const run = (id: string, actionId: string, payload: Record<string, unknown> = {}) => applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id,
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId,
          ...payload
        }
      }),
      context
    );
    const hotCash = run("command:street-dealers:hot-cash", "street_dealers_collect_hot_cash");
    const stash = run("command:street-dealers:stash", "street_dealers_move_stash");
    const fractional = run("command:street-dealers:fractional", "start_drug_sale", {
      dealerSlotId: "slot-1",
      itemId: "neon-dust",
      amount: 1.5
    });
    const strategic = run("command:street-dealers:strategic", "start_drug_sale", {
      dealerSlotId: "slot-1",
      itemId: "ghost-serum",
      amount: 1
    });

    expect(hotCash.errors.map((error) => error.code)).toContain("building_action_not_found");
    expect(stash.errors.map((error) => error.code)).toContain("building_action_not_found");
    expect(fractional.errors.map((error) => error.code)).toContain("street_dealers_invalid_amount");
    expect(strategic.errors.map((error) => error.code)).toContain("street_dealers_slot_product_mismatch");
    for (const result of [hotCash, stash, fractional, strategic]) {
      expect(result.nextState.resourceStatesById["resource:1"].balances).toMatchObject({
        "dirty-cash": 0,
        biomass: 3,
        "neon-dust": 4,
        "ghost-serum": 2
      });
    }
  });

  it("applies smuggling tunnel Pouliční dealeři bonuses to street dealer sale previews", () => {
    const { state, building } = createStateWithFixedBuilding("street_dealers", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0,
        "neon-dust": 12
      }
    });
    const smugglingTunnelIds = Array.from({ length: 5 }, (_, index) => {
      const tunnel = createFixedBuildingFixture("smuggling_tunnel", {
        id: `building:district-1:smuggling_tunnel:${index + 1}`
      });
      state.buildingsById[tunnel.id] = tunnel;
      return tunnel.id;
    });
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: [building.id, ...smugglingTunnelIds]
    };

    const started = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:street-dealers:tunnel-support",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "start_drug_sale",
          dealerSlotId: "slot-1",
          itemId: "neonDust",
          amount: 10
        }
      }),
      context
    );

    expect(started.errors).toEqual([]);
    expect(started.nextState.playersById["player:1"].metadata?.streetDealers).toMatchObject({
      slots: [
        {
          slotId: "slot-1",
          itemId: "neon-dust",
          amount: 10,
          rewardDirtyCash: 6250,
          completesAtTick: 45
        }
      ]
    });
  });

  it("keeps stock exchange clean-only passives and runs market control actions", () => {
    const { state, building } = createStateWithFixedBuilding("stock_exchange", {
      playerBalances: {
        cash: 20000,
        "dirty-cash": 300
      }
    });
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      influence: 25
    };
    const passive = collectIncome(state, context);

    expect(passive.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(0);
    expect(passive.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(300);
    expect(passive.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(passive.districtsById["district:1"].influence).toBeGreaterThan(25);

    const speculation = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:stock:speculation",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "speculative_buy",
          targetCategory: "materials",
          investmentCleanCash: 4000
        }
      }),
      context
    );
    const speculationReport = createConflictReportViews(speculation.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(speculation.errors).toEqual([]);
    expect(speculation.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(300);
    expectMafianHeat(speculation.nextState.districtsById["district:1"].heat, 5);
    expect(speculation.nextState.buildingsById[building.id].metadata?.stockExchange).toMatchObject({
      actionHistory: [{ actionId: "speculative_buy", category: "materials" }],
      riskEvents: [{ actionId: "speculative_buy", riskPct: 6 }]
    });
    expect(speculationReport).toMatchObject({
      buildingActionId: "speculative_buy",
      stockExchangeResult: {
        type: "speculative_buy",
        category: "materials",
        investmentCleanCash: 4000
      }
    });

    const pressureState = {
      ...state,
      buildingsById: {
        ...state.buildingsById,
        [building.id]: {
          ...building,
          actionCooldowns: {}
        }
      }
    };
    const beforeNormalMetal = calculateMarketPrice({ ...pressureState, config: context.config }, "metal-parts", "normal").finalPrice;
    const beforeBlackMetal = calculateMarketPrice({ ...pressureState, config: context.config }, "metal-parts", "black").finalPrice;
    const pressure = applyCommand(
      pressureState,
      createRunBuildingActionCommandFixture({
        id: "command:stock:pressure",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "market_pressure",
          targetCategory: "materials",
          mode: "pump"
        }
      }),
      context
    );
    const afterNormalMetal = calculateMarketPrice({ ...pressure.nextState, config: context.config }, "metal-parts", "normal").finalPrice;
    const afterBlackMetal = calculateMarketPrice({ ...pressure.nextState, config: context.config }, "metal-parts", "black").finalPrice;

    expect(pressure.errors).toEqual([]);
    expect(pressure.nextState.resourceStatesById["resource:1"].balances.cash).toBe(17000);
    expect(pressure.nextState.districtsById["district:1"].influence).toBe(10);
    expectMafianHeat(pressure.nextState.districtsById["district:1"].heat, 8);
    expect(pressure.nextState.buildingsById[building.id].metadata?.stockExchange).toMatchObject({
      marketEffects: [
        {
          category: "materials",
          mode: "pump",
          regularPriceModifierPct: 12,
          blackMarketPriceModifierPct: 4.8
        }
      ]
    });
    expect(afterNormalMetal).toBeGreaterThan(beforeNormalMetal);
    expect(afterBlackMetal).toBeGreaterThan(beforeBlackMetal);
    expect(Object.values(pressure.nextState.cityFeedEventsById).some((event) =>
      event.message === "Downtown burza rozkolísala ceny v kategorii materials."
    )).toBe(false);

    const insiderState = {
      ...state,
      buildingsById: {
        ...state.buildingsById,
        [building.id]: {
          ...building,
          actionCooldowns: {}
        }
      }
    };
    const insider = applyCommand(
      insiderState,
      createRunBuildingActionCommandFixture({
        id: "command:stock:insider",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "insider_window"
        }
      }),
      context
    );

    expect(insider.errors).toEqual([]);
    expect(insider.nextState.resourceStatesById["resource:1"].balances.cash).toBe(18500);
    expectMafianHeat(insider.nextState.districtsById["district:1"].heat, 4);
    expect(insider.nextState.buildingsById[building.id].metadata?.stockExchange).toMatchObject({
      insiderWindowExpiresAtTick: 72,
      riskEvents: [{ actionId: "insider_window", riskPct: 10 }]
    });
  });

  it("keeps central bank clean-only passives and runs reserve actions", () => {
    const { state, building } = createStateWithFixedBuilding("central_bank", {
      playerBalances: {
        cash: 10000,
        "dirty-cash": 300
      }
    });
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      influence: 60
    };
    const passive = collectIncome(state, context);

    expect(passive.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(10000);
    expect(passive.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(300);
    expect(passive.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(passive.districtsById["district:1"].influence).toBeGreaterThan(60);

    const liquidity = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:central-bank:liquidity",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "liquidity_injection"
        }
      }),
      context
    );
    const liquidityReport = createConflictReportViews(liquidity.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(liquidity.errors).toEqual([]);
    expect(liquidity.nextState.resourceStatesById["resource:1"].balances.cash).toBe(12500);
    expect(liquidity.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(300);
    expectMafianHeat(liquidity.nextState.districtsById["district:1"].heat, 4);
    expect(liquidity.nextState.districtsById["district:1"].influence).toBe(40);
    expect(liquidity.nextState.buildingsById[building.id].metadata?.centralBank).toMatchObject({
      riskEvents: [{ actionId: "liquidity_injection", riskPct: 6 }]
    });
    expect(liquidityReport).toMatchObject({
      buildingActionId: "liquidity_injection",
      centralBankResult: {
        type: "liquidity_injection",
        rewardCleanCash: 2500
      }
    });

    const frozenState = {
      ...state,
      buildingsById: {
        ...state.buildingsById,
        [building.id]: {
          ...building,
          actionCooldowns: {}
        }
      }
    };
    const frozen = applyCommand(
      frozenState,
      createRunBuildingActionCommandFixture({
        id: "command:central-bank:frozen",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "frozen_accounts"
        }
      }),
      context
    );

    expect(frozen.errors).toEqual([]);
    expect(frozen.nextState.resourceStatesById["resource:1"].balances.cash).toBe(8000);
    expect(frozen.nextState.buildingsById[building.id].metadata?.centralBank).toMatchObject({
      frozenAccountsExpiresAtTick: 96,
      riskEvents: [{ actionId: "frozen_accounts", riskPct: 8 }]
    });

    const intervention = applyCommand(
      frozenState,
      createRunBuildingActionCommandFixture({
        id: "command:central-bank:intervention",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "currency_intervention",
          targetCategory: "materials"
        }
      }),
      context
    );

    expect(intervention.errors).toEqual([]);
    expect(intervention.nextState.resourceStatesById["resource:1"].balances.cash).toBe(7000);
    expect(intervention.nextState.districtsById["district:1"].influence).toBe(35);
    expect(intervention.nextState.buildingsById[building.id].metadata?.centralBank).toMatchObject({
      currencyInterventions: [{ category: "materials", volatilityReductionPct: 30, stockExchangeEffectReductionPct: 25 }],
      riskEvents: [{ actionId: "currency_intervention", riskPct: 12 }]
    });
  });

  it("runs Lobby Club as clean influence building with pressure actions and no dirty production", () => {
    const { state, building } = createStateWithFixedBuilding("lobby_club", {
      playerBalances: {
        cash: 5000,
        "dirty-cash": 300
      }
    });
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      influence: 80
    };
    const passive = collectIncome(state, context);

    expect(passive.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(5000);
    expect(passive.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(300);
    expect(passive.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(passive.districtsById["district:1"].influence).toBeGreaterThan(80);
    expect(context.config.balance.lobbyClub).toMatchObject({
      countOnMap: 2,
      zone: "downtown",
      noIntelPower: true,
      noDirtyCash: true,
      noPopulationProduction: true,
      noLaundering: true,
      noAuditRisk: true,
      dirtyCashPerMinute: 0,
      populationPerMinute: 0
    });

    const pressure = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:lobby:pressure",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "backroom_pressure"
        }
      }),
      context
    );
    const pressureReport = createConflictReportViews(pressure.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(pressure.errors).toEqual([]);
    expect(pressure.nextState.resourceStatesById["resource:1"].balances.cash).toBe(3800);
    expect(pressure.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(300);
    expectMafianHeat(pressure.nextState.districtsById["district:1"].heat, 3);
    expect(pressure.nextState.districtsById["district:1"].influence).toBe(55);
    expect(pressure.nextState.buildingsById[building.id].metadata?.lobbyClub).toMatchObject({
      backroomPressureExpiresAtTick: 96,
      riskEvents: [{ actionId: "backroom_pressure", riskPct: 8 }]
    });
    expect(pressure.nextState.buildingsById[building.id].actionCooldowns.backroom_pressure).toBe(192);
    expect(pressureReport).toMatchObject({
      buildingActionId: "backroom_pressure",
      lobbyClubResult: {
        type: "backroom_pressure",
        influenceProductionBonusPct: 18,
        influenceActionCostReductionPct: 10
      }
    });

    const quietState = {
      ...state,
      buildingsById: {
        ...state.buildingsById,
        [building.id]: {
          ...building,
          actionCooldowns: {}
        }
      }
    };
    const quiet = applyCommand(
      quietState,
      createRunBuildingActionCommandFixture({
        id: "command:lobby:quiet",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "quiet_negotiation"
        }
      }),
      context
    );

    expect(quiet.errors).toEqual([]);
    expect(quiet.nextState.resourceStatesById["resource:1"].balances.cash).toBe(3500);
    expect(quiet.nextState.districtsById["district:1"].influence).toBe(65);
    expect(quiet.nextState.buildingsById[building.id].metadata?.lobbyClub).toMatchObject({
      riskReductionExpiresAtTick: 96,
      nextInfluenceDiscountPct: 8,
      nextInfluenceDiscountExpiresAtTick: 96,
      riskEvents: [{ actionId: "quiet_negotiation", riskPct: 6 }]
    });

    const media = applyCommand(
      quietState,
      createRunBuildingActionCommandFixture({
        id: "command:lobby:media",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "media_screen"
        }
      }),
      context
    );

    expect(media.errors).toEqual([]);
    expect(media.nextState.resourceStatesById["resource:1"].balances.cash).toBe(3000);
    expect(media.nextState.districtsById["district:1"].influence).toBe(80);
    expectMafianHeat(media.nextState.districtsById["district:1"].heat, 4);
    expect(media.nextState.buildingsById[building.id].metadata?.lobbyClub).toMatchObject({
      mediaScreenExpiresAtTick: 96,
      riskEvents: [{ actionId: "media_screen", riskPct: 7 }]
    });
  });

  it("runs airport import, black charter, evacuation corridor, and import market discounts", () => {
    const airportContext = {
      config: {
        ...context.config,
        balance: {
          ...context.config.balance,
          airport: {
            ...context.config.balance.airport!,
            expressImport: {
              ...context.config.balance.airport!.expressImport,
              customsRiskPct: 0
            },
            customsInspection: {
              ...context.config.balance.airport!.customsInspection,
              passiveRiskPct: 0
            }
          }
        }
      }
    };
    const { state, building } = createStateWithFixedBuilding("airport", {
      playerBalances: {
        cash: 10000,
        "dirty-cash": 5000,
        "metal-parts": 0,
        chemicals: 0,
        biomass: 0,
        "tech-core": 0
      }
    });
    const warehouse = createFixedBuildingFixture("warehouse", {
      id: "building:district-1:warehouse:airport"
    });
    state.buildingsById[warehouse.id] = warehouse;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: [building.id, warehouse.id]
    };

    const passive = collectIncome(state, context);
    expect(passive.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(10000);
    expect(passive.resourceStatesById["resource:1"].balances["dirty-cash"]).toBeGreaterThan(5000);
    expect(passive.districtsById["district:1"].influence).toBeGreaterThan(0);

    const importStarted = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:airport:import",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "express_import",
          targetCategory: "materials"
        }
      }),
      airportContext
    );

    expect(importStarted.errors).toEqual([]);
    expect(importStarted.nextState.resourceStatesById["resource:1"].balances.cash).toBe(8000);
    expectMafianHeat(importStarted.nextState.districtsById["district:1"].heat, 6);
    expect(importStarted.nextState.buildingsById[building.id].metadata?.airport).toMatchObject({
      pendingImports: [{ category: "materials", completesAtTick: 18 }]
    });

    let completedState = importStarted.nextState;
    for (let index = 0; index < 18; index += 1) {
      completedState = runTick(completedState, airportContext).nextState;
    }
    const completedBalances = completedState.resourceStatesById["resource:1"].balances;
    expect(
      (completedBalances["metal-parts"] ?? 0)
      + (completedBalances.chemicals ?? 0)
      + (completedBalances.biomass ?? 0)
    ).toBeGreaterThan(0);
    expect(completedState.buildingsById[building.id].metadata?.airport).toMatchObject({
      pendingImports: [],
      lastImportShipment: {
        category: "materials",
        customsTriggered: false
      }
    });

    const nightStartTick = context.config.balance.dayNight?.phases.day.durationTicks ?? 1440;
    const nightState = {
      ...state,
      root: {
        ...state.root,
        tick: nightStartTick
      }
    };
    const charter = applyCommand(
      nightState,
      createRunBuildingActionCommandFixture({
        id: "command:airport:charter",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "black_charter"
        }
      }),
      context
    );
    expect(charter.errors).toEqual([]);
    expect(charter.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(2500);
    expect(charter.nextState.buildingsById[building.id].metadata?.airport).toMatchObject({
      blackCharterExpiresAtTick: nightStartTick + 96,
      blackCharterOffer: {
        discountPct: 6,
        purchaseCustomsRiskPct: 15
      }
    });

    const corridor = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:airport:corridor",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "evacuation_corridor"
        }
      }),
      context
    );
    expect(corridor.errors).toEqual([]);
    expect(corridor.nextState.resourceStatesById["resource:1"].balances.cash).toBe(8200);
    expect(corridor.nextState.buildingsById[building.id].metadata?.airport).toMatchObject({
      evacuationCorridorExpiresAtTick: 84
    });

    const marketState = {
      ...state,
      config: context.config,
      playersById: {
        "player:1": {
          id: "player:1",
          cleanCash: 10000,
          dirtyCash: 10000,
          resources: {}
        }
      },
      eventLog: [],
      rumors: []
    };
    const basePrice = calculateMarketPrice(marketState, "metal-parts", "normal").finalPrice;
    const bought = buyResource(marketState, marketState.playersById["player:1"], "metal-parts", 1, "normal", "cleanCash");
    expect(bought.success).toBe(true);
    expect(bought.shoppingMallDiscountPct).toBe(8);
    expect(bought.unitPrice).toBe(Math.ceil(basePrice * 0.92));
  });

  it("keeps city hall clean political and runs authority actions", () => {
    const { state, building } = createStateWithFixedBuilding("city_hall", {
      playerBalances: {
        cash: 10000,
        "dirty-cash": 900
      }
    });
    const restaurant = createFixedBuildingFixture("restaurant", {
      id: "building:district-1:restaurant:city-hall"
    });
    const school = createFixedBuildingFixture("school", {
      id: "building:district-1:school:city-hall"
    });
    state.buildingsById[restaurant.id] = restaurant;
    state.buildingsById[school.id] = school;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      influence: 100,
      buildingIds: [building.id, restaurant.id, school.id]
    };
    state.districtsById["district:2"] = createDistrictFixture({
      id: "district:2",
      ownerPlayerId: "player:1",
      name: "Second District"
    });
    state.root.districtIds.push("district:2");

    const passive = collectIncome(state, context);
    expect(passive.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(10000);
    expect(passive.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(900);
    expect(passive.districtsById["district:1"].influence).toBeGreaterThan(100);
    expect(passive.districtsById["district:1"].heat).toBeGreaterThan(0);

    const cover = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:city-hall:cover",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "official_cover",
          targetDistrictId: "district:1"
        }
      }),
      context
    );
    expect(cover.errors).toEqual([]);
    expect(cover.nextState.resourceStatesById["resource:1"].balances.cash).toBe(8500);
    expect(cover.nextState.districtsById["district:1"].influence).toBe(75);
    expectMafianHeat(cover.nextState.districtsById["district:1"].heat, 2);
    expect(cover.nextState.buildingsById[building.id].metadata?.cityHall).toMatchObject({
      officialCoverByDistrictId: {
        "district:1": {
          heatGainReductionPct: 35,
          policeControlChanceReductionPct: 20,
          rumorChanceReductionPct: 15,
          expiresAtTick: 96
        },
        "district:2": {
          heatGainReductionPct: 35,
          policeControlChanceReductionPct: 20,
          rumorChanceReductionPct: 15,
          expiresAtTick: 96
        }
      },
      riskEvents: [{ actionId: "official_cover", riskPct: 8 }]
    });

    const contract = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:city-hall:contract",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "city_contract"
        }
      }),
      context
    );
    const contractReport = createConflictReportViews(contract.nextState, { playerId: "player:1", limit: 1 })[0];
    expect(contract.errors).toEqual([]);
    expect(contract.nextState.resourceStatesById["resource:1"].balances.cash).toBe(11740);
    expect(contract.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(900);
    expect(contract.nextState.districtsById["district:1"].influence).toBe(80);
    expectMafianHeat(contract.nextState.districtsById["district:1"].heat, 3);
    expect(contractReport).toMatchObject({
      buildingActionId: "city_contract",
      cityHallResult: {
        type: "city_contract",
        legalBuildingCount: 2,
        rewardCleanCash: 1740,
        influenceCost: 20
      }
    });

    const decree = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:city-hall:decree",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "emergency_decree",
          mode: "suspended_checks"
        }
      }),
      context
    );
    expect(decree.errors).toEqual([]);
    expect(decree.nextState.resourceStatesById["resource:1"].balances.cash).toBe(7500);
    expect(decree.nextState.districtsById["district:1"].influence).toBe(60);
    expectMafianHeat(decree.nextState.districtsById["district:1"].heat, 8);
    expect(decree.nextState.buildingsById[building.id].metadata?.cityHall).toMatchObject({
      emergencyDecree: {
        modeId: "suspended_checks",
        expiresAtTick: 72
      },
      riskEvents: [{ actionId: "emergency_decree", riskPct: 12 }]
    });
  });

  it("keeps vip lounge as high-truth passive rumor building without intel power or contacts", () => {
    const vipContext = {
      config: {
        ...context.config,
        balance: {
          ...context.config.balance,
          vipLounge: {
            ...context.config.balance.vipLounge!,
            passiveRumor: {
              ...context.config.balance.vipLounge!.passiveRumor,
              baseChancePct: 100
            }
          }
        }
      }
    };
    const { state, building } = createStateWithFixedBuilding("vip_lounge", {
      playerBalances: {
        cash: 1000,
        "dirty-cash": 200
      }
    });
    const extraVipIds = Array.from({ length: 2 }, (_, index) => {
      const vip = createFixedBuildingFixture("vip_lounge", {
        id: `building:district-1:vip_lounge:${index + 2}`
      });
      state.buildingsById[vip.id] = vip;
      return vip.id;
    });
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: [building.id, ...extraVipIds]
    };

    const passive = collectIncome(state, vipContext);
    expect(passive.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(1000);
    expect(passive.resourceStatesById["resource:1"].balances["dirty-cash"]).toBeGreaterThan(200);
    expect(passive.districtsById["district:1"].influence).toBeGreaterThan(0);
    expect(passive.districtsById["district:1"].heat).toBeGreaterThan(0);

    let rumorState = state;
    for (let index = 0; index < 50; index += 1) {
      rumorState = runTick(rumorState, vipContext).nextState;
    }
    expect(rumorState.buildingsById[building.id].metadata?.vipLounge).toMatchObject({
      rumorEvents: [
        {
          truthChancePct: 86
        }
      ]
    });
    expect(rumorState.buildingsById[building.id].metadata?.vipLounge).not.toHaveProperty("contacts");
  });

  it("runs a valid fixed building action and updates resources, district heat, influence, cooldown, and report", () => {
    const { state, building } = createStateWithFixedBuilding("port");
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "port_container_cut"
        }
      }),
      context
    );

    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:1"].balances["metal-parts"]).toBeGreaterThan(8);
    expect(result.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBeGreaterThan(250);
    expect(result.nextState.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(result.nextState.districtsById["district:1"].influence).toBeGreaterThan(0);
    expect(result.nextState.buildingsById[building.id].actionCooldowns.port_container_cut).toBeGreaterThan(0);
    expect(Object.values(result.nextState.notificationsById).some((notification) => notification.category === "report.building-action")).toBe(true);
  });

  it("rejects an action when the building is not fixed in the district", () => {
    const { state, building } = createStateWithFixedBuilding("port");
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
          actionId: "port_container_cut"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("building_not_in_district");
  });

  it("rejects an action for the wrong building type", () => {
    const { state, building } = createStateWithFixedBuilding("drug_lab");
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "port_container_cut"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("building_action_type_mismatch");
  });

  it("rejects an action blocked by building cooldown", () => {
    const { state, building } = createStateWithFixedBuilding("port", {
      actionCooldowns: {
        port_container_cut: 3
      }
    });
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "port_container_cut"
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

  it("runs casino bribed inspector with the configured cost and cooldown", () => {
    const { state, building } = createStateWithFixedBuilding("casino", {
      playerBalances: {
        cash: 15000,
        "dirty-cash": 250
      }
    });
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:casino:bribed-inspector",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "bribed_inspector"
        }
      }),
      context
    );
    const balances = result.nextState.resourceStatesById["resource:1"].balances;
    const report = createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(result.errors).toEqual([]);
    expect(balances.cash).toBe(0);
    expect(result.nextState.buildingsById[building.id].actionCooldowns.bribed_inspector).toBe(
      cooldownTicksForMs(105 * 60 * 1000)
    );
    expect(report).toMatchObject({
      casinoResult: {
        type: "heat_control",
        costPaid: 15000
      }
    });
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
    expect(balances.cash).toBe(1965);
    expectMafianHeat(result.nextState.districtsById["district:1"].heat, 9);
    expect(result.nextState.districtsById["district:1"].influence).toBe(3);
    expect(result.nextState.buildingsById[building.id].metadata?.casino).toMatchObject({
      launderedEvents: [{ tick: 0, amount: 2400 }]
    });
    expect(report).toMatchObject({
      casinoResult: {
        launderedDirtyCash: 2400,
        cleanCashGained: 1965,
        feePaid: 435,
        heatGain: mafianHeat(9)
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
    const nightStartTick = context.config.balance.dayNight?.phases.day.durationTicks ?? 1440;
    state.root.tick = nightStartTick;
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
      vipNightExpiresAtTick: nightStartTick + ticksForMs(10 * 60 * 1000)
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
    expectMafianHeat(result.nextState.districtsById["district:1"].heat, 12);
    expect(result.nextState.districtsById["district:1"].influence).toBe(3);
    expect(result.nextState.buildingsById[building.id].actionCooldowns.good_rate).toBe(
      cooldownTicksForMs(18 * 60 * 1000)
    );
    expect(result.nextState.buildingsById[building.id].metadata?.exchangeOffice).toMatchObject({
      launderedEvents: [{ tick: 0, amount: 1600 }],
      auditRiskBonuses: [{ expiresAtTick: 96, riskPct: 4, source: "good_rate" }]
    });
    expect(report).toMatchObject({
      message: expect.stringContaining("1408 clean cash"),
      exchangeResult: {
        launderedDirtyCash: 1600,
        cleanCashGained: 1408,
        feePaid: 192,
        heatGain: mafianHeat(12),
        influenceGain: 3
      }
    });
  });

  it("blocks exchange office good rate at night", () => {
    const { state, building } = createStateWithFixedBuilding("exchange", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 10000
      }
    });
    state.root.tick = context.config.balance.dayNight?.phases.day.durationTicks ?? 1440;

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:exchange:good-rate:night",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "good_rate"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("building_action_phase_blocked");
    expect(result.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(10000);
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(0);
    expect(result.nextState.buildingsById[building.id].actionCooldowns.good_rate).toBeUndefined();
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
    expectMafianHeat(result.nextState.districtsById["district:1"].heat, 3);
    expect(result.nextState.districtsById["district:1"].influence).toBe(1);
    expect(result.nextState.buildingsById[building.id].metadata?.arcade).toMatchObject({
      launderedEvents: [{ tick: 0, amount: 1300 }],
      auditRiskBonuses: [{ expiresAtTick: 96, riskPct: 3, source: "back_cashdesk" }]
    });
    expect(result.nextState.buildingsById[building.id].actionCooldowns.back_cashdesk).toBe(
      cooldownTicksForMs(16 * 60 * 1000)
    );
    expect(report).toMatchObject({
      arcadeResult: {
        launderedDirtyCash: 1300,
        cleanCashGained: 1105,
        feePaid: 195,
        heatGain: 3,
        influenceGain: 1,
        auditRiskBonusPct: 3,
        auditRiskDurationMinutes: 8
      }
    });
    const reportMessage = "message" in report && typeof report.message === "string"
      ? report.message
      : "";
    expect(reportMessage).toContain("Vliv +1");
    expect(reportMessage).toContain("Audit risk +3% na 8 min");
  });

  it("activates arcade night machines and blocks stacking while active", () => {
    const { state, building } = createStateWithFixedBuilding("arcade");
    const nightStartTick = context.config.balance.dayNight?.phases.day.durationTicks ?? 1440;
    state.root.tick = nightStartTick;
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
      nightMachinesExpiresAtTick: nightStartTick + 84
    });
    expect(second.errors.map((error) => error.code)).toContain("building_action_cooldown");
    expect(second.errors.map((error) => error.code)).toContain("arcade_night_machines_active");
  });

  it("rejects the removed armory fortify compatibility action without changing defense", () => {
    const { state, building } = createStateWithFixedBuilding("armory");
    const defenseBefore = structuredClone(state.districtsById["district:1"].defenseLoadout);
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

    expect(result.errors.map((error) => error.code)).toContain("building_action_not_found");
    expect(result.nextState.districtsById["district:1"].defenseLoadout).toEqual(defenseBefore);
    expect(result.events).toEqual([]);
    expect(createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })).toEqual([]);
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

  it("applies Kult population generation bonus to apartment block production", () => {
    const createPopulationSubject = (factionId: "mafian" | "kult") => {
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
      state.playersById["player:1"] = {
        ...state.playersById["player:1"],
        factionId
      };
      state.root.tick = 12;
      const result = collectIncome(state, context);
      return Number((result.buildingsById[building.id].metadata?.apartmentBlock as { storedPopulation?: number })?.storedPopulation || 0);
    };

    const baselinePopulation = createPopulationSubject("mafian");
    const cultPopulation = createPopulationSubject("kult");

    expect(cultPopulation).toBeCloseTo(baselinePopulation * 1.1);
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
    const singleGarage = createStateWithFixedBuilding("garage", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      }
    });
    const singleResult = collectIncome(singleGarage.state, context);
    const singleCash = Number(singleResult.resourceStatesById["resource:1"].balances.cash || 0);
    const singleHeat = Number(singleResult.districtsById["district:1"].heat || 0);

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
    expect(result.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(singleCash * 2);
    expect(result.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(0);
    expect(result.resourceStatesById["resource:1"].balances.influence).toBeUndefined();
    expect(result.resourceStatesById["resource:1"].balances.population).toBeUndefined();
    expect(result.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(result.districtsById["district:1"].heat).toBeGreaterThan(singleHeat * 2);
    expect(result.districtsById["district:1"].influence).toBe(0);
    expect(actions.garage_prepare_vehicles).toBeUndefined();
    expect(actions.garage_fast_route).toBeUndefined();
    expect(actions.garage_escape_routes).toBeUndefined();
  });

  it("collects car dealer income with clean money, dirty money, heat, influence, and no population or actions", () => {
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
    const carDealerBalance = context.config.balance.fixedBuildings?.car_dealer;

    expect(result.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(0);
    expect(result.resourceStatesById["resource:1"].balances["dirty-cash"]).toBeGreaterThan(0);
    expect(result.resourceStatesById["resource:1"].balances.influence).toBeUndefined();
    expect(result.resourceStatesById["resource:1"].balances.population).toBeUndefined();
    expect(result.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(result.districtsById["district:1"].influence).toBeGreaterThan(0);
    expect(carDealerBalance?.cleanPerHour).toBe(2145);
    expect(carDealerBalance?.dirtyPerHour).toBeCloseTo(650, 5);
    expect(carDealerBalance?.heatPerDay).toBeCloseTo(60, 5);
    expect(carDealerBalance?.influencePerDay).toBeCloseTo(24, 5);
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

  it("stores school population locally while clean income and influence apply passively", () => {
    const { state, building } = createStateWithFixedBuilding("school", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      },
      metadata: {
        school: {
          storedStudents: 18,
          lastUpdatedTick: 0,
          lastCapacity: 20,
          wasFull: false
        }
      }
    });
    state.root.tick = 120;

    const result = collectIncome(state, context);
    const metadata = result.buildingsById[building.id].metadata?.school as {
      storedStudents?: number;
      lastCapacity?: number;
      wasFull?: boolean;
    };

    expect(result.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(0);
    expect(result.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(0);
    expect(result.districtsById["district:1"].heat).toBe(0);
    expect(result.districtsById["district:1"].influence).toBeGreaterThan(0);
    expect(metadata.storedStudents).toBe(20);
    expect(metadata.lastCapacity).toBe(20);
    expect(metadata.wasFull).toBe(true);
  });

  it("rejects removed school population collection action", () => {
    const { state, building } = createStateWithFixedBuilding("school", {
      metadata: {
        school: {
          storedStudents: 4.8,
          lastUpdatedTick: 0,
          lastCapacity: 20,
          wasFull: false
        }
      }
    });
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      population: 11
    };
    state.serverInstance = {
      ...state.serverInstance,
      worldSeed: "school-seed-11"
    };

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "collect_students"
        }
      }),
      context
    );

    expect(result.errors.map((error) => error.code)).toContain("building_action_not_found");
    expect(result.nextState.playersById["player:1"].population).toBe(11);
    expect(result.nextState.resourceStatesById["resource:1"].balances["gang-members"]).toBeUndefined();
    expect(result.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(250);
    expect(result.nextState.districtsById["district:1"].heat).toBe(0);
    expect(result.nextState.districtsById["district:1"].influence).toBe(0);
    expect(result.nextState.buildingsById[building.id].metadata?.school).toMatchObject({
      storedStudents: 4.8,
      wasFull: false
    });
  });

  it("activates school evening course and blocks stacking while active", () => {
    const { state, building } = createStateWithFixedBuilding("school", {
      playerBalances: {
        cash: 1000,
        "dirty-cash": 0
      }
    });

    const first = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:school:course:1",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "evening_course"
        }
      }),
      context
    );
    const second = applyCommand(
      first.nextState,
      createRunBuildingActionCommandFixture({
        id: "command:school:course:2",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "evening_course"
        }
      }),
      context
    );
    const report = createConflictReportViews(first.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(first.errors).toEqual([]);
    expect(first.nextState.resourceStatesById["resource:1"].balances.cash).toBe(0);
    const schoolAction = context.config.balance.buildingActions?.evening_course;
    expect(schoolAction).toBeDefined();
    expect(first.nextState.buildingsById[building.id].metadata?.school).toMatchObject({
      eveningCourseExpiresAtTick: ticksForMs(schoolAction?.durationMs ?? 0)
    });
    expect(first.nextState.buildingsById[building.id].actionCooldowns.evening_course).toBe(cooldownTicksForMs(schoolAction?.cooldownMs ?? 0));
    expect(second.errors.map((error) => error.code)).toContain("building_action_cooldown");
    expect(second.errors.map((error) => error.code)).toContain("school_evening_course_active");
    expect(report).toMatchObject({
      reportType: "building-action",
      buildingActionId: "evening_course",
      schoolResult: {
        type: "education_boost",
        apartmentRecruitmentMultiplier: 1.6
      },
      heatGain: 0
    });
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
        { id: "recovery:test:population", itemType: "population", amount: 20, source: "attack", lostAtTick: 0 },
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
    expect(balances["gang-members"]).toBeUndefined();
    expect(result.nextState.playersById["player:1"].population).toBe(14);
    expect(result.nextState.playersById["player:1"].recoveryPool).toEqual([
      { id: "recovery:test:pistol", itemType: "pistol", amount: 5, source: "attack", lostAtTick: 0 }
    ]);
    expectMafianHeat(result.nextState.districtsById["district:1"].heat, 1);
    expect(report).toMatchObject({
      buildingActionId: "stabilization_protocol",
      clinicResult: {
        type: "recovery",
        recovered: {
          population: 4
        },
        keptForRecycling: 5,
        cleanCashCost: 1200,
        heatGain: 1
      }
    });
  });

  it("sums garage and car dealer cooldown support for clinic stabilization", () => {
    const { state, building } = createStateWithFixedBuilding("clinic", {
      playerBalances: {
        cash: 5000,
        "dirty-cash": 0
      }
    });
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      recoveryPool: [
        { id: "recovery:test:population", itemType: "population", amount: 20, source: "attack", lostAtTick: 0 }
      ]
    };
    const supportBuildings = [
      ...Array.from({ length: 5 }, (_value, index) =>
        createFixedBuildingFixture("garage", {
          id: `building:district-1:garage:clinic-support:${index + 1}`
        })
      ),
      ...Array.from({ length: 4 }, (_value, index) =>
        createFixedBuildingFixture("car_dealer", {
          id: `building:district-1:car_dealer:clinic-support:${index + 1}`
        })
      )
    ];
    for (const supportBuilding of supportBuildings) {
      state.buildingsById[supportBuilding.id] = supportBuilding;
    }
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: [building.id, ...supportBuildings.map((supportBuilding) => supportBuilding.id)]
    };

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:clinic:stabilization:support",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "stabilization_protocol"
        }
      }),
      context
    );

    const baseCooldownTicks = cooldownTicksForMs(18 * 60 * 1000);
    const expectedCooldownTicks = Math.ceil(baseCooldownTicks * (1 - 0.065));

    expect(result.errors).toEqual([]);
    expect(result.nextState.buildingsById[building.id].actionCooldowns.stabilization_protocol).toBe(expectedCooldownTicks);
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

  it("runs recycling center extract losses against material salvage pool only", () => {
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
        { id: "salvage:test:vest", itemId: "vest", itemName: "Neprůstřelná vesta", category: "defenseItems", amount: 20, source: "defense", lostAtTick: 0 },
        { id: "salvage:test:future", itemId: "future-component", itemName: "Future Component", category: "rareComponents", amount: 4, source: "attack", lostAtTick: 0 }
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
    expect(balances["baseball-bat"]).toBe(0);
    expect(balances.vest).toBe(0);
    expect(result.nextState.playersById["player:1"].population).toBe(10);
    expect(result.nextState.playersById["player:1"].salvagePool).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemId: "baseball-bat", amount: 20 }),
      expect.objectContaining({ itemId: "vest", amount: 20 }),
      expect.objectContaining({ itemId: "future-component", amount: 4 })
    ]));
    expectMafianHeat(result.nextState.districtsById["district:1"].heat, 2);
    expect(report).toMatchObject({
      buildingActionId: "extract_losses",
      recyclingResult: {
        type: "salvage_recovery",
        salvageRatePct: 12,
        recoveredByCategory: {
          materials: 2
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
    const { state, building } = createStateWithFixedBuilding("factory", {
      productionResourceKey: "metal-parts",
      productionStoredAmount: 20,
      playerBalances: {
        cash: 0,
        "dirty-cash": 0,
        "metal-parts": 88
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
          buildingId: building.id,
          resourceKey: "metal-parts"
        }
      }),
      context
    );

    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:1"].balances["metal-parts"]).toBe(90);
    expect(result.nextState.resourceStatesById["resource:" + building.id].balances["metal-parts"]).toBe(18);
  });

  it("keeps smuggling tunnel as dirty-only passive income with heat", () => {
    const { state, building } = createStateWithFixedBuilding("smuggling_tunnel", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0,
        influence: 0
      }
    });
    state.root.tick = 250;

    const produced = collectIncome(state, context);

    expect(produced.resourceStatesById["resource:1"].balances.cash).toBe(0);
    expect(produced.resourceStatesById["resource:1"].balances["dirty-cash"]).toBeGreaterThan(0);
    expect(produced.buildingsById[building.id].metadata?.smugglingTunnel).toBeUndefined();
    expect(produced.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(produced.districtsById["district:1"].influence).toBe(0);
  });

  it("keeps courthouse as passive clean legal protection without special actions", () => {
    const { state, building } = createStateWithFixedBuilding("court", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      }
    });

    const produced = collectIncome(state, context);
    const definition = getPublicBuildingCatalog("free").find((entry) => entry.buildingTypeId === "court");

    expect(context.config.balance.courthouse).toMatchObject({
      id: "courthouse",
      buildingTypeId: "court",
      countOnMap: 2,
      noSpecialActions: true,
      noDirtyCash: true,
      noPopulationProduction: true,
      noIntelPower: true,
      noLaundering: true,
      noAuditRisk: true
    });
    expect(definition?.specialActions).toEqual([]);
    expect(produced.resourceStatesById["resource:1"].balances.cash).toBeGreaterThan(0);
    expect(produced.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(0);
    expect(produced.districtsById["district:1"].heat).toBeGreaterThan(0);
    expect(produced.districtsById["district:1"].influence).toBeGreaterThan(0);
    expect(produced.buildingsById[building.id].actionCooldowns).toEqual({});
  });

  it("activates smuggling tunnel open channel and blocks stacking while active", () => {
    const openChannelConfig = context.config.balance.smugglingTunnel?.openChannel;
    expect(openChannelConfig).toMatchObject({
      durationMinutes: 15,
      cooldownMinutes: 30,
      costCleanCash: 1800,
      heatGain: 5
    });
    const { state, building } = createStateWithFixedBuilding("smuggling_tunnel", {
      playerBalances: {
        cash: 2000,
        "dirty-cash": 1000
      }
    });

    const first = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:smuggling:open-channel:1",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "open_channel"
        }
      }),
      context
    );
    const second = applyCommand(
      first.nextState,
      createRunBuildingActionCommandFixture({
        id: "command:smuggling:open-channel:2",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "open_channel"
        }
      }),
      context
    );
    const report = createConflictReportViews(first.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(first.errors).toEqual([]);
    expect(first.nextState.resourceStatesById["resource:1"].balances.cash).toBe(200);
    expect(first.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(1000);
    expect(first.nextState.playersById["player:1"].metadata?.smugglingTunnel).toMatchObject({
      openChannelStartedAtTick: 0,
      openChannelExpiresAtTick: ticksForMs((openChannelConfig?.durationMinutes ?? 0) * 60 * 1000)
    });
    expect(first.nextState.buildingsById[building.id].actionCooldowns.open_channel).toBe(
      cooldownTicksForMs((openChannelConfig?.cooldownMinutes ?? 0) * 60 * 1000)
    );
    expect(first.nextState.districtsById["district:1"].heat).toBe(mafianIllegalHeat(7));
    expect(second.errors.map((error) => error.code)).toContain("building_action_cooldown");
    expect(second.errors.map((error) => error.code)).toContain("smuggling_tunnel_open_channel_active");
    expect(report).toMatchObject({
      reportType: "building-action",
      buildingActionId: "open_channel",
      smugglingTunnelResult: {
        type: "open_channel",
        cleanCashCost: 1800,
        durationTicks: ticksForMs((openChannelConfig?.durationMinutes ?? 0) * 60 * 1000),
        heatGain: 5,
        tunnelDirtyProductionBonusPct: 45,
        dealerSaleSpeedBonusPct: 10,
        streetIncidentFlatRiskPct: 5
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

  it("generates one Strip Club passive rumor per owned club every thirty minutes", () => {
    const { state, building } = createStateWithFixedBuilding("strip_club", {
      id: "building:district-1:strip_club:1",
      metadata: {
        stripClub: {
          lastPassiveRumorCheckTick: 0,
          rumorEvents: []
        }
      }
    });
    const secondClub = {
      ...building,
      id: "building:district-2:strip_club:2",
      districtId: "district:2",
      metadata: {
        stripClub: {
          lastPassiveRumorCheckTick: 0,
          rumorEvents: []
        }
      }
    };
    state.buildingsById[secondClub.id] = secondClub;
    state.districtsById["district:2"] = createDistrictFixture({
      id: "district:2",
      buildingIds: [secondClub.id],
      ownerPlayerId: "player:1"
    });
    state.root.districtIds.push("district:2");
    state.root.tick = ticksForMs(30 * 60 * 1000);

    const result = collectIncome(state, context);
    const firstMetadata = result.buildingsById[building.id].metadata?.stripClub as { rumorEvents?: unknown[] } | undefined;
    const secondMetadata = result.buildingsById[secondClub.id].metadata?.stripClub as { rumorEvents?: unknown[] } | undefined;

    expect(context.config.balance.stripClub?.passiveRumorIntervalMinutes).toBe(30);
    expect(context.config.balance.stripClub?.baseRumorChancePct).toBe(100);
    expect(firstMetadata?.rumorEvents).toHaveLength(1);
    expect(secondMetadata?.rumorEvents).toHaveLength(1);
  });

  it("runs Strip Club cash collection through server state", () => {
    const { state, building } = createStateWithFixedBuilding("strip_club", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      }
    });
    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:strip:collect-cash",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "strip_club_collect_cash"
        }
      }),
      context
    );
    const report = createConflictReportViews(result.nextState, { playerId: "player:1", limit: 1 })[0];

    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(306);
    expectMafianHeat(result.nextState.districtsById["district:1"].heat, 4);
    expect(result.nextState.buildingsById[building.id].actionCooldowns.strip_club_collect_cash).toBe(
      cooldownTicksForMs(10 * 60 * 1000)
    );
    expect(report).toMatchObject({
      reportType: "building-action",
      buildingActionId: "strip_club_collect_cash"
    });
  });

  it("runs Restaurant as passive clean, influence, heat, and rumor building with server-backed detail actions", () => {
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
      noSpecialActions: false,
      noLaundering: true,
      noAuditRisk: true,
      dirtyCashPerMinute: 0
    });
    expect((context.config.balance.buildingActions ?? {}).restaurant_collect_revenue).toMatchObject({
      actionId: "restaurant_collect_revenue",
      buildingType: "restaurant",
      heatGain: 5,
      outputGain: {
        cash: 869,
        "dirty-cash": 550
      }
    });
  });

  it("runs Restaurant detail revenue action through server state", () => {
    const { state, building } = createStateWithFixedBuilding("restaurant", {
      id: "building:district-1:restaurant:1",
      playerBalances: {
        cash: 0,
        "dirty-cash": 0,
        influence: 0
      }
    });

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:restaurant:collect-revenue",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "restaurant_collect_revenue"
        }
      }),
      context
    );

    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(869);
    expect(result.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(550);
    expectMafianHeat(result.nextState.districtsById["district:1"].heat, 5);
    expect(result.nextState.buildingsById[building.id].actionCooldowns.restaurant_collect_revenue).toBe(
      cooldownTicksForMs(30 * 60 * 1000)
    );
    expect(result.events[0]).toMatchObject({
      type: "building-action-resolved",
      payload: {
        actionId: "restaurant_collect_revenue",
        cashDelta: 869,
        dirtyCashDelta: 550
      }
    });

    const nightState = createStateWithFixedBuilding("restaurant", {
      id: "building:district-1:restaurant:night",
      playerBalances: {
        cash: 0,
        "dirty-cash": 0,
        influence: 0
      }
    });
    nightState.state.root.tick = context.config.balance.dayNight?.phases.day.durationTicks ?? 1440;

    const blocked = applyCommand(
      nightState.state,
      createRunBuildingActionCommandFixture({
        id: "command:restaurant:collect-revenue:night",
        payload: {
          districtId: "district:1",
          buildingId: nightState.building.id,
          actionId: "restaurant_collect_revenue"
        }
      }),
      context
    );

    expect(blocked.errors.map((error) => error.code)).toContain("building_action_phase_blocked");
    expect(blocked.nextState.resourceStatesById["resource:1"].balances.cash).toBe(0);
    expect(blocked.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(0);
    expect(blocked.nextState.districtsById["district:1"].heat).toBe(0);
    expect(blocked.nextState.buildingsById[nightState.building.id].actionCooldowns.restaurant_collect_revenue).toBeUndefined();
  });

  it("runs Restaurant cover meetings effect through server state", () => {
    const { state, building } = createStateWithFixedBuilding("restaurant", {
      id: "building:district-1:restaurant:1",
      playerBalances: {
        cash: 0,
        "dirty-cash": 0,
        influence: 0
      }
    });

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:restaurant:cover-meetings",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "restaurant_cover_meetings"
        }
      }),
      context
    );
    const effectState = result.nextState.effectStatesById["effect:district:1"];

    expect(result.errors).toEqual([]);
    expectMafianHeat(result.nextState.districtsById["district:1"].heat, 4);
    expect(result.nextState.districtsById["district:1"].influence).toBe(8);
    expect(result.nextState.buildingsById[building.id].actionCooldowns.restaurant_cover_meetings).toBe(
      cooldownTicksForMs(45 * 60 * 1000)
    );
    expect(effectState.effects).toEqual([
      expect.objectContaining({
        stackPolicyKey: "restaurant_cover_meetings",
        payload: expect.objectContaining({
          actionId: "restaurant_cover_meetings",
          cleanIncomeMultiplier: 1.18,
          dirtyIncomeMultiplier: 1.18,
          effectModifiers: {
            cleanIncomeMultiplier: 1.18,
            dirtyIncomeMultiplier: 1.18
          }
        })
      })
    ]);
  });

  it("runs Restaurant local network effect through server state", () => {
    const { state, building } = createStateWithFixedBuilding("restaurant", {
      id: "building:district-1:restaurant:1",
      playerBalances: {
        cash: 0,
        "dirty-cash": 0,
        influence: 0
      }
    });

    const result = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:restaurant:local-network",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "restaurant_local_network"
        }
      }),
      context
    );
    const effectState = result.nextState.effectStatesById["effect:district:1"];

    expect(result.errors).toEqual([]);
    expectMafianHeat(result.nextState.districtsById["district:1"].heat, 8);
    expect(result.nextState.districtsById["district:1"].influence).toBe(4);
    expect(result.nextState.buildingsById[building.id].actionCooldowns.restaurant_local_network).toBe(
      cooldownTicksForMs(30 * 60 * 1000)
    );
    expect(effectState.effects).toEqual([
      expect.objectContaining({
        stackPolicyKey: "restaurant_local_network",
        payload: expect.objectContaining({
          actionId: "restaurant_local_network",
          influenceMultiplier: 1.12,
          effectModifiers: {
            influenceMultiplier: 1.12
          }
        })
      })
    ]);
  });

  it("generates Restaurant passive rumors and publishes them to street news without reliability visibility", () => {
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
    const cityFeedEvents = Object.values(result.cityFeedEventsById);
    const restaurantCityFeedEvent = cityFeedEvents.find((event) => event.sourceBuildingType === "restaurant");
    const projection = createCityFeedProjection(result, {
      playerId: "player:1",
      selectedDistrictId: building.districtId
    });

    expect(metadata?.rumorEvents?.length).toBeGreaterThan(0);
    expect(metadata?.rumorEvents?.[0]?.reliabilityVisible).toBe(false);
    expect(metadata?.rumorEvents?.[0]?.text).not.toContain("Spolehlivost:");
    expect(restaurantCityFeedEvent).toMatchObject({
      category: "rumor",
      districtId: building.districtId,
      sourceBuildingType: "restaurant"
    });
    expect(projection.selectedDistrictFeed.some((event) => event.id === restaurantCityFeedEvent?.id)).toBe(true);
  });

  it("runs Convenience Store as passive street cash, population, influence, heat, and rumor building", () => {
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
      noSpecialActions: false,
      noLaundering: true,
      noAuditRisk: true,
      dirtyCashPerMinute: 18
    });
    expect((context.config.balance.buildingActions ?? {}).convenience_street_info).toBeUndefined();
    expect((context.config.balance.buildingActions ?? {}).collect_convenience_store_population).toMatchObject({
      actionId: "collect_convenience_store_population",
      buildingType: "convenience_store"
    });
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

  it("checks Convenience Store rumors once per player and interval instead of once per building", () => {
    const rumorContext = {
      config: {
        ...context.config,
        balance: {
          ...context.config.balance,
          convenienceStore: {
            ...context.config.balance.convenienceStore!,
            baseRumorChancePct: 100,
            maxRumorChecksPerPlayerPerInterval: 1
          }
        }
      }
    };
    const { state, building } = createStateWithFixedBuilding("convenience_store", {
      id: "building:district-1:convenience_store:1",
      metadata: { convenienceStore: { lastPassiveRumorCheckTick: 0, rumorEvents: [] } }
    });
    const secondStore = {
      ...building,
      id: "building:district-2:convenience_store:2",
      districtId: "district:2",
      metadata: { convenienceStore: { lastPassiveRumorCheckTick: 0, rumorEvents: [] } }
    };
    state.buildingsById[secondStore.id] = secondStore;
    state.districtsById["district:2"] = createDistrictFixture({
      id: "district:2",
      buildingIds: [secondStore.id],
      ownerPlayerId: "player:1"
    });
    state.root.districtIds.push("district:2");
    state.root.tick = ticksForMs(10 * 60 * 1000);

    const result = collectIncome(state, rumorContext);
    const firstMetadata = result.buildingsById[building.id].metadata?.convenienceStore as { lastPassiveRumorCheckTick?: number; rumorEvents?: unknown[] };
    const secondMetadata = result.buildingsById[secondStore.id].metadata?.convenienceStore as { lastPassiveRumorCheckTick?: number; rumorEvents?: unknown[] };

    expect(firstMetadata.lastPassiveRumorCheckTick).toBe(state.root.tick);
    expect(firstMetadata.rumorEvents).toHaveLength(1);
    expect(secondMetadata.lastPassiveRumorCheckTick).toBe(0);
    expect(secondMetadata.rumorEvents).toEqual([]);
  });

  it("activates Strip Club VIP lounge and blocks stacking while active", () => {
    const { state, building } = createStateWithFixedBuilding("strip_club", {
      playerBalances: {
        cash: 5000,
        "dirty-cash": 0
      }
    });
    state.root.tick = context.config.balance.dayNight?.phases.day.durationTicks ?? 1440;
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
      vipLoungeExpiresAtTick: state.root.tick
        + ticksForMs((context.config.balance.stripClub?.vipLounge.durationMinutes ?? 0) * 60 * 1000)
    });
    expect(second.errors.map((error) => error.code)).toContain("building_action_cooldown");
    expect(second.errors.map((error) => error.code)).toContain("strip_club_vip_lounge_active");
  });

  it("rejects removed bar whispers action", () => {
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

    expect(result.errors.map((error) => error.code)).toContain("building_action_not_found");
    expect(result.nextState.districtsById["district:1"].heat).toBe(0);
    expect(result.nextState.districtsById["district:1"].influence).toBe(30);
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
    expectMafianHeat(result.nextState.districtsById["district:1"].heat, 20);
    expect(result.nextState.districtsById["district:1"].influence).toBe(4);
    expect(result.nextState.buildingsById[building.id].metadata?.stripClub).toMatchObject({
      privatePartyExpiresAtTick: 120,
      scandalEvents: expect.any(Array)
    });
    expect(report).toMatchObject({
      buildingActionId: "private_party",
      stripClubResult: {
        type: "influence_rumor_event",
        scandal: true
      }
    });
  });

  it("runs Power Station as infrastructure support with no energy resource", () => {
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
    expect(balances["dirty-cash"]).toBeGreaterThan(0);
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
    expect(first.nextState.resourceStatesById["resource:1"].balances.cash).toBe(1500);
    expectMafianHeat(first.nextState.districtsById["district:1"].heat, 3);
    expect(first.nextState.districtsById["district:1"].influence).toBe(0);
    expect(first.nextState.buildingsById[building.id].metadata?.powerStation).toMatchObject({
      backupGridSwitchExpiresAtTick: ticksForMs(25 * 60 * 1000)
    });
    expect(first.nextState.buildingsById[building.id].actionCooldowns.backup_grid_switch).toBe(cooldownTicksForMs(60 * 60 * 1000));
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

  it("runs Power Station production boost and heat reduction through server state", () => {
    const { state, building } = createStateWithFixedBuilding("power_station", {
      playerBalances: {
        cash: 0,
        "dirty-cash": 0
      }
    });
    const boost = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        id: "command:power:feed-production",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "power_station_feed_production"
        }
      }),
      context
    );
    const effectState = boost.nextState.effectStatesById["effect:district:1"];
    const heatState = {
      ...state,
      districtsById: {
        ...state.districtsById,
        "district:1": {
          ...state.districtsById["district:1"],
          heat: 7
        }
      }
    };
    const reduced = applyCommand(
      heatState,
      createRunBuildingActionCommandFixture({
        id: "command:power:reduce-heat",
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "power_station_reduce_heat"
        }
      }),
      context
    );

    expect(boost.errors).toEqual([]);
    expect(boost.nextState.resourceStatesById["resource:1"].balances.cash).toBe(2000);
    expect(boost.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBe(500);
    expectMafianHeat(boost.nextState.districtsById["district:1"].heat, 10);
    expect(boost.nextState.buildingsById[building.id].actionCooldowns.power_station_feed_production).toBe(
      cooldownTicksForMs(60 * 60 * 1000)
    );
    expect(effectState).toBeUndefined();

    expect(reduced.errors).toEqual([]);
    expect(reduced.nextState.districtsById["district:1"].heat).toBe(0);
    expect(reduced.nextState.buildingsById[building.id].actionCooldowns.power_station_reduce_heat).toBe(
      cooldownTicksForMs(60 * 60 * 1000)
    );
  });

});
