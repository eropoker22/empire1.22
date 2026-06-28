import type { GameplaySliceView, OccupyDistrictCommand } from "@empire/shared-types";

export interface CreateOccupyDistrictCommandInput {
  commandId: string;
  slice: GameplaySliceView;
  targetDistrictId: string;
  issuedAt: string;
  clientRequestId?: string | null;
}

/**
 * Responsibility: Builds one occupy command strictly from the current server-fed district slice.
 * Belongs here: typed client dispatch construction only.
 * Does not belong here: occupy validation or ownership mutation.
 */
export const createOccupyDistrictCommand = (
  input: CreateOccupyDistrictCommandInput
): OccupyDistrictCommand => {
  const district = input.slice.district;

  if (!district) {
    throw new Error("Occupy command cannot be created from missing district/target context.");
  }

  return {
    id: input.commandId,
    type: "occupy-district",
    mode: input.slice.mode.mode,
    playerId: input.slice.player.playerId,
    serverInstanceId: input.slice.player.instanceId,
    issuedAt: input.issuedAt,
    payload: {
      districtId: input.targetDistrictId,
      sourceDistrictId: district.districtId
    },
    clientRequestId: input.clientRequestId ?? null
  };
};
