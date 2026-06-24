import type { GameplaySliceView } from "@empire/shared-types";
import type { DistrictPanelViewModel } from "./district-panel-view-model-types";

type BasicActionFields = Pick<
  DistrictPanelViewModel,
  "robTargets" | "heistTargets" | "placeDefense" | "removeDefense"
>;

export const createDistrictBasicActionViewModels = (
  district: NonNullable<GameplaySliceView["district"]>,
  hasPendingCommand: boolean
): BasicActionFields => ({
  robTargets: (district.robTargets ?? []).map((target) => ({
    districtId: target.districtId,
    label: target.name,
    statusLabel: target.status,
    disabled: hasPendingCommand || !target.enabled,
    disabledReason: getDisabledReason(hasPendingCommand, target.disabledReason)
  })),
  heistTargets: (district.heistTargets ?? []).map((target) => ({
    districtId: target.districtId,
    label: target.name,
    ownerLabel: target.ownerPlayerId
      ? `Vlastník ${target.ownerPlayerId}`
      : "Neutrální distrikt",
    statusLabel: target.status,
    disabled: hasPendingCommand || !target.enabled,
    disabledReason: getDisabledReason(hasPendingCommand, target.disabledReason)
  })),
  placeDefense: district.placeDefense
    ? {
        actionLabel: "Vložit obranu",
        disabled: hasPendingCommand || !district.placeDefense.enabled,
        disabledReason: getDisabledReason(hasPendingCommand, district.placeDefense.disabledReason)
      }
    : null,
  removeDefense: district.removeDefense
    ? {
        actionLabel: "Odebrat obranu",
        disabled: hasPendingCommand || !district.removeDefense.enabled,
        disabledReason: getDisabledReason(hasPendingCommand, district.removeDefense.disabledReason)
      }
    : null
});

const getDisabledReason = (
  hasPendingCommand: boolean,
  disabledReason: string | null
): string | null =>
  hasPendingCommand ? "Akce se zpracovává." : disabledReason;
