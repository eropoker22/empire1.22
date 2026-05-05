import type { District, PoliceRaidPreviewConsequences, ResourceState } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import { sanitizeAmount } from "./raidPreview";

export const applyResourceSeizures = (
  resourceState: ResourceState,
  preview: PoliceRaidPreviewConsequences
): ResourceState => {
  const balances = { ...resourceState.balances };
  balances["dirty-cash"] = Math.max(0, sanitizeAmount(balances["dirty-cash"]) - preview.seizedDirtyCash);
  for (const [resourceKey, amount] of Object.entries(preview.seizedResources)) {
    balances[resourceKey] = Math.max(0, sanitizeAmount(balances[resourceKey]) - sanitizeAmount(amount));
  }
  return { ...resourceState, balances, version: resourceState.version + 1 };
};

export const applyDistrictLockdown = (
  district: District,
  lockdownUntilTick: number | null,
  reason: string
): District => ({
  ...district,
  status: "locked",
  lockdownUntilTick,
  policeLockdownReason: reason,
  previousStatusBeforeLockdown: district.status === "locked"
    ? district.previousStatusBeforeLockdown ?? "claimed"
    : district.status,
  version: district.version + 1
});

export const applyBuildingDisruptions = (
  buildingsById: CoreGameState["buildingsById"],
  buildingIds: string[],
  disruptedUntilTick: number
): CoreGameState["buildingsById"] => {
  let nextBuildingsById = buildingsById;
  for (const buildingId of buildingIds) {
    const building = nextBuildingsById[buildingId];
    if (!building || building.status === "destroyed") continue;
    nextBuildingsById = {
      ...nextBuildingsById,
      [building.id]: {
        ...building,
        status: "disabled",
        disruptedUntilTick,
        metadata: {
          ...(building.metadata ?? {}),
          policePreviousStatus: building.status,
          policeDisruptedUntilTick: disruptedUntilTick
        },
        version: building.version + 1
      }
    };
  }
  return nextBuildingsById;
};

export const createPlayerResourceState = (
  player: CoreGameState["playersById"][string],
  tick: number
): ResourceState => ({
  id: player.resourceStateId,
  ownerType: "player",
  ownerId: player.id,
  balances: {},
  incomeModifiers: {},
  lastUpdatedTick: tick,
  version: 1
});
