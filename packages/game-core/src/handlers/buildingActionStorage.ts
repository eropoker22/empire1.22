import type { ResourceState } from "@empire/shared-types";
import type { CoreError } from "../errors";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import { canPlayerReceiveResource, normalizeStorageBalances } from "./warehouseBuilding";

export const resolveBuildingActionStorageError = (input: {
  state: CoreGameState;
  playerId: string;
  outputGain: Record<string, number>;
  context: GameCoreContext;
}): CoreError | null => {
  const warehouse = input.context.config.balance.warehouse;
  if (!warehouse) return null;
  for (const [resourceKey, amount] of Object.entries(input.outputGain)) {
    if (resourceKey === "population" || Number(amount || 0) <= 0) continue;
    const result = canPlayerReceiveResource(input.state, input.playerId, resourceKey, amount, warehouse);
    if (!result.allowed) {
      return { code: result.code ?? "storage_capacity_full", message: result.message ?? "Sklad je pro tuto položku plný." };
    }
  }
  return null;
};

export const resolveNormalizedPlayerResourceState = (
  state: CoreGameState,
  player: CoreGameState["playersById"][string],
  tick: number
): { resourceState: ResourceState; existed: boolean } => {
  const existing = state.resourceStatesById[player.resourceStateId];
  return {
    resourceState: existing
      ? { ...existing, balances: normalizeStorageBalances(existing.balances) }
      : { id: player.resourceStateId, ownerType: "player", ownerId: player.id, balances: {}, incomeModifiers: {}, lastUpdatedTick: tick, version: 1 },
    existed: Boolean(existing)
  };
};
