import type { ConflictBalanceConfig } from "../../contracts";
import type { CoreGameState } from "../../entities";

export interface OccupyBalance {
  cooldownTicks: number;
  failureChancePct: number;
  heatGain: number;
  influenceCost: number;
  populationRefundPct: number;
}

export const DEFAULT_OCCUPY_BALANCE: OccupyBalance = {
  cooldownTicks: 2,
  failureChancePct: 5,
  heatGain: 2,
  influenceCost: 5,
  populationRefundPct: 10
};

export const resolveOccupyBalance = (
  config?: Pick<ConflictBalanceConfig, "occupyCooldownTicks" | "occupyFailureChancePct" | "occupyHeatGain" | "occupyInfluenceCost" | "occupyPopulationRefundPct">
): OccupyBalance => ({
  cooldownTicks: Math.max(0, Math.floor(config?.occupyCooldownTicks ?? DEFAULT_OCCUPY_BALANCE.cooldownTicks)),
  failureChancePct: Math.min(100, Math.max(0, Number(config?.occupyFailureChancePct ?? DEFAULT_OCCUPY_BALANCE.failureChancePct))),
  heatGain: Math.max(0, Number(config?.occupyHeatGain ?? DEFAULT_OCCUPY_BALANCE.heatGain)),
  influenceCost: Math.max(0, Number(config?.occupyInfluenceCost ?? DEFAULT_OCCUPY_BALANCE.influenceCost)),
  populationRefundPct: Math.min(100, Math.max(0, Number(config?.occupyPopulationRefundPct ?? DEFAULT_OCCUPY_BALANCE.populationRefundPct)))
});

export const createOccupyCooldownKey = (districtId: string): string => `occupy:${districtId}`;
export const createOccupyGlobalCooldownKey = (): string => "occupy:global";
export const createOccupySourceCooldownKey = (districtId: string): string => `occupy:source:${districtId}`;

const countActiveOwnedDistricts = (state: CoreGameState, playerId: string): number =>
  Object.values(state.districtsById).filter(
    (district) => district.ownerPlayerId === playerId && district.status !== "destroyed"
  ).length;

export const resolveOccupyInfluenceCost = (
  state: CoreGameState,
  playerId: string,
  config?: ConflictBalanceConfig
): number => {
  const player = state.playersById[playerId];
  const storedAttemptCount = Number(player?.metadata?.occupyAttemptCount);
  const inferredAttemptCount = Math.max(0, countActiveOwnedDistricts(state, playerId) - 1);
  const attemptCount = Number.isSafeInteger(storedAttemptCount) && storedAttemptCount >= 0
    ? storedAttemptCount
    : inferredAttemptCount;
  return attemptCount === 0
    ? Math.max(0, Number(config?.occupyInfluenceCost ?? DEFAULT_OCCUPY_BALANCE.influenceCost))
    : Math.max(0, Number(config?.occupyRepeatInfluenceCost ?? 10));
};

export const resolveOccupyPopulationCost = (
  state: CoreGameState,
  playerId: string,
  config?: ConflictBalanceConfig
): number => {
  const nextOwnedDistrictCount = countActiveOwnedDistricts(state, playerId) + 1;
  const base = Math.max(0, Math.floor(Number(config?.occupyOverextension?.basePopulationCost ?? 50)));
  if (nextOwnedDistrictCount <= 3) return base;
  return base + Math.ceil((nextOwnedDistrictCount - 3) / 2)
    * Math.max(0, Math.floor(Number(config?.occupyOverextension?.additionalPopulationPerTwoDistricts ?? 1)));
};
