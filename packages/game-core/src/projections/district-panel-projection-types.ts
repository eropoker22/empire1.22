import type {
  BuildingActionBalanceConfig,
  AirportBalanceConfig,
  CarDealerBalanceConfig,
  CentralBankBalanceConfig,
  CityHallBalanceConfig,
  ConvenienceStoreBalanceConfig,
  CraftBuildingBalanceConfig,
  FitnessClubBalanceConfig,
  GarageBalanceConfig,
  PowerStationBalanceConfig,
  ProductionBuildingBalanceConfig,
  RecruitmentCenterBalanceConfig,
  RecyclingCenterBalanceConfig,
  RestaurantBalanceConfig,
  SchoolBalanceConfig,
  ShoppingMallBalanceConfig,
  StockExchangeBalanceConfig,
  SmugglingTunnelBalanceConfig,
  StreetDealersBalanceConfig,
  StripClubBalanceConfig,
  VipLoungeBalanceConfig
} from "../contracts/game-mode-config";
import type { DistrictPanelBuildingCatalogEntry } from "./district-building-catalog-types";

export interface DistrictPanelProjectionInput {
  playerId: string;
  districtId: string;
  buildCatalog: ReadonlyArray<DistrictPanelBuildingCatalogEntry>;
  productionCatalog: Readonly<Record<string, ProductionBuildingBalanceConfig>>;
  craftCatalog: Readonly<Record<string, CraftBuildingBalanceConfig>>;
  buildingActionCatalog: Readonly<Record<string, BuildingActionBalanceConfig>>;
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
  productionMultiplier: number;
  tickRateMs?: number;
}
