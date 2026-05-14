import type { FixedBuildingBalanceConfig } from "../../contracts";
import type { GameCoreContext } from "../../engine/context";
import type { CoreGameState } from "../../entities";
import { applyAirportIncomeModifiers } from "../../handlers/airportBuildingActions";
import { applyArcadeIncomeModifiers } from "../../handlers/arcadeBuildingActions";
import { applyCarDealerIncomeModifiers } from "../../handlers/carDealerBuildingActions";
import { applyCasinoIncomeModifiers } from "../../handlers/casinoBuildingActions";
import { applyCentralBankIncomeModifiers } from "../../handlers/centralBankBuildingActions";
import { applyCityHallIncomeModifiers } from "../../handlers/cityHallBuildingActions";
import { applyClinicIncomeModifiers } from "../../handlers/clinicBuildingActions";
import { applyConvenienceStoreIncomeModifiers } from "../../handlers/convenienceStoreBuildingActions";
import { applyCourthouseIncomeModifiers } from "../../handlers/courthouseBuildingActions";
import { applyExchangeOfficeIncomeModifiers } from "../../handlers/exchangeOfficeBuildingActions";
import { applyFitnessClubIncomeModifiers } from "../../handlers/fitnessClubBuildingActions";
import { applyGarageIncomeModifiers } from "../../handlers/garageBuildingActions";
import { applyLobbyClubIncomeModifiers } from "../../handlers/lobbyClubBuildingActions";
import { applyPowerStationIncomeModifiers } from "../../handlers/powerStationBuildingActions";
import { applyRecruitmentCenterIncomeModifiers } from "../../handlers/recruitmentCenterBuildingActions";
import { applyRecyclingCenterIncomeModifiers } from "../../handlers/recyclingCenterBuildingActions";
import { applyRestaurantIncomeModifiers } from "../../handlers/restaurantBuildingActions";
import { applySchoolIncomeModifiers } from "../../handlers/schoolBuildingActions";
import { applyShoppingMallIncomeModifiers } from "../../handlers/shoppingMallBuildingActions";
import { applySmugglingTunnelIncomeModifiers } from "../../handlers/smugglingTunnelBuildingActions";
import { applyStockExchangeIncomeModifiers } from "../../handlers/stockExchangeBuildingActions";
import { applyStreetDealersIncomeModifiers } from "../../handlers/streetDealersBuildingActions";
import { applyStripClubIncomeModifiers } from "../../handlers/stripClubBuildingActions";
import { applyVipLoungeIncomeModifiers } from "../../handlers/vipLoungeBuildingActions";
import { applyWarehouseIncomeModifiers } from "../../handlers/warehouseBuilding";

interface FixedBuildingIncomeValues {
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}

