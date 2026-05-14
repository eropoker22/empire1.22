import type { DistrictPanelBuildingView } from "@empire/shared-types";
import type { BuildingActionBalanceConfig } from "../contracts/game-mode-config";
import type { CoreGameState } from "../entities/game-state";
import type { DistrictPanelBuildingCatalogEntry } from "./district-building-catalog-types";
import { createBuildingStats } from "./district-building-stats-projection";
import { formatInputSummary, formatResourceLabel, formatTickLabel } from "./district-building-action-formatters";
import { getAirportMetadata } from "../handlers/airportBuildingActions";
import { getCentralBankMetadata } from "../handlers/centralBankBuildingActions";
import { getCityHallMetadata } from "../handlers/cityHallBuildingActions";
import { getLobbyClubMetadata } from "../handlers/lobbyClubBuildingActions";
import { getPowerStationMetadata } from "../handlers/powerStationBuildingActions";
import { resolveRecyclingCenterSalvageStats } from "../handlers/recyclingCenterBuildingActions";
import { getStripClubMetadata } from "../handlers/stripClubBuildingActions";
import { getStockExchangeMetadata } from "../handlers/stockExchangeBuildingActions";
import { resolveOpenChannelStats } from "../handlers/smugglingTunnelBuildingActions";
import {
  getOwnedStreetDealerCount,
  getStreetDealersPlayerMetadata,
  resolveStreetDealerSlotCount
} from "../handlers/streetDealersBuildingActions";
import {
  getSchoolMetadata,
  isEveningCourseActive
} from "../handlers/schoolBuildingActions";
import type { AirportBalanceConfig, CarDealerBalanceConfig, CentralBankBalanceConfig, CityHallBalanceConfig, CourthouseBalanceConfig, FitnessClubBalanceConfig, GarageBalanceConfig, LobbyClubBalanceConfig, PowerStationBalanceConfig, RecruitmentCenterBalanceConfig, RecyclingCenterBalanceConfig, RestaurantBalanceConfig, SchoolBalanceConfig, ShoppingMallBalanceConfig, SmugglingTunnelBalanceConfig, StockExchangeBalanceConfig, StreetDealersBalanceConfig, StripClubBalanceConfig, VipLoungeBalanceConfig } from "../contracts/game-mode-config";
import type { ConvenienceStoreBalanceConfig } from "../contracts/game-mode-config";

export interface CreateDistrictPanelBuildingViewsInput {
  state: CoreGameState;
  buildings: CoreGameState["buildingsById"][string][];
  buildCatalog: ReadonlyArray<DistrictPanelBuildingCatalogEntry>;
  actionCatalog: Readonly<Record<string, BuildingActionBalanceConfig>>;
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
  district: CoreGameState["districtsById"][string];
  playerId: string;
  playerBalances: Record<string, number>;
  tick: number;
  tickRateMs?: number;
}

