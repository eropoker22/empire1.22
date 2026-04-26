import type { PlayerView } from "@empire/shared-types";

/**
 * Responsibility: Maps server-fed player projections into UI-safe view model fields.
 * Belongs here: presentational derivations only, such as labels and visibility flags.
 * Does not belong here: authoritative gameplay calculations.
 */
export interface PlayerViewModel {
  playerId: string;
  instanceId: string;
  modeLabel: string;
  resourceSummary: string;
  notificationCount: number;
}

export const createPlayerViewModel = (
  view: PlayerView | null,
  modeLabelOverride?: string
): PlayerViewModel | null =>
  view
    ? {
        playerId: view.playerId,
        instanceId: view.instanceId,
        modeLabel: modeLabelOverride ?? view.mode,
        resourceSummary: formatResourceBalances(view.resourceBalances),
        notificationCount: view.notifications.length
      }
    : null;

const formatResourceBalances = (balances: Record<string, number>): string => {
  const parts = Object.entries(balances).filter(([, amount]) => amount > 0);

  return parts.length > 0
    ? parts.map(([resourceKey, amount]) => `${toTitleCase(resourceKey)} ${amount}`).join(" · ")
    : "No resources";
};

const toTitleCase = (value: string): string =>
  value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
