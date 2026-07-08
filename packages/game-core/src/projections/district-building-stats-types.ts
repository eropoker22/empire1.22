import type { CoreGameState } from "../entities/game-state";
import type { DistrictPanelBuildingCatalogEntry } from "./district-building-catalog-types";
import type {
  AirportBalanceConfig,
  CarDealerBalanceConfig,
  CentralBankBalanceConfig,
  CityHallBalanceConfig,
  CourthouseBalanceConfig,
  LobbyClubBalanceConfig,
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
  VipLoungeBalanceConfig,
  ResolvedGameModeConfig
} from "../contracts/game-mode-config";

export interface BuildingStatView {
  label: string;
  value: string;
}

export interface BuildingStatsProjectionInput {
  definition: DistrictPanelBuildingCatalogEntry | undefined;
  effectivePassiveStats?: {
    cleanPerHour: number;
    dirtyPerHour: number;
    heatPerDay: number;
    influencePerDay: number;
  };
  state: CoreGameState;
  district: CoreGameState["districtsById"][string];
  building: CoreGameState["buildingsById"][string];
  playerId: string;
  playerBalances: Record<string, number>;
  dayNightConfig?: ResolvedGameModeConfig;
  stripClubConfig?: StripClubBalanceConfig;
  restaurantConfig?: RestaurantBalanceConfig;
  convenienceStoreConfig?: ConvenienceStoreBalanceConfig;
  shoppingMallConfig?: ShoppingMallBalanceConfig;
  stockExchangeConfig?: StockExchangeBalanceConfig;
  centralBankConfig?: CentralBankBalanceConfig;
  airportConfig?: AirportBalanceConfig;
  cityHallConfig?: CityHallBalanceConfig;
  courthouseConfig?: CourthouseBalanceConfig;
  lobbyClubConfig?: LobbyClubBalanceConfig;
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
