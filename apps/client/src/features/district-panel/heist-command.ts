import type { GameplaySliceView, HeistDistrictCommand } from "@empire/shared-types";

export interface CreateHeistDistrictCommandInput {
  commandId: string;
  slice: GameplaySliceView;
  targetDistrictId: string;
  issuedAt: string;
  clientRequestId?: string | null;
}

export const createHeistDistrictCommand = (
  input: CreateHeistDistrictCommandInput
): HeistDistrictCommand => {
  const district = input.slice.district;
  const target = district?.heistTargets?.find((entry) => entry.districtId === input.targetDistrictId);
  const style = target?.styles.find((entry) => entry.style === "balanced") ?? target?.styles[0];

  if (!district || !target || !target.enabled || !style) {
    throw new Error("Heist commands can only be created from enabled heist targets present in the current server-fed slice.");
  }

  return {
    id: input.commandId,
    type: "heist-district",
    mode: input.slice.mode.mode,
    playerId: input.slice.player.playerId,
    serverInstanceId: input.slice.player.instanceId,
    issuedAt: input.issuedAt,
    payload: {
      targetDistrictId: input.targetDistrictId,
      sourceDistrictId: district.districtId,
      style: style.style,
      gangMembersSent: style.defaultGangMembersSent,
      expectedTargetVersion: target.expectedTargetVersion,
      expectedSourceVersion: target.expectedSourceVersion
    },
    clientRequestId: input.clientRequestId ?? null
  };
};
