import { FREE_HOSTED_STARTING_MATERIAL_IDS } from "@empire/game-config";
import type { HostedStartingPlayerStateView } from "@empire/shared-types";

export const resolveGameplaySliceStartingBalances = (
  defaults: Record<string, number>,
  startingPlayerState?: HostedStartingPlayerStateView
): Record<string, number> => {
  const balances: Record<string, number> = { ...defaults };
  if (startingPlayerState) {
    for (const materialId of FREE_HOSTED_STARTING_MATERIAL_IDS) {
      balances[materialId] = startingPlayerState.materials[materialId];
    }
    balances.cash = startingPlayerState.cleanCash;
    balances["dirty-cash"] = startingPlayerState.dirtyCash;
  }
  delete balances.population;
  return balances;
};

export const resolveGameplaySliceStartingPopulation = (
  defaults: Record<string, number>,
  startingPlayerState?: HostedStartingPlayerStateView
): number => {
  const population = startingPlayerState?.population ?? defaults.population ?? 0;
  return Number.isFinite(population) ? Math.max(0, population) : 0;
};
