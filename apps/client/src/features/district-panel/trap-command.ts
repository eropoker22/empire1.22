import type { GameplaySliceView, PlaceTrapCommand } from "@empire/shared-types";

export interface CreatePlaceTrapCommandInput {
  commandId: string;
  slice: GameplaySliceView;
  issuedAt: string;
  clientRequestId?: string | null;
}

/**
 * Responsibility: Builds one trap placement command strictly from the current server-fed district slice.
 * Belongs here: typed client dispatch construction only.
 * Does not belong here: hidden-state validation or trap logic.
 */
export const createPlaceTrapCommand = (
  input: CreatePlaceTrapCommandInput
): PlaceTrapCommand => {
  const district = input.slice.district;

  if (!district?.trap) {
    throw new Error("Trap command cannot be created from missing district/trap context.");
  }

  return {
    id: input.commandId,
    type: "place-trap",
    mode: input.slice.mode.mode,
    playerId: input.slice.player.playerId,
    serverInstanceId: input.slice.player.instanceId,
    issuedAt: input.issuedAt,
    payload: {
      districtId: district.districtId
    },
    clientRequestId: input.clientRequestId ?? null
  };
};
