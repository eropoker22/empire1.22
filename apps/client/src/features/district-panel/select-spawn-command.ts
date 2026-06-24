import type { GameplaySliceView, SelectSpawnDistrictCommand } from "@empire/shared-types";

export interface CreateSelectSpawnDistrictCommandInput {
  commandId: string;
  slice: GameplaySliceView;
  districtId: string;
  issuedAt: string;
  clientRequestId?: string | null;
}

export const createSelectSpawnDistrictCommand = (
  input: CreateSelectSpawnDistrictCommandInput
): SelectSpawnDistrictCommand => {
  const spawnDistrict = input.slice.spawnSelection?.districts.find((district) =>
    district.districtId === input.districtId
  );

  if (!spawnDistrict || spawnDistrict.status !== "available") {
    throw new Error("Spawn selection commands can only be created from available server-fed spawn districts.");
  }

  return {
    id: input.commandId,
    type: "select-spawn-district",
    mode: input.slice.mode.mode,
    playerId: input.slice.player.playerId,
    serverInstanceId: input.slice.player.instanceId,
    issuedAt: input.issuedAt,
    payload: {
      districtId: input.districtId
    },
    clientRequestId: input.clientRequestId ?? null
  };
};
