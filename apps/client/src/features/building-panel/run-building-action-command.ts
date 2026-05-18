import type { GameplaySliceView, RunBuildingActionCommand } from "@empire/shared-types";

export interface CreateRunBuildingActionCommandInput {
  commandId: string;
  slice: GameplaySliceView;
  buildingId: string;
  actionId: string;
  dealerSlotId?: string;
  targetCategory?: string;
  category?: string;
  mode?: string;
  investmentCleanCash?: number;
  investment?: number;
  targetZone?: string;
  itemId?: string;
  amount?: number;
  issuedAt: string;
  clientRequestId?: string | null;
}

/**
 * Responsibility: Factory for client-issued fixed-building action commands.
 * Belongs here: typed command construction from server-fed building actions.
 * Does not belong here: action validation, resource math, or cooldown rules.
 */
export const createRunBuildingActionCommand = (
  input: CreateRunBuildingActionCommandInput
): RunBuildingActionCommand => {
  const district = input.slice.district;
  const building = district?.buildings.find((candidate) => candidate.buildingId === input.buildingId);
  const action = building?.actions.find((candidate) => candidate.actionId === input.actionId && candidate.enabled);

  if (!district || !building || !action) {
    throw new Error("Building action commands can only be created from enabled actions present in the current server-fed slice.");
  }

  return {
    id: input.commandId,
    type: "run-building-action",
    mode: input.slice.player.mode,
    playerId: input.slice.player.playerId,
    serverInstanceId: input.slice.player.instanceId,
    issuedAt: input.issuedAt,
    payload: {
      districtId: district.districtId,
      buildingId: building.buildingId,
      actionId: action.actionId,
      ...(input.dealerSlotId ? { dealerSlotId: input.dealerSlotId } : {}),
      ...(input.targetCategory ? { targetCategory: input.targetCategory } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.mode ? { mode: input.mode } : {}),
      ...(input.investmentCleanCash !== undefined ? { investmentCleanCash: input.investmentCleanCash } : {}),
      ...(input.investment !== undefined ? { investment: input.investment } : {}),
      ...(input.targetZone ? { targetZone: input.targetZone } : {}),
      ...(input.itemId ? { itemId: input.itemId } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {})
    },
    clientRequestId: input.clientRequestId ?? null
  };
};