export const createDistrictPanelBuildingViews = (
  input: CreateDistrictPanelBuildingViewsInput
): DistrictPanelBuildingView[] => {
  const buildingDefinitions = Object.fromEntries(input.buildCatalog.map((entry) => [entry.buildingTypeId, entry]));

  return input.buildings.map((building) => {
    const definition = buildingDefinitions[building.buildingTypeId];
    const actions = createBuildingActionViews({
      actionCatalog: input.actionCatalog,
      building,
      state: input.state,
      stripClubConfig: input.stripClubConfig,
      restaurantConfig: input.restaurantConfig,
      convenienceStoreConfig: input.convenienceStoreConfig,
      shoppingMallConfig: input.shoppingMallConfig,
      stockExchangeConfig: input.stockExchangeConfig,
      centralBankConfig: input.centralBankConfig,
      airportConfig: input.airportConfig,
      cityHallConfig: input.cityHallConfig,
      courthouseConfig: input.courthouseConfig,
      lobbyClubConfig: input.lobbyClubConfig,
      vipLoungeConfig: input.vipLoungeConfig,
      powerStationConfig: input.powerStationConfig,
      recruitmentCenterConfig: input.recruitmentCenterConfig,
      fitnessClubConfig: input.fitnessClubConfig,
      garageConfig: input.garageConfig,
      carDealerConfig: input.carDealerConfig,
      smugglingTunnelConfig: input.smugglingTunnelConfig,
      streetDealersConfig: input.streetDealersConfig,
      schoolConfig: input.schoolConfig,
      recyclingCenterConfig: input.recyclingCenterConfig,
      district: input.district,
      playerId: input.playerId,
      playerBalances: input.playerBalances,
      tick: input.tick,
      tickRateMs: input.tickRateMs
    });

    const baseLabel = definition?.label ?? formatResourceLabel(building.buildingTypeId);
    const variantName = normalizeBuildingDisplayName(building.displayName) ?? resolveCatalogVariantName(definition, building.id);

    return {
      buildingId: building.id,
      buildingTypeId: building.buildingTypeId,
      label: baseLabel,
      displayName: variantName ?? baseLabel,
      variantName,
      zone: definition?.zone ?? input.district.zone,
      role: definition?.role ?? "Fixed building",
      info: definition?.info ?? "Fixed district building.",
      stats: createBuildingStats({
        definition,
        state: input.state,
        district: input.district,
        building,
        playerId: input.playerId,
        playerBalances: input.playerBalances,
        stripClubConfig: input.stripClubConfig,
        restaurantConfig: input.restaurantConfig,
        convenienceStoreConfig: input.convenienceStoreConfig,
        shoppingMallConfig: input.shoppingMallConfig,
        stockExchangeConfig: input.stockExchangeConfig,
        centralBankConfig: input.centralBankConfig,
        airportConfig: input.airportConfig,
        cityHallConfig: input.cityHallConfig,
        courthouseConfig: input.courthouseConfig,
        lobbyClubConfig: input.lobbyClubConfig,
        vipLoungeConfig: input.vipLoungeConfig,
        powerStationConfig: input.powerStationConfig,
        recruitmentCenterConfig: input.recruitmentCenterConfig,
        fitnessClubConfig: input.fitnessClubConfig,
        garageConfig: input.garageConfig,
        carDealerConfig: input.carDealerConfig,
        smugglingTunnelConfig: input.smugglingTunnelConfig,
        streetDealersConfig: input.streetDealersConfig,
        schoolConfig: input.schoolConfig,
        recyclingCenterConfig: input.recyclingCenterConfig,
        tick: input.tick,
        tickRateMs: input.tickRateMs
      }),
      specialActions: createSpecialActionViews(definition, actions),
      level: building.level,
      status: building.status,
      actionCooldowns: { ...(building.actionCooldowns ?? {}) },
      actions
    };
  });
};

const normalizeBuildingDisplayName = (value: string | null | undefined): string | null => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

const resolveCatalogVariantName = (
  definition: CreateDistrictPanelBuildingViewsInput["buildCatalog"][number] | undefined,
  seed: string
): string | null => {
  const variants = definition?.nameVariants ?? [];
  if (variants.length < 1) {
    return null;
  }
  return variants[hashString(seed) % variants.length] ?? null;
};

