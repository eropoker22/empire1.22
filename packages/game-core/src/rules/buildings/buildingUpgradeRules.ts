import type { Building, ResourceState } from "@empire/shared-types";
import type {
  BuildingUpgradeBalanceConfig,
  FixedBuildingBalanceConfig
} from "../../contracts";
import type { GameCoreContext } from "../../engine/context";
import type { CoreGameState } from "../../entities";

export const GENERIC_FIXED_BUILDING_UPGRADE_PCT_PER_LEVEL = 14;
export const PRODUCTION_BUILDING_UPGRADE_PCT_PER_LEVEL = 10;

export interface BuildingUpgradeCost {
  level: number;
  nextLevel: number;
  maxLevel: number;
  costs: Record<string, number>;
  source: "casino" | "fixed-generic" | "production";
}

export interface BuildingUpgradeEffectSummary {
  label: string;
  value: string;
  detail: string;
}

export const resolveBuildingUpgradeCost = (
  building: Building,
  context: GameCoreContext
): BuildingUpgradeCost | null => {
  const level = getBuildingLevel(building);
  const maxLevel = resolveBuildingMaxLevel(building.buildingTypeId, context);
  if (level >= maxLevel) return null;

  const nextLevel = level + 1;
  const casinoUpgrade = building.buildingTypeId === "casino"
    ? context.config.balance.casino?.upgrades.find((upgrade) => upgrade.level === nextLevel)
    : null;

  if (casinoUpgrade) {
    return {
      level,
      nextLevel,
      maxLevel,
      source: "casino",
      costs: cleanCostRecord({
        cash: casinoUpgrade.cleanCashCost,
        "tech-core": casinoUpgrade.techCoreCost ?? 0,
        "combat-module": casinoUpgrade.combatModuleCost ?? 0
      })
    };
  }

  const productionUpgrade = resolveProductionUpgradeConfig(building.buildingTypeId, context);
  if (productionUpgrade) {
    return {
      level,
      nextLevel,
      maxLevel,
      source: "production",
      costs: {
        cash: calculateProductionUpgradeCost(productionUpgrade, nextLevel)
      }
    };
  }

  const fixedConfig = context.config.balance.fixedBuildings?.[building.buildingTypeId];
  if (!fixedConfig || maxLevel <= 1) return null;

  return {
    level,
    nextLevel,
    maxLevel,
    source: "fixed-generic",
    costs: {
      cash: calculateGenericFixedBuildingUpgradeCost(fixedConfig, nextLevel)
    }
  };
};

export const resolveBuildingMaxLevel = (
  buildingTypeId: string,
  context: GameCoreContext
): number => {
  const fixedMaxLevel = Number(context.config.balance.fixedBuildings?.[buildingTypeId]?.maxLevel);
  const productionMaxLevel = Number(resolveProductionUpgradeConfig(buildingTypeId, context)?.maxLevel);
  return Math.max(
    1,
    Number.isFinite(fixedMaxLevel) ? Math.floor(fixedMaxLevel) : 1,
    Number.isFinite(productionMaxLevel) ? Math.floor(productionMaxLevel) : 1
  );
};

export const calculateGenericFixedBuildingUpgradeCost = (
  config: FixedBuildingBalanceConfig,
  nextLevel: number
): number => {
  const safeNextLevel = Math.max(2, Math.floor(Number(nextLevel || 2)));
  return Math.max(
    850,
    Math.round((Number(config.cleanPerHour || 0) + Number(config.dirtyPerHour || 0) + 120) * (safeNextLevel + 1) * 2.4)
  );
};

export const calculateProductionUpgradeCost = (
  upgrade: BuildingUpgradeBalanceConfig,
  nextLevel: number
): number => {
  const safeNextLevel = Math.max(2, Math.min(Math.max(2, upgrade.maxLevel), Math.floor(Number(nextLevel || 2))));
  const rawCost = Math.max(0, Number(upgrade.upgradeBaseCost || 0)) * Math.pow(
    Math.max(1, Number(upgrade.costGrowth || 1)),
    safeNextLevel - 2
  );
  const rounded = Math.round(rawCost);
  const roundTo = Math.max(0, Math.floor(Number(upgrade.roundCostTo || 0)));
  return roundTo > 0 ? Math.max(roundTo, Math.round(rounded / roundTo) * roundTo) : rounded;
};

export const resolveProductionUpgradeConfig = (
  buildingTypeId: string,
  context: GameCoreContext
): BuildingUpgradeBalanceConfig | null => {
  return (buildingTypeId === "pharmacy" ? context.config.balance.pharmacy?.upgrade : undefined)
    ?? (buildingTypeId === "drug_lab" ? context.config.balance.drugLab?.upgrade : undefined)
    ?? (buildingTypeId === "factory" ? context.config.balance.factory?.upgrade : undefined)
    ?? context.config.balance.productionBuildings?.[buildingTypeId]?.upgrade
    ?? context.config.balance.craftBuildings?.[buildingTypeId]?.upgrade
    ?? null;
};

