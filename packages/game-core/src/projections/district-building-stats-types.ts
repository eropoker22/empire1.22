import type { CoreGameState } from "../entities/game-state";
import type { DistrictPanelBuildingCatalogEntry } from "./district-building-catalog-types";
import type {
  AirportBalanceConfig,
  CarDealerBalanceConfig,
  CentralBankBalanceConfig,
  CityHallBalanceConfig,
  ConvenienceStoreBalanceConfig,
  FitnessClubBalanceConfig,
  GarageBalanceConfig,
  PowerStationBalanceConfig,
  RecruitmentCenterBalanceConfig,
  RecyclingCenterBalanceConfig,
  RestaurantBalanceConfig,
  SchoolBalanceConfig,
  ShoppingMallBalanceConfig,
  SmugglingTunnelBalanceConfig,
  StockExchangeBalanceConfig,
  StreetDealersBalanceConfig,
  StripClubBalanceConfig,
  VipLoungeBalanceConfig
} from "../contracts/game-mode-config";

export interface BuildingStatView {
  label: string;
  value: string;
}

export interface BuildingStatsProjectionInput {
  definition: DistrictPanelBuildingCatalogEntry | undefined;
  state: CoreGameState;
  district: CoreGameState["districtsById"][string];
  building: CoreGameState["buildingsById"][string];
  playerId: string;
  playerBalances: Record<string, number>;
  stripClubConfig?: StripClubBalanceConfig;
  restaurantConfig?: RestaurantBalanceConfig;
  convenienceStoreConfig?: ConvenienceStoreBalanceConfig;
  shoppingMallConfig?: ShoppingMallBalanceConfig;
  stockExchangeConfig?: StockExchangeBalanceConfig;
  centralBankConfig?: CentralBankBalanceConfig;
  airportConfig?: AirportBalanceConfig;
  cityHallConfig?: CityHallBalanceConfig;
  vipLoungeConfig?: VipLoungeBalanceConfig;
  powerStationConfig?: PowerStationBalanceConfig;
  recruitmentCenterConfig?: RecruitmentCenterBalanceConfig;
  fitnessClubConfig?: FitnessClubBalanceConfig;
  garageConfig?: GarageBalanceConfig;
  carDealerConfig?: CarDealerBalanceConfig;
  smugglingTunnelConfig?: SmugglingTunnelBalanceConfig;
  streetDealersConfig?: StreetDealersBalanceConfig;
  schoolConfig?: SchoolBalanceConfig;
  recyclingCenterConfig?: RecyclingCenterBalanceConfig;
  tick: number;
  tickRateMs?: number;
}