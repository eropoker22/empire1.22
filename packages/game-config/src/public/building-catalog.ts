import type { GameModeId } from "@empire/shared-types";
import {
  getAllPublicBuildingDefinitions,
  type PublicBuildingDefinition
} from "./building-definitions";

export type PublicBuildingCatalogEntry = PublicBuildingDefinition;

export const getPublicBuildingCatalog = (
  _mode: GameModeId
): PublicBuildingCatalogEntry[] => getAllPublicBuildingDefinitions();
