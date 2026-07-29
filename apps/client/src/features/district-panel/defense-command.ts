import type {
  GameplaySliceView,
  PlaceDefenseCommand,
  RemoveDefenseCommand
} from "@empire/shared-types";

export interface CreateDefenseCommandInput {
  commandId: string;
  slice: GameplaySliceView;
  issuedAt: string;
  clientRequestId?: string | null;
}

export const createPlaceDefenseCommand = (
  input: CreateDefenseCommandInput
): PlaceDefenseCommand => {
  const district = input.slice.district;
  if (!district || !district.placeDefense) {
    throw new Error("Place defense command cannot be created from missing district/defense context.");
  }
  if (!district.placeDefense.enabled || !district.placeDefense.preferredItemId) {
    throw new Error("Place defense command cannot be created from a disabled defense projection.");
  }

  return {
    id: input.commandId,
    type: "place-defense",
    mode: input.slice.mode.mode,
    playerId: input.slice.player.playerId,
    serverInstanceId: input.slice.player.instanceId,
    issuedAt: input.issuedAt,
    payload: {
      targetDistrictId: district.districtId,
      defenseItemId: district.placeDefense.preferredItemId,
      amount: district.placeDefense.preferredAmount,
      expectedTargetVersion: district.placeDefense.expectedTargetVersion
    },
    clientRequestId: input.clientRequestId ?? null
  };
};

export const createRemoveDefenseCommand = (
  input: CreateDefenseCommandInput
): RemoveDefenseCommand => {
  const district = input.slice.district;
  if (!district || !district.removeDefense) {
    throw new Error("Remove defense command cannot be created from missing district/defense context.");
  }
  if (!district.removeDefense.enabled || !district.removeDefense.preferredItemId) {
    throw new Error("Remove defense command cannot be created from a disabled defense projection.");
  }

  return {
    id: input.commandId,
    type: "remove-defense",
    mode: input.slice.mode.mode,
    playerId: input.slice.player.playerId,
    serverInstanceId: input.slice.player.instanceId,
    issuedAt: input.issuedAt,
    payload: {
      targetDistrictId: district.districtId,
      defenseItemId: district.removeDefense.preferredItemId,
      amount: district.removeDefense.preferredAmount,
      expectedTargetVersion: district.removeDefense.expectedTargetVersion
    },
    clientRequestId: input.clientRequestId ?? null
  };
};
