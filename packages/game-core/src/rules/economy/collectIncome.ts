import type { ResourceState } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import {
  calculateIncomeByPlayerId,
  getActiveFixedBuildingConfigsForDistrict,
  resolveActiveDistrictEffectModifiers
} from "./calculateIncome";
import { applyAirportIncomeModifiers } from "../../handlers/airportBuildingActions";
import { applyArcadeAuditChecks, applyArcadeIncomeModifiers } from "../../handlers/arcadeBuildingActions";
import { applyApartmentBlockPopulationProduction } from "../../handlers/apartmentBlockBuildingActions";
import { applyCasinoAuditChecks, applyCasinoIncomeModifiers } from "../../handlers/casinoBuildingActions";
import { applyCarDealerIncomeModifiers } from "../../handlers/carDealerBuildingActions";
import { applyCentralBankIncomeModifiers } from "../../handlers/centralBankBuildingActions";
import { applyCityHallIncomeModifiers } from "../../handlers/cityHallBuildingActions";
import { applyClinicIncomeModifiers } from "../../handlers/clinicBuildingActions";
import { applyConvenienceStoreIncomeModifiers, applyConvenienceStorePassiveRumors } from "../../handlers/convenienceStoreBuildingActions";
import { applyExchangeOfficeAuditChecks, applyExchangeOfficeIncomeModifiers } from "../../handlers/exchangeOfficeBuildingActions";
import { applyFitnessClubIncomeModifiers } from "../../handlers/fitnessClubBuildingActions";
import { applyGarageIncomeModifiers } from "../../handlers/garageBuildingActions";
import { applyPowerStationIncomeModifiers } from "../../handlers/powerStationBuildingActions";
import { applyRecruitmentCenterIncomeModifiers } from "../../handlers/recruitmentCenterBuildingActions";
import { applyRecyclingCenterIncomeModifiers } from "../../handlers/recyclingCenterBuildingActions";
import { applyRestaurantIncomeModifiers, applyRestaurantPassiveRumors } from "../../handlers/restaurantBuildingActions";
import { applyShoppingMallIncomeModifiers } from "../../handlers/shoppingMallBuildingActions";
import { applyStockExchangeIncomeModifiers } from "../../handlers/stockExchangeBuildingActions";
import {
  applySchoolIncomeModifiers,
  applySchoolStudentProduction
} from "../../handlers/schoolBuildingActions";
import {
  applySmugglingTunnelBatchProduction,
  applySmugglingTunnelIncomeModifiers
} from "../../handlers/smugglingTunnelBuildingActions";
import { applyStreetDealersIncomeModifiers } from "../../handlers/streetDealersBuildingActions";
import { applyStripClubIncomeModifiers, applyStripClubPassiveRumors } from "../../handlers/stripClubBuildingActions";
import { applyVipLoungeIncomeModifiers, applyVipLoungePassiveRumors } from "../../handlers/vipLoungeBuildingActions";
import { applyWarehouseIncomeModifiers } from "../../handlers/warehouseBuilding";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Responsibility: Applies periodic income collection to the authoritative state.
 * Belongs here: server-side economy transitions driven by ticks or commands.
 * Does not belong here: UI timing or client cache updates.
 */
