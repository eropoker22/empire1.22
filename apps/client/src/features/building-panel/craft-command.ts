import type { CraftItemCommand, GameplaySliceView } from "@empire/shared-types";

export interface CreateCraftItemCommandInput {
  commandId: string;
  slice: GameplaySliceView;
  buildingId: string;
  recipeId: string;
  quantity?: number;
  issuedAt: string;
  clientRequestId?: string | null;
}

/**
 * Responsibility: Factory for client-issued processing commands from server-fed slot actions.
 * Belongs here: typed command construction for migrated craft-item dispatch.
 * Does not belong here: recipe validation or inventory mutation logic.
 */
export const createCraftItemCommand = (
  input: CreateCraftItemCommandInput
): CraftItemCommand => {
  const district = input.slice.district;
  const slot = district?.slots.find((candidate) => candidate.buildingId === input.buildingId);
  const craftOption = slot?.craftOptions.find((candidate) => candidate.recipeId === input.recipeId && candidate.canCraft);
  const building = district?.buildings.find((candidate) => candidate.buildingId === input.buildingId);
  const productionLine = [
    ...(building?.pharmacy?.lines ?? []),
    ...(building?.drugLab?.lines ?? []),
    ...(building?.factory?.productionLines ?? []),
    ...(building?.armory?.productionLines ?? [])
  ].find((candidate) => candidate.recipeId === input.recipeId && candidate.canStart);

  if (!district || (!craftOption && !productionLine)) {
    throw new Error("Craft commands can only be created from enabled craft options present in the current server-fed slice.");
  }

  return {
    id: input.commandId,
    type: "craft-item",
    mode: input.slice.player.mode,
    playerId: input.slice.player.playerId,
    serverInstanceId: input.slice.player.instanceId,
    issuedAt: input.issuedAt,
    payload: {
      districtId: district.districtId,
      buildingId: input.buildingId,
      recipeId: craftOption?.recipeId ?? productionLine!.recipeId,
      quantity: input.quantity ?? 1
    },
    clientRequestId: input.clientRequestId ?? null
  };
};
