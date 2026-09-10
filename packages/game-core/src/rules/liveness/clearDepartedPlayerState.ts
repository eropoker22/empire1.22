import type { CoreGameState } from "../../entities";
import { settleUnclaimedBounty } from "../../handlers/bountySettlement";
import type { GameCoreContext } from "../../engine/context";
import { removeMemberFromAlliance } from "../alliances/allianceLifecycle";
import { finishPendingDistrictActionResolution, preparePendingDistrictActionResolution } from "../../handlers/pendingDistrictActionShared";

/** A new registration must not inherit orders, intel, or temporary bonuses from an ended attempt. */
export const clearDepartedPlayerState = (state: CoreGameState, playerId: string, context?: GameCoreContext): CoreGameState => {
  const player = state.playersById[playerId];
  if (!player || player.status !== "left") return state;
  let next = state;
  if (context) for (const alliance of Object.values(next.alliancesById)) {
    if (alliance.status === "disbanded" || !alliance.memberIds.includes(playerId)) continue;
    next = removeMemberFromAlliance(next, alliance.id, playerId, "server_leave",
      `server-leave:${player.metadata?.membershipId ?? playerId}:${alliance.id}`,
      context.clock?.nowIso?.() ?? state.serverInstance.startedAt, context, undefined).nextState;
  }
  for (const bounty of Object.values(next.bountiesById ?? {})) {
    if (bounty.status !== "active") continue;
    const reason = bounty.createdByPlayerId === playerId ? "creator_left" : bounty.targetPlayerId === playerId ? "target_left" : null;
    if (reason) next = settleUnclaimedBounty(next, bounty.id, reason, context?.clock?.nowIso?.()).nextState;
  }
  // Market purchases settle synchronously. Removing the old attempt's escrow here
  // precedes the atomic leave snapshot and any subsequent starter activation.
  if (next.market && Array.isArray(next.market.playerListings)) next = { ...next, market: { ...next.market,
    playerListings: next.market.playerListings.filter((listing) => listing.sellerPlayerId !== playerId) } };
  const buildingsById = { ...next.buildingsById };
  const resourceStatesById = { ...next.resourceStatesById };
  for (const building of Object.values(buildingsById)) {
    if (building.ownerPlayerId !== playerId && !(building.ownerPlayerId === "player:neutral" && building.metadata?.releasedByEarlyLeavePlayerId === playerId)) continue;
    const metadata = { ...(building.metadata ?? {}) };
    // Legacy timed imports belong to the abandoned attempt, including storage remainders.
    delete metadata.airport;
    buildingsById[building.id] = { ...building, metadata, processing: null, productionLines: {}, version: building.version + 1 };
    const local = resourceStatesById[`resource:${building.id}`];
    if (local) resourceStatesById[local.id] = { ...local, balances: Object.fromEntries(Object.keys(local.balances).map((key) => [key, 0])), version: local.version + 1 };
  }
  next = { ...next, buildingsById, resourceStatesById };
  for (const operation of Object.values(next.pendingDistrictActionOperationsById ?? {})) {
    if (operation.playerId === playerId) next = finishPendingDistrictActionResolution(
      preparePendingDistrictActionResolution(next, operation), operation);
  }
  const pendingOccupyOperationsById = { ...next.pendingOccupyOperationsById };
  const districtsById = { ...next.districtsById };
  for (const operation of Object.values(pendingOccupyOperationsById)) {
    if (operation.playerId !== playerId) continue;
    delete pendingOccupyOperationsById[operation.id];
    const district = districtsById[operation.targetDistrictId];
    if (district?.operationLocks?.occupy === operation.resolveAtTick) {
      const operationLocks = { ...district.operationLocks };
      delete operationLocks.occupy;
      districtsById[district.id] = { ...district, operationLocks, version: district.version + 1 };
    }
  }
  const effectStatesById = { ...next.effectStatesById };
  const playerBoostStatesByPlayerId = { ...next.playerBoostStatesByPlayerId };
  const playerCityEventStatesByPlayerId = { ...next.playerCityEventStatesByPlayerId };
  delete effectStatesById[player.effectStateId];
  delete playerBoostStatesByPlayerId[playerId];
  delete playerCityEventStatesByPlayerId[playerId];
  const notificationsById = Object.fromEntries(Object.entries(next.notificationsById)
    .filter(([, notification]) => notification.recipientId !== playerId));
  const trapsById = Object.fromEntries(Object.entries(next.trapsById)
    .filter(([, trap]) => trap.ownerPlayerId !== playerId));
  return { ...next, pendingOccupyOperationsById, districtsById, effectStatesById,
    playerBoostStatesByPlayerId, playerCityEventStatesByPlayerId, notificationsById, trapsById,
    root: { ...next.root, notificationIds: next.root.notificationIds.filter((id) => notificationsById[id]),
      trapIds: next.root.trapIds.filter((id) => trapsById[id]), version: next.root.version + 1 } };
};