const hashString = (value: string): number => {
  const text = String(value || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const createSpecialActionViews = (
  definition: CreateDistrictPanelBuildingViewsInput["buildCatalog"][number] | undefined,
  actions: ReturnType<typeof createBuildingActionViews>
) =>
  (definition?.specialActions ?? []).map((specialAction) => {
    const commandAction = actions.find((action) => action.actionId === specialAction.actionId);

    return {
      actionId: specialAction.actionId,
      label: specialAction.label,
      description: specialAction.description,
      effectSummary: specialAction.effectSummary,
      durationMs: specialAction.durationMs,
      cooldownMs: specialAction.cooldownMs,
      cooldownRemainingTicks: commandAction?.cooldownRemainingTicks ?? 0,
      heatGain: specialAction.heatGain,
      enabled: commandAction?.enabled ?? false,
      disabledReason: commandAction?.disabledReason ?? "This special action is not wired to the command dispatcher yet."
    };
  });

const createBuildingActionViews = (input: {
  actionCatalog: Readonly<Record<string, BuildingActionBalanceConfig>>;
  state: CoreGameState;
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
  building: CoreGameState["buildingsById"][string];
  district: CoreGameState["districtsById"][string];
  playerId: string;
  playerBalances: Record<string, number>;
  tick: number;
  tickRateMs?: number;
}) =>
  Object.values(input.actionCatalog)
    .filter((action) => action.buildingType === input.building.buildingTypeId)
    .map((action) => {
      const cooldownUntilTick = Math.max(0, Number((input.building.actionCooldowns ?? {})[action.actionId] || 0));
      const cooldownRemainingTicks = Math.max(0, cooldownUntilTick - input.tick);
      const missingCosts = Object.entries(action.inputCost).filter(
        ([resourceKey, requiredAmount]) => Math.max(0, Number(input.playerBalances[resourceKey] || 0)) < requiredAmount
      );
      const ownerBlocked =
        action.requiredOwner &&
        (input.district.ownerPlayerId !== input.playerId || input.building.ownerPlayerId !== input.playerId);
      const stripClubDisabledReason = resolveStripClubDisabledReason({
        state: input.state,
        district: input.district,
        building: input.building,
        action,
        stripClubConfig: input.stripClubConfig,
        tick: input.tick
      });
      const powerStationDisabledReason = resolvePowerStationDisabledReason({
        state: input.state,
        building: input.building,
        action,
        powerStationConfig: input.powerStationConfig,
        tick: input.tick
      });
      const recyclingCenterDisabledReason = resolveRecyclingCenterDisabledReason({
        state: input.state,
        building: input.building,
        action,
        recyclingCenterConfig: input.recyclingCenterConfig,
        tickRateMs: input.tickRateMs ?? 5000
      });
      const smugglingTunnelDisabledReason = resolveSmugglingTunnelDisabledReason({
        state: input.state,
        building: input.building,
        action,
        smugglingTunnelConfig: input.smugglingTunnelConfig,
        tick: input.tick
      });
      const stockExchangeDisabledReason = resolveStockExchangeDisabledReason({
        state: input.state,
        district: input.district,
        building: input.building,
        action,
        stockExchangeConfig: input.stockExchangeConfig,
        playerBalances: input.playerBalances,
        tick: input.tick
      });
      const airportDisabledReason = resolveAirportDisabledReason({
        state: input.state,
        building: input.building,
        action,
        airportConfig: input.airportConfig,
        playerBalances: input.playerBalances,
        tick: input.tick
      });
      const cityHallDisabledReason = resolveCityHallDisabledReason({
        state: input.state,
        district: input.district,
        building: input.building,
        action,
        cityHallConfig: input.cityHallConfig,
        playerBalances: input.playerBalances,
        tick: input.tick
      });
      const centralBankDisabledReason = resolveCentralBankDisabledReason({
        state: input.state,
        district: input.district,
        building: input.building,
        action,
        centralBankConfig: input.centralBankConfig,
        playerBalances: input.playerBalances,
        tick: input.tick
      });
      const lobbyClubDisabledReason = resolveLobbyClubDisabledReason({
        district: input.district,
        building: input.building,
        action,
        lobbyClubConfig: input.lobbyClubConfig,
        playerBalances: input.playerBalances,
        tick: input.tick
      });
      const schoolDisabledReason = resolveSchoolDisabledReason({
        state: input.state,
        building: input.building,
        action,
        schoolConfig: input.schoolConfig,
        tick: input.tick
      });
      const streetDealerDisabledReason = resolveStreetDealerDisabledReason({
        state: input.state,
        building: input.building,
        action,
        streetDealersConfig: input.streetDealersConfig,
        playerBalances: input.playerBalances,
        tick: input.tick
      });
      const disabledReason = ownerBlocked
        ? "Only the district owner can run this building action."
        : input.building.status !== "active"
          ? "Only active fixed buildings can run actions."
          : input.district.status === "contested" && !action.allowedIfContested
            ? "This action is blocked while the district is contested."
            : stripClubDisabledReason
              ? stripClubDisabledReason
              : powerStationDisabledReason
                ? powerStationDisabledReason
                : recyclingCenterDisabledReason
                  ? recyclingCenterDisabledReason
                  : smugglingTunnelDisabledReason
                    ? smugglingTunnelDisabledReason
                    : stockExchangeDisabledReason
                      ? stockExchangeDisabledReason
                      : airportDisabledReason
                        ? airportDisabledReason
                        : cityHallDisabledReason
                          ? cityHallDisabledReason
                          : centralBankDisabledReason
                            ? centralBankDisabledReason
                            : lobbyClubDisabledReason
                              ? lobbyClubDisabledReason
                              : schoolDisabledReason
                                ? schoolDisabledReason
                                : streetDealerDisabledReason
                                  ? streetDealerDisabledReason
                              : cooldownRemainingTicks > 0
                                ? `Cooldown ${formatTickLabel(cooldownRemainingTicks)}.`
                                : missingCosts.length > 0
                                  ? `Need ${formatInputSummary(Object.fromEntries(missingCosts))}.`
                                  : null;

      return {
        actionId: action.actionId,
        label: action.label,
        description: action.description,
        durationMs: action.durationMs,
        cooldownMs: action.cooldownMs,
        cooldownRemainingTicks,
        inputCost: { ...action.inputCost },
        outputGain: { ...action.outputGain },
        heatGain: action.heatGain,
        influenceChange: action.influenceChange,
        reportText: action.reportText,
        enabled: disabledReason === null,
        disabledReason
      };
    });

const resolveStripClubDisabledReason = (input: {
  state: CoreGameState;
  district: CoreGameState["districtsById"][string];
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  stripClubConfig?: StripClubBalanceConfig;
  tick: number;
}): string | null => {
  const config = input.stripClubConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) {
    return null;
  }
  const metadata = getStripClubMetadata(input.building);
  if (input.action.actionId === config.vipLounge.actionId && (metadata.vipLoungeExpiresAtTick ?? 0) > input.tick) {
    return `VIP salonek active ${formatTickLabel((metadata.vipLoungeExpiresAtTick ?? input.tick) - input.tick)}.`;
  }
  if (input.action.actionId === config.privateParty.actionId && (metadata.privatePartyExpiresAtTick ?? 0) > input.tick) {
    return `Soukromá party active ${formatTickLabel((metadata.privatePartyExpiresAtTick ?? input.tick) - input.tick)}.`;
  }
  if (input.action.actionId === config.barWhispers.actionId && Math.max(0, Number(input.district.influence || 0)) < config.barWhispers.influenceCost) {
    return `Need ${config.barWhispers.influenceCost} influence.`;
  }
  return null;
};

const resolvePowerStationDisabledReason = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  powerStationConfig?: PowerStationBalanceConfig;
  tick: number;
}): string | null => {
  const config = input.powerStationConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId || input.action.actionId !== config.backupGridSwitch.actionId) {
    return null;
  }
  const expiresAtTick = getPowerStationMetadata(input.building).backupGridSwitchExpiresAtTick ?? 0;
  if (expiresAtTick > input.tick) {
    return `Záložní síť active ${formatTickLabel(expiresAtTick - input.tick)}.`;
  }
  return null;
};

