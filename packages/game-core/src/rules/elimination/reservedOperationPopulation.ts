import type { CoreGameState } from "../../entities";

export const calculateReservedOperationPopulation = (state: CoreGameState, playerId: string): number => {
  const player = state.playersById[playerId];
  if (player?.status !== "active") return 0;
  const seen = new Set<string>();
  return Object.entries(state.pendingDistrictActionOperationsById ?? {}).reduce((total, [id, op]) => {
    if (seen.has(op.id) || id !== op.id || op.playerId !== playerId || op.operationType !== "heist"
      || op.command.serverInstanceId !== player.serverInstanceId || op.issuedAtTick > state.root.tick
      || op.reservationsReleased || (op.membershipId !== undefined && op.membershipId !== player.metadata?.membershipId)) return total;
    seen.add(op.id);
    const amount = Number(op.reservedPopulation);
    return total + (Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0);
  }, 0);
};
