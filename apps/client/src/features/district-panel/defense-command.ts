import type {
  GameplaySliceView,
  PlaceDefenseCommand,
  RemoveDefenseCommand
} from "@empire/shared-types";

const DEFAULT_DEFENSE_ITEM_ID = "barricades";
const DEFAULT_DEFENSE_AMOUNT = 1;

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
  if (!district?.placeDefense?.enabled) {
    throw new Error("Place defense commands can only be created from an enabled defense action present in the current server-fed slice.");
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
      defenseItemId: DEFAULT_DEFENSE_ITEM_ID,
      amount: DEFAULT_DEFENSE_AMOUNT,
      expectedTargetVersion: district.placeDefense.expectedTargetVersion
    },
    clientRequestId: input.clientRequestId ?? null
  };
};

export const createRemoveDefenseCommand = (
  input: CreateDefenseCommandInput
): RemoveDefenseCommand => {
  const district = input.slice.district;
  if (!district?.removeDefense?.enabled) {
    throw new Error("Remove defense commands can only be created from an enabled defense action present in the current server-fed slice.");
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
      defenseItemId: DEFAULT_DEFENSE_ITEM_ID,
      amount: DEFAULT_DEFENSE_AMOUNT,
      expectedTargetVersion: district.removeDefense.expectedTargetVersion
    },
    clientRequestId: input.clientRequestId ?? null
  };
};
