import type { PharmacyProductionBuildingView, PharmacyProductionLineView } from "@empire/shared-types";
import type { PharmacyRecipeId, ResolvedGameModeConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import {
  PHARMACY_BUILDING_TYPE_ID
} from "../handlers/pharmacyProductionShared";
import { getWarehouseCapacityForResource, resolveWarehouseStorageCapacity } from "../handlers/warehouseBuilding";

export const createPharmacyProductionBuildingView = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  playerId: string;
  config?: ResolvedGameModeConfig;
  tickRateMs?: number;
}): PharmacyProductionBuildingView | null => {
  const pharmacy = input.config?.balance.pharmacy;
  if (input.building.buildingTypeId !== PHARMACY_BUILDING_TYPE_ID || !pharmacy) return null;
  const isOwner = input.building.ownerPlayerId === input.playerId && input.building.status === "active";
  const player = input.state.playersById[input.playerId];
  const balances = player ? input.state.resourceStatesById[player.resourceStateId]?.balances ?? {} : {};
  const storage = player && input.config?.balance.warehouse
    ? resolveWarehouseStorageCapacity(input.state, player.id, input.config.balance.warehouse)
    : null;
  const lines = (Object.entries(pharmacy.recipes) as Array<[PharmacyRecipeId, typeof pharmacy.recipes[PharmacyRecipeId]]>).map(([recipeId, recipe]) => {
    const cleanCash = Math.max(0, Number(balances.cash || 0));
    const playerStoredAmount = Math.max(0, Number(balances[recipe.outputResourceKey] ?? 0));
    const playerStoredCapacity = storage ? getWarehouseCapacityForResource(storage, recipe.outputResourceKey) : 0;
    const maxByStorage = storage
      ? Math.max(0, Math.floor((playerStoredCapacity - playerStoredAmount) / recipe.outputAmount))
      : Number.MAX_SAFE_INTEGER;
    const maxByCash = recipe.cleanCashCostPerUnit > 0
      ? Math.floor(cleanCash / recipe.cleanCashCostPerUnit)
      : Number.MAX_SAFE_INTEGER;
    const maxStartQuantity = isOwner
      ? Math.max(0, Math.min(recipe.queueCap, maxByCash, maxByStorage))
      : 0;
    const storageFull = maxByStorage <= 0;
    const disabledReason = !isOwner
      ? input.building.status !== "active" ? "Lékárna musí být aktivní." : "Lékárna patří jinému hráči."
      : storageFull ? "Sklad je pro tento produkt plný."
      : maxStartQuantity <= 0 ? "Na spuštění výroby nemáš dost clean cash."
      : null;
    const status = storageFull ? "full" : "ready";
    return {
      executionMode: "instant",
      recipeId,
      resourceKey: recipe.outputResourceKey,
      label: recipe.label,
      producedAmount: 0,
      producedCapacity: playerStoredCapacity,
      playerStoredAmount,
      playerStoredCapacity,
      queuedAmount: 0,
      queueCapacity: recipe.queueCap,
      activeAmount: 0,
      waitingAmount: 0,
      unitCleanCashCost: recipe.cleanCashCostPerUnit,
      baseUnitDurationTicks: 0,
      effectiveUnitDurationTicks: 0,
      remainingTicks: 0,
      remainingMs: 0,
      status,
      canStart: maxStartQuantity > 0,
      canCancelWaiting: false,
      canCollect: false,
      maxStartQuantity,
      disabledReason
    } satisfies PharmacyProductionLineView;
  });
  return { buildingId: input.building.id, lines };
};
