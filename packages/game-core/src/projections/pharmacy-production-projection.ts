import type { PharmacyProductionBuildingView, PharmacyProductionLineView } from "@empire/shared-types";
import type { PharmacyRecipeId, ResolvedGameModeConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import {
  getPharmacyProducedAmount,
  getPharmacyLine,
  PHARMACY_BUILDING_TYPE_ID,
  resolvePharmacyDurationTicks
} from "../handlers/pharmacyProductionShared";

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
  const lines = (Object.entries(pharmacy.recipes) as Array<[PharmacyRecipeId, typeof pharmacy.recipes[PharmacyRecipeId]]>).map(([recipeId, recipe]) => {
    const line = getPharmacyLine(input.building, recipeId);
    const producedAmount = getPharmacyProducedAmount(input.state, input.building, recipe.outputResourceKey);
    const activeAmount = line.activeCompletesAtTick === null ? 0 : 1;
    const waitingAmount = Math.max(0, line.queuedAmount - activeAmount);
    const remainingTicks = activeAmount ? Math.max(0, line.activeCompletesAtTick! - input.state.root.tick) : 0;
    const effectiveUnitDurationTicks = resolvePharmacyDurationTicks(input.state, input.building, recipe, { config: input.config! });
    const cleanCash = Math.max(0, Number(balances.cash || 0));
    const queueSpace = Math.max(0, recipe.queueCap - line.queuedAmount);
    const localFull = producedAmount >= recipe.localOutputCap;
    const maxStartQuantity = isOwner && !localFull
      ? Math.max(0, Math.min(queueSpace, Math.floor(cleanCash / recipe.cleanCashCostPerUnit)))
      : 0;
    const disabledReason = !isOwner
      ? input.building.status !== "active" ? "Lékárna musí být aktivní." : "Lékárna patří jinému hráči."
      : localFull ? "Lokální zásoba Lékárny je plná."
      : queueSpace <= 0 ? "Fronta této výrobní linky je plná."
      : maxStartQuantity <= 0 ? "Na spuštění výroby nemáš dost clean cash."
      : null;
    const status = localFull
      ? "full"
      : activeAmount
        ? "processing"
        : line.queuedAmount > 0
          ? "waiting"
          : producedAmount > 0
            ? "completed"
            : "ready";
    return {
      recipeId,
      resourceKey: recipe.outputResourceKey,
      label: recipe.label,
      producedAmount,
      producedCapacity: recipe.localOutputCap,
      queuedAmount: line.queuedAmount,
      queueCapacity: recipe.queueCap,
      activeAmount: activeAmount as 0 | 1,
      waitingAmount,
      unitCleanCashCost: recipe.cleanCashCostPerUnit,
      baseUnitDurationTicks: recipe.durationTicksPerUnit,
      effectiveUnitDurationTicks,
      remainingTicks,
      remainingMs: remainingTicks * Math.max(1, Number(input.tickRateMs || input.config?.tickRateMs || 5000)),
      status,
      canStart: maxStartQuantity > 0,
      canCancelWaiting: waitingAmount > 0,
      canCollect: isOwner && producedAmount > 0,
      maxStartQuantity,
      disabledReason
    } satisfies PharmacyProductionLineView;
  });
  return { buildingId: input.building.id, lines };
};
