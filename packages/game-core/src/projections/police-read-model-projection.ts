import type { PoliceReadModel as SharedPoliceReadModel } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { resolveWantedLevel } from "../rules/police/wantedLevel";
import { calculatePlayerPolicePressure } from "../rules/police/policePressure";
import { resolveCityHallNetworkCover, resolveCityHallPoliceMitigation } from "../rules/police/cityHallPoliceMitigation";
import {
  createActiveConsequences,
  createHeatBreakdown,
  createProtectionView,
  createRecentRaidInfo,
  getRecommendedAction,
  resolveRaidRisk,
  sanitizeDistrictId,
  sanitizeHeat,
  sanitizePoliceFeed,
  sanitizeWantedLevel,
  selectVisiblePendingRaid,
  toPendingRaidView,
  type PoliceRaidRisk
} from "./police-read-model-helpers";

export type { PoliceRaidRisk } from "./police-read-model-helpers";

export interface PoliceHeatSourceView {
  id: string;
  kind: "player" | "district";
  label: string;
  heat: number;
}

export interface PoliceReadModel extends SharedPoliceReadModel {
  projectedWantedLevel: number;
  districtHeat: number;
  totalHeat: number;
  raidPressure: number;
  raidThreshold: number;
  raidPending: boolean;
  raidRisk: PoliceRaidRisk;
  heatSources: PoliceHeatSourceView[];
}

export interface PoliceReadModelOptions {
  selectedDistrictId?: string | null;
}

/**
 * Responsibility: Creates a UI/API-safe police projection from authoritative state.
 * Belongs here: read-only heat aggregation, wanted projection, pressure, and raid lifecycle view.
 * Does not belong here: mutating heat, scheduling raids, or resolving raid outcomes.
 */
