import type {
  PendingRaid,
  PoliceEvent,
  PoliceReadModel as SharedPoliceReadModel
} from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { resolveWantedLevel } from "../rules/police/wantedLevel";
import { calculatePlayerPolicePressure } from "../rules/police/policePressure";

export type PoliceRaidRisk = "none" | "watch" | "elevated" | "ready" | "pending";

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

/**
 * Responsibility: Creates a UI/API-safe police projection from authoritative state.
 * Belongs here: read-only heat aggregation, wanted projection, pressure, and raid lifecycle view.
 * Does not belong here: mutating heat, scheduling raids, or resolving raid outcomes.
 */
export const createPoliceReadModel = (
  state: CoreGameState,
  playerId: string,
  context?: GameCoreContext
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
  const pendingRaid = selectVisiblePendingRaid(policeState?.pendingRaids);
  const policeFeed = sanitizePoliceFeed(policeState?.policeEvents);
  const lastPoliceEvent = policeFeed[0] ?? null;
  const raidPending = pendingRaid !== null;

  return {
    playerId,
    policeStateId,
    heat: playerHeat,
    wantedLevel,
    wantedLabel: `${wantedLevel} / 5`,
    riskTier: raidPending && pressure.riskTier === "low" ? "high" : pressure.riskTier,
    aggregatePressure: pressure.aggregatePressure,
    playerHeatPressure: pressure.playerHeatPressure,
    districtHeatPressure: pressure.districtHeatPressure,
    hottestDistrictId: pressure.hottestDistrictId,
    hottestDistrictHeat: pressure.hottestDistrictHeat,
    pendingRaid,
    lastPoliceEvent,
    policeFeed,
    recommendedAction: getRecommendedAction(raidPending ? "high" : pressure.riskTier),
    updatedAtTick: state.root.tick,
    updatedAt: new Date(0).toISOString(),
    projectedWantedLevel,
    districtHeat,
    totalHeat,
    raidPressure: pressure.aggregatePressure,
    raidThreshold: pressure.highPressureRaidThreshold,
    raidPending,
    raidRisk: resolveRaidRisk(pressure.aggregatePressure, pressure.highPressureRaidThreshold, raidPending),
    heatSources
  };
};

const selectVisiblePendingRaid = (raids: PendingRaid[] | undefined): PendingRaid | null =>
  (raids ?? []).find((raid) => raid.status === "pending" || raid.status === "acknowledged") ?? null;

const sanitizePoliceFeed = (events: PoliceEvent[] | undefined): PoliceEvent[] =>
  (events ?? [])
    .filter((event): event is PoliceEvent => Boolean(event?.id && event.playerId))
    .slice(0, 8);

const sanitizeHeat = (value: unknown): number => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const sanitizeWantedLevel = (value: unknown): number =>
  Math.max(0, Math.min(5, Math.floor(Number(value || 0))));

const resolveRaidRisk = (
  raidPressure: number,
  raidThreshold: number,
  raidPending: boolean
): PoliceRaidRisk => {
  if (raidPending) return "pending";
  if (raidPressure >= raidThreshold) return "ready";
  if (raidPressure >= raidThreshold * 0.75) return "elevated";
  return raidPressure > 0 ? "watch" : "none";
};

const getRecommendedAction = (riskTier: SharedPoliceReadModel["riskTier"]): string => {
  switch (riskTier) {
    case "extreme":
      return "Okamžitě omez hlučné akce. Hrozí raid.";
    case "high":
      return "Zvaž pauzu v útocích. Policie sleduje tvoje districty.";
    case "medium":
      return "Sniž hluk nebo přesouvej dirty cash.";
    case "low":
    default:
      return "Pokračuj opatrně.";
  }
};
