import type { GameModeId } from "@empire/shared-types/ids/game-mode-id";
import type { PoliceSystemBalanceConfig } from "./police-balance-config";
import type {
  BuildingActionBalanceConfig,
  CraftBuildingBalanceConfig,
  FixedBuildingBalanceConfig,
  ProductionBuildingBalanceConfig
} from "./building-balance-config";
import type {
  ArcadeBalanceConfig,
  CasinoBalanceConfig,
  ExchangeOfficeBalanceConfig
} from "./laundering-building-balance-config";
import type {
  ApartmentBlockBalanceConfig,
  ClinicBalanceConfig,
  SchoolBalanceConfig,
  WarehouseBalanceConfig
} from "./civilian-building-balance-config";
import type {
  ConvenienceStoreBalanceConfig,
  RestaurantBalanceConfig,
  StripClubBalanceConfig,
  VipLoungeBalanceConfig
} from "./intel-building-balance-config";
import type {
  FitnessClubBalanceConfig,
  RecruitmentCenterBalanceConfig
} from "./support-building-balance-config";
import type {
  CentralBankBalanceConfig,
  ShoppingMallBalanceConfig,
  StockExchangeBalanceConfig
} from "./finance-building-balance-config";
import type {
  AirportBalanceConfig,
  CityHallBalanceConfig
} from "./civic-building-balance-config";
import type {
  CarDealerBalanceConfig,
  GarageBalanceConfig,
  SmugglingTunnelBalanceConfig,
  StreetDealersBalanceConfig
} from "./underground-building-balance-config";
import type {
  PowerStationBalanceConfig,
  RecyclingCenterBalanceConfig
} from "./infrastructure-building-balance-config";

export * from "./building-balance-config";
export * from "./laundering-building-balance-config";
export * from "./civilian-building-balance-config";
export * from "./intel-building-balance-config";
export * from "./support-building-balance-config";
export * from "./finance-building-balance-config";
export * from "./civic-building-balance-config";
export * from "./underground-building-balance-config";
export * from "./infrastructure-building-balance-config";

/**
 * Responsibility: Core-facing mode configuration contract used by runtime bootstrap.
 * Belongs here: serializable mode knobs grouped for balance and runtime decisions.
 * Does not belong here: server lifecycle logic or UI routing concerns.
 */
export interface GameModeConfig {
  mode: GameModeId;
  tickRateMs: number;
  balance: {
    incomeMultiplier: number;
    productionMultiplier: number;
    cooldownMultiplier: number;
    maxPlayersPerServer: number;
    maxAllianceSize: number;
    buildSlotLimit: number;
    eventFrequencyMultiplier: number;
    policePressureMultiplier: number;
    raidIntensityMultiplier: number;
    expansionSpeedMultiplier: number;
    dayLengthTicks: number;
    nightLengthTicks: number;
    victoryConditionKey: string;
    /**
     * Fraction of active districts required for control victory.
     * Defaults to 1 when omitted by legacy fixtures.
     */
    districtControlVictoryThreshold?: number;
    startingResources: Record<string, number>;
    conflict?: import("./building-balance-config").ConflictBalanceConfig;
    police?: PoliceSystemBalanceConfig;
    productionBuildings?: Record<string, ProductionBuildingBalanceConfig>;
    craftBuildings?: Record<string, CraftBuildingBalanceConfig>;
    fixedBuildings?: Record<string, FixedBuildingBalanceConfig>;
    buildingActions?: Record<string, BuildingActionBalanceConfig>;
    casino?: CasinoBalanceConfig;
    exchangeOffice?: ExchangeOfficeBalanceConfig;
    arcade?: ArcadeBalanceConfig;
    apartmentBlock?: ApartmentBlockBalanceConfig;
    school?: SchoolBalanceConfig;
    warehouse?: WarehouseBalanceConfig;
    clinic?: ClinicBalanceConfig;
    stripClub?: StripClubBalanceConfig;
    restaurant?: RestaurantBalanceConfig;
    convenienceStore?: ConvenienceStoreBalanceConfig;
    shoppingMall?: ShoppingMallBalanceConfig;
    stockExchange?: StockExchangeBalanceConfig;
    centralBank?: CentralBankBalanceConfig;
    airport?: AirportBalanceConfig;
    cityHall?: CityHallBalanceConfig;
    vipLounge?: VipLoungeBalanceConfig;
    recruitmentCenter?: RecruitmentCenterBalanceConfig;
    fitnessClub?: FitnessClubBalanceConfig;
    garage?: GarageBalanceConfig;
    carDealer?: CarDealerBalanceConfig;
    smugglingTunnel?: SmugglingTunnelBalanceConfig;
    streetDealers?: StreetDealersBalanceConfig;
    recyclingCenter?: RecyclingCenterBalanceConfig;
    powerStation?: PowerStationBalanceConfig;
  };
  technical: {
    sessionTtlMs: number;
    gameDurationMs: number;
    storageKeyPrefix: string;
    snapshotIntervalTicks: number;
    notificationBatchWindowMs: number;
    debug: {
      allowDebugTools: boolean;
      enableDeterministicSeeds: boolean;
    };
  };
  publicMeta: {
    mode: GameModeId;
    label: string;
    matchStyle: "short" | "long";
    tickRateMs: number;
    sessionKeyPrefix: string;
  };
}

export type ResolvedGameModeConfig = GameModeConfig;
