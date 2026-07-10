import type { GameplaySliceView } from "@empire/shared-types";

export const createServerSliceRenderFingerprint = (
  readModel: GameplaySliceView | null,
  selectedDistrictId?: string | null
): string => readModel
  ? JSON.stringify({
      instanceId: readModel.server.serverInstanceId,
      playerId: readModel.player.playerId,
      stateVersion: readModel.server.stateVersion,
      currentTick: readModel.server.currentTick,
      selectedDistrictId: readModel.district?.districtId
        ?? readModel.server.selectedDistrictId
        ?? selectedDistrictId
        ?? "",
      spawnStatus: readModel.spawnSelection?.status || ""
    })
  : "";

export const canReuseServerSliceRender = (
  nextFingerprint: string,
  previousFingerprint: string,
  commandId: string | undefined,
  errorCount: number
): boolean => Boolean(
  nextFingerprint
  && nextFingerprint === previousFingerprint
  && !commandId
  && errorCount === 0
);