export const resolveFixedBuildingIncomeConfig = (input: {
  state: CoreGameState;
  context: GameCoreContext;
  districtId: string;
  building: CoreGameState["buildingsById"][string];
  config: FixedBuildingBalanceConfig;
}): FixedBuildingIncomeValues => {
  const { state, context, districtId, building, config } = input;
  const casinoConfig = context.config.balance.casino
    ? applyCasinoIncomeModifiers({
        config: context.config.balance.casino,
        building,
        tick: state.root.tick,
        ...toIncomeModifierInput(config)
      })
    : config;
  const activeConfig = context.config.balance.exchangeOffice
    ? applyExchangeOfficeIncomeModifiers({
        config: context.config.balance.exchangeOffice,
        state,
        building,
        tick: state.root.tick,
        ...toIncomeModifierInput(casinoConfig)
      })
    : casinoConfig;
  const finalConfig = context.config.balance.arcade
    ? applyArcadeIncomeModifiers({
        config: context.config.balance.arcade,
        state,
        building,
        tick: state.root.tick,
        ...toIncomeModifierInput(activeConfig)
      })
    : activeConfig;
  const warehouseConfig = context.config.balance.warehouse
    ? applyWarehouseIncomeModifiers({
        config: context.config.balance.warehouse,
        state,
        building,
        ...toIncomeModifierInput(finalConfig)
    })
    : finalConfig;
  const clinicConfig = context.config.balance.clinic
    ? applyClinicIncomeModifiers({
        config: context.config.balance.clinic,
        state,
        building,
        ...toIncomeModifierInput(warehouseConfig)
      })
    : warehouseConfig;
  const stripClubConfig = context.config.balance.stripClub
    ? applyStripClubIncomeModifiers({
        config: context.config.balance.stripClub,
        state,
        building,
        tick: state.root.tick,
        ...toIncomeModifierInput(clinicConfig)
    })
    : clinicConfig;
  const restaurantConfig = context.config.balance.restaurant
    ? applyRestaurantIncomeModifiers({
        config: context.config.balance.restaurant,
        state,
        building,
        ...toIncomeModifierInput(stripClubConfig)
      })
    : stripClubConfig;
  const convenienceStoreConfig = context.config.balance.convenienceStore
    ? applyConvenienceStoreIncomeModifiers({
        config: context.config.balance.convenienceStore,
        state,
        building,
        ...toIncomeModifierInput(restaurantConfig)
      })
    : restaurantConfig;
  const recruitmentCenterConfig = context.config.balance.recruitmentCenter
    ? applyRecruitmentCenterIncomeModifiers({
        config: context.config.balance.recruitmentCenter,
        state,
        building,
        ...toIncomeModifierInput(convenienceStoreConfig)
      })
    : convenienceStoreConfig;
  const fitnessClubConfig = context.config.balance.fitnessClub
    ? applyFitnessClubIncomeModifiers({
        config: context.config.balance.fitnessClub,
        state,
        building,
        ...toIncomeModifierInput(recruitmentCenterConfig)
      })
    : recruitmentCenterConfig;
  const shoppingMallConfig = context.config.balance.shoppingMall
    ? applyShoppingMallIncomeModifiers({
        config: context.config.balance.shoppingMall,
        state,
        building,
        ...toIncomeModifierInput(fitnessClubConfig)
      })
    : fitnessClubConfig;
  const stockExchangeConfig = context.config.balance.stockExchange
    ? applyStockExchangeIncomeModifiers({
        config: context.config.balance.stockExchange,
        state,
        building,
        tick: state.root.tick,
        ...toIncomeModifierInput(shoppingMallConfig)
      })
    : shoppingMallConfig;
  const airportConfig = context.config.balance.airport
    ? applyAirportIncomeModifiers({
        config: context.config.balance.airport,
        building,
        ...toIncomeModifierInput(stockExchangeConfig)
      })
    : stockExchangeConfig;
  const cityHallConfig = context.config.balance.cityHall
    ? applyCityHallIncomeModifiers({
        config: context.config.balance.cityHall,
        state,
        building,
        districtId: districtId,
        tick: state.root.tick,
        ...toIncomeModifierInput(airportConfig)
      })
    : airportConfig;
  const centralBankConfig = context.config.balance.centralBank
    ? applyCentralBankIncomeModifiers({
        config: context.config.balance.centralBank,
        state,
        building,
        tick: state.root.tick,
        ...toIncomeModifierInput(cityHallConfig)
      })
    : cityHallConfig;
  const vipLoungeConfig = context.config.balance.vipLounge
    ? applyVipLoungeIncomeModifiers({
        config: context.config.balance.vipLounge,
        state,
        building,
        ...toIncomeModifierInput(centralBankConfig)
      })
    : centralBankConfig;
  const garageConfig = context.config.balance.garage
    ? applyGarageIncomeModifiers({
        config: context.config.balance.garage,
        state,
        building,
        ...toIncomeModifierInput(vipLoungeConfig)
      })
    : vipLoungeConfig;
  const carDealerConfig = context.config.balance.carDealer
    ? applyCarDealerIncomeModifiers({
        config: context.config.balance.carDealer,
        state,
        building,
        ...toIncomeModifierInput(garageConfig)
      })
    : garageConfig;
  const recyclingCenterConfig = context.config.balance.recyclingCenter
    ? applyRecyclingCenterIncomeModifiers({
        config: context.config.balance.recyclingCenter,
        state,
        building,
        ...toIncomeModifierInput(carDealerConfig)
      })
    : carDealerConfig;
  const schoolConfig = context.config.balance.school
    ? applySchoolIncomeModifiers({
        config: context.config.balance.school,
        state,
        building,
        tick: state.root.tick,
        ...toIncomeModifierInput(recyclingCenterConfig)
      })
    : recyclingCenterConfig;
  const smugglingTunnelConfig = context.config.balance.smugglingTunnel
    ? applySmugglingTunnelIncomeModifiers({
        config: context.config.balance.smugglingTunnel,
        state,
        building,
        tick: state.root.tick,
        ...toIncomeModifierInput(schoolConfig)
      })
    : schoolConfig;
  const streetDealersConfig = context.config.balance.streetDealers
    ? applyStreetDealersIncomeModifiers({
        config: context.config.balance.streetDealers,
        smugglingTunnelConfig: context.config.balance.smugglingTunnel,
        state,
        building,
        ...toIncomeModifierInput(smugglingTunnelConfig)
      })
    : smugglingTunnelConfig;
  const powerStationConfig = context.config.balance.powerStation
    ? applyPowerStationIncomeModifiers({
        config: context.config.balance.powerStation,
        state,
        building,
        tick: state.root.tick,
        ...toIncomeModifierInput(streetDealersConfig)
      })
    : streetDealersConfig;
  const lobbyClubConfig = context.config.balance.lobbyClub
    ? applyLobbyClubIncomeModifiers({
        config: context.config.balance.lobbyClub,
        state,
        building,
        tick: state.root.tick,
        ...toIncomeModifierInput(powerStationConfig)
      })
    : powerStationConfig;
  const courthouseConfig = context.config.balance.courthouse
    ? applyCourthouseIncomeModifiers({
        config: context.config.balance.courthouse,
        state,
        building,
        ...toIncomeModifierInput(lobbyClubConfig)
      })
    : lobbyClubConfig;
  return courthouseConfig;
};

const toIncomeModifierInput = (config: FixedBuildingIncomeValues) => ({
  cleanPerHour: config.cleanPerHour,
  dirtyPerHour: config.dirtyPerHour,
  heatPerDay: config.heatPerDay,
  influencePerDay: config.influencePerDay
});
