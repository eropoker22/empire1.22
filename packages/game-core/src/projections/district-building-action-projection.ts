import type { DistrictPanelBuildingView } from "@empire/shared-types";
import type { BuildingActionBalanceConfig, ResolvedGameModeConfig } from "../contracts/game-mode-config";
import type { CoreGameState } from "../entities/game-state";
import type { DistrictPanelBuildingCatalogEntry } from "./district-building-catalog-types";
import {
  createBuildingStats,
  createPassivePhaseEffectLabel
} from "./district-building-stats-projection";
import { formatInputSummary, formatResourceLabel, formatTickLabel } from "./district-building-action-formatters";
import {
  createExpectedEffectSummary,
  createRequiredInputViews,
  createRiskSummary,
  resolveBuildingActionStatus
} from "./district-building-action-view-helpers";
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
import { resolveDayNightBuildingRule } from "../rules/day-night/dayNightActionRules";
import {
  applyDayNightBuildingIncomeModifiers,
  resolveDayNightPassiveBuildingRule
} from "../rules/day-night/dayNight";
import { resolveEffectiveBuildingActionPreview } from "../rules/buildings/buildingActionCosts";
import {
  createBaseBuildingActionPreview,
  normalizeBuildingDisplayName,
  resolveCatalogVariantName
} from "./district-building-display-helpers";

export interface CreateDistrictPanelBuildingViewsInput {
  state: CoreGameState;
  buildings: CoreGameState["buildingsById"][string][];
  buildCatalog: ReadonlyArray<DistrictPanelBuildingCatalogEntry>;
  actionCatalog: Readonly<Record<string, BuildingActionBalanceConfig>>;
  config?: ResolvedGameModeConfig;
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
    const buildingPhaseRule = input.config
      ? resolveDayNightBuildingRule(input.state, { config: input.config }, building.buildingTypeId)
      : null;
    const passivePhaseRule = input.config
      ? resolveDayNightPassiveBuildingRule(input.state, { config: input.config }, building.buildingTypeId)
      : null;
    const effectivePassiveStats = input.config && definition?.stats
      ? applyDayNightBuildingIncomeModifiers({
          state: input.state,
          context: { config: input.config },
          buildingTypeId: building.buildingTypeId,
          cleanPerHour: definition.stats.cleanPerHour,
          dirtyPerHour: definition.stats.dirtyPerHour,
          heatPerDay: definition.stats.heatPerDay,
          influencePerDay: definition.stats.influencePerDay
        })
      : undefined;
    const passivePhaseEffectLabel = createPassivePhaseEffectLabel({
      baseStats: definition?.stats,
      effectiveStats: effectivePassiveStats
    });
    const actions = createBuildingActionViews({
      actionCatalog: input.actionCatalog,
      config: input.config,
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
      role: definition?.role ?? "Pevná budova",
      info: definition?.info ?? "Pevná budova districtu.",
      stats: createBuildingStats({
        definition,
        effectivePassiveStats,
        state: input.state,
        district: input.district,
        building,
        playerId: input.playerId,
        playerBalances: input.playerBalances,
        dayNightConfig: input.config,
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
      actions,
      phaseAvailability: buildingPhaseRule?.phaseAvailability ?? "neutral",
      phaseBadgeLabel: buildingPhaseRule?.phaseBadgeLabel ?? null,
      phaseTooltip: buildingPhaseRule?.phaseTooltip ?? null,
      phaseBlockedReason: buildingPhaseRule?.blockedReason ?? null,
      passivePhaseBadgeLabel: passivePhaseRule?.phaseBadgeLabel ?? null,
      passivePhaseEffectLabel,
      passivePhaseTooltip: passivePhaseEffectLabel ?? passivePhaseRule?.phaseTooltip ?? null
    };
  });
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
      baseInputCost: commandAction?.baseInputCost ?? {},
      effectiveInputCost: commandAction?.effectiveInputCost ?? {},
      baseOutputGain: commandAction?.baseOutputGain ?? {},
      effectiveOutputGain: commandAction?.effectiveOutputGain ?? {},
      baseHeatGain: commandAction?.baseHeatGain ?? specialAction.heatGain,
      effectiveHeatGain: commandAction?.effectiveHeatGain ?? specialAction.heatGain,
      baseCooldownMs: commandAction?.baseCooldownMs ?? specialAction.cooldownMs,
      effectiveCooldownMs: commandAction?.effectiveCooldownMs ?? specialAction.cooldownMs,
      baseDurationMs: commandAction?.baseDurationMs ?? specialAction.durationMs,
      effectiveDurationMs: commandAction?.effectiveDurationMs ?? specialAction.durationMs,
      enabled: commandAction?.enabled ?? false,
      disabledReason: commandAction?.disabledReason ?? "Tato speciální akce ještě není napojená na command dispatcher.",
      phaseAvailability: commandAction?.phaseAvailability ?? "neutral",
      phaseBadgeLabel: commandAction?.phaseBadgeLabel ?? null,
      phaseTooltip: commandAction?.phaseTooltip ?? null,
      phaseBlockedReason: commandAction?.phaseBlockedReason ?? null,
      blockedReason: commandAction?.blockedReason ?? null,
      preferredPhase: commandAction?.preferredPhase ?? null,
      currentPhase: commandAction?.currentPhase ?? null,
      phaseEffectSummary: commandAction?.phaseEffectSummary ?? []
    };
  });

