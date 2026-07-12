import type { BalanceConfig } from "../contracts/balance-config";

export const baseProductionBuildingsConfig: NonNullable<BalanceConfig["productionBuildings"]> = {};

/**
 * Legacy one-job craft buildings were replaced by typed production lines.
 * Keep the deprecated configuration surface empty so it cannot become a
 * second balance source for Armory, Factory, Pharmacy, or Drug Lab.
 */
export const baseCraftBuildingsConfig: NonNullable<BalanceConfig["craftBuildings"]> = {};
