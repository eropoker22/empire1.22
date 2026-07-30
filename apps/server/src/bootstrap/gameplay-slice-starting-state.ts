import type { HostedStartingPlayerStateView } from "@empire/shared-types";

export const resolveGameplaySliceStartingBalances = (
  defaults: Record<string, number>,
  startingPlayerState?: HostedStartingPlayerStateView
): Record<string, number> => {
  const balances: Record<string, number> = startingPlayerState ? {
    ...defaults,
    ...startingPlayerState.materials,
    cash: startingPlayerState.cleanCash,
    "dirty-cash": startingPlayerState.dirtyCash
  } : { ...defaults };
  delete balances.population;
  return balances;
};

export const resolveGameplaySliceStartingPopulation = (
  defaults: Record<string, number>,
  startingPlayerState?: HostedStartingPlayerStateView
): number => {
  const population = Number(startingPlayerState?.population ?? defaults.population ?? 0);
  return Number.isFinite(population) ? Math.max(0, population) : 0;
};
