import type { WarehouseBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import {
  isNonStockableResource,
  normalizeStorageBalances,
  normalizeStorageResourceKey,
  ResourceCreditCheck,
  ResourceCreditContext,
  StorageCapacityError
} from "./storageCapacityTypes";
import { resolveResourceCapacity } from "./storageCapacityResolver";

export const calculateReceivableResourceAmount = (
  state: CoreGameState,
  playerId: string,
  resourceKey: string,
  requestedAmount: number,
  config: WarehouseBalanceConfig,
  context: ResourceCreditContext = {}
): number => {
  const requested = Math.max(0, Math.floor(Number(requestedAmount || 0)));
  if (requested <= 0 || context.kind === "restorative" || isNonStockableResource(resourceKey)) return requested;
  const canonicalKey = normalizeStorageResourceKey(resourceKey);
  const maxAmount = resolveResourceCapacity(state, playerId, canonicalKey, config);
  const player = state.playersById[playerId];
  const balances = normalizeStorageBalances(player ? state.resourceStatesById[player.resourceStateId]?.balances ?? {} : {});
  return Math.max(0, Math.min(requested, maxAmount - Math.max(0, Number(balances[canonicalKey] || 0))));
};

export const canPlayerReceiveResource = (
  state: CoreGameState,
  playerId: string,
  resourceKey: string,
  amount: number,
  config: WarehouseBalanceConfig,
  context: ResourceCreditContext = {}
): ResourceCreditCheck => {
  const requested = Math.max(0, Math.floor(Number(amount || 0)));
  if (context.kind === "restorative" || isNonStockableResource(resourceKey)) {
    return { allowed: true, code: null, message: null, currentAmount: 0, maxAmount: null, receivableAmount: requested };
  }
  try {
    const canonicalKey = normalizeStorageResourceKey(resourceKey);
    const maxAmount = resolveResourceCapacity(state, playerId, canonicalKey, config);
    const player = state.playersById[playerId];
    const balances = normalizeStorageBalances(player ? state.resourceStatesById[player.resourceStateId]?.balances ?? {} : {});
    const currentAmount = Math.max(0, Number(balances[canonicalKey] || 0));
    const receivableAmount = Math.max(0, Math.min(requested, maxAmount - currentAmount));
    if (currentAmount > maxAmount) {
      return { allowed: false, code: "storage_capacity_exceeded", message: "Tuto položku už nemůžeš přijmout, dokud neuvolníš kapacitu.", currentAmount, maxAmount, receivableAmount };
    }
    if (receivableAmount <= 0) {
      return { allowed: false, code: "storage_capacity_full", message: "Sklad je pro tuto položku plný.", currentAmount, maxAmount, receivableAmount };
    }
    if (receivableAmount < requested) {
      return { allowed: false, code: "storage_capacity_exceeded", message: "Tuto položku už nemůžeš přijmout, dokud neuvolníš kapacitu.", currentAmount, maxAmount, receivableAmount };
    }
    return { allowed: true, code: null, message: null, currentAmount, maxAmount, receivableAmount };
  } catch (error) {
    if (error instanceof StorageCapacityError) {
      return { allowed: false, code: error.code, message: "Tato položka nemá nastavenou skladovou kapacitu.", currentAmount: 0, maxAmount: null, receivableAmount: 0 };
    }
    throw error;
  }
};