const resolveRecyclingCenterDisabledReason = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  recyclingCenterConfig?: RecyclingCenterBalanceConfig;
  tickRateMs: number;
}): string | null => {
  const config = input.recyclingCenterConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId || input.action.actionId !== config.extractLosses.actionId) {
    return null;
  }
  const stats = resolveRecyclingCenterSalvageStats({
    state: input.state,
    playerId: input.building.ownerPlayerId,
    config,
    tickRateMs: input.tickRateMs
  });
  if (stats.freshPool.length <= 0) {
    return "Salvage pool is empty.";
  }
  return null;
};

const resolveSmugglingTunnelDisabledReason = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  smugglingTunnelConfig?: SmugglingTunnelBalanceConfig;
  tick: number;
}): string | null => {
  const config = input.smugglingTunnelConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) {
    return null;
  }
  if (input.action.actionId !== config.openChannel.actionId) {
    return null;
  }
  const channel = resolveOpenChannelStats({
    state: input.state,
    playerId: input.building.ownerPlayerId,
    config,
    tick: input.tick
  });
  if (channel.active) {
    return `Otevřený kanál active ${formatTickLabel(channel.remainingTicks)}.`;
  }
  return null;
};

const resolveStockExchangeDisabledReason = (input: {
  state: CoreGameState;
  district: CoreGameState["districtsById"][string];
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  stockExchangeConfig?: StockExchangeBalanceConfig;
  playerBalances: Record<string, number>;
  tick: number;
}): string | null => {
  const config = input.stockExchangeConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const metadata = getStockExchangeMetadata(input.building, input.tick);
  if (input.action.actionId === config.marketPressure.actionId) {
    if (Math.max(0, Number(input.district.influence || 0)) < config.marketPressure.costInfluence) {
      return `Need ${config.marketPressure.costInfluence} influence.`;
    }
    if (metadata.marketEffects.some((effect) => effect.expiresAtTick > input.tick)) {
      return "Market pressure is already active.";
    }
  }
  if (input.action.actionId === config.insiderWindow.actionId && Number(metadata.insiderWindowExpiresAtTick || 0) > input.tick) {
    return `Insider Window active ${formatTickLabel(Number(metadata.insiderWindowExpiresAtTick) - input.tick)}.`;
  }
  if (input.action.actionId === config.speculativeBuy.actionId) {
    const minimumTotal = config.speculativeBuy.costCleanCash + 1;
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < minimumTotal) {
      return `Need at least ${minimumTotal} clean cash.`;
    }
  }
  return null;
};

