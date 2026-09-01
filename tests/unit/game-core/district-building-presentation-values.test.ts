import { describe, expect, it } from "vitest";
import { getAllPublicBuildingDefinitions, resolveModeConfig } from "@empire/game-config";
import { dayNightActionRules } from "../../../packages/game-config/src/public/day-night-action-rules";
import { createStreetDealerSaleView } from "../../../packages/game-core/src/projections/district-building-action-view-helpers";
import { createDistrictPanelBuildingViews } from "../../../packages/game-core/src/projections/district-building-action-projection";
import { resolvePlayerStorageCapacitySummary } from "../../../packages/game-core/src/handlers/warehouseBuilding";
import {
  createCivilBuildingStats,
  createCivilPopulationBufferPresentation
} from "../../../packages/game-core/src/projections/district-building-civil-stats";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const config = resolveModeConfig("free");

describe("district building presentation values", () => {
  it("projects precise apartment and convenience population buffers", () => {
    const apartmentFixture = createCoreStateWithFixedBuildingFixture("apartment_block", {
      buildingOverrides: {
        metadata: {
          apartmentBlock: {
            storedPopulation: 14 / 30,
            lastCapacity: 50,
            lastUpdatedTick: 0,
            wasFull: false
          }
        }
      }
    });
    const apartmentInput = {
      definition: undefined,
      state: apartmentFixture.state,
      district: apartmentFixture.state.districtsById[apartmentFixture.building.districtId],
      building: apartmentFixture.building,
      playerId: "player:1",
      playerBalances: {},
      dayNightConfig: config,
      convenienceStoreConfig: config.balance.convenienceStore,
      recruitmentCenterConfig: config.balance.recruitmentCenter,
      tick: 0,
      tickRateMs: config.tickRateMs
    };
    const apartmentBuffer = createCivilPopulationBufferPresentation(apartmentInput);
    const apartmentStats = createCivilBuildingStats(apartmentInput, []);

    expect(apartmentBuffer).toEqual({
      storedAmount: 14 / 30,
      capacity: 50,
      productionPerMinute: 2,
      timeToFullMs: 1_490_000
    });
    expect(apartmentStats).toEqual(expect.arrayContaining([
      { label: "Populace / min", value: "2" },
      { label: "Lokální zásobník", value: "0/50" }
    ]));

    const convenienceFixture = createCoreStateWithFixedBuildingFixture("convenience_store", {
      buildingOverrides: {
        metadata: {
          convenienceStore: {
            storedPopulation: 0,
            populationCapacity: 50,
            populationLastUpdatedTick: 0,
            populationWasFull: false,
            rumorEvents: []
          }
        }
      }
    });
    const convenienceInput = {
      ...apartmentInput,
      state: convenienceFixture.state,
      district: convenienceFixture.state.districtsById[convenienceFixture.building.districtId],
      building: convenienceFixture.building
    };
    const convenienceBuffer = createCivilPopulationBufferPresentation(convenienceInput);
    const convenienceStats = createCivilBuildingStats(convenienceInput, []);

    expect(convenienceBuffer).toEqual({
      storedAmount: 0,
      capacity: 50,
      productionPerMinute: 50 / 60,
      timeToFullMs: 3_600_000
    });
    expect(convenienceStats).toEqual(expect.arrayContaining([
      { label: "Populace / min", value: "0.83" },
      { label: "Lokální zásobník", value: "0/50" }
    ]));
  });

  it("keeps school presentation rate before day-night while using effective fill time", () => {
    const fixture = createCoreStateWithFixedBuildingFixture("school", {
      buildingOverrides: {
        metadata: {
          school: {
            storedStudents: 0,
            lastCapacity: 20,
            lastUpdatedTick: 0,
            wasFull: false
          }
        }
      }
    });
    const populationBuffer = createCivilPopulationBufferPresentation({
      state: fixture.state,
      building: fixture.building,
      dayNightConfig: config,
      schoolConfig: config.balance.school,
      tick: 0,
      tickRateMs: config.tickRateMs
    });

    expect(populationBuffer).toEqual({
      storedAmount: 0,
      capacity: 20,
      productionPerMinute: 0.55,
      timeToFullMs: 1_820_000
    });
  });

  it("projects population collect actions as disabled until their canonical minimum", () => {
    const apartmentFixture = createCoreStateWithFixedBuildingFixture("apartment_block", {
      buildingOverrides: {
        metadata: {
          apartmentBlock: {
            storedPopulation: 0,
            lastUpdatedTick: 0
          }
        }
      }
    });
    const [apartmentView] = createDistrictPanelBuildingViews({
      state: apartmentFixture.state,
      buildings: [apartmentFixture.building],
      buildCatalog: getAllPublicBuildingDefinitions(),
      actionCatalog: config.balance.buildingActions ?? {},
      config,
      district: apartmentFixture.state.districtsById[apartmentFixture.building.districtId],
      playerId: "player:1",
      playerBalances: {},
      tick: 0,
      tickRateMs: config.tickRateMs
    });
    const apartmentCollect = apartmentView.actions.find((action) => action.actionId === "collect_population");

    expect(apartmentCollect).toMatchObject({
      enabled: false,
      disabledReason: "Bytový blok zatím nemá připravené obyvatele."
    });

    const convenienceFixture = createCoreStateWithFixedBuildingFixture("convenience_store", {
      buildingOverrides: {
        metadata: {
          convenienceStore: {
            storedPopulation: 0,
            populationLastUpdatedTick: 0,
            rumorEvents: []
          }
        }
      }
    });
    const [convenienceView] = createDistrictPanelBuildingViews({
      state: convenienceFixture.state,
      buildings: [convenienceFixture.building],
      buildCatalog: getAllPublicBuildingDefinitions(),
      actionCatalog: config.balance.buildingActions ?? {},
      config,
      convenienceStoreConfig: config.balance.convenienceStore,
      district: convenienceFixture.state.districtsById[convenienceFixture.building.districtId],
      playerId: "player:1",
      playerBalances: {},
      tick: 0,
      tickRateMs: config.tickRateMs
    });
    const convenienceCollect = convenienceView.actions.find(
      (action) => action.actionId === "collect_convenience_store_population"
    );

    expect(convenienceCollect).toMatchObject({
      enabled: false,
      disabledReason: "Večerka zatím nemá připravené obyvatele."
    });

    const schoolFixture = createCoreStateWithFixedBuildingFixture("school", {
      buildingOverrides: {
        metadata: {
          school: {
            storedStudents: 0,
            lastUpdatedTick: 0,
            lastCapacity: 20,
            wasFull: false
          }
        }
      }
    });
    const createSchoolView = () => createDistrictPanelBuildingViews({
      state: schoolFixture.state,
      buildings: [schoolFixture.state.buildingsById[schoolFixture.building.id]],
      buildCatalog: getAllPublicBuildingDefinitions(),
      actionCatalog: config.balance.buildingActions ?? {},
      config,
      schoolConfig: config.balance.school,
      district: schoolFixture.state.districtsById[schoolFixture.building.districtId],
      playerId: "player:1",
      playerBalances: { cash: 1_000 },
      tick: 0,
      tickRateMs: config.tickRateMs
    })[0];
    const emptySchoolCollect = createSchoolView().actions.find(
      (action) => action.actionId === "collect_school_population"
    );

    expect(emptySchoolCollect).toMatchObject({
      enabled: false,
      disabledReason: "Škola zatím nemá připravené členy k výběru."
    });

    schoolFixture.state.buildingsById[schoolFixture.building.id] = {
      ...schoolFixture.state.buildingsById[schoolFixture.building.id],
      metadata: {
        school: {
          storedStudents: 1.25,
          lastUpdatedTick: 0,
          lastCapacity: 20,
          wasFull: false
        }
      }
    };
    const readySchoolCollect = createSchoolView().actions.find(
      (action) => action.actionId === "collect_school_population"
    );

    expect(readySchoolCollect).toMatchObject({
      enabled: true,
      disabledReason: null
    });
  });

  it("does not advertise a fixed-output building action when its warehouse item is full", () => {
    const fixture = createCoreStateWithFixedBuildingFixture("port", {
      includeWarehouse: true,
      playerBalances: { "metal-parts": 90 }
    });
    const [portView] = createDistrictPanelBuildingViews({
      state: fixture.state,
      buildings: [fixture.building],
      buildCatalog: getAllPublicBuildingDefinitions(),
      actionCatalog: config.balance.buildingActions ?? {},
      config,
      district: fixture.state.districtsById[fixture.building.districtId],
      playerId: "player:1",
      playerBalances: fixture.state.resourceStatesById["resource:1"].balances,
      tick: 0,
      tickRateMs: config.tickRateMs
    });
    const containerCut = portView.actions.find((action) => action.actionId === "port_container_cut");

    expect(containerCut).toMatchObject({
      enabled: false,
      status: "blocked",
      disabledReason: "Sklad je pro tuto položku plný."
    });
  });

  it("projects the actual recruitment camera bonus separately from its cap", () => {
    const fixture = createCoreStateWithFixedBuildingFixture("recruitment_center");
    const stats = createCivilBuildingStats({
      definition: undefined,
      state: fixture.state,
      district: fixture.state.districtsById[fixture.building.districtId],
      building: fixture.building,
      playerId: "player:1",
      playerBalances: {},
      dayNightConfig: config,
      convenienceStoreConfig: config.balance.convenienceStore,
      recruitmentCenterConfig: config.balance.recruitmentCenter,
      tick: 0,
      tickRateMs: config.tickRateMs
    }, []);

    expect(stats).toEqual(expect.arrayContaining([
      { label: "Kamery/alarmy", value: "+1.5 %" },
      { label: "Cap kamer/alarmu", value: "max +50 %" }
    ]));
  });

  it("projects canonical spawn mechanics for garage, fitness, clinic, exchange and warehouse", () => {
    const project = (buildingTypeId: string, level = 1) => {
      const fixture = createCoreStateWithFixedBuildingFixture(buildingTypeId, {
        buildingOverrides: { level }
      });
      if (buildingTypeId === "clinic") {
        fixture.state.playersById["player:1"] = {
          ...fixture.state.playersById["player:1"],
          recoveryPool: [{
            id: "recovery:1",
            itemType: "population",
            amount: 7,
            lostAtTick: fixture.state.root.tick,
            lostAt: new Date(0).toISOString(),
            source: "attack"
          }]
        };
      }
      const [view] = createDistrictPanelBuildingViews({
        state: fixture.state,
        buildings: [fixture.building],
        buildCatalog: getAllPublicBuildingDefinitions(),
        actionCatalog: config.balance.buildingActions ?? {},
        config,
        fitnessClubConfig: config.balance.fitnessClub,
        garageConfig: config.balance.garage,
        powerStationConfig: config.balance.powerStation,
        district: fixture.state.districtsById[fixture.building.districtId],
        playerId: "player:1",
        playerBalances: fixture.state.resourceStatesById["resource:1"].balances,
        tick: fixture.state.root.tick,
        tickRateMs: config.tickRateMs
      });
      return view;
    };

    expect(project("garage").stats).toContainEqual({ label: "Zkrácení čekání", value: "-2 %" });
    expect(project("fitness_club").stats).toEqual(expect.arrayContaining([
      { label: "Síla útoku", value: "+3 %" },
      { label: "Síla obrany", value: "+2 %" },
      { label: "Cap útoku", value: "+24 %" },
      { label: "Cap obrany", value: "+18 %" }
    ]));
    expect(project("clinic").presentation?.mechanics?.clinic).toEqual({
      recoveryRatePct: 15,
      recoveryPool: {
        totalFreshAmount: 7,
        fresh: [{ id: "recovery:1", itemType: "population", amount: 7, source: "attack" }]
      },
      network: { incomeMultiplier: 1, heatMultiplier: 1 }
    });
    expect(project("exchange").presentation?.mechanics?.exchange).toEqual({
      launderingCapacity: 6_000,
      auditRiskPct: 4,
      network: { incomeMultiplier: 1, launderingLimitMultiplier: 1, heatMultiplier: 1 }
    });
    const warehouseNetwork = project("warehouse", 2).presentation?.mechanics?.warehouse?.network;
    expect(warehouseNetwork).toMatchObject({ incomeMultiplier: 1, heatMultiplier: 1 });
    expect(warehouseNetwork?.storageCapacityMultiplier).toBeCloseTo(1.68, 8);

    const warehouseFixture = createCoreStateWithFixedBuildingFixture("warehouse", {
      playerBalances: { smg: 200 }
    });
    const warehouseStorage = resolvePlayerStorageCapacitySummary(
      warehouseFixture.state,
      "player:1",
      config.balance.warehouse!
    );
    expect(warehouseStorage.groups
      .flatMap((group) => group.items)
      .find((item) => item.resourceKey === "smg"))
      .toMatchObject({ currentAmount: 200, maxAmount: 12, isFull: false, isOverCapacity: true });
  });

  it("projects exact dynamic building-action costs and deterministic rewards", () => {
    const project = (
      buildingTypeId: string,
      playerBalances: Record<string, number>,
      metadata: Record<string, unknown> = {}
    ) => {
      const fixture = createCoreStateWithFixedBuildingFixture(buildingTypeId, {
        playerBalances,
        buildingOverrides: { metadata }
      });
      const district = fixture.state.districtsById[fixture.building.districtId];
      district.influence = 100;
      const [view] = createDistrictPanelBuildingViews({
        state: fixture.state,
        buildings: [fixture.building],
        buildCatalog: getAllPublicBuildingDefinitions(),
        actionCatalog: config.balance.buildingActions ?? {},
        config,
        stockExchangeConfig: config.balance.stockExchange,
        airportConfig: config.balance.airport,
        cityHallConfig: config.balance.cityHall,
        lobbyClubConfig: config.balance.lobbyClub,
        district,
        playerId: "player:1",
        playerBalances: fixture.state.resourceStatesById["resource:1"].balances,
        tick: fixture.state.root.tick,
        tickRateMs: config.tickRateMs
      });
      return view.actions;
    };

    for (const [buildingTypeId, actionId] of [
      ["casino", "quiet_backroom"],
      ["exchange", "good_rate"],
      ["arcade", "back_cashdesk"]
    ] as const) {
      const action = project(buildingTypeId, { "dirty-cash": 10_000, cash: 0 })
        .find((candidate) => candidate.actionId === actionId);
      expect(action?.inputCost["dirty-cash"]).toBeGreaterThan(0);
      expect(action?.outputGain.cash).toBeGreaterThan(0);
      expect(action?.reportText).toContain("dirty cash");
    }

    const cityContract = project("city_hall", { cash: 20_000 })
      .find((action) => action.actionId === "city_contract");
    expect(cityContract?.outputGain.cash).toBeGreaterThan(0);
    expect(cityContract?.influenceChange).toBeLessThan(0);
    expect(cityContract?.reportText).toContain("Městská zakázka přinesla");

    const speculativeBuy = project("stock_exchange", { cash: 10_000 })
      .find((action) => action.actionId === "speculative_buy");
    expect(speculativeBuy).toMatchObject({
      inputCost: { cash: 3_500 },
      costPreview: {
        fixedInputCost: { cash: 2_500 },
        variableInputCosts: [{
          inputId: "investmentCleanCash",
          resourceKey: "cash",
          amountPerUnit: 1
        }]
      }
    });
    expect(speculativeBuy?.requiresInput.find((input) => input.id === "investmentCleanCash"))
      .toMatchObject({ min: 1, max: 7_500, defaultValue: 1_000 });

    const expressImport = project("airport", { cash: 20_000 }, {
      airport: { nextImportCostPenaltyPct: 20 }
    }).find((action) => action.actionId === "express_import");
    expect(expressImport?.inputCost.cash).toBe(2_400);
  });

  it("omits fractional clinic residue and keeps stabilization unavailable", () => {
    const fixture = createCoreStateWithFixedBuildingFixture("clinic", {
      playerBalances: { cash: 5_000 }
    });
    fixture.state.playersById["player:1"] = {
      ...fixture.state.playersById["player:1"],
      recoveryPool: [{
        id: "recovery:fractional",
        itemType: "population",
        amount: 0.75,
        lostAtTick: fixture.state.root.tick,
        lostAt: new Date(0).toISOString(),
        source: "attack"
      }]
    };
    const [view] = createDistrictPanelBuildingViews({
      state: fixture.state,
      buildings: [fixture.building],
      buildCatalog: getAllPublicBuildingDefinitions(),
      actionCatalog: config.balance.buildingActions ?? {},
      config,
      powerStationConfig: config.balance.powerStation,
      district: fixture.state.districtsById[fixture.building.districtId],
      playerId: "player:1",
      playerBalances: fixture.state.resourceStatesById["resource:1"].balances,
      tick: fixture.state.root.tick,
      tickRateMs: config.tickRateMs
    });

    expect(view.presentation?.mechanics?.clinic?.recoveryPool).toEqual({
      totalFreshAmount: 0,
      fresh: []
    });
    expect(view.actions.find((action) => action.actionId === "stabilization_protocol")).toMatchObject({
      status: "blocked",
      enabled: false,
      disabledReason: "Žádné ztráty k léčbě."
    });
  });

  it("omits private typed mechanics for buildings owned by another player", () => {
    const project = (buildingTypeId: "clinic" | "exchange" | "warehouse") => {
      const fixture = createCoreStateWithFixedBuildingFixture(buildingTypeId, {
        buildingOverrides: { ownerPlayerId: "player:2" }
      });
      const [view] = createDistrictPanelBuildingViews({
        state: fixture.state,
        buildings: [fixture.building],
        buildCatalog: getAllPublicBuildingDefinitions(),
        actionCatalog: config.balance.buildingActions ?? {},
        config,
        powerStationConfig: config.balance.powerStation,
        district: fixture.state.districtsById[fixture.building.districtId],
        playerId: "player:1",
        playerBalances: fixture.state.resourceStatesById["resource:1"].balances,
        tick: fixture.state.root.tick,
        tickRateMs: config.tickRateMs
      });
      return view;
    };

    expect(project("clinic").presentation?.mechanics).toBeNull();
    expect(project("exchange").presentation?.mechanics).toBeNull();
    expect(project("warehouse").presentation?.mechanics).toBeNull();
  });

  it("projects authoritative street dealer slots, inventory and daytime risk copy", () => {
    const fixture = createCoreStateWithFixedBuildingFixture("street_dealers", {
      playerBalances: {
        "neon-dust": 60,
        "pulse-shot": 40,
        "velvet-smoke": 20
      }
    });
    const view = createStreetDealerSaleView({
      config: config.balance.streetDealers,
      state: fixture.state,
      playerId: "player:1",
      playerBalances: fixture.state.resourceStatesById["resource:1"].balances,
      currentPhase: "day",
      dayNightRule: dayNightActionRules.start_drug_sale,
      tick: 0,
      tickRateMs: config.tickRateMs
    });

    expect(view).toMatchObject({
      phase: "day",
      phaseStatusLabel: "DEN: heat +30 %, riziko +10 p. b.",
      slotCount: 3
    });
    expect(view?.slots).toHaveLength(3);
    expect(view?.slots[0]).toMatchObject({
      slotId: "slot-1",
      itemId: "neon-dust",
      ownedAmount: 60,
      unitSalePriceDirtyCash: 625,
      minimumAmountPerSale: 10,
      locked: false
    });
  });

  it("carries typed population and dealer values through the district building projection", () => {
    const apartmentFixture = createCoreStateWithFixedBuildingFixture("apartment_block", {
      buildingOverrides: {
        metadata: {
          apartmentBlock: {
            storedPopulation: 14 / 30,
            lastCapacity: 50,
            lastUpdatedTick: 0,
            wasFull: false
          }
        }
      }
    });
    const [apartmentView] = createDistrictPanelBuildingViews({
      state: apartmentFixture.state,
      buildings: [apartmentFixture.building],
      buildCatalog: getAllPublicBuildingDefinitions(),
      actionCatalog: config.balance.buildingActions ?? {},
      config,
      recruitmentCenterConfig: config.balance.recruitmentCenter,
      district: apartmentFixture.state.districtsById[apartmentFixture.building.districtId],
      playerId: "player:1",
      playerBalances: {},
      tick: 0,
      tickRateMs: config.tickRateMs
    });

    expect(apartmentView.presentation?.populationBuffer).toEqual({
      storedAmount: 14 / 30,
      capacity: 50,
      productionPerMinute: 2,
      timeToFullMs: 1_490_000
    });

    const dealerFixture = createCoreStateWithFixedBuildingFixture("street_dealers", {
      playerBalances: {
        "neon-dust": 60,
        "pulse-shot": 40,
        "velvet-smoke": 20
      }
    });
    const [dealerView] = createDistrictPanelBuildingViews({
      state: dealerFixture.state,
      buildings: [dealerFixture.building],
      buildCatalog: getAllPublicBuildingDefinitions(),
      actionCatalog: config.balance.buildingActions ?? {},
      config,
      smugglingTunnelConfig: config.balance.smugglingTunnel,
      streetDealersConfig: config.balance.streetDealers,
      district: dealerFixture.state.districtsById[dealerFixture.building.districtId],
      playerId: "player:1",
      playerBalances: dealerFixture.state.resourceStatesById["resource:1"].balances,
      tick: 0,
      tickRateMs: config.tickRateMs
    });
    const dealerAction = dealerView.actions.find((action) => action.actionId === "start_drug_sale");

    expect(dealerAction?.dealerSale?.slotCount).toBe(3);
    expect(dealerAction?.dealerSale?.slots[0]).toMatchObject({
      itemId: "neon-dust",
      ownedAmount: 60
    });
  });
});
