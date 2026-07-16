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
  const corridor = input.slice.frontier?.corridorTargets.find((entry) => entry.targetDistrictId === input.targetDistrictId);

  if (!district) {
    throw new Error("Spy command cannot be created from missing district/target context.");
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
      sourceDistrictId: corridor?.sourceDistrictId ?? district.districtId,
      ...(corridor ? { routeDistrictId: corridor.routeDistrictId, expectedRouteVersion: corridor.routeVersion } : {})
    },
    clientRequestId: input.clientRequestId ?? null
  };
};
