import type { CoreGameState } from "../../entities";
import { finishPendingDistrictActionResolution, preparePendingDistrictActionResolution } from "../../handlers/pendingDistrictActionShared";

/** A new registration must not inherit orders, intel, or temporary bonuses from an ended attempt. */
export const clearDepartedPlayerState = (state: CoreGameState, playerId: string): CoreGameState => {
  const player = state.playersById[playerId];
  if (!player || player.status !== "left") return state;
  let next = state;
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
  const bountiesById = Object.fromEntries(Object.entries(next.bountiesById ?? {}).map(([id, bounty]) => [id,
    bounty.status === "active" && bounty.targetPlayerId === playerId
      ? { ...bounty, status: "cancelled" as const, cancelledAtTick: next.root.tick, version: bounty.version + 1 }
      : bounty]));
  const trapsById = Object.fromEntries(Object.entries(next.trapsById)
    .filter(([, trap]) => trap.ownerPlayerId !== playerId));
  return { ...next, pendingOccupyOperationsById, districtsById, effectStatesById,
    playerBoostStatesByPlayerId, playerCityEventStatesByPlayerId, notificationsById, bountiesById, trapsById,
    root: { ...next.root, notificationIds: next.root.notificationIds.filter((id) => notificationsById[id]),
      trapIds: next.root.trapIds.filter((id) => trapsById[id]), version: next.root.version + 1 } };
};
