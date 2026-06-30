import type { BuildingUpgradeBalanceConfig } from "../contracts/game-mode-config";

export const resolveProjectionProductionLevelMultiplier = (
  level: unknown,
  upgrade?: BuildingUpgradeBalanceConfig
): number => {
  if (!upgrade) return 1;
  const safeLevel = Math.max(1, Math.min(Math.max(1, upgrade.maxLevel), Math.floor(Number(level || 1))));
  const pctPerLevel = Number(upgrade.productionMultiplierPerLevel ?? 10);
  return 1 + ((safeLevel - 1) * pctPerLevel / 100);
};
