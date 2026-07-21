import type { PlayerId } from "@empire/shared-types";
import type { GameCoreContext } from "../../engine/context";
import type { CoreGameState } from "../../entities";
import { DEFAULT_ELIMINATION_SCORE_WEIGHTS, resolveEliminationConfig } from "./eliminationConfig";

export interface PlayerEliminationScore {
  playerId: PlayerId;
  playerName: string;
  gangName: string;
  avatarSrc: string | null;
  score: number;
  controlledDistricts: number;
  totalOwnedDistrictInfluence: number;
  activeBuildingCount: number;
  cleanCash: number;
  dirtyCash: number;
  totalResourceValue: number;
  population: number;
  recentActivityBonus: number;
  lastActionAt: string | null;
}

export const createPlayerEliminationScore = (
  state: CoreGameState,
  playerId: PlayerId,
  context: GameCoreContext
): PlayerEliminationScore => {
  const player = state.playersById[playerId];
  const weights = resolveEliminationConfig(context.config)?.scoreWeights ?? DEFAULT_ELIMINATION_SCORE_WEIGHTS;
  const districts = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId && district.status !== "destroyed");
  const resourceBalances = state.resourceStatesById[player?.resourceStateId ?? ""]?.balances ?? {};
  const cleanCash = positiveNumber(resourceBalances.cash);
  const dirtyCash = positiveNumber(resourceBalances["dirty-cash"]);
  const population = positiveNumber(player?.population ?? resourceBalances.population);
  const totalResourceValue = Object.entries(resourceBalances)
    .filter(([key]) => key !== "cash" && key !== "dirty-cash" && key !== "population")
    .reduce((sum, [key, value]) => sum + (positiveNumber(value) * resolveResourceScoreValue(weights.resourceScoreValues, key)), 0);
  const activeBuildingCount = Object.values(state.buildingsById)
    .filter((building) => building.ownerPlayerId === playerId && building.status === "active").length;
  const totalOwnedDistrictInfluence = districts.reduce((sum, district) => sum + positiveNumber(district.influence), 0);
  const recentActivityBonus = isRecentlyActive(state, player?.lastActionAt ?? null, context, weights.recentActivityWindowTicks)
    ? weights.recentActivityBonus
    : 0;
  const score =
    districts.length * weights.controlledDistricts
    + totalOwnedDistrictInfluence * weights.districtInfluence
    + activeBuildingCount * weights.activeBuildingCount
    + cleanCash * weights.cleanCash
    + dirtyCash * weights.dirtyCash
    + totalResourceValue * weights.resources
    + population * weights.population
    + recentActivityBonus;

  return {
    playerId,
    playerName: player?.name ?? playerId,
    gangName: stringMetadata(player?.metadata, "gangName") || player?.name || playerId,
    avatarSrc: stringMetadata(player?.metadata, "avatarSrc") || stringMetadata(player?.metadata, "avatar") || null,
    score,
    controlledDistricts: districts.length,
    totalOwnedDistrictInfluence,
    activeBuildingCount,
    cleanCash,
    dirtyCash,
    totalResourceValue,
    population,
    recentActivityBonus,
    lastActionAt: player?.lastActionAt ?? null
  };
};

const ELIMINATION_SCORE_EPSILON = 0.0001;

export const compareEliminationScores = (left: PlayerEliminationScore, right: PlayerEliminationScore): number =>
  compareScore(left.score, right.score)
  || left.controlledDistricts - right.controlledDistricts
  || compareLastActionAt(left.lastActionAt, right.lastActionAt)
  || left.playerId.localeCompare(right.playerId);

const compareScore = (left: number, right: number): number => {
  const delta = left - right;
  return Math.abs(delta) <= ELIMINATION_SCORE_EPSILON ? 0 : delta;
};

const stringMetadata = (metadata: Record<string, unknown> | undefined, key: string): string => {
  const value = String(metadata?.[key] ?? "").trim();
  return value;
};

const compareLastActionAt = (left: string | null, right: string | null): number => {
  const leftTime = Date.parse(left ?? "");
  const rightTime = Date.parse(right ?? "");
  const safeLeft = Number.isFinite(leftTime) ? leftTime : -Infinity;
  const safeRight = Number.isFinite(rightTime) ? rightTime : -Infinity;
  return safeLeft - safeRight;
};

const positiveNumber = (value: unknown): number => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const resolveResourceScoreValue = (registry: Record<string, number> | undefined, resourceKey: string): number => {
  const configured = Number(registry?.[resourceKey]);
  return Number.isFinite(configured) && configured >= 0 ? configured : 1;
};

const isRecentlyActive = (
  state: CoreGameState,
  lastActionAt: string | null,
  context: GameCoreContext,
  windowTicks: number
): boolean => {
  const lastActionMs = Date.parse(lastActionAt ?? "");
  if (!Number.isFinite(lastActionMs)) return false;
  const contextNowMs = context.clock?.now?.().getTime() ?? Date.parse(context.clock?.nowIso?.() ?? "");
  const startedAtMs = Date.parse(state.serverInstance.startedAt || "");
  const derivedNowMs = Number.isFinite(startedAtMs)
    ? startedAtMs + (Math.max(0, state.root.tick) * Math.max(1, context.config.tickRateMs))
    : Number.NaN;
  const nowMs = Number.isFinite(contextNowMs) ? contextNowMs : derivedNowMs;
  if (!Number.isFinite(nowMs)) return false;
  const windowMs = Math.max(0, Number(windowTicks) || 0) * Math.max(1, context.config.tickRateMs);
  const ageMs = nowMs - lastActionMs;
  return ageMs >= 0 && ageMs <= windowMs;
};