export const collectIncome = (state: CoreGameState, context?: GameCoreContext): CoreGameState => {
  const incomeByPlayerId = calculateIncomeByPlayerId(state, context);

  if (!context && Object.keys(incomeByPlayerId).length === 0) {
    return state;
  }

  let changed = false;
  let nextResourceStatesById = state.resourceStatesById;

  for (const [playerId, incomeBalances] of Object.entries(incomeByPlayerId)) {
    const player = state.playersById[playerId];

    if (!player) {
      continue;
    }

    const currentResourceState = state.resourceStatesById[player.resourceStateId] ?? createPlayerResourceState(player, state.root.tick);
    const nextBalances = {
      ...currentResourceState.balances
    };

    for (const [resourceKey, amount] of Object.entries(incomeBalances)) {
      nextBalances[resourceKey] = Math.max(0, Number(nextBalances[resourceKey] || 0) + amount);
    }

    nextResourceStatesById = {
      ...nextResourceStatesById,
      [currentResourceState.id]: {
        ...currentResourceState,
        balances: nextBalances,
        lastUpdatedTick: state.root.tick,
        version: currentResourceState.version + (state.resourceStatesById[currentResourceState.id] ? 1 : 0)
      }
    };
    changed = true;
  }

  const districtPressureResult = context
    ? applyFixedBuildingPassivePressure(state, context)
    : {
        changed: false,
        districtsById: state.districtsById
      };
  changed = changed || districtPressureResult.changed;

  const incomeState = changed
    ? {
        ...state,
        resourceStatesById: nextResourceStatesById,
        districtsById: districtPressureResult.districtsById
      }
    : state;

  const casinoAuditState = context?.config.balance.casino
    ? applyCasinoAuditChecks(incomeState, context.config.balance.casino, context.config.tickRateMs)
    : incomeState;
  const exchangeAuditState = context?.config.balance.exchangeOffice
    ? applyExchangeOfficeAuditChecks(casinoAuditState, context.config.balance.exchangeOffice, context.config.tickRateMs)
    : casinoAuditState;
  const arcadeAuditState = context?.config.balance.arcade
    ? applyArcadeAuditChecks(exchangeAuditState, context.config.balance.arcade, context.config.tickRateMs)
    : exchangeAuditState;
  const apartmentState = context?.config.balance.apartmentBlock
    ? applyApartmentBlockPopulationProduction(arcadeAuditState, context.config.balance.apartmentBlock, context.config.tickRateMs, context.config.balance.powerStation, context.config.balance.recruitmentCenter)
    : arcadeAuditState;
  const schoolState = context?.config.balance.school
    ? applySchoolStudentProduction(apartmentState, context.config.balance.school, context.config.tickRateMs)
    : apartmentState;
  const smugglingTunnelState = context?.config.balance.smugglingTunnel
    ? applySmugglingTunnelBatchProduction({
        state: schoolState,
        config: context.config.balance.smugglingTunnel,
        tickRateMs: context.config.tickRateMs,
        incomeMultiplier: context.config.balance.incomeMultiplier
      })
    : schoolState;
  const stripClubRumorState = context?.config.balance.stripClub
    ? applyStripClubPassiveRumors(smugglingTunnelState, context.config.balance.stripClub, context.config.tickRateMs)
    : smugglingTunnelState;
  const restaurantRumorState = context?.config.balance.restaurant
    ? applyRestaurantPassiveRumors(stripClubRumorState, context.config.balance.restaurant, context.config.tickRateMs)
    : stripClubRumorState;
  const convenienceRumorState = context?.config.balance.convenienceStore
    ? applyConvenienceStorePassiveRumors(restaurantRumorState, context.config.balance.convenienceStore, context.config.tickRateMs, context.config.balance.restaurant)
    : restaurantRumorState;
  return context?.config.balance.vipLounge
    ? applyVipLoungePassiveRumors(convenienceRumorState, context.config.balance.vipLounge, context.config.tickRateMs)
    : convenienceRumorState;
};

const createPlayerResourceState = (
  player: CoreGameState["playersById"][string],
  tick: number
): ResourceState => ({
  id: player.resourceStateId,
  ownerType: "player",
  ownerId: player.id,
  balances: {},
  incomeModifiers: {},
  lastUpdatedTick: tick,
  version: 1
});

