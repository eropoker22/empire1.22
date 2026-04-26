import type { CollectProductionCommand, GameModeId } from "@empire/shared-types";

export interface CreateCollectProductionCommandInput {
  commandId: string;
  serverInstanceId: string;
  playerId: string;
  mode: GameModeId;
  districtId: string;
  buildingId: string;
  issuedAt: string;
  clientRequestId?: string | null;
}

/**
 * Responsibility: Factory for client-issued production collection commands.
 * Belongs here: typed command construction from server-fed production UI state.
 * Does not belong here: production validation or inventory math.
 */
export const createCollectProductionCommand = (
  input: CreateCollectProductionCommandInput
): CollectProductionCommand => ({
  id: input.commandId,
  type: "collect-production",
  mode: input.mode,
  playerId: input.playerId,
  serverInstanceId: input.serverInstanceId,
  issuedAt: input.issuedAt,
  payload: {
    districtId: input.districtId,
    buildingId: input.buildingId
  },
  clientRequestId: input.clientRequestId ?? null
});
