import type { GameplaySliceView, SpyDistrictCommand } from "@empire/shared-types";

export interface CreateSpyDistrictCommandInput {
  commandId: string;
  slice: GameplaySliceView;
  targetDistrictId: string;
  issuedAt: string;
  clientRequestId?: string | null;
}

/**
 * Responsibility: Builds one spy command strictly from the current server-fed district slice.
 * Belongs here: typed client dispatch construction only.
 * Does not belong here: spy validation or outcome prediction.
 */
export const createSpyDistrictCommand = (
  input: CreateSpyDistrictCommandInput
): SpyDistrictCommand => {
  const district = input.slice.district;
  const target = district?.spyTargets.find((entry) => entry.districtId === input.targetDistrictId);

  if (!district || !target || !target.enabled) {
    throw new Error("Spy commands can only be created from enabled spy targets present in the current server-fed slice.");
  }

  return {
    id: input.commandId,
    type: "spy-district",
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