const applyFixedBuildingPassivePressure = (
  state: CoreGameState,
  context: GameCoreContext
): { changed: boolean; districtsById: CoreGameState["districtsById"] } => {
  if (!context.config.balance.fixedBuildings) {
    return {
      changed: false,
      districtsById: state.districtsById
    };
  }

  const ticksPerDay = DAY_MS / Math.max(1, context.config.tickRateMs);
  let changed = false;
  let nextDistrictsById = state.districtsById;

  for (const district of Object.values(state.districtsById)) {
    if (!district.ownerPlayerId || district.status === "destroyed") {
      continue;
    }

    const activeBuildings = getActiveFixedBuildingConfigsForDistrict(state, district, context);
    const modifiers = resolveActiveDistrictEffectModifiers(state, district.id);
    const baseHeatPerDay = activeBuildings.reduce((total, { building, config }) => {
      const casinoConfig = context.config.balance.casino
        ? applyCasinoIncomeModifiers({
            config: context.config.balance.casino,
            building,
            tick: state.root.tick,
            cleanPerHour: config.cleanPerHour,
            dirtyPerHour: config.dirtyPerHour,
            heatPerDay: config.heatPerDay,
            influencePerDay: config.influencePerDay
          })
        : config;
      const activeConfig = context.config.balance.exchangeOffice
        ? applyExchangeOfficeIncomeModifiers({
            config: context.config.balance.exchangeOffice,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: casinoConfig.cleanPerHour,
            dirtyPerHour: casinoConfig.dirtyPerHour,
            heatPerDay: casinoConfig.heatPerDay,
            influencePerDay: casinoConfig.influencePerDay
          })
        : casinoConfig;
      const finalConfig = context.config.balance.arcade
        ? applyArcadeIncomeModifiers({
            config: context.config.balance.arcade,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: activeConfig.cleanPerHour,
            dirtyPerHour: activeConfig.dirtyPerHour,
            heatPerDay: activeConfig.heatPerDay,
            influencePerDay: activeConfig.influencePerDay
          })
        : activeConfig;
      const warehouseConfig = context.config.balance.warehouse
        ? applyWarehouseIncomeModifiers({
            config: context.config.balance.warehouse,
            state,
            building,
            cleanPerHour: finalConfig.cleanPerHour,
            dirtyPerHour: finalConfig.dirtyPerHour,
            heatPerDay: finalConfig.heatPerDay,
            influencePerDay: finalConfig.influencePerDay
        })
        : finalConfig;
      const clinicConfig = context.config.balance.clinic
        ? applyClinicIncomeModifiers({
            config: context.config.balance.clinic,
            state,
            building,
            cleanPerHour: warehouseConfig.cleanPerHour,
            dirtyPerHour: warehouseConfig.dirtyPerHour,
            heatPerDay: warehouseConfig.heatPerDay,
            influencePerDay: warehouseConfig.influencePerDay
          })
        : warehouseConfig;
      const stripClubConfig = context.config.balance.stripClub
        ? applyStripClubIncomeModifiers({
            config: context.config.balance.stripClub,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: clinicConfig.cleanPerHour,
            dirtyPerHour: clinicConfig.dirtyPerHour,
            heatPerDay: clinicConfig.heatPerDay,
            influencePerDay: clinicConfig.influencePerDay
        })
        : clinicConfig;
      const restaurantConfig = context.config.balance.restaurant
        ? applyRestaurantIncomeModifiers({
            config: context.config.balance.restaurant,
            state,
            building,
            cleanPerHour: stripClubConfig.cleanPerHour,
            dirtyPerHour: stripClubConfig.dirtyPerHour,
            heatPerDay: stripClubConfig.heatPerDay,
            influencePerDay: stripClubConfig.influencePerDay
          })
        : stripClubConfig;
      const convenienceStoreConfig = context.config.balance.convenienceStore
        ? applyConvenienceStoreIncomeModifiers({
            config: context.config.balance.convenienceStore,
            state,
            building,
            cleanPerHour: restaurantConfig.cleanPerHour,
            dirtyPerHour: restaurantConfig.dirtyPerHour,
            heatPerDay: restaurantConfig.heatPerDay,
            influencePerDay: restaurantConfig.influencePerDay
          })
        : restaurantConfig;
      const recruitmentCenterConfig = context.config.balance.recruitmentCenter
        ? applyRecruitmentCenterIncomeModifiers({
            config: context.config.balance.recruitmentCenter,
            state,
            building,
            cleanPerHour: convenienceStoreConfig.cleanPerHour,
            dirtyPerHour: convenienceStoreConfig.dirtyPerHour,
            heatPerDay: convenienceStoreConfig.heatPerDay,
            influencePerDay: convenienceStoreConfig.influencePerDay
          })
        : convenienceStoreConfig;
      const fitnessClubConfig = context.config.balance.fitnessClub
        ? applyFitnessClubIncomeModifiers({
            config: context.config.balance.fitnessClub,
            state,
            building,
            cleanPerHour: recruitmentCenterConfig.cleanPerHour,
            dirtyPerHour: recruitmentCenterConfig.dirtyPerHour,
            heatPerDay: recruitmentCenterConfig.heatPerDay,
            influencePerDay: recruitmentCenterConfig.influencePerDay
          })
        : recruitmentCenterConfig;
      const shoppingMallConfig = context.config.balance.shoppingMall
        ? applyShoppingMallIncomeModifiers({
            config: context.config.balance.shoppingMall,
            state,
            building,
            cleanPerHour: fitnessClubConfig.cleanPerHour,
            dirtyPerHour: fitnessClubConfig.dirtyPerHour,
            heatPerDay: fitnessClubConfig.heatPerDay,
            influencePerDay: fitnessClubConfig.influencePerDay
          })
        : fitnessClubConfig;
      const stockExchangeConfig = context.config.balance.stockExchange
        ? applyStockExchangeIncomeModifiers({
            config: context.config.balance.stockExchange,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: shoppingMallConfig.cleanPerHour,
            dirtyPerHour: shoppingMallConfig.dirtyPerHour,
            heatPerDay: shoppingMallConfig.heatPerDay,
            influencePerDay: shoppingMallConfig.influencePerDay
          })
        : shoppingMallConfig;
      const airportConfig = context.config.balance.airport
        ? applyAirportIncomeModifiers({
            config: context.config.balance.airport,
            building,
            cleanPerHour: stockExchangeConfig.cleanPerHour,
            dirtyPerHour: stockExchangeConfig.dirtyPerHour,
            heatPerDay: stockExchangeConfig.heatPerDay,
            influencePerDay: stockExchangeConfig.influencePerDay
          })
        : stockExchangeConfig;
      const cityHallConfig = context.config.balance.cityHall
        ? applyCityHallIncomeModifiers({
            config: context.config.balance.cityHall,
            state,
            building,
            districtId: district.id,
            tick: state.root.tick,
            cleanPerHour: airportConfig.cleanPerHour,
            dirtyPerHour: airportConfig.dirtyPerHour,
            heatPerDay: airportConfig.heatPerDay,
            influencePerDay: airportConfig.influencePerDay
          })
        : airportConfig;
      const centralBankConfig = context.config.balance.centralBank
        ? applyCentralBankIncomeModifiers({
            config: context.config.balance.centralBank,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: cityHallConfig.cleanPerHour,
            dirtyPerHour: cityHallConfig.dirtyPerHour,
            heatPerDay: cityHallConfig.heatPerDay,
            influencePerDay: cityHallConfig.influencePerDay
          })
        : cityHallConfig;
      const vipLoungeConfig = context.config.balance.vipLounge
        ? applyVipLoungeIncomeModifiers({
            config: context.config.balance.vipLounge,
            state,
            building,
            cleanPerHour: centralBankConfig.cleanPerHour,
            dirtyPerHour: centralBankConfig.dirtyPerHour,
            heatPerDay: centralBankConfig.heatPerDay,
            influencePerDay: centralBankConfig.influencePerDay
          })
        : centralBankConfig;
      const garageConfig = context.config.balance.garage
        ? applyGarageIncomeModifiers({
            config: context.config.balance.garage,
            state,
            building,
            cleanPerHour: vipLoungeConfig.cleanPerHour,
            dirtyPerHour: vipLoungeConfig.dirtyPerHour,
            heatPerDay: vipLoungeConfig.heatPerDay,
            influencePerDay: vipLoungeConfig.influencePerDay
          })
        : vipLoungeConfig;
      const carDealerConfig = context.config.balance.carDealer
        ? applyCarDealerIncomeModifiers({
            config: context.config.balance.carDealer,
            state,
            building,
            cleanPerHour: garageConfig.cleanPerHour,
            dirtyPerHour: garageConfig.dirtyPerHour,
            heatPerDay: garageConfig.heatPerDay,
            influencePerDay: garageConfig.influencePerDay
          })
        : garageConfig;
      const recyclingCenterConfig = context.config.balance.recyclingCenter
        ? applyRecyclingCenterIncomeModifiers({
            config: context.config.balance.recyclingCenter,
            state,
            building,
            cleanPerHour: carDealerConfig.cleanPerHour,
            dirtyPerHour: carDealerConfig.dirtyPerHour,
            heatPerDay: carDealerConfig.heatPerDay,
            influencePerDay: carDealerConfig.influencePerDay
          })
        : carDealerConfig;
      const schoolConfig = context.config.balance.school
        ? applySchoolIncomeModifiers({
            config: context.config.balance.school,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: recyclingCenterConfig.cleanPerHour,
            dirtyPerHour: recyclingCenterConfig.dirtyPerHour,
            heatPerDay: recyclingCenterConfig.heatPerDay,
            influencePerDay: recyclingCenterConfig.influencePerDay
          })
        : recyclingCenterConfig;
      const smugglingTunnelConfig = context.config.balance.smugglingTunnel
        ? applySmugglingTunnelIncomeModifiers({
            config: context.config.balance.smugglingTunnel,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: schoolConfig.cleanPerHour,
            dirtyPerHour: schoolConfig.dirtyPerHour,
            heatPerDay: schoolConfig.heatPerDay,
            influencePerDay: schoolConfig.influencePerDay
          })
        : schoolConfig;
      const streetDealersConfig = context.config.balance.streetDealers
        ? applyStreetDealersIncomeModifiers({
            config: context.config.balance.streetDealers,
            smugglingTunnelConfig: context.config.balance.smugglingTunnel,
            state,
            building,
            cleanPerHour: smugglingTunnelConfig.cleanPerHour,
            dirtyPerHour: smugglingTunnelConfig.dirtyPerHour,
            heatPerDay: smugglingTunnelConfig.heatPerDay,
            influencePerDay: smugglingTunnelConfig.influencePerDay
          })
        : smugglingTunnelConfig;
      const powerStationConfig = context.config.balance.powerStation
        ? applyPowerStationIncomeModifiers({
            config: context.config.balance.powerStation,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: streetDealersConfig.cleanPerHour,
            dirtyPerHour: streetDealersConfig.dirtyPerHour,
            heatPerDay: streetDealersConfig.heatPerDay,
            influencePerDay: streetDealersConfig.influencePerDay
          })
        : streetDealersConfig;
      return total + sanitizePerDay(powerStationConfig.heatPerDay);
    }, 0);
    const baseInfluencePerDay = activeBuildings.reduce((total, { building, config }) => {
      const casinoConfig = context.config.balance.casino
        ? applyCasinoIncomeModifiers({
            config: context.config.balance.casino,
            building,
            tick: state.root.tick,
            cleanPerHour: config.cleanPerHour,
            dirtyPerHour: config.dirtyPerHour,
            heatPerDay: config.heatPerDay,
            influencePerDay: config.influencePerDay
          })
        : config;
      const activeConfig = context.config.balance.exchangeOffice
        ? applyExchangeOfficeIncomeModifiers({
            config: context.config.balance.exchangeOffice,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: casinoConfig.cleanPerHour,
            dirtyPerHour: casinoConfig.dirtyPerHour,
            heatPerDay: casinoConfig.heatPerDay,
            influencePerDay: casinoConfig.influencePerDay
          })
        : casinoConfig;
      const finalConfig = context.config.balance.arcade
        ? applyArcadeIncomeModifiers({
            config: context.config.balance.arcade,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: activeConfig.cleanPerHour,
            dirtyPerHour: activeConfig.dirtyPerHour,
            heatPerDay: activeConfig.heatPerDay,
            influencePerDay: activeConfig.influencePerDay
          })
        : activeConfig;
      const warehouseConfig = context.config.balance.warehouse
        ? applyWarehouseIncomeModifiers({
            config: context.config.balance.warehouse,
            state,
            building,
            cleanPerHour: finalConfig.cleanPerHour,
            dirtyPerHour: finalConfig.dirtyPerHour,
            heatPerDay: finalConfig.heatPerDay,
            influencePerDay: finalConfig.influencePerDay
        })
        : finalConfig;
      const clinicConfig = context.config.balance.clinic
        ? applyClinicIncomeModifiers({
            config: context.config.balance.clinic,
            state,
            building,
            cleanPerHour: warehouseConfig.cleanPerHour,
            dirtyPerHour: warehouseConfig.dirtyPerHour,
            heatPerDay: warehouseConfig.heatPerDay,
            influencePerDay: warehouseConfig.influencePerDay
          })
        : warehouseConfig;
      const stripClubConfig = context.config.balance.stripClub
        ? applyStripClubIncomeModifiers({
            config: context.config.balance.stripClub,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: clinicConfig.cleanPerHour,
            dirtyPerHour: clinicConfig.dirtyPerHour,
            heatPerDay: clinicConfig.heatPerDay,
            influencePerDay: clinicConfig.influencePerDay
        })
        : clinicConfig;
      const restaurantConfig = context.config.balance.restaurant
        ? applyRestaurantIncomeModifiers({
            config: context.config.balance.restaurant,
            state,
            building,
            cleanPerHour: stripClubConfig.cleanPerHour,
            dirtyPerHour: stripClubConfig.dirtyPerHour,
            heatPerDay: stripClubConfig.heatPerDay,
            influencePerDay: stripClubConfig.influencePerDay
          })
        : stripClubConfig;
      const convenienceStoreConfig = context.config.balance.convenienceStore
        ? applyConvenienceStoreIncomeModifiers({
            config: context.config.balance.convenienceStore,
            state,
            building,
            cleanPerHour: restaurantConfig.cleanPerHour,
            dirtyPerHour: restaurantConfig.dirtyPerHour,
            heatPerDay: restaurantConfig.heatPerDay,
            influencePerDay: restaurantConfig.influencePerDay
          })
        : restaurantConfig;
      const recruitmentCenterConfig = context.config.balance.recruitmentCenter
        ? applyRecruitmentCenterIncomeModifiers({
            config: context.config.balance.recruitmentCenter,
            state,
            building,
            cleanPerHour: convenienceStoreConfig.cleanPerHour,
            dirtyPerHour: convenienceStoreConfig.dirtyPerHour,
            heatPerDay: convenienceStoreConfig.heatPerDay,
            influencePerDay: convenienceStoreConfig.influencePerDay
          })
        : convenienceStoreConfig;
      const fitnessClubConfig = context.config.balance.fitnessClub
        ? applyFitnessClubIncomeModifiers({
            config: context.config.balance.fitnessClub,
            state,
            building,
            cleanPerHour: recruitmentCenterConfig.cleanPerHour,
            dirtyPerHour: recruitmentCenterConfig.dirtyPerHour,
            heatPerDay: recruitmentCenterConfig.heatPerDay,
            influencePerDay: recruitmentCenterConfig.influencePerDay
          })
        : recruitmentCenterConfig;
      const shoppingMallConfig = context.config.balance.shoppingMall
        ? applyShoppingMallIncomeModifiers({
            config: context.config.balance.shoppingMall,
            state,
            building,
            cleanPerHour: fitnessClubConfig.cleanPerHour,
            dirtyPerHour: fitnessClubConfig.dirtyPerHour,
            heatPerDay: fitnessClubConfig.heatPerDay,
            influencePerDay: fitnessClubConfig.influencePerDay
          })
        : fitnessClubConfig;
      const stockExchangeConfig = context.config.balance.stockExchange
        ? applyStockExchangeIncomeModifiers({
            config: context.config.balance.stockExchange,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: shoppingMallConfig.cleanPerHour,
            dirtyPerHour: shoppingMallConfig.dirtyPerHour,
            heatPerDay: shoppingMallConfig.heatPerDay,
            influencePerDay: shoppingMallConfig.influencePerDay
          })
        : shoppingMallConfig;
      const airportConfig = context.config.balance.airport
        ? applyAirportIncomeModifiers({
            config: context.config.balance.airport,
            building,
            cleanPerHour: stockExchangeConfig.cleanPerHour,
            dirtyPerHour: stockExchangeConfig.dirtyPerHour,
            heatPerDay: stockExchangeConfig.heatPerDay,
            influencePerDay: stockExchangeConfig.influencePerDay
          })
        : stockExchangeConfig;
      const cityHallConfig = context.config.balance.cityHall
        ? applyCityHallIncomeModifiers({
            config: context.config.balance.cityHall,
            state,
            building,
            districtId: district.id,
            tick: state.root.tick,
            cleanPerHour: airportConfig.cleanPerHour,
            dirtyPerHour: airportConfig.dirtyPerHour,
            heatPerDay: airportConfig.heatPerDay,
            influencePerDay: airportConfig.influencePerDay
          })
        : airportConfig;
      const centralBankConfig = context.config.balance.centralBank
        ? applyCentralBankIncomeModifiers({
            config: context.config.balance.centralBank,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: cityHallConfig.cleanPerHour,
            dirtyPerHour: cityHallConfig.dirtyPerHour,
            heatPerDay: cityHallConfig.heatPerDay,
            influencePerDay: cityHallConfig.influencePerDay
          })
        : cityHallConfig;
      const vipLoungeConfig = context.config.balance.vipLounge
        ? applyVipLoungeIncomeModifiers({
            config: context.config.balance.vipLounge,
            state,
            building,
            cleanPerHour: centralBankConfig.cleanPerHour,
            dirtyPerHour: centralBankConfig.dirtyPerHour,
            heatPerDay: centralBankConfig.heatPerDay,
            influencePerDay: centralBankConfig.influencePerDay
          })
        : centralBankConfig;
      const garageConfig = context.config.balance.garage
        ? applyGarageIncomeModifiers({
            config: context.config.balance.garage,
            state,
            building,
            cleanPerHour: vipLoungeConfig.cleanPerHour,
            dirtyPerHour: vipLoungeConfig.dirtyPerHour,
            heatPerDay: vipLoungeConfig.heatPerDay,
            influencePerDay: vipLoungeConfig.influencePerDay
          })
        : vipLoungeConfig;
      const carDealerConfig = context.config.balance.carDealer
        ? applyCarDealerIncomeModifiers({
            config: context.config.balance.carDealer,
            state,
            building,
            cleanPerHour: garageConfig.cleanPerHour,
            dirtyPerHour: garageConfig.dirtyPerHour,
            heatPerDay: garageConfig.heatPerDay,
            influencePerDay: garageConfig.influencePerDay
          })
        : garageConfig;
      const recyclingCenterConfig = context.config.balance.recyclingCenter
        ? applyRecyclingCenterIncomeModifiers({
            config: context.config.balance.recyclingCenter,
            state,
            building,
            cleanPerHour: carDealerConfig.cleanPerHour,
            dirtyPerHour: carDealerConfig.dirtyPerHour,
            heatPerDay: carDealerConfig.heatPerDay,
            influencePerDay: carDealerConfig.influencePerDay
          })
        : carDealerConfig;
      const schoolConfig = context.config.balance.school
        ? applySchoolIncomeModifiers({
            config: context.config.balance.school,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: recyclingCenterConfig.cleanPerHour,
            dirtyPerHour: recyclingCenterConfig.dirtyPerHour,
            heatPerDay: recyclingCenterConfig.heatPerDay,
            influencePerDay: recyclingCenterConfig.influencePerDay
          })
        : recyclingCenterConfig;
      const smugglingTunnelConfig = context.config.balance.smugglingTunnel
        ? applySmugglingTunnelIncomeModifiers({
            config: context.config.balance.smugglingTunnel,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: schoolConfig.cleanPerHour,
            dirtyPerHour: schoolConfig.dirtyPerHour,
            heatPerDay: schoolConfig.heatPerDay,
            influencePerDay: schoolConfig.influencePerDay
          })
        : schoolConfig;
      const streetDealersConfig = context.config.balance.streetDealers
        ? applyStreetDealersIncomeModifiers({
            config: context.config.balance.streetDealers,
            smugglingTunnelConfig: context.config.balance.smugglingTunnel,
            state,
            building,
            cleanPerHour: smugglingTunnelConfig.cleanPerHour,
            dirtyPerHour: smugglingTunnelConfig.dirtyPerHour,
            heatPerDay: smugglingTunnelConfig.heatPerDay,
            influencePerDay: smugglingTunnelConfig.influencePerDay
          })
        : smugglingTunnelConfig;
      const powerStationConfig = context.config.balance.powerStation
        ? applyPowerStationIncomeModifiers({
            config: context.config.balance.powerStation,
            state,
            building,
            tick: state.root.tick,
            cleanPerHour: streetDealersConfig.cleanPerHour,
            dirtyPerHour: streetDealersConfig.dirtyPerHour,
            heatPerDay: streetDealersConfig.heatPerDay,
            influencePerDay: streetDealersConfig.influencePerDay
          })
        : streetDealersConfig;
      return total + sanitizePerDay(powerStationConfig.influencePerDay);
    }, 0);
    const heatPerDay = baseHeatPerDay * modifiers.heatMultiplier + modifiers.heatPerDay;
    const influencePerDay = baseInfluencePerDay * modifiers.influenceMultiplier + modifiers.influencePerDay;
    const heatDelta = resolvePerTick(heatPerDay, ticksPerDay);
    const influenceDelta = resolvePerTick(influencePerDay, ticksPerDay);

    if (Math.abs(heatDelta) <= Number.EPSILON && Math.abs(influenceDelta) <= Number.EPSILON) {
      continue;
    }

    const nextHeat = Math.max(0, Number(district.heat || 0) + heatDelta);
    const nextInfluence = Math.max(0, Number(district.influence || 0) + influenceDelta);

    nextDistrictsById = {
      ...nextDistrictsById,
      [district.id]: {
        ...district,
        heat: nextHeat,
        influence: nextInfluence,
        version: district.version + 1
      }
    };
    changed = true;
  }

  return {
    changed,
    districtsById: nextDistrictsById
  };
};

const sanitizePerDay = (value: unknown): number => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const resolvePerTick = (perDay: number, ticksPerDay: number): number =>
  Number.isFinite(perDay) && ticksPerDay > 0 ? perDay / ticksPerDay : 0;
