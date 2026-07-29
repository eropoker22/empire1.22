import type { CoreGameState } from "@empire/game-core";
import type { Player } from "@empire/shared-types";

export const removeDisabledDevBountyDemoTargets = (
  state: CoreGameState,
  demoTargetPlayerIds: readonly string[]
): boolean => {
  const demoPlayers = demoTargetPlayerIds
    .map((playerId) => state.playersById[playerId])
    .filter((player): player is Player => player?.metadata?.systemBountyTarget === true);
  if (demoPlayers.length === 0) return false;

  const demoPlayerIds = new Set(demoPlayers.map((player) => player.id));
  releaseDemoDistricts(state, demoPlayerIds);
  deleteDemoPlayerState(state, demoPlayers);
  state.root.playerIds = state.root.playerIds.filter((playerId) => !demoPlayerIds.has(playerId));
  state.trapsById = Object.fromEntries(
    Object.entries(state.trapsById).filter(([, trap]) => !demoPlayerIds.has(trap.ownerPlayerId))
  );
  state.bountiesById = Object.fromEntries(
    Object.entries(state.bountiesById ?? {}).filter(([, bounty]) =>
      !demoPlayerIds.has(bounty.createdByPlayerId)
      && !demoPlayerIds.has(bounty.targetPlayerId)
      && !demoPlayerIds.has(bounty.claimedByPlayerId ?? "")
    )
  );
  return true;
};

const releaseDemoDistricts = (
  state: CoreGameState,
  demoPlayerIds: ReadonlySet<string>
): void => {
  for (const district of Object.values(state.districtsById)) {
    if (!district.ownerPlayerId || !demoPlayerIds.has(district.ownerPlayerId)) continue;
    state.districtsById[district.id] = {
      ...district,
      ownerPlayerId: null,
      controllerAllianceId: null,
      status: district.status === "claimed" ? "neutral" : district.status,
      securityRevision: district.securityRevision + 1,
      conflictRevision: district.conflictRevision + 1,
      version: district.version + 1
    };
    for (const buildingId of district.buildingIds) {
      const building = state.buildingsById[buildingId];
      if (!building || !demoPlayerIds.has(building.ownerPlayerId)) continue;
      state.buildingsById[building.id] = {
        ...building,
        ownerPlayerId: "player:neutral",
        version: building.version + 1
      };
    }
  }
};

const deleteDemoPlayerState = (
  state: CoreGameState,
  demoPlayers: Player[]
): void => {
  for (const player of demoPlayers) {
    delete state.playersById[player.id];
    delete state.resourceStatesById[player.resourceStateId];
    delete state.cooldownStatesById[player.cooldownStateId];
    delete state.effectStatesById[player.effectStateId];
    delete state.policeStatesById[player.policeStateId];
    delete state.playerBoostStatesByPlayerId?.[player.id];
    delete state.playerCityEventStatesByPlayerId?.[player.id];
    delete state.playerSpyOperationStatesByPlayerId?.[player.id];
  }
};
