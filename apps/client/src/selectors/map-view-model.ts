import type { DistrictSummaryView } from "@empire/shared-types";

/**
 * Responsibility: Maps district data into map-render friendly read models.
 * Belongs here: presentation-safe ownership/highlight metadata for the map layer.
 * Does not belong here: combat, income, or police calculations.
 */
export interface MapDistrictViewModel {
  districtId: string;
  label: string;
  ownerLabel: string;
  zoneLabel: string;
  heatLabel: string;
  influenceLabel: string;
  buildingSummary: string;
  ownerPlayerId: string | null;
  ownerColor: string | null;
  isOwnedByPlayer: boolean;
  isContested: boolean;
  isDestroyed: boolean;
  isSelected: boolean;
  isAttackTarget: boolean;
  attackEnabled: boolean;
  attackDisabledReason: string | null;
}

export const createMapDistrictViewModels = (
  districts: DistrictSummaryView[],
  selectedDistrictId: string | null,
  attackTargets: ReadonlyArray<{
    districtId: string;
    enabled: boolean;
    disabledReason: string | null;
  }> = []
): MapDistrictViewModel[] =>
  districts.map((district) => {
    const attackTarget = attackTargets.find((target) => target.districtId === district.districtId);
    const isDestroyed = district.status === "destroyed";

    return {
      districtId: district.districtId,
      label: district.name,
      ownerLabel: isDestroyed
        ? "Zničený distrikt"
        : district.isOwnedByPlayer
        ? "Vlastní hráč"
        : district.ownerPlayerId
          ? `Vlastní ${district.ownerPlayerId}`
          : "Neutrální distrikt",
      zoneLabel: toTitleCase(district.zone),
      heatLabel: formatHeatLabel(district.heat),
      influenceLabel: String(district.influence),
      buildingSummary: `${district.filledSlotCount} pevných`,
      ownerPlayerId: district.ownerPlayerId,
      ownerColor: district.ownerColor,
      isOwnedByPlayer: district.isOwnedByPlayer,
      isContested: district.status === "contested",
      isDestroyed,
      isSelected: district.districtId === selectedDistrictId,
      isAttackTarget: attackTarget !== undefined,
      attackEnabled: attackTarget?.enabled ?? false,
      attackDisabledReason: attackTarget?.disabledReason ?? null
    };
  });

const toTitleCase = (value: string): string =>
  value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const formatHeatLabel = (value: number): string =>
  String(Math.round(Number.isFinite(value) ? value : 0));
