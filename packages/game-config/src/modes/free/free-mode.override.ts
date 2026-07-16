import type { ResolvedGameModeConfig } from "../../contracts/game-mode-config";
import { freeModeBuildingActions } from "./free-mode-building-actions";
import { freeModeFixedBuildings } from "./free-mode-fixed-buildings";
import { freeModeApartmentBlockConfig } from "../../public/free-mode-apartment-block-config";
import { freeModeAirportConfig } from "../../public/free-mode-airport-config";
import { freeModeArcadeConfig } from "../../public/free-mode-arcade-config";
import { freeModeCasinoConfig } from "../../public/free-mode-casino-config";
import { freeModeCarDealerConfig } from "../../public/free-mode-car-dealer-config";
import { freeModeCentralBankConfig } from "../../public/free-mode-central-bank-config";
import { freeModeCityHallConfig } from "../../public/free-mode-city-hall-config";
import { freeModeClinicConfig } from "../../public/free-mode-clinic-config";
import { freeModeConvenienceStoreConfig } from "../../public/free-mode-convenience-store-config";
import { freeModeCourthouseConfig } from "../../public/free-mode-courthouse-config";
import { freeModeExchangeOfficeConfig } from "../../public/free-mode-exchange-office-config";
import { freeModeFitnessClubConfig } from "../../public/free-mode-fitness-club-config";
import { freeModeGarageConfig } from "../../public/free-mode-garage-config";
import { freeModeLobbyClubConfig } from "../../public/free-mode-lobby-club-config";
import { freeModeParliamentConfig } from "../../public/free-mode-parliament-config";
import { freeModePowerStationConfig } from "../../public/free-mode-power-station-config";
import { freeModePortConfig } from "../../public/free-mode-port-config";
import { freeModeRecyclingCenterConfig } from "../../public/free-mode-recycling-center-config";
import { freeModeSchoolConfig } from "../../public/free-mode-school-config";
import { freeModeSmugglingTunnelConfig } from "../../public/free-mode-smuggling-tunnel-config";
import { freeModeStreetDealersConfig } from "../../public/free-mode-street-dealers-config";
import { freeModeRecruitmentCenterConfig } from "../../public/free-mode-recruitment-center-config";
import { freeModeRestaurantConfig } from "../../public/free-mode-restaurant-config";
import { freeModeShoppingMallConfig } from "../../public/free-mode-shopping-mall-config";
import { freeModeStockExchangeConfig } from "../../public/free-mode-stock-exchange-config";
import { freeModeStripClubConfig } from "../../public/free-mode-strip-club-config";
import { freeModeVipLoungeConfig } from "../../public/free-mode-vip-lounge-config";
import { freeModeWarehouseConfig } from "../../public/free-mode-warehouse-config";
import { freeModePharmacyConfig } from "./free-mode-pharmacy-config";
import { freeModeDrugLabConfig } from "./free-mode-drug-lab-config";
import { freeModeFactoryConfig } from "./free-mode-factory-config";
import { freeModeArmoryConfig } from "./free-mode-armory-config";
import { freeModeAttackWeaponsConfig } from "../../public/free-mode-attack-weapons-config";
import { freeModePlayerBoostConfig } from "./free-mode-player-boost-config";
import { freeModeCityEventConfig } from "./free-mode-city-event-config";
import { freeModeAllianceLifecycleConfig } from "./free-mode-alliance-lifecycle-config";
import { freeModePoliceConfig } from "./free-police-config";
import {
  FREE_MODE_COOLDOWN_MULTIPLIER,
  FREE_MODE_TICK_RATE_MS,
  ticksFromDays,
  ticksFromHours,
  ticksFromMinutes
} from "./free-mode-timing";
import { createDayNightConfig, resolveDayNightPhaseDurationTicks } from "../../public/day-night-config";
import { FACTION_DEFINITION_BY_ID } from "../../public/faction-definitions";

