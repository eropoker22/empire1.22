import type { GameplaySliceView, RobDistrictCommand } from "@empire/shared-types";

export interface CreateRobDistrictCommandInput {
  commandId: string;
  slice: GameplaySliceView;
  targetDistrictId: string;
  issuedAt: string;
  clientRequestId?: string | null;
}

export const createRobDistrictCommand = (
  input: CreateRobDistrictCommandInput
): RobDistrictCommand => {
  const district = input.slice.district;
  const target = district?.robTargets?.find((entry) => entry.districtId === input.targetDistrictId);
  const corridor = input.slice.frontier?.corridorTargets.find((entry) => entry.targetDistrictId === input.targetDistrictId);

  if (!district) {
    throw new Error("Rob command cannot be created from missing district/target context.");
  }

  return {
    id: input.commandId,
    type: "rob-district",
    mode: input.slice.mode.mode,
    playerId: input.slice.player.playerId,
    serverInstanceId: input.slice.player.instanceId,
    issuedAt: input.issuedAt,
    payload: {
      targetDistrictId: input.targetDistrictId,
      sourceDistrictId: corridor?.sourceDistrictId ?? district.districtId,
      ...(target?.expectedTargetVersion !== undefined ? { expectedTargetVersion: target.expectedTargetVersion } : {}),
      ...(target?.expectedSourceVersion !== undefined ? { expectedSourceVersion: target.expectedSourceVersion } : {}),
      ...(corridor ? { routeDistrictId: corridor.routeDistrictId, expectedRouteVersion: corridor.routeVersion } : {})
    },
    clientRequestId: input.clientRequestId ?? null
  };
};
