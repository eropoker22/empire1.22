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
import { freeModePoliceConfig } from "./free-police-config";
import { createDayNightConfig } from "../../public/day-night-config";
import { FACTION_DEFINITION_BY_ID } from "../../public/faction-definitions";

const FREE_MODE_TICK_RATE_MS = 5000;
const ticksFromHours = (hours: number, tickRateMs = FREE_MODE_TICK_RATE_MS): number =>
  Math.ceil((hours * 60 * 60 * 1000) / tickRateMs);
const ticksFromDays = (days: number, tickRateMs = FREE_MODE_TICK_RATE_MS): number =>
  ticksFromHours(days * 24, tickRateMs);

const FREE_MODE_DAY_NIGHT_PHASE_TICKS = ticksFromHours(2);
const FREE_MODE_ELIMINATION_INTERVAL_TICKS = ticksFromHours(4);
const FREE_MODE_FIRST_ELIMINATION_TICKS = ticksFromHours(8);
const FREE_MODE_MINIMUM_VICTORY_TICKS = ticksFromHours(72);
const FREE_MODE_CONTROL_HOLD_TICKS = ticksFromHours(6);
const FREE_MODE_HARD_TIMEOUT_TICKS = ticksFromDays(7);
const FREE_MODE_HARD_TIMEOUT_MS = FREE_MODE_HARD_TIMEOUT_TICKS * FREE_MODE_TICK_RATE_MS;

export const freeModeOverride: Partial<ResolvedGameModeConfig> = {
  mode: "free",
  tickRateMs: FREE_MODE_TICK_RATE_MS,
  balance: {
    incomeMultiplier: 1.2,
    productionMultiplier: 1.2,
    cooldownMultiplier: 0.8,
    maxPlayersPerServer: 20,
    maxAllianceSize: 4,
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
    policePressureMultiplier: 0.9,
    raidIntensityMultiplier: 0.9,
    expansionSpeedMultiplier: 1.3,
    dayLengthTicks: FREE_MODE_DAY_NIGHT_PHASE_TICKS,
    nightLengthTicks: FREE_MODE_DAY_NIGHT_PHASE_TICKS,
    dayNight: createDayNightConfig({
      dayDurationTicks: FREE_MODE_DAY_NIGHT_PHASE_TICKS,
      nightDurationTicks: FREE_MODE_DAY_NIGHT_PHASE_TICKS
    }),
    victoryConditionKey: "fast-control",
    districtControlVictoryThreshold: 0.75,
    minimumVictoryTicks: FREE_MODE_MINIMUM_VICTORY_TICKS,
    districtControlHoldTicks: FREE_MODE_CONTROL_HOLD_TICKS,
    allowDurationVictoryFallback: false,
    hardTimeoutTicks: FREE_MODE_HARD_TIMEOUT_TICKS,
    police: freeModePoliceConfig,
    conflict: {
      spyCooldownTicks: 1,
      attackCooldownTicks: 36,
      occupyCooldownTicks: 2,
      minAttackDurationTicks: 36,
      attackHeatGain: 8,
      occupyHeatGain: 2,
      occupyInfluenceCost: 5,
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
    factions: FACTION_DEFINITION_BY_ID,
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