export const resolveProductionBuildingLevelMultiplier = (
  building: Pick<Building, "level" | "buildingTypeId">,
  context: GameCoreContext
): number => {
  const upgrade = resolveProductionUpgradeConfig(building.buildingTypeId, context);
  if (!upgrade) return 1;
  const pctPerLevel = Number(upgrade.productionMultiplierPerLevel ?? PRODUCTION_BUILDING_UPGRADE_PCT_PER_LEVEL);
  const safeLevel = Math.max(1, Math.min(Math.max(1, upgrade.maxLevel), Math.floor(Number(building.level || 1))));
  return 1 + ((safeLevel - 1) * pctPerLevel / 100);
};

export const applyGenericFixedBuildingLevelMultiplier = (input: {
  building: Pick<Building, "level" | "buildingTypeId">;
  config: FixedBuildingBalanceConfig;
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): Omit<FixedBuildingBalanceConfig, "maxLevel"> => {
  if (input.config.maxLevel <= 1 || input.building.buildingTypeId === "casino" || input.building.buildingTypeId === "warehouse") {
    return {
      cleanPerHour: input.cleanPerHour,
      dirtyPerHour: input.dirtyPerHour,
      heatPerDay: input.heatPerDay,
      influencePerDay: input.influencePerDay
    };
  }

  const level = Math.max(1, Math.min(input.config.maxLevel, Math.floor(Number(input.building.level || 1))));
  const multiplier = 1 + ((level - 1) * GENERIC_FIXED_BUILDING_UPGRADE_PCT_PER_LEVEL / 100);
  return {
    cleanPerHour: input.cleanPerHour * multiplier,
    dirtyPerHour: input.dirtyPerHour * multiplier,
    heatPerDay: input.heatPerDay * multiplier,
    influencePerDay: input.influencePerDay * multiplier
  };
};

export const describeBuildingUpgradeEffects = (
  building: Building,
  context: GameCoreContext
): BuildingUpgradeEffectSummary[] => {
  const upgradeCost = resolveBuildingUpgradeCost(building, context);
  if (!upgradeCost) return [];

  if (building.buildingTypeId === "casino") {
    const current = context.config.balance.casino?.upgrades
      .filter((upgrade) => upgrade.level <= upgradeCost.level)
      .sort((left, right) => right.level - left.level)[0];
    const next = context.config.balance.casino?.upgrades.find((upgrade) => upgrade.level === upgradeCost.nextLevel);
    return [
      current && next && next.incomeBonusPct !== current.incomeBonusPct
        ? {
            label: "Income",
            value: `+${next.incomeBonusPct - current.incomeBonusPct}%`,
            detail: `${current.incomeBonusPct}% -> ${next.incomeBonusPct}%`
          }
        : null,
      current && next && next.launderingLimitBonusPct !== current.launderingLimitBonusPct
        ? {
            label: "Kapacita praní",
            value: `+${next.launderingLimitBonusPct - current.launderingLimitBonusPct}%`,
            detail: `${current.launderingLimitBonusPct}% -> ${next.launderingLimitBonusPct}%`
          }
        : null
    ].filter((item): item is BuildingUpgradeEffectSummary => item !== null);
  }

  const productionUpgrade = resolveProductionUpgradeConfig(building.buildingTypeId, context);
  if (productionUpgrade) {
    const before = resolveProductionBuildingLevelMultiplier(building, context);
    const after = resolveProductionBuildingLevelMultiplier({ ...building, level: upgradeCost.nextLevel }, context);
    const beforePct = Math.round((before - 1) * 100);
    const afterPct = Math.round((after - 1) * 100);
    return [{
      label: "Produkce",
      value: `+${Math.round((after - before) * 100)}%`,
      detail: `${beforePct >= 0 ? "+" : ""}${beforePct}% -> ${afterPct >= 0 ? "+" : ""}${afterPct}%`
    }];
  }

  const fixedConfig = context.config.balance.fixedBuildings?.[building.buildingTypeId];
  if (!fixedConfig) return [];
  const before = 1 + ((Math.max(1, upgradeCost.level) - 1) * GENERIC_FIXED_BUILDING_UPGRADE_PCT_PER_LEVEL / 100);
  const after = 1 + ((Math.max(1, upgradeCost.nextLevel) - 1) * GENERIC_FIXED_BUILDING_UPGRADE_PCT_PER_LEVEL / 100);
  const beforePct = Math.round((before - 1) * 100);
  const afterPct = Math.round((after - 1) * 100);
  return [{
    label: "Bonus levelu",
    value: `${afterPct >= 0 ? "+" : ""}${afterPct}%`,
    detail: `${beforePct >= 0 ? "+" : ""}${beforePct}% -> ${afterPct >= 0 ? "+" : ""}${afterPct}%`
  }];
};

export const hasEnoughResourcesForUpgrade = (
  resourceState: ResourceState | undefined,
  costs: Record<string, number>
): boolean =>
  Object.entries(costs).every(([resourceKey, requiredAmount]) =>
    Math.max(0, Number(resourceState?.balances?.[resourceKey] || 0)) >= Math.max(0, Number(requiredAmount || 0))
  );

const getBuildingLevel = (building: Pick<Building, "level">): number =>
  Math.max(1, Math.floor(Number(building.level || 1)));

const cleanCostRecord = (costs: Record<string, number>): Record<string, number> =>
  Object.fromEntries(
    Object.entries(costs)
      .map(([key, value]): [string, number] => [key, Math.max(0, Math.floor(Number(value || 0)))])
      .filter(([, value]) => value > 0)
  );
