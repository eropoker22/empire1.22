import type { AttackDistrictCommand, GameplaySliceView } from "@empire/shared-types";

export interface CreateAttackDistrictCommandInput {
  commandId: string;
  slice: GameplaySliceView;
  targetDistrictId: string;
  issuedAt: string;
  clientRequestId?: string | null;
}

/**
 * Responsibility: Builds one attack command strictly from the current server-fed district slice.
 * Belongs here: typed command construction only.
 * Does not belong here: attack validation or result prediction.
 */
export const createAttackDistrictCommand = (
  input: CreateAttackDistrictCommandInput
): AttackDistrictCommand => {
  const district = input.slice.district;

  if (!district) {
    throw new Error("Attack command cannot be created from missing district/target context.");
  }

  return {
    id: input.commandId,
    type: "attack-district",
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