const createBuildingActionViews = (input: {
  actionCatalog: Readonly<Record<string, BuildingActionBalanceConfig>>;
  config?: ResolvedGameModeConfig;
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
      const effectivePreview = input.config
        ? resolveEffectiveBuildingActionPreview({
            action,
            state: input.state,
            context: { config: input.config },
            buildingTypeId: input.building.buildingTypeId
          })
        : createBaseBuildingActionPreview(action);
      const missingCosts = Object.entries(effectivePreview.effectiveInputCost).filter(
        ([resourceKey, requiredAmount]) => Math.max(0, Number(input.playerBalances[resourceKey] || 0)) < requiredAmount
      );
      const effectiveAction = {
        ...action,
        inputCost: effectivePreview.effectiveInputCost,
        outputGain: effectivePreview.effectiveOutputGain,
        heatGain: effectivePreview.effectiveHeatGain,
        cooldownMs: effectivePreview.effectiveCooldownMs,
        durationMs: effectivePreview.effectiveDurationMs
      };
      const phaseBlocked = Boolean(effectivePreview.blockedReason);
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
      const disabledReason = effectivePreview.blockedReason
        ? effectivePreview.blockedReason
        : ownerBlocked
        ? "Tuhle akci může spustit jen majitel districtu."
        : input.building.status !== "active"
          ? "Akce může spustit jen aktivní pevná budova."
          : input.district.status === "contested" && !action.allowedIfContested
            ? "Akce je blokovaná, dokud je district sporný."
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
                                ? `Akce čeká ${formatTickLabel(cooldownRemainingTicks)}.`
                                : missingCosts.length > 0
                                ? `Chybí ${formatInputSummary(Object.fromEntries(missingCosts))}.`
                                  : null;
      const status = resolveBuildingActionStatus({
        disabledReason,
        cooldownRemainingTicks: phaseBlocked ? 0 : cooldownRemainingTicks,
        missingCostCount: phaseBlocked ? 0 : missingCosts.length
      });

      return {
        buildingId: input.building.id,
        buildingTypeId: input.building.buildingTypeId,
        actionId: action.actionId,
        label: action.label,
        description: action.description,
        status,
        disabledReason,
        cooldownRemainingTicks,
        cost: { ...effectivePreview.effectiveInputCost },
        expectedEffectSummary: createExpectedEffectSummary(effectiveAction),
        riskSummary: createRiskSummary(effectiveAction),
        requiresInput: createRequiredInputViews({
          action,
          stockExchangeConfig: input.stockExchangeConfig,
          centralBankConfig: input.centralBankConfig,
          airportConfig: input.airportConfig,
          cityHallConfig: input.cityHallConfig,
          streetDealersConfig: input.streetDealersConfig
        }),
        durationMs: effectivePreview.effectiveDurationMs,
        cooldownMs: effectivePreview.effectiveCooldownMs,
        inputCost: { ...effectivePreview.effectiveInputCost },
        outputGain: { ...effectivePreview.effectiveOutputGain },
        heatGain: effectivePreview.effectiveHeatGain,
        baseInputCost: { ...effectivePreview.baseInputCost },
        effectiveInputCost: { ...effectivePreview.effectiveInputCost },
        baseOutputGain: { ...effectivePreview.baseOutputGain },
        effectiveOutputGain: { ...effectivePreview.effectiveOutputGain },
        baseHeatGain: effectivePreview.baseHeatGain,
        effectiveHeatGain: effectivePreview.effectiveHeatGain,
        baseCooldownMs: effectivePreview.baseCooldownMs,
        effectiveCooldownMs: effectivePreview.effectiveCooldownMs,
        baseDurationMs: effectivePreview.baseDurationMs,
        effectiveDurationMs: effectivePreview.effectiveDurationMs,
        influenceChange: action.influenceChange,
        reportText: action.reportText,
        enabled: status === "available",
        phaseAvailability: effectivePreview.phaseAvailability,
        phaseBadgeLabel: effectivePreview.phaseBadgeLabel,
        phaseTooltip: effectivePreview.phaseTooltip,
        phaseBlockedReason: effectivePreview.blockedReason,
        blockedReason: effectivePreview.blockedReason,
        preferredPhase: effectivePreview.preferredPhase,
        currentPhase: effectivePreview.currentPhase,
        phaseEffectSummary: [...effectivePreview.phaseEffectSummary]
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
    return `VIP salonek je aktivní ještě ${formatTickLabel((metadata.vipLoungeExpiresAtTick ?? input.tick) - input.tick)}.`;
  }
  if (input.action.actionId === config.privateParty.actionId && (metadata.privatePartyExpiresAtTick ?? 0) > input.tick) {
    return `Soukromá party je aktivní ještě ${formatTickLabel((metadata.privatePartyExpiresAtTick ?? input.tick) - input.tick)}.`;
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
    return `Záložní síť běží ještě ${formatTickLabel(expiresAtTick - input.tick)}.`;
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
    return "Nemáš žádné itemové ztráty k vytěžení.";
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
    return `Otevřený kanál je aktivní ještě ${formatTickLabel(channel.remainingTicks)}.`;
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
      return `Chybí ${config.marketPressure.costInfluence} vlivu.`;
    }
    if (metadata.marketEffects.some((effect) => effect.expiresAtTick > input.tick)) {
      return "Tlak na market už je aktivní.";
    }
  }
  if (input.action.actionId === config.insiderWindow.actionId && Number(metadata.insiderWindowExpiresAtTick || 0) > input.tick) {
    return `Vnitřní tipy jsou aktivní ještě ${formatTickLabel(Number(metadata.insiderWindowExpiresAtTick) - input.tick)}.`;
  }
  if (input.action.actionId === config.speculativeBuy.actionId) {
    const minimumTotal = config.speculativeBuy.costCleanCash + 1;
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < minimumTotal) {
      return `Chybí alespoň ${minimumTotal} clean cash.`;
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
      return `Chybí ${cost} clean cash.`;
    }
  }
  if (input.action.actionId === config.blackCharter.actionId) {
    if (Number(metadata.blackCharterExpiresAtTick || 0) > input.tick) {
      return `Černý charter je aktivní ještě ${formatTickLabel(Number(metadata.blackCharterExpiresAtTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.playerBalances["dirty-cash"] || 0)) < config.blackCharter.costDirtyCash) {
      return `Chybí ${config.blackCharter.costDirtyCash} dirty cash.`;
    }
  }
  if (input.action.actionId === config.evacuationCorridor.actionId) {
    if (Number(metadata.evacuationCorridorExpiresAtTick || 0) > input.tick) {
      return `Evakuační koridor je aktivní ještě ${formatTickLabel(Number(metadata.evacuationCorridorExpiresAtTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.evacuationCorridor.costCleanCash) {
      return `Chybí ${config.evacuationCorridor.costCleanCash} clean cash.`;
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
      return `Chybí ${config.officialCover.costCleanCash} clean cash.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.officialCover.costInfluence) {
      return `Chybí ${config.officialCover.costInfluence} vlivu.`;
    }
    const activeCover = Object.values(input.state.districtsById)
      .filter((district) => district.ownerPlayerId === input.building.ownerPlayerId && district.status !== "destroyed")
      .map((district) => metadata.officialCoverByDistrictId[district.id])
      .find((cover) => Number(cover?.expiresAtTick || 0) > input.tick);
    if (activeCover) {
      return `Úřední krytí je aktivní ještě ${formatTickLabel(activeCover.expiresAtTick - input.tick)} ve vlastněných districtech.`;
    }
  }
  if (input.action.actionId === config.cityContract.actionId) {
    if (Number(metadata.cityContractBlockedUntilTick || 0) > input.tick) {
      return `Městská zakázka je blokovaná ještě ${formatTickLabel(Number(metadata.cityContractBlockedUntilTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.cityContract.costInfluence) {
      return `Chybí ${config.cityContract.costInfluence} vlivu.`;
    }
  }
  if (input.action.actionId === config.emergencyDecree.actionId) {
    if (Number(metadata.emergencyDecree?.expiresAtTick || 0) > input.tick) {
      return `Nouzová vyhláška je aktivní ještě ${formatTickLabel(Number(metadata.emergencyDecree?.expiresAtTick || 0) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.emergencyDecree.costCleanCash) {
      return `Chybí ${config.emergencyDecree.costCleanCash} clean cash.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.emergencyDecree.costInfluence) {
      return `Chybí ${config.emergencyDecree.costInfluence} vlivu.`;
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
      return `Likviditní injekce je blokovaná ještě ${formatTickLabel(Number(metadata.liquidityBlockedUntilTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.liquidityInjection.costInfluence) {
      return `Chybí ${config.liquidityInjection.costInfluence} vlivu.`;
    }
  }
  if (input.action.actionId === config.frozenAccounts.actionId) {
    if (Number(metadata.frozenAccountsExpiresAtTick || 0) > input.tick) {
      return `Zmrazené účty jsou aktivní ještě ${formatTickLabel(Number(metadata.frozenAccountsExpiresAtTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.frozenAccounts.costCleanCash) {
      return `Chybí ${config.frozenAccounts.costCleanCash} clean cash.`;
    }
  }
  if (input.action.actionId === config.currencyIntervention.actionId) {
    if (metadata.currencyInterventions.some((effect) => effect.expiresAtTick > input.tick)) {
      return "Kurzovní intervence už je aktivní.";
    }
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.currencyIntervention.costCleanCash) {
      return `Chybí ${config.currencyIntervention.costCleanCash} clean cash.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.currencyIntervention.costInfluence) {
      return `Chybí ${config.currencyIntervention.costInfluence} vlivu.`;
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
      return `Zákulisní tlak je aktivní ještě ${formatTickLabel(Number(metadata.backroomPressureExpiresAtTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.backroomPressure.costCleanCash) {
      return `Chybí ${config.backroomPressure.costCleanCash} clean cash.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.backroomPressure.costInfluence) {
      return `Chybí ${config.backroomPressure.costInfluence} vlivu.`;
    }
  }
  if (input.action.actionId === config.quietNegotiation.actionId) {
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.quietNegotiation.costCleanCash) {
      return `Chybí ${config.quietNegotiation.costCleanCash} clean cash.`;
    }
    if (Math.max(0, Number(input.district.influence || 0)) < config.quietNegotiation.costInfluence) {
      return `Chybí ${config.quietNegotiation.costInfluence} vlivu.`;
    }
  }
  if (input.action.actionId === config.mediaScreen.actionId) {
    if (Number(metadata.mediaScreenExpiresAtTick || 0) > input.tick) {
      return `Mediální clona je aktivní ještě ${formatTickLabel(Number(metadata.mediaScreenExpiresAtTick) - input.tick)}.`;
    }
    if (Math.max(0, Number(input.playerBalances.cash || 0)) < config.mediaScreen.costCleanCash) {
      return `Chybí ${config.mediaScreen.costCleanCash} clean cash.`;
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
  if (input.action.actionId !== config.eveningCourse.actionId) {
    return null;
  }
  if (isEveningCourseActive(metadata, input.tick)) {
    return `Večerní kurz je aktivní ještě ${formatTickLabel(Math.max(0, Number(metadata.eveningCourseExpiresAtTick || 0) - input.tick))}.`;
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
  if (slotCount <= 0 || lockedSlots >= slotCount) return "Nemáš volný slot Pouličních dealerů.";
  const hasDrugStock = config.sellableDrugs.some((drug) => Number(input.playerBalances[drug.itemId] || 0) > 0);
  return hasDrugStock ? null : "Chybí produkt z drug labu ve skladu.";
};
