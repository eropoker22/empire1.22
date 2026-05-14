import type { CourthouseBalanceConfig, FixedBuildingBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";

export const getOwnedCourthouses = (
  state: CoreGameState,
  playerId: string | null | undefined,
  config: CourthouseBalanceConfig
): CoreGameState["buildingsById"][string][] => {
  if (!playerId) return [];
  return Object.values(state.buildingsById).filter((building) =>
    building.ownerPlayerId === playerId &&
    building.status === "active" &&
    building.buildingTypeId === config.buildingTypeId
  );
};

export const getOwnedCourthouseCount = (
  state: CoreGameState,
  playerId: string | null | undefined,
  config: CourthouseBalanceConfig
): number => getOwnedCourthouses(state, playerId, config).length;

export const resolveCourthouseTier = (
  ownedCount: number,
  config: CourthouseBalanceConfig
): CourthouseBalanceConfig["legalProtectionTiers"][number] | null =>
  config.legalProtectionTiers.find((tier) =>
    ownedCount >= tier.minOwned && ownedCount <= tier.maxOwned
  ) ?? null;

export const resolveCourthouseRaidMitigation = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: CourthouseBalanceConfig;
}): { ownedCount: number; reductionPct: number } => {
  if (!input.config || !input.playerId) return { ownedCount: 0, reductionPct: 0 };
  const ownedCount = getOwnedCourthouseCount(input.state, input.playerId, input.config);
  const tier = resolveCourthouseTier(ownedCount, input.config);
  return {
    ownedCount,
    reductionPct: Math.max(0, Math.min(100, tier?.policeRaidConsequencesReductionPct ?? 0))
  };
};

export const applyCourthouseIncomeModifiers = (input: {
  config: CourthouseBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): FixedBuildingBalanceConfig => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId) {
    return {
      cleanPerHour: input.cleanPerHour,
      dirtyPerHour: input.dirtyPerHour,
      heatPerDay: input.heatPerDay,
      influencePerDay: input.influencePerDay,
      maxLevel: 1
    };
  }
  const ownedCount = getOwnedCourthouseCount(input.state, input.building.ownerPlayerId, input.config);
  const tier = resolveCourthouseTier(ownedCount, input.config);
  return {
    cleanPerHour: input.cleanPerHour * (tier?.cleanIncomeMultiplier ?? 1),
    dirtyPerHour: 0,
    heatPerDay: input.heatPerDay * (tier?.heatMultiplier ?? 1),
    influencePerDay: input.influencePerDay * (tier?.influenceMultiplier ?? 1),
    maxLevel: 1
  };
};
