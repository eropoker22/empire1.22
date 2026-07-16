import type { GameModeId } from "@empire/shared-types/ids/game-mode-id";
import type { FactionDefinition, PlayerFactionId } from "@empire/shared-types";
import type { PoliceSystemBalanceConfig } from "./police-balance-config";
import type { AttackWeaponsBalanceConfig } from "./attack-weapon-balance-config";
import type { PlayerBoostBalanceConfig } from "./player-boost-balance-config";
import type { CityEventBalanceConfig } from "./city-event-balance-config";
import type {
  BuildingActionBalanceConfig,
  CraftBuildingBalanceConfig,
  DrugLabBalanceConfig,
  FactoryBalanceConfig,
  ArmoryBalanceConfig,
  FixedBuildingBalanceConfig,
  PharmacyBalanceConfig,
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
  CityHallBalanceConfig,
  CourthouseBalanceConfig,
  LobbyClubBalanceConfig,
  ParliamentBalanceConfig,
  PortBalanceConfig
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
export * from "./attack-weapon-balance-config";
export * from "./player-boost-balance-config";
export * from "./city-event-balance-config";
export * from "./laundering-building-balance-config";
export * from "./civilian-building-balance-config";
export * from "./intel-building-balance-config";
export * from "./support-building-balance-config";
export * from "./finance-building-balance-config";
export * from "./civic-building-balance-config";
export * from "./underground-building-balance-config";
export * from "./infrastructure-building-balance-config";

export type DayNightPhaseId = "day" | "night";

export interface DayNightModifiersConfig {
  legalIncomeMultiplier?: number;
  dirtyIncomeMultiplier?: number;
  productionSpeedMultiplier?: number;
  legalProductionSpeedMultiplier?: number;
  illegalProductionSpeedMultiplier?: number;
  heatGainMultiplier?: number;
  policePressureMultiplier?: number;
  raidSeverityMultiplier?: number;
  heistSuccessChanceModifierPct?: number;
  heistDetectionChanceModifierPct?: number;
  rumorGenerationMultiplier?: number;
  rumorTruthChanceModifierPct?: number;
  marketVolatilityMultiplier?: number;
  attackTravelOrPreparationMultiplier?: number;
}

export interface DayNightPhaseRuleConfig {
  preferredPhase?: DayNightPhaseId;
  allowedPhases?: DayNightPhaseId[];
  blockedReason?: string;
  phaseEffectSummary?: string;
  heatMultiplier?: number;
  cooldownMultiplier?: number;
  durationMultiplier?: number;
  costMultiplier?: number;
  rewardMultiplier?: number;
  detectionChanceModifierPct?: number;
  successChanceModifierPct?: number;
  auditRiskModifierPct?: number;
  rumorChanceModifierPct?: number;
  rumorTruthModifierPct?: number;
  passiveCleanIncomeMultiplier?: number;
  passiveDirtyIncomeMultiplier?: number;
  passiveHeatMultiplier?: number;
  passiveInfluenceMultiplier?: number;
  passiveRumorGenerationMultiplier?: number;
  passiveRumorTruthModifierPct?: number;
  passiveProductionMultiplier?: number;
  passivePopulationMultiplier?: number;
  passiveRecoveryMultiplier?: number;
  passiveDefenseSupportMultiplier?: number;
  phasePassiveModifiers?: Partial<Record<DayNightPhaseId, DayNightPassiveBuildingRuleConfig>>;
}

export interface DayNightPassiveBuildingRuleConfig {
  passiveCleanIncomeMultiplier?: number;
  passiveDirtyIncomeMultiplier?: number;
  passiveHeatMultiplier?: number;
  passiveInfluenceMultiplier?: number;
  passiveRumorGenerationMultiplier?: number;
  passiveRumorTruthModifierPct?: number;
  passiveProductionMultiplier?: number;
  passivePopulationMultiplier?: number;
  passiveRecoveryMultiplier?: number;
  passiveDefenseSupportMultiplier?: number;
}

export type DayNightBuildingRuleConfig = DayNightPhaseRuleConfig;
export type DayNightActionRuleConfig = DayNightPhaseRuleConfig;

export interface DayNightPhaseConfig {
  id: DayNightPhaseId;
  label: string;
  durationTicks: number;
  modifiers: DayNightModifiersConfig;
  cityFeedMessages: string[];
  uiThemeHint: DayNightPhaseId;
  effectSummary: string[];
}

export interface DayNightBalanceConfig {
  enabled: boolean;
  defaultPhase: DayNightPhaseId;
  phases: Record<DayNightPhaseId, DayNightPhaseConfig>;
  buildingRules?: Record<string, DayNightBuildingRuleConfig>;
  actionRules?: Record<string, DayNightActionRuleConfig>;
}

export interface EliminationScoreWeightsConfig {
  controlledDistricts: number;
  districtInfluence: number;
  cleanCash: number;
  dirtyCash: number;
  resources: number;
  population: number;
  activeBuildingCount: number;
  recentActivityBonus: number;
}

export interface EliminationQuietHoursConfig {
  enabled: boolean;
  timeZone: string;
  startHour: number;
  endHour: number;
  behavior: "defer_to_window_end";
}

export interface EliminationBalanceConfig {
  enabled: boolean;
  intervalTicks: number;
  firstEliminationTick: number;
  minActivePlayers: number;
  dangerZoneSize: number;
  quietHours?: EliminationQuietHoursConfig;
  eliminatedPlayerStatus: "defeated";
  defeatedDistrictPolicy: "neutralize" | "lock" | "transfer_to_city";
  defeatedDistrictLockTicks: number;
  scoreWeights: EliminationScoreWeightsConfig;
}

export interface FinalLockdownBalanceConfig {
  enabled: boolean;
  triggerActivePlayers: number;
  activeDurationTicks: number;
  pauseDuringQuietHours: boolean;
  scoreMode: "final_empire_score";
  topRankCount: number;
  downtownDistrictBonus: number;
  rareBuildingBonus: number;
  heatPenaltyStart: number;
  heatPenaltyPerPoint: number;
  extremeHeatPenaltyStart: number;
  extremeHeatPenaltyPerPoint: number;
}

export interface AllianceReadinessConfig {
  readyIntervalSeconds: number;
  readyButtonAvailableBeforeDueSeconds: number;
  gracePeriodSeconds: number;
  voteDurationSeconds: number;
  voteRetryCooldownSeconds: number;
}

export interface AllianceExitPenaltyReasonConfig {
  allianceJoinLockoutSeconds: number;
  allianceCreateLockoutSeconds: number;
  influenceDebuffSeconds: number;
  actionCooldownDebuffSeconds: number;
  statDebuffSeconds?: number;
  formerAllyTruceSeconds: number;
  influenceGenerationMultiplier: number;
  actionCooldownMultiplier: number;
  attackMultiplier?: number;
  defenseMultiplier?: number;
  productionMultiplier?: number;
  incomeMultiplier?: number;
  blocksAllianceDefenseSupport: boolean;
}

export interface AllianceLifecycleBalanceConfig {
  readiness: AllianceReadinessConfig;
  voluntaryLeavePenalty: AllianceExitPenaltyReasonConfig;
  inactiveKickPenalty: AllianceExitPenaltyReasonConfig;
  disbandPenalty: AllianceExitPenaltyReasonConfig;
  administrativeRemovalPenalty: AllianceExitPenaltyReasonConfig;
  affectedCooldownActionIds: string[];
  exitPendingTimeoutSeconds: number;
}

export interface PlayerLivenessBalanceConfig {
  lastStand: {
    enabled: boolean;
    protectionTicks: number;
    maxUsesPerPlayer: number;
    disabledDuringFinalLockdown: boolean;
  };
  emergencyRecovery: {
    enabled: boolean;
    maxUsesPerPlayer: number;
    cleanCash: number;
    population: number;
    futureUnlockGraceTicks: number;
    disabledDuringFinalLockdown: boolean;
  };
  encirclementConfirmationTicks: number;
}

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
    allianceLifecycle?: AllianceLifecycleBalanceConfig;
    playerLiveness?: PlayerLivenessBalanceConfig;
    buildSlotLimit: number;
    eventFrequencyMultiplier: number;
    elimination?: EliminationBalanceConfig;
    finalLockdown?: FinalLockdownBalanceConfig;
    policePressureMultiplier: number;
    raidIntensityMultiplier: number;
    expansionSpeedMultiplier: number;
    dayLengthTicks: number;
    nightLengthTicks: number;
    dayNight?: DayNightBalanceConfig;
    victoryConditionKey: string;
    /**
     * Fraction of active districts required for control victory.
     * Defaults to 1 when omitted by legacy fixtures.
     */
    districtControlVictoryThreshold?: number;
    /**
     * Earliest server tick where control victory may resolve.
     * Defaults to 0 for legacy fixtures and custom tests.
     */
    minimumVictoryTicks?: number;
    /**
     * Number of continuous ticks a subject must hold the configured control threshold.
     * Defaults to 0 for legacy immediate-control victory.
     */
    districtControlHoldTicks?: number;
    /**
     * When false, duration expiry ends as timeout/no winner instead of picking the
     * current score leader.
     */
    allowDurationVictoryFallback?: boolean;
    /**
     * Safety timeout in ticks. Used when duration fallback winner is disabled.
     */
    hardTimeoutTicks?: number;
    startingResources: Record<string, number>;
    attackWeapons?: AttackWeaponsBalanceConfig;
    playerBoosts?: PlayerBoostBalanceConfig;
    cityEvents?: CityEventBalanceConfig;
    factions?: Record<PlayerFactionId, FactionDefinition>;
    conflict?: import("./building-balance-config").ConflictBalanceConfig;
    police?: PoliceSystemBalanceConfig;
    productionBuildings?: Record<string, ProductionBuildingBalanceConfig>;
    craftBuildings?: Record<string, CraftBuildingBalanceConfig>;
    pharmacy?: PharmacyBalanceConfig;
    drugLab?: DrugLabBalanceConfig;
    factory?: FactoryBalanceConfig;
    armory?: ArmoryBalanceConfig;
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
    port?: PortBalanceConfig;
    parliament?: ParliamentBalanceConfig;
    cityHall?: CityHallBalanceConfig;
    courthouse?: CourthouseBalanceConfig;
    lobbyClub?: LobbyClubBalanceConfig;
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
