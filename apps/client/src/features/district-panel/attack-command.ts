import type { AttackDistrictCommand, GameModeId } from "@empire/shared-types";

export interface CreateAttackDistrictCommandInput {
  commandId: string;
  serverInstanceId: string;
  playerId: string;
  mode: GameModeId;
  sourceDistrictId: string;
  targetDistrictId: string;
  issuedAt: string;
  clientRequestId?: string | null;
}

/**
 * Responsibility: Factory for client-issued attack commands from server-fed UI state.
 * Belongs here: typed command construction only.
 * Does not belong here: attack validation or result prediction.
 */
export const createAttackDistrictCommand = (
  input: CreateAttackDistrictCommandInput
): AttackDistrictCommand => ({
  id: input.commandId,
  type: "attack-district",
  mode: input.mode,
  playerId: input.playerId,
  serverInstanceId: input.serverInstanceId,
  issuedAt: input.issuedAt,
  payload: {
    districtId: input.targetDistrictId,
    sourceDistrictId: input.sourceDistrictId
  },
  clientRequestId: input.clientRequestId ?? null
});
