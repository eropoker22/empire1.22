import { createInitialState } from "@empire/game-core";
import { createDistrictBuildingSliceSeed } from "./district-building-slice-seed";

/**
 * Responsibility: Entry point for explicit seed/bootstrap tooling outside production runtime.
 * Belongs here: local setup scripts and isolated instance seed generation.
 * Does not belong here: auto-loaded prod seeds or hidden demo data in server boot.
 */
export const seedToolShell = {
  createBaseSeed: (instanceId: string) => createInitialState(instanceId, "free"),
  createDistrictBuildingSliceSeed
};

export * from "./district-building-slice-seed";