export const createPoliceReadModel = (
  state: CoreGameState,
  playerId: string,
  context?: GameCoreContext,
  options: PoliceReadModelOptions = {}
): PoliceReadModel => {
  const player = state.playersById[playerId] ?? null;
  const policeStateId = player?.policeStateId ?? null;
  const policeState = policeStateId ? state.policeStatesById[policeStateId] ?? null : null;
  const pressure = calculatePlayerPolicePressure(state, playerId, context);
  const playerHeat = sanitizeHeat(policeState?.heat);
  const districtSources = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId)
    .map((district) => ({
      id: district.id,
      kind: "district" as const,
      label: district.name || district.id,
      heat: sanitizeHeat(district.heat)
    }))
    .filter((source) => source.heat > 0);
  const heatSources = [
    ...(policeState
      ? [{
          id: policeState.id,
          kind: "player" as const,
          label: "Player police heat",
          heat: playerHeat
        }]
      : []),
    ...districtSources
  ].filter((source) => source.heat > 0);
  const districtHeat = districtSources.reduce((total, source) => total + source.heat, 0);
  const totalHeat = playerHeat + districtHeat;
  const projectedWantedLevel = resolveWantedLevel(playerHeat);
  const storedWantedLevel = sanitizeWantedLevel(policeState?.wantedLevel);
  const wantedLevel = Math.max(storedWantedLevel, projectedWantedLevel);
  const pendingRaid = toPendingRaidView(selectVisiblePendingRaid(policeState?.pendingRaids));
  const policeFeed = sanitizePoliceFeed(policeState?.policeEvents);
  const lastPoliceEvent = policeFeed[0] ?? null;
  const recentRaid = createRecentRaidInfo(policeFeed);
  const activeConsequences = createActiveConsequences(state, playerId);
  const raidPending = pendingRaid !== null;
  const courthouseMitigation = pendingRaid?.previewConsequences.courthouseMitigation ?? null;
  const projectedSeverity = pressure.aggregatePressure >= pressure.extremePressureRaidThreshold ? "extreme" : "high";
  const cityHallNetworkCover = resolveCityHallNetworkCover({
    state,
    context,
    playerId
  });
  const cityHallMitigation = resolveCityHallPoliceMitigation({
    state,
    context,
    playerId,
    targetDistrictId: pressure.hottestDistrictHeat >= (context?.config.balance.police?.districtTargetHeatThreshold ?? 60)
      ? pressure.hottestDistrictId
      : null,
    severity: projectedSeverity
  });
  const mitigations = [
    ...(cityHallMitigation || cityHallNetworkCover
      ? [{
        source: (cityHallMitigation ?? cityHallNetworkCover)!.source,
        label: cityHallMitigation
          ? `${cityHallMitigation.label} Snižuje šanci vytvoření zásahu.`
          : `${cityHallNetworkCover!.label} Raidy čistě z player heat bez cílového districtu zatím nekryje.`,
        districtId: cityHallMitigation?.districtId ?? null,
        coveredDistrictIds: cityHallMitigation?.coveredDistrictIds ?? cityHallNetworkCover!.coveredDistrictIds,
        effectiveReductionPct: cityHallMitigation?.effectiveReductionPct ?? 0,
        triggerChancePct: cityHallMitigation?.triggerChancePct
      }]
      : []),
    ...(courthouseMitigation
      ? [{
        source: "courthouse",
        label: "Soud nezabrání zásahu, ale může zmírnit následky.",
        districtId: pendingRaid?.targetDistrictId ?? null,
        effectiveReductionPct: courthouseMitigation.reductionPct
      }]
      : [])
  ];
  const heatBreakdown = createHeatBreakdown({
    wantedLabel: `${wantedLevel} / 5`,
    playerHeat,
    districtHeat,
    raidPressure: pressure.aggregatePressure
  });
  const raidPressureExplanation = "Raid pressure je celkový tlak policie: player heat plus vážený district heat z vlastněných districtů. District heat může přitáhnout raid i bez vysokého wanted levelu.";
  const selectedDistrictId = sanitizeDistrictId(options.selectedDistrictId);
  const selectedDistrict = selectedDistrictId ? state.districtsById[selectedDistrictId] ?? null : null;
  const protection = createProtectionView(mitigations);

  return {
    playerId,
    policeStateId,
    heat: playerHeat,
    playerHeat,
    ownedDistrictHeat: districtHeat,
    wantedLevel,
    wantedLevelLabel: `${wantedLevel} / 5`,
    wantedLabel: `${wantedLevel} / 5`,
    riskTier: raidPending && pressure.riskTier === "low" ? "high" : pressure.riskTier,
    aggregatePressure: pressure.aggregatePressure,
    playerHeatPressure: pressure.playerHeatPressure,
    districtHeatPressure: pressure.districtHeatPressure,
    hottestDistrictId: pressure.hottestDistrictId,
    hottestDistrictHeat: pressure.hottestDistrictHeat,
    selectedDistrictId,
    selectedDistrictHeat: selectedDistrict ? sanitizeHeat(selectedDistrict.heat) : 0,
    pendingRaid,
    activeRaid: pendingRaid
      ? {
          id: pendingRaid.id,
          type: "police-raid-pending",
          severity: pendingRaid.severity,
          status: pendingRaid.status,
          districtId: pendingRaid.targetDistrictId,
          tick: pendingRaid.triggerTick,
          message: pendingRaid.reason
        }
      : null,
    recentRaid,
    activeConsequences,
    raidConsequenceStatus: raidPending
      ? "pending"
      : activeConsequences.length > 0
        ? "active"
        : recentRaid
          ? "recent"
          : "none",
    lastPoliceEvent,
    policeFeed,
    mitigations,
    protection,
    recommendedAction: getRecommendedAction({
      riskTier: pressure.riskTier,
      raidPending,
      wantedLevel,
      playerHeat,
      playerHeatPressure: pressure.playerHeatPressure,
      districtHeat,
      districtHeatPressure: pressure.districtHeatPressure,
      aggregatePressure: pressure.aggregatePressure,
      cityHallMitigationActive: Boolean(cityHallNetworkCover),
      courthouseMitigationActive: Boolean(courthouseMitigation)
    }),
    updatedAtTick: state.root.tick,
    updatedAt: context?.clock?.nowIso() ?? new Date().toISOString(),
    projectedWantedLevel,
    districtHeat,
    totalHeat,
    raidPressure: pressure.aggregatePressure,
    raidThreshold: pressure.highPressureRaidThreshold,
    raidPressureExplanation,
    heatBreakdown,
    raidPending,
    raidRisk: resolveRaidRisk(pressure.aggregatePressure, pressure.highPressureRaidThreshold, raidPending),
    heatSources
  };
};