const FREE_MODE_DAY_NIGHT_PHASE_TICKS = resolveDayNightPhaseDurationTicks(FREE_MODE_TICK_RATE_MS);
const FREE_MODE_ELIMINATION_INTERVAL_TICKS = ticksFromHours(4);
const FREE_MODE_FIRST_ELIMINATION_TICKS = ticksFromHours(8);
const FREE_MODE_HARD_TIMEOUT_TICKS = ticksFromDays(7);
const FREE_MODE_HARD_TIMEOUT_MS = FREE_MODE_HARD_TIMEOUT_TICKS * FREE_MODE_TICK_RATE_MS;

export const freeModeOverride: Partial<ResolvedGameModeConfig> = {
  mode: "free",
  tickRateMs: FREE_MODE_TICK_RATE_MS,
  balance: {
    incomeMultiplier: 1.2,
    productionMultiplier: 1.2,
    cooldownMultiplier: FREE_MODE_COOLDOWN_MULTIPLIER,
    maxPlayersPerServer: 20,
    maxAllianceSize: 4,
    allianceLifecycle: freeModeAllianceLifecycleConfig,
    playerLiveness: {
      lastStand: {
        enabled: true,
        protectionTicks: ticksFromMinutes(12),
        maxUsesPerPlayer: 1,
        disabledDuringFinalLockdown: true
      },
      emergencyRecovery: {
        enabled: true,
        maxUsesPerPlayer: 1,
        cleanCash: 500,
        population: 5,
        futureUnlockGraceTicks: ticksFromMinutes(10),
        disabledDuringFinalLockdown: true
      },
      encirclementConfirmationTicks: ticksFromMinutes(2)
    },
    buildSlotLimit: 8,
    eventFrequencyMultiplier: 1.2,
    elimination: {
      enabled: true,
      intervalTicks: FREE_MODE_ELIMINATION_INTERVAL_TICKS,
      firstEliminationTick: FREE_MODE_FIRST_ELIMINATION_TICKS,
      minActivePlayers: 8,
      dangerZoneSize: 3,
      quietHours: {
        enabled: true,
        timeZone: "Europe/Bratislava",
        startHour: 0,
        endHour: 6,
        behavior: "defer_to_window_end"
      },
      eliminatedPlayerStatus: "defeated",
      defeatedDistrictPolicy: "neutralize",
      defeatedDistrictLockTicks: FREE_MODE_ELIMINATION_INTERVAL_TICKS,
      scoreWeights: {
        controlledDistricts: 10000,
        districtInfluence: 25,
        activeBuildingCount: 500,
        cleanCash: 0.1,
        dirtyCash: 0.05,
        resources: 0.2,
        population: 2,
        recentActivityBonus: 250
      }
    },
    finalLockdown: {
      enabled: true,
      triggerActivePlayers: 8,
      activeDurationTicks: ticksFromHours(12),
      pauseDuringQuietHours: true,
      scoreMode: "final_empire_score",
      topRankCount: 3,
      downtownDistrictBonus: 15_000,
      rareBuildingBonus: 5_000,
      heatPenaltyStart: 120,
      heatPenaltyPerPoint: 50,
      extremeHeatPenaltyStart: 180,
      extremeHeatPenaltyPerPoint: 100
    },
    policePressureMultiplier: 0.9,
    raidIntensityMultiplier: 0.9,
    expansionSpeedMultiplier: 1.3,
    dayLengthTicks: FREE_MODE_DAY_NIGHT_PHASE_TICKS,
    nightLengthTicks: FREE_MODE_DAY_NIGHT_PHASE_TICKS,
    dayNight: createDayNightConfig({
      dayDurationTicks: FREE_MODE_DAY_NIGHT_PHASE_TICKS,
      nightDurationTicks: FREE_MODE_DAY_NIGHT_PHASE_TICKS
    }),
    victoryConditionKey: "final-lockdown",
    allowDurationVictoryFallback: false,
    hardTimeoutTicks: FREE_MODE_HARD_TIMEOUT_TICKS,
    police: freeModePoliceConfig,
    conflict: {
      spyCooldownTicks: ticksFromMinutes(6),
      spyAuthorizationTtlTicks: ticksFromMinutes(10),
      spySlotCooldownTicks: ticksFromMinutes(6),
      defenseCapacity: {
        baseCapacityPoints: 20,
        zoneBonusPoints: { downtown: 4 },
        itemWeights: {
          vest: 1,
          barricades: 1,
          cameras: 2,
          alarm: 2,
          "defense-tower": 4
        }
      },
      heist: {
        globalCooldownTicks: ticksFromMinutes(8),
        sameTargetCooldownTicks: ticksFromMinutes(12),
        victimProtectionTicks: ticksFromMinutes(6),
        styles: {
          stealth: {
            minMembers: 5,
            maxMembers: 35,
            baseSuccessChance: 0.80,
            baseDetectionChance: 0.18,
            lootMultiplier: 0.65,
            detectedLossMultiplier: 0.35,
            heatOnSuccess: 1,
            heatOnDetected: 4
          },
          balanced: {
            minMembers: 10,
            maxMembers: 70,
            baseSuccessChance: 0.74,
            baseDetectionChance: 0.30,
            lootMultiplier: 1,
            detectedLossMultiplier: 0.50,
            heatOnSuccess: 3,
            heatOnDetected: 7
          },
          all_in: {
            minMembers: 25,
            maxMembers: 120,
            baseSuccessChance: 0.68,
            baseDetectionChance: 0.46,
            lootMultiplier: 1.45,
            detectedLossMultiplier: 0.70,
            heatOnSuccess: 5,
            heatOnDetected: 12
          }
        },
        security: {
          camerasDetectionChancePerUnit: 0.04,
          camerasMaxDetectionBonus: 0.20,
          alarmDetectionChancePerUnit: 0.06,
          alarmMaxDetectionBonus: 0.24,
          defenseTowerResistancePerUnit: 8,
          barricadesResistancePerUnit: 2
        }
      },
      robbery: {
        cityDayRegenerationFraction: 0.25,
        poolsByZone: {
          park: {
            cash: { min: 20, max: 50 },
            dirtyCash: { min: 5, max: 20 },
            chemicals: { min: 10, max: 24 },
            biomass: { min: 8, max: 20 },
            metalParts: { min: 0, max: 4 }
          },
          residential: {
            cash: { min: 25, max: 60 },
            dirtyCash: { min: 8, max: 24 },
            chemicals: { min: 2, max: 8 },
            biomass: { min: 2, max: 8 },
            metalParts: { min: 1, max: 6 }
          },
          commercial: {
            cash: { min: 70, max: 150 },
            dirtyCash: { min: 20, max: 55 },
            chemicals: { min: 1, max: 6 },
            biomass: { min: 1, max: 5 },
            metalParts: { min: 2, max: 8 }
          },
          industrial: {
            cash: { min: 35, max: 80 },
            dirtyCash: { min: 10, max: 30 },
            chemicals: { min: 4, max: 12 },
            biomass: { min: 0, max: 4 },
            metalParts: { min: 14, max: 32 }
          },
          downtown: {
            cash: { min: 100, max: 200 },
            dirtyCash: { min: 35, max: 75 },
            chemicals: { min: 2, max: 8 },
            biomass: { min: 2, max: 8 },
            metalParts: { min: 4, max: 12 }
          }
        }
      },
      attackCooldownTicks: ticksFromMinutes(22),
      attackTargetProtectionTicks: ticksFromMinutes(10),
      concurrency: {
        offenseGlobalCooldownTicks: ticksFromMinutes(1.5),
        sourceConflictLockTicks: ticksFromMinutes(1.5),
        attackFailedCombatProtectionTicks: ticksFromMinutes(3),
        attackCaptureProtectionTicks: ticksFromMinutes(10),
        attackDestructionProtectionTicks: ticksFromMinutes(10)
      },
      captureStabilization: {
        durationTicks: ticksFromMinutes(15),
        incomeMultiplier: 0.5,
        productionSpeedMultiplier: 0.5,
        cleanCaptureAttritionPct: 5,
        successfulCaptureMinimumAttritionPct: 8
      },
      defenseCasualty: {
        vestRelativeReductionPerUnit: 0.05,
        vestRelativeReductionCap: 0.35
      },
      catastrophe: {
        bazookaBonusPerUnit: 0.015,
        bazookaBonusCap: 0.12,
        finalChanceCap: 0.18
      },
      occupyOverextension: {
        basePopulationCost: 50,
        thirdDistrictInfluenceCost: 550,
        fourthDistrictInfluenceCost: 1050,
        additionalDistrictInfluenceCost: 250,
        additionalPopulationPerTwoDistricts: 1
      },
      trapRelocationCooldownTicks: ticksFromMinutes(10),
      robCooldownTicks: ticksFromMinutes(10),
      heistCooldownTicks: ticksFromMinutes(8),
      occupyCooldownTicks: ticksFromMinutes(12),
      occupyFailureChancePct: 5,
      minAttackDurationTicks: ticksFromMinutes(22),
      attackHeatGain: 8,
      occupyHeatGain: 2,
      occupyInfluenceCost: 5,
      occupyPopulationRefundPct: 10,
      spyBaseSuccessChance: 0.76,
      spyTrapRevealChance: 0.2,
      trapAttackLosses: 2,
      reportsLimit: 6,
      catastropheChance: 0.02
    },
    startingResources: {
      cash: 1500,
      "dirty-cash": 300,
      chemicals: 10,
      biomass: 6,
      "metal-parts": 8,
      "tech-core": 2
    },
    attackWeapons: freeModeAttackWeaponsConfig,
    playerBoosts: freeModePlayerBoostConfig,
    cityEvents: freeModeCityEventConfig,
    factions: FACTION_DEFINITION_BY_ID,
    pharmacy: freeModePharmacyConfig,
    drugLab: freeModeDrugLabConfig,
    factory: freeModeFactoryConfig,
    armory: freeModeArmoryConfig,
    fixedBuildings: freeModeFixedBuildings,
    buildingActions: freeModeBuildingActions,
    casino: freeModeCasinoConfig,
    exchangeOffice: freeModeExchangeOfficeConfig,
    arcade: freeModeArcadeConfig,
    apartmentBlock: freeModeApartmentBlockConfig,
    school: freeModeSchoolConfig,
    warehouse: freeModeWarehouseConfig,
    clinic: freeModeClinicConfig,
    stripClub: freeModeStripClubConfig,
    restaurant: freeModeRestaurantConfig,
    convenienceStore: freeModeConvenienceStoreConfig,
    shoppingMall: freeModeShoppingMallConfig,
    stockExchange: freeModeStockExchangeConfig,
    centralBank: freeModeCentralBankConfig,
    airport: freeModeAirportConfig,
    port: freeModePortConfig,
    parliament: freeModeParliamentConfig,
    cityHall: freeModeCityHallConfig,
    courthouse: freeModeCourthouseConfig,
    lobbyClub: freeModeLobbyClubConfig,
    vipLounge: freeModeVipLoungeConfig,
    fitnessClub: freeModeFitnessClubConfig,
    recruitmentCenter: freeModeRecruitmentCenterConfig,
    garage: freeModeGarageConfig,
    carDealer: freeModeCarDealerConfig,
    smugglingTunnel: freeModeSmugglingTunnelConfig,
    streetDealers: freeModeStreetDealersConfig,
    recyclingCenter: freeModeRecyclingCenterConfig,
    powerStation: freeModePowerStationConfig
  },
  technical: {
    sessionTtlMs: FREE_MODE_HARD_TIMEOUT_MS,
    gameDurationMs: FREE_MODE_HARD_TIMEOUT_MS,
    storageKeyPrefix: "empire:free",
    snapshotIntervalTicks: 8,
    notificationBatchWindowMs: 200,
    debug: {
      allowDebugTools: false,
      enableDeterministicSeeds: false
    }
  },
  publicMeta: {
    mode: "free",
    label: "Empire Streets Free",
    matchStyle: "long",
    tickRateMs: FREE_MODE_TICK_RATE_MS,
    sessionKeyPrefix: "empire:free"
  }
};
