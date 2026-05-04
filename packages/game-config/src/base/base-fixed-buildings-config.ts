import type { BalanceConfig } from "../contracts/balance-config";
import { getAllPublicBuildingDefinitions } from "../public/building-definitions";

export const baseFixedBuildingsConfig: NonNullable<BalanceConfig["fixedBuildings"]> =
  Object.fromEntries(
    getAllPublicBuildingDefinitions().map((definition) => [
      definition.buildingTypeId,
      {
        ...definition.stats
      }
    ])
  );