const resolveAirportDisabledReason = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  airportConfig?: AirportBalanceConfig;
  playerBalances: Record<string, number>;
  tick: number;
}): string | null => {
  const config = input.airportConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const metadata = getAirportMetadata(input.building, input.tick);
  if (input.action.actionId === config.expressImport.actionId) {
    const penaltyPct = Math.max(0, Number(metadata.nextImportCostPenaltyPct || 0));
    const cost = Math.ceil(config.expressImport.costCleanCash * (1 + penaltyPct / 100));
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < cost) {
      return `Need ${cost} clean cash.`;
    }
  }
  if (input.action.actionId === config.blackCharter.actionId) {
    if (Number(metadata.blackCharterExpiresAtTick || 0) > input.tick) {
      return `Černý charter active ${formatTickLabel(Number(metadata.blackCharterExpiresAtTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.playerBalances["dirty-cash"] || 0)) < config.blackCharter.costDirtyCash) {
      return `Need ${config.blackCharter.costDirtyCash} dirty cash.`;
    }
  }
  if (input.action.actionId === config.evacuationCorridor.actionId) {
    if (Number(metadata.evacuationCorridorExpiresAtTick || 0) > input.tick) {
      return `Evakuační koridor active ${formatTickLabel(Number(metadata.evacuationCorridorExpiresAtTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.evacuationCorridor.costCleanCash) {
      return `Need ${config.evacuationCorridor.costCleanCash} clean cash.`;
    }
  }
  return null;
};

const resolveCityHallDisabledReason = (input: {
  state: CoreGameState;
  district: CoreGameState["districtsById"][string];
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  cityHallConfig?: CityHallBalanceConfig;
  playerBalances: Record<string, number>;
  tick: number;
}): string | null => {
  const config = input.cityHallConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const metadata = getCityHallMetadata(input.building, input.tick);
  if (input.action.actionId === config.officialCover.actionId) {
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.officialCover.costCleanCash) {
      return `Need ${config.officialCover.costCleanCash} clean cash.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.officialCover.costInfluence) {
      return `Need ${config.officialCover.costInfluence} influence.`;
    }
    const activeCover = Object.values(input.state.districtsById)
      .filter((district) => district.ownerPlayerId === input.building.ownerPlayerId && district.status !== "destroyed")
      .map((district) => metadata.officialCoverByDistrictId[district.id])
      .find((cover) => Number(cover?.expiresAtTick || 0) > input.tick);
    if (activeCover) {
      return `Úřední krytí active ${formatTickLabel(activeCover.expiresAtTick - input.tick)} ve vlastněných districtech.`;
    }
  }
  if (input.action.actionId === config.cityContract.actionId) {
    if (Number(metadata.cityContractBlockedUntilTick || 0) > input.tick) {
      return `Městská zakázka blocked ${formatTickLabel(Number(metadata.cityContractBlockedUntilTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.cityContract.costInfluence) {
      return `Need ${config.cityContract.costInfluence} influence.`;
    }
  }
  if (input.action.actionId === config.emergencyDecree.actionId) {
    if (Number(metadata.emergencyDecree?.expiresAtTick || 0) > input.tick) {
      return `Nouzová vyhláška active ${formatTickLabel(Number(metadata.emergencyDecree?.expiresAtTick || 0) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.emergencyDecree.costCleanCash) {
      return `Need ${config.emergencyDecree.costCleanCash} clean cash.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.emergencyDecree.costInfluence) {
      return `Need ${config.emergencyDecree.costInfluence} influence.`;
    }
  }
  return null;
};

const resolveCentralBankDisabledReason = (input: {
  state: CoreGameState;
  district: CoreGameState["districtsById"][string];
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  centralBankConfig?: CentralBankBalanceConfig;
  playerBalances: Record<string, number>;
  tick: number;
}): string | null => {
  const config = input.centralBankConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const metadata = getCentralBankMetadata(input.building, input.tick);
  if (input.action.actionId === config.liquidityInjection.actionId) {
    if (Number(metadata.liquidityBlockedUntilTick || 0) > input.tick) {
      return `Likviditní injekce blocked ${formatTickLabel(Number(metadata.liquidityBlockedUntilTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.liquidityInjection.costInfluence) {
      return `Need ${config.liquidityInjection.costInfluence} influence.`;
    }
  }
  if (input.action.actionId === config.frozenAccounts.actionId) {
    if (Number(metadata.frozenAccountsExpiresAtTick || 0) > input.tick) {
      return `Zmrazené účty active ${formatTickLabel(Number(metadata.frozenAccountsExpiresAtTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.frozenAccounts.costCleanCash) {
      return `Need ${config.frozenAccounts.costCleanCash} clean cash.`;
    }
  }
  if (input.action.actionId === config.currencyIntervention.actionId) {
    if (metadata.currencyInterventions.some((effect) => effect.expiresAtTick > input.tick)) {
      return "Kurzovní intervence is already active.";
    }
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.currencyIntervention.costCleanCash) {
      return `Need ${config.currencyIntervention.costCleanCash} clean cash.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.currencyIntervention.costInfluence) {
      return `Need ${config.currencyIntervention.costInfluence} influence.`;
    }
  }
  return null;
};

const resolveLobbyClubDisabledReason = (input: {
  district: CoreGameState["districtsById"][string];
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  lobbyClubConfig?: LobbyClubBalanceConfig;
  playerBalances: Record<string, number>;
  tick: number;
}): string | null => {
  const config = input.lobbyClubConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const metadata = getLobbyClubMetadata(input.building, input.tick);
  if (input.action.actionId === config.backroomPressure.actionId) {
    if (Number(metadata.backroomPressureExpiresAtTick || 0) > input.tick) {
      return `Zákulisní tlak active ${formatTickLabel(Number(metadata.backroomPressureExpiresAtTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.backroomPressure.costCleanCash) {
      return `Need ${config.backroomPressure.costCleanCash} clean cash.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.backroomPressure.costInfluence) {
      return `Need ${config.backroomPressure.costInfluence} influence.`;
    }
  }
  if (input.action.actionId === config.quietNegotiation.actionId) {
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.quietNegotiation.costCleanCash) {
      return `Need ${config.quietNegotiation.costCleanCash} clean cash.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.quietNegotiation.costInfluence) {
      return `Need ${config.quietNegotiation.costInfluence} influence.`;
    }
  }
  if (input.action.actionId === config.mediaScreen.actionId) {
    if (Number(metadata.mediaScreenExpiresAtTick || 0) > input.tick) {
      return `Mediální clona active ${formatTickLabel(Number(metadata.mediaScreenExpiresAtTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.mediaScreen.costCleanCash) {
      return `Need ${config.mediaScreen.costCleanCash} clean cash.`;
    }
  }
  return null;
};

const resolveSchoolDisabledReason = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  schoolConfig?: SchoolBalanceConfig;
  tick: number;
}): string | null => {
  const config = input.schoolConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) {
    return null;
  }
  const metadata = getSchoolMetadata(input.building, input.tick);
  if (input.action.actionId === config.collectStudents.actionId) {
    return metadata.storedStudents > 0 ? null : "Škola zatím nemá studenty k vybrání.";
  }
  if (input.action.actionId !== config.eveningCourse.actionId) {
    return null;
  }
  if (isEveningCourseActive(metadata, input.tick)) {
    return `Večerní kurz active ${formatTickLabel(Math.max(0, Number(metadata.eveningCourseExpiresAtTick || 0) - input.tick))}.`;
  }
  return null;
};

const resolveStreetDealerDisabledReason = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  streetDealersConfig?: StreetDealersBalanceConfig;
  playerBalances: Record<string, number>;
  tick: number;
}): string | null => {
  const config = input.streetDealersConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId || input.action.actionId !== config.startDrugSale.actionId) {
    return null;
  }
  if (!input.building.ownerPlayerId) return "Street dealers need an owner.";
  const player = input.state.playersById[input.building.ownerPlayerId];
  const ownedCount = getOwnedStreetDealerCount(input.state, input.building.ownerPlayerId, config);
  const slotCount = resolveStreetDealerSlotCount(ownedCount, config);
  const metadata = player ? getStreetDealersPlayerMetadata(player) : { slots: [], saleHistory: [] };
  const lockedSlots = metadata.slots.filter((slot) => slot.saleId || Number(slot.cooldownUntilTick || 0) > input.tick).length;
  if (slotCount <= 0 || lockedSlots >= slotCount) return "No free dealer slot.";
  const hasDrugStock = config.sellableDrugs.some((drug) => Number(input.playerBalances[drug.itemId] || 0) > 0);
  return hasDrugStock ? null : "Need a Drug Lab product in storage.";
};
