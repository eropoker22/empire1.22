import { formatNumber } from "./district-building-action-formatters";
import { createCivilBuildingStats } from "./district-building-civil-stats";
import { createFinanceBuildingStats } from "./district-building-finance-stats";
import { createMarketBuildingStats } from "./district-building-market-stats";
import { createSupportBuildingStats } from "./district-building-support-stats";
import type { BuildingStatsProjectionInput, BuildingStatView } from "./district-building-stats-types";

export const createBuildingStats = (input: BuildingStatsProjectionInput): BuildingStatView[] => {
  const stats = input.definition?.stats;
  const baseStats = [
    { label: "Clean / h", value: `$${formatNumber(stats?.cleanPerHour ?? 0)}` },
    { label: "Dirty / h", value: `$${formatNumber(stats?.dirtyPerHour ?? 0)}` },
    { label: "Heat / day", value: formatNumber(stats?.heatPerDay ?? 0) },
    { label: "Influence / day", value: formatNumber(stats?.influencePerDay ?? 0) },
    { label: "Max level", value: String(stats?.maxLevel ?? 1) }
  ];

  return createFinanceBuildingStats(input)
    ?? createMarketBuildingStats(input)
    ?? createSupportBuildingStats(input)
    ?? createCivilBuildingStats(input, baseStats);
};