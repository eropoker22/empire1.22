import { createDistrictPanelView } from "@empire/game-core";
import { getPublicBuildingCatalog } from "@empire/game-config";
import type { DistrictPanelView } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";

/**
 * Responsibility: Server-side composition of district panel projection data.
 * Belongs here: combining authoritative state with mode-aware public build catalog data.
 * Does not belong here: client rendering or command mutation.
 */
export const createDistrictPanelProjection = (
  runtime: ServerInstanceRuntime,
  playerId: string,
  districtId: string
): DistrictPanelView | null =>
  createDistrictPanelView(runtime.state, {
    playerId,
    districtId,
    buildCatalog: getPublicBuildingCatalog(runtime.record.mode),
    productionCatalog: runtime.config.balance.productionBuildings ?? {},
    craftCatalog: runtime.config.balance.craftBuildings ?? {},
    buildingActionCatalog: runtime.config.balance.buildingActions ?? {},
    productionMultiplier: runtime.config.balance.productionMultiplier
  });
