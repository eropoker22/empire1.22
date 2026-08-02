import { describe, expect, it } from "vitest";
import { getAllPublicBuildingDefinitions, resolveModeConfig } from "@empire/game-config";
import { dayNightActionRules } from "../../../packages/game-config/src/public/day-night-action-rules";
import { createStreetDealerSaleView } from "../../../packages/game-core/src/projections/district-building-action-view-helpers";
import { createDistrictPanelBuildingViews } from "../../../packages/game-core/src/projections/district-building-action-projection";
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
