import type {
  CancelDrugLabProductionCommand,
  CancelPharmacyProductionCommand,
  CancelProductionLineCommand,
  GameplaySliceView
} from "@empire/shared-types";

export interface CreateCancelProductionCommandInput {
  commandId: string;
  slice: GameplaySliceView;
  buildingId: string;
  recipeId: string;
  issuedAt: string;
  clientRequestId?: string | null;
}

type CancelProductionCommand =
  | CancelDrugLabProductionCommand
  | CancelPharmacyProductionCommand
  | CancelProductionLineCommand;

/**
 * Responsibility: Maps a server-fed cancellable production line to its command type.
 * Belongs here: typed command construction over the current authoritative slice.
 * Does not belong here: queue mutation, refund math, or production validation.
 */
export const createCancelProductionCommand = (
  input: CreateCancelProductionCommandInput
): CancelProductionCommand => {
  const district = input.slice.district;
  const building = district?.buildings.find((candidate) => candidate.buildingId === input.buildingId);
  const lines = building?.pharmacy?.lines
    ?? building?.drugLab?.lines
    ?? building?.factory?.productionLines
    ?? building?.armory?.productionLines
    ?? [];
  const line = lines.find(
    (candidate) => candidate.recipeId === input.recipeId && candidate.canCancelWaiting
  );

  if (!district || !building || !line) {
    throw new Error(
      "Production cancellation commands can only be created from cancellable lines present in the current server-fed slice."
    );
  }

  const command = {
    id: input.commandId,
    mode: input.slice.player.mode,
    playerId: input.slice.player.playerId,
    serverInstanceId: input.slice.player.instanceId,
    issuedAt: input.issuedAt,
    payload: {
      districtId: district.districtId,
      buildingId: building.buildingId,
      recipeId: line.recipeId
    },
    clientRequestId: input.clientRequestId ?? null
  };

  if (building.buildingTypeId === "pharmacy") {
    return { ...command, type: "cancel-pharmacy-production" };
  }
  if (building.buildingTypeId === "drug_lab") {
    return { ...command, type: "cancel-drug-lab-production" };
  }
  if (building.buildingTypeId === "factory" || building.buildingTypeId === "armory") {
    return { ...command, type: "cancel-production-line" };
  }

  throw new Error("The selected building does not expose a cancellable production command.");
};
