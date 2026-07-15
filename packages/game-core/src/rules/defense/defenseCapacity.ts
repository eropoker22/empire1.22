import type { DefenseWeaponId } from "@empire/shared-types";
import type { ConflictBalanceConfig } from "../../contracts";

const DEFAULT_ITEM_WEIGHTS: Record<DefenseWeaponId, number> = {
  vest: 1,
  barricades: 1,
  cameras: 2,
  alarm: 2,
  "defense-tower": 4
};

export const resolveDefenseCapacityPoints = (
  districtZone: string,
  config?: ConflictBalanceConfig["defenseCapacity"]
): number => {
  const resolved = config ?? {
    baseCapacityPoints: 20,
    zoneBonusPoints: { downtown: 4 },
    itemWeights: DEFAULT_ITEM_WEIGHTS
  };
  return Math.max(
    0,
    resolved.baseCapacityPoints + Number(resolved.zoneBonusPoints[districtZone.toLowerCase()] ?? 0)
  );
};

export const calculateDefenseCapacityUsage = (
  loadout: Partial<Record<DefenseWeaponId, number>>,
  config?: ConflictBalanceConfig["defenseCapacity"]
): number => {
  const weights = config?.itemWeights ?? DEFAULT_ITEM_WEIGHTS;
  return (Object.entries(weights) as Array<[DefenseWeaponId, number]>).reduce(
    (total, [itemId, weight]) => total + Math.max(0, Number(loadout[itemId] ?? 0)) * Math.max(1, Number(weight)),
    0
  );
};

export const calculateDefensePlacementPoints = (
  itemId: DefenseWeaponId,
  amount: number,
  config?: ConflictBalanceConfig["defenseCapacity"]
): number => Math.max(0, amount) * Math.max(1, Number(config?.itemWeights[itemId] ?? DEFAULT_ITEM_WEIGHTS[itemId]));
