import type { ResolvedGameModeConfig } from "../../contracts/game-mode-config";
import { freeModeAirportConfig } from "../../public/free-mode-airport-config";
import { freeModeArcadeConfig } from "../../public/free-mode-arcade-config";
import { freeModeCasinoConfig } from "../../public/free-mode-casino-config";
import { freeModeCarDealerConfig } from "../../public/free-mode-car-dealer-config";
import { freeModeCentralBankConfig } from "../../public/free-mode-central-bank-config";
import { freeModeCityHallConfig } from "../../public/free-mode-city-hall-config";
import { freeModeClinicConfig } from "../../public/free-mode-clinic-config";
import { freeModeConvenienceStoreConfig } from "../../public/free-mode-convenience-store-config";
import { freeModeExchangeOfficeConfig } from "../../public/free-mode-exchange-office-config";
import { freeModeFitnessClubConfig } from "../../public/free-mode-fitness-club-config";
import { freeModeGarageConfig } from "../../public/free-mode-garage-config";
import { freeModePowerStationConfig } from "../../public/free-mode-power-station-config";
import { freeModeRecyclingCenterConfig } from "../../public/free-mode-recycling-center-config";
import { freeModeRecruitmentCenterConfig } from "../../public/free-mode-recruitment-center-config";
import { freeModeRestaurantConfig } from "../../public/free-mode-restaurant-config";
import { freeModeSchoolConfig } from "../../public/free-mode-school-config";
import { freeModeShoppingMallConfig } from "../../public/free-mode-shopping-mall-config";
import { freeModeSmugglingTunnelConfig } from "../../public/free-mode-smuggling-tunnel-config";
import { freeModeStockExchangeConfig } from "../../public/free-mode-stock-exchange-config";
import { freeModeStreetDealersConfig } from "../../public/free-mode-street-dealers-config";
import { freeModeStripClubConfig } from "../../public/free-mode-strip-club-config";
import { freeModeVipLoungeConfig } from "../../public/free-mode-vip-lounge-config";
import { freeModeWarehouseConfig } from "../../public/free-mode-warehouse-config";
export const freeModeFixedBuildings: NonNullable<ResolvedGameModeConfig["balance"]["fixedBuildings"]> = {
  casino: {
    cleanPerHour: freeModeCasinoConfig.cleanCashPerMinute * 60,
    dirtyPerHour: freeModeCasinoConfig.dirtyCashPerMinute * 60,
    heatPerDay: freeModeCasinoConfig.heatPerMinute * 60 * 24,
    influencePerDay: freeModeCasinoConfig.influencePerMinute * 60 * 24,
    maxLevel: 4
  },
  exchange: {
    cleanPerHour: freeModeExchangeOfficeConfig.cleanCashPerMinute * 60,
    dirtyPerHour: freeModeExchangeOfficeConfig.dirtyCashPerMinute * 60,
    heatPerDay: 230.4,
    influencePerDay: 403.2,
    maxLevel: 1
  },
  arcade: {
    cleanPerHour: freeModeArcadeConfig.cleanCashPerMinute * 60,
    dirtyPerHour: freeModeArcadeConfig.dirtyCashPerMinute * 60,
    heatPerDay: 172.8,
    influencePerDay: 259.2,
    maxLevel: 1
  },
  apartment_block: {
    cleanPerHour: 0,
    dirtyPerHour: 0,
    heatPerDay: 0,
    influencePerDay: 0,
    maxLevel: 1
  },
  school: {
    cleanPerHour: freeModeSchoolConfig.cleanCashPerMinute * 60,
    dirtyPerHour: 0,
    heatPerDay: 0,
    influencePerDay: freeModeSchoolConfig.influencePerMinute * 60 * 24,
    maxLevel: 1
  },
  warehouse: {
    cleanPerHour: freeModeWarehouseConfig.cleanCashPerMinute * 60,
    dirtyPerHour: 0,
    heatPerDay: 86.4,
    influencePerDay: 0,
    maxLevel: 4
  },
  clinic: {
    cleanPerHour: freeModeClinicConfig.cleanCashPerMinute * 60,
    dirtyPerHour: 0,
    heatPerDay: 43.2,
    influencePerDay: 0,
    maxLevel: 1
  },
  strip_club: {
    cleanPerHour: freeModeStripClubConfig.cleanCashPerMinute * 60,
    dirtyPerHour: freeModeStripClubConfig.dirtyCashPerMinute * 60,
    heatPerDay: freeModeStripClubConfig.heatPerMinute * 60 * 24,
    influencePerDay: freeModeStripClubConfig.influencePerMinute * 60 * 24,
    maxLevel: 1
  },
  power_station: {
    cleanPerHour: freeModePowerStationConfig.cleanCashPerMinute * 60,
    dirtyPerHour: 0,
    heatPerDay: 115.2,
    influencePerDay: 0,
    maxLevel: 1
  },
  restaurant: {
    cleanPerHour: freeModeRestaurantConfig.cleanCashPerMinute * 60,
    dirtyPerHour: 0,
    heatPerDay: 57.6,
    influencePerDay: 172.8,
    maxLevel: 1
  },
  convenience_store: {
    cleanPerHour: freeModeConvenienceStoreConfig.cleanCashPerMinute * 60,
    dirtyPerHour: freeModeConvenienceStoreConfig.dirtyCashPerMinute * 60,
    heatPerDay: freeModeConvenienceStoreConfig.heatPerMinute * 60 * 24,
    influencePerDay: freeModeConvenienceStoreConfig.influencePerMinute * 60 * 24,
    maxLevel: 1
  },
  shopping_mall: {
    cleanPerHour: freeModeShoppingMallConfig.cleanCashPerMinute * 60,
    dirtyPerHour: freeModeShoppingMallConfig.dirtyCashPerMinute * 60,
    heatPerDay: freeModeShoppingMallConfig.heatPerMinute * 60 * 24,
    influencePerDay: freeModeShoppingMallConfig.influencePerMinute * 60 * 24,
    maxLevel: 1
  },
  central_bank: {
    cleanPerHour: freeModeCentralBankConfig.cleanCashPerMinute * 60,
    dirtyPerHour: 0,
    heatPerDay: freeModeCentralBankConfig.heatPerMinute * 60 * 24,
    influencePerDay: freeModeCentralBankConfig.influencePerMinute * 60 * 24,
    maxLevel: 1
  },
  stock_exchange: {
    cleanPerHour: freeModeStockExchangeConfig.cleanCashPerMinute * 60,
    dirtyPerHour: 0,
    heatPerDay: freeModeStockExchangeConfig.heatPerMinute * 60 * 24,
    influencePerDay: freeModeStockExchangeConfig.influencePerMinute * 60 * 24,
    maxLevel: 1
  },
  airport: {
    cleanPerHour: freeModeAirportConfig.cleanCashPerMinute * 60,
    dirtyPerHour: freeModeAirportConfig.dirtyCashPerMinute * 60,
    heatPerDay: freeModeAirportConfig.heatPerMinute * 60 * 24,
    influencePerDay: freeModeAirportConfig.influencePerMinute * 60 * 24,
    maxLevel: 1
  },
  city_hall: {
    cleanPerHour: freeModeCityHallConfig.cleanCashPerMinute * 60,
    dirtyPerHour: 0,
    heatPerDay: freeModeCityHallConfig.heatPerMinute * 60 * 24,
    influencePerDay: freeModeCityHallConfig.influencePerMinute * 60 * 24,
    maxLevel: 1
  },
  vip_lounge: {
    cleanPerHour: freeModeVipLoungeConfig.cleanCashPerMinute * 60,
    dirtyPerHour: freeModeVipLoungeConfig.dirtyCashPerMinute * 60,
    heatPerDay: freeModeVipLoungeConfig.heatPerMinute * 60 * 24,
    influencePerDay: freeModeVipLoungeConfig.influencePerMinute * 60 * 24,
    maxLevel: 1
  },
  fitness_club: {
    cleanPerHour: freeModeFitnessClubConfig.cleanCashPerMinute * 60,
    dirtyPerHour: 0,
    heatPerDay: freeModeFitnessClubConfig.heatPerMinute * 60 * 24,
    influencePerDay: 0,
    maxLevel: 1
  },
  recruitment_center: {
    cleanPerHour: freeModeRecruitmentCenterConfig.cleanCashPerMinute * 60,
    dirtyPerHour: 0,
    heatPerDay: freeModeRecruitmentCenterConfig.heatPerMinute * 60 * 24,
    influencePerDay: 0,
    maxLevel: 1
  },
  garage: {
    cleanPerHour: freeModeGarageConfig.cleanCashPerMinute * 60,
    dirtyPerHour: 0,
    heatPerDay: freeModeGarageConfig.heatPerMinute * 60 * 24,
    influencePerDay: 0,
    maxLevel: 1
  },
  car_dealer: {
    cleanPerHour: freeModeCarDealerConfig.cleanCashPerMinute * 60,
    dirtyPerHour: freeModeCarDealerConfig.dirtyCashPerMinute * 60,
    heatPerDay: freeModeCarDealerConfig.heatPerMinute * 60 * 24,
    influencePerDay: 0,
    maxLevel: 1
  },
  recycling_center: {
    cleanPerHour: freeModeRecyclingCenterConfig.cleanCashPerMinute * 60,
    dirtyPerHour: 0,
    heatPerDay: freeModeRecyclingCenterConfig.heatPerMinute * 60 * 24,
    influencePerDay: 0,
    maxLevel: 1
  },
  smuggling_tunnel: {
    cleanPerHour: 0,
    dirtyPerHour: freeModeSmugglingTunnelConfig.dirtyCashPerMinute * 60,
    heatPerDay: freeModeSmugglingTunnelConfig.heatPerMinute * 60 * 24,
    influencePerDay: 0,
    maxLevel: 1
  },
  street_dealers: {
    cleanPerHour: 0,
    dirtyPerHour: freeModeStreetDealersConfig.dirtyCashPerMinute * 60,
    heatPerDay: freeModeStreetDealersConfig.heatPerMinute * 60 * 24,
    influencePerDay: 0,
    maxLevel: 1
  }
};
