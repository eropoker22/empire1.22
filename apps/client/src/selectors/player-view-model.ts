import type { PlayerEconomyView, PlayerView } from "@empire/shared-types";
import type { DayNightReadModel } from "@empire/shared-types";

/**
 * Responsibility: Maps server-fed player projections into UI-safe view model fields.
 * Belongs here: presentational derivations only, such as labels and visibility flags.
 * Does not belong here: authoritative gameplay calculations.
 */
export interface PlayerViewModel {
  playerId: string;
  instanceId: string;
  modeLabel: string;
  homeDistrictId: string | null;
  resourceSummary: string;
  economy: PlayerEconomyViewModel | null;
  notificationCount: number;
  dayNight: DayNightReadModel | null;
  police: PoliceViewModel | null;
}

export interface PlayerEconomyViewModel {
  cleanCashLabel: string;
  dirtyCashLabel: string;
  influenceLabel: string;
  populationLabel: string;
  gangMembersLabel: string;
}

export interface PoliceViewModel {
  heatLabel: string;
  wantedLevelLabel: string;
  pendingRaidLabel: string | null;
  raidConsequenceStatus: string;
  selectedDistrictHeatLabel: string;
  protectionLabel: string;
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
        homeDistrictId: view.homeDistrictId ?? null,
        resourceSummary: view.economy
          ? formatEconomySummary(view.economy)
          : formatResourceBalances(view.resourceBalances),
        economy: view.economy ? createEconomyViewModel(view.economy) : null,
        notificationCount: view.notifications.length,
        dayNight: view.dayNight ?? null,
        police: createPoliceViewModel(view)
      }
    : null;

const createEconomyViewModel = (economy: PlayerEconomyView): PlayerEconomyViewModel => ({
  cleanCashLabel: String(Math.max(0, Number(economy.cleanCash || 0))),
  dirtyCashLabel: String(Math.max(0, Number(economy.dirtyCash || 0))),
  influenceLabel: String(Math.max(0, Number(economy.influence || 0))),
  populationLabel: String(Math.max(0, Number(economy.population || 0))),
  gangMembersLabel: String(Math.max(0, Number(economy.gangMembers || 0)))
});

const createPoliceViewModel = (view: PlayerView): PoliceViewModel | null => {
  const police = view.police ?? null;
  if (!police) {
    return null;
  }

  return {
    heatLabel: String(Math.max(0, Number(police.heat || 0))),
    wantedLevelLabel: police.wantedLevelLabel || police.wantedLabel || `${police.wantedLevel} / 5`,
    pendingRaidLabel: police.pendingRaid
      ? `${police.pendingRaid.severity.toUpperCase()} raid`
      : null,
    raidConsequenceStatus: police.raidConsequenceStatus || "none",
    selectedDistrictHeatLabel: String(Math.max(0, Number(police.selectedDistrictHeat || 0))),
    protectionLabel: police.protection.sources.length > 0
      ? `${police.protection.sources.join(", ")} x${police.protection.raidConsequenceMultiplier.toFixed(2)}`
      : "none"
  };
};

const formatEconomySummary = (economy: PlayerEconomyView): string => {
  const seenResourceIds = new Set(["cash", "dirty-cash", "population", "gang-members"]);
  const parts = [
    `Cash ${Math.max(0, Number(economy.cleanCash || 0))}`,
    `Dirty Cash ${Math.max(0, Number(economy.dirtyCash || 0))}`,
    `Vliv ${Math.max(0, Number(economy.influence || 0))}`,
    `Population ${Math.max(0, Number(economy.population || 0))}`
  ];

  for (const balances of [economy.materials, economy.drugs, economy.weapons]) {
    for (const [resourceId, amount] of Object.entries(balances)) {
      seenResourceIds.add(resourceId);
      if (amount > 0) {
        parts.push(`${formatResourceLabel(resourceId)} ${amount}`);
      }
    }
  }

  for (const [resourceId, amount] of Object.entries(economy.resources)) {
    if (!seenResourceIds.has(resourceId) && amount > 0) {
      parts.push(`${formatResourceLabel(resourceId)} ${amount}`);
    }
  }

  return parts.join(" · ");
};

const formatResourceBalances = (balances: Record<string, number>): string => {
  const parts = Object.entries(balances).filter(([, amount]) => amount > 0);

  return parts.length > 0
    ? parts.map(([resourceKey, amount]) => `${formatResourceLabel(resourceKey)} ${amount}`).join(" · ")
    : "No resources";
};

const RESOURCE_LABELS: Record<string, string> = {
  "combat-module": "Bojový modul",
  combatModule: "Bojový modul"
};

const formatResourceLabel = (value: string): string =>
  RESOURCE_LABELS[value] ?? toTitleCase(value);

const toTitleCase = (value: string): string =>
  value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
