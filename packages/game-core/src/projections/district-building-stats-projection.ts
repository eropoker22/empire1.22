import { formatNumber } from "./district-building-action-formatters";
import { createCivilBuildingStats } from "./district-building-civil-stats";
import { createFinanceBuildingStats } from "./district-building-finance-stats";
import { createMarketBuildingStats } from "./district-building-market-stats";
import { createSupportBuildingStats } from "./district-building-support-stats";
import type { BuildingStatsProjectionInput, BuildingStatView } from "./district-building-stats-types";

export const createBuildingStats = (input: BuildingStatsProjectionInput): BuildingStatView[] => {
  const stats = input.definition?.stats;
  const effectiveStats = input.effectivePassiveStats;
  const baseStats = [
    {
      label: "Clean / h",
      value: formatPassiveStat(stats?.cleanPerHour ?? 0, effectiveStats?.cleanPerHour, "$")
    },
    {
      label: "Dirty / h",
      value: formatPassiveStat(stats?.dirtyPerHour ?? 0, effectiveStats?.dirtyPerHour, "$")
    },
    {
      label: "Heat / day",
      value: formatPassiveStat(stats?.heatPerDay ?? 0, effectiveStats?.heatPerDay)
    },
    {
      label: "Influence / day",
      value: formatPassiveStat(stats?.influencePerDay ?? 0, effectiveStats?.influencePerDay)
    },
    { label: "Max level", value: String(stats?.maxLevel ?? 1) }
  ];

  const projectedStats = createFinanceBuildingStats(input)
    ?? createMarketBuildingStats(input)
    ?? createSupportBuildingStats(input)
    ?? createCivilBuildingStats(input, baseStats);
  return appendPassivePhaseSummary(projectedStats, input);
};

export const createPassivePhaseEffectLabel = (input: {
  baseStats: {
    cleanPerHour: number;
    dirtyPerHour: number;
    heatPerDay: number;
    influencePerDay: number;
  } | undefined;
  effectiveStats: {
    cleanPerHour: number;
    dirtyPerHour: number;
    heatPerDay: number;
    influencePerDay: number;
  } | undefined;
}): string | null => {
  const base = input.baseStats;
  const effective = input.effectiveStats;
  if (!base || !effective) {
    return null;
  }

  const parts = [
    createChangedPassivePart("Clean", base.cleanPerHour, effective.cleanPerHour, "$", "/h"),
    createChangedPassivePart("Dirty", base.dirtyPerHour, effective.dirtyPerHour, "$", "/h"),
    createChangedPassivePart("Heat", base.heatPerDay, effective.heatPerDay, "", "/den"),
    createChangedPassivePart("Vliv", base.influencePerDay, effective.influencePerDay, "", "/den")
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : null;
};

const formatPassiveStat = (
  baseValue: number,
  effectiveValue: number | undefined,
  prefix = ""
): string => {
  const base = Math.max(0, Number(baseValue || 0));
  const effective = Number(effectiveValue);
  const formattedBase = `${prefix}${formatNumber(base)}`;
  if (!Number.isFinite(effective) || Math.abs(effective - base) < 0.001) {
    return formattedBase;
  }
  return `${formattedBase} -> ${prefix}${formatNumber(Math.max(0, effective))}`;
};

const appendPassivePhaseSummary = (
  stats: BuildingStatView[],
  input: BuildingStatsProjectionInput
): BuildingStatView[] => {
  const base = input.definition?.stats;
  const effective = input.effectivePassiveStats;
  const label = createPassivePhaseEffectLabel({
    baseStats: base,
    effectiveStats: effective
  });
  if (!label) {
    return stats;
  }
  return [...stats, { label: "Efekt fáze", value: label }];
};

const createChangedPassivePart = (
  label: string,
  baseValue: number,
  effectiveValue: number,
  prefix = "",
  suffix = ""
): string | null => {
  const base = Math.max(0, Number(baseValue || 0));
  const effective = Math.max(0, Number(effectiveValue || 0));
  if (Math.abs(base - effective) < 0.001) {
    return null;
  }
  return `${label} ${prefix}${formatNumber(base)}${suffix} -> ${prefix}${formatNumber(effective)}${suffix}`;
};
