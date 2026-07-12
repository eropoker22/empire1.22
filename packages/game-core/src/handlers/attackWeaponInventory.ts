import type { AttackWeaponId, Player } from "@empire/shared-types";
import type { CoreGameState } from "../entities";

export const applyAttackWeaponLosses = (
  loadout: Partial<Record<AttackWeaponId, number>>,
  losses: Partial<Record<AttackWeaponId, number>>
): Partial<Record<AttackWeaponId, number>> => {
  const nextLoadout = { ...loadout };
  for (const [itemId, amount] of Object.entries(losses) as Array<[AttackWeaponId, number]>) {
    nextLoadout[itemId] = Math.max(0, Number(nextLoadout[itemId] || 0) - Math.max(0, Number(amount) || 0));
  }
  return nextLoadout;
};

export const writeAttackWeaponInventory = (
  state: CoreGameState,
  player: Player,
  inventory: Partial<Record<AttackWeaponId, number>>
): CoreGameState["resourceStatesById"] => {
  const resourceState = state.resourceStatesById[player.resourceStateId];
  if (!resourceState) {
    return state.resourceStatesById;
  }
  return {
    ...state.resourceStatesById,
    [resourceState.id]: {
      ...resourceState,
      balances: {
        ...resourceState.balances,
        ...inventory
      },
      lastUpdatedTick: state.root.tick,
      version: resourceState.version + 1
    }
  };
};
