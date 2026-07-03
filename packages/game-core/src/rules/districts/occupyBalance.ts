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

export const resolveOccupyPopulationCost = (
  state: CoreGameState,
  playerId: string
): number => {
  const ownedDistrictCount = Object.values(state.districtsById).filter(
    (district) => district.ownerPlayerId === playerId && district.status !== "destroyed"
  ).length;

  if (ownedDistrictCount <= 1) return 50;
  if (ownedDistrictCount === 2) return 250;
  return 550;
};
