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

  if (!district || !target || !target.enabled) {
    throw new Error("Rob commands can only be created from enabled rob targets present in the current server-fed slice.");
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
      sourceDistrictId: district.districtId,
      expectedTargetVersion: target.expectedTargetVersion,
      expectedSourceVersion: target.expectedSourceVersion
    },
    clientRequestId: input.clientRequestId ?? null
  };
};
