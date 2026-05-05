import type { CoreGameState } from "../../entities";

export const releaseExpiredPoliceConsequences = (state: CoreGameState): CoreGameState => {
  const currentTick = state.root.tick;
  let changed = false;
  let districtsById = state.districtsById;
  let buildingsById = state.buildingsById;

  for (const district of Object.values(state.districtsById)) {
    if (district.status !== "locked" || !district.lockdownUntilTick || district.lockdownUntilTick > currentTick) continue;
    districtsById = {
      ...districtsById,
      [district.id]: {
        ...district,
        status: district.previousStatusBeforeLockdown && district.previousStatusBeforeLockdown !== "locked"
          ? district.previousStatusBeforeLockdown
          : district.ownerPlayerId ? "claimed" : "neutral",
        lockdownUntilTick: null,
        policeLockdownReason: null,
        previousStatusBeforeLockdown: null,
        version: district.version + 1
      }
    };
    changed = true;
  }

  for (const building of Object.values(state.buildingsById)) {
    if (building.status !== "disabled" || !building.disruptedUntilTick || building.disruptedUntilTick > currentTick) continue;
    const previousStatus = String(building.metadata?.policePreviousStatus || "active");
    buildingsById = {
      ...buildingsById,
      [building.id]: {
        ...building,
        status: previousStatus === "constructing" || previousStatus === "destroyed" ? previousStatus : "active",
        disruptedUntilTick: null,
        metadata: { ...(building.metadata ?? {}), policePreviousStatus: undefined, policeDisruptedUntilTick: undefined },
        version: building.version + 1
      }
    };
    changed = true;
  }

  return changed ? { ...state, districtsById, buildingsById } : state;
};
