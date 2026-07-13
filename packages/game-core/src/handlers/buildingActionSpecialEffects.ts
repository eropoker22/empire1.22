import type { DefenseWeaponId, DistrictId } from "@empire/shared-types";
import type { CoreGameState } from "../entities";

export interface BuildingActionSpecialEffectResult {
  nextDistrict: CoreGameState["districtsById"][string];
  defenseAdded: Partial<Record<DefenseWeaponId, number>>;
  intelRevealedDistrictIds: DistrictId[];
  intelDetectedDefense: Record<string, Partial<Record<DefenseWeaponId, number>>>;
  messages: string[];
}

export const resolveBuildingActionSpecialEffect = (input: {
  state: CoreGameState;
  district: CoreGameState["districtsById"][string];
  actionId: string;
}): BuildingActionSpecialEffectResult => {
  const intelEffect = INTEL_EFFECT_BY_ACTION_ID[input.actionId] ?? null;
  if (intelEffect) {
    const intelRevealedDistrictIds = getIntelDistrictIds(input.state, input.district, intelEffect.limit);
    const label = BUILDING_ACTION_MESSAGE_LABELS[input.actionId] ?? "Intel";
    return {
      nextDistrict: input.district,
      defenseAdded: {},
      intelRevealedDistrictIds,
      intelDetectedDefense: intelEffect.detectDefense
        ? Object.fromEntries(
            intelRevealedDistrictIds.map((districtId) => [
              districtId,
              input.state.districtsById[districtId]?.defenseLoadout ?? {}
            ])
          )
        : {},
      messages: intelRevealedDistrictIds.length > 0
        ? intelRevealedDistrictIds.map((districtId) => `${label} revealed activity around ${districtId}.`)
        : [`${label} did not find a useful lead.`]
    };
  }

  return {
    nextDistrict: input.district,
    defenseAdded: {},
    intelRevealedDistrictIds: [],
    intelDetectedDefense: {},
    messages: []
  };
};

const INTEL_EFFECT_BY_ACTION_ID: Record<string, { limit: number; detectDefense: boolean }> = {
  express_import: { limit: 1, detectDefense: false },
  black_charter: { limit: 1, detectDefense: false },
  evacuation_corridor: { limit: 1, detectDefense: false }
};

const BUILDING_ACTION_MESSAGE_LABELS: Record<string, string> = {
  express_import: "Airport import crews",
  black_charter: "Airport charter contacts",
  evacuation_corridor: "Airport evacuation crews"
};

const getIntelDistrictIds = (
  state: CoreGameState,
  district: CoreGameState["districtsById"][string],
  limit: number
): DistrictId[] =>
  district.adjacentDistrictIds
    .filter((districtId) => {
      const candidate = state.districtsById[districtId];
      return Boolean(candidate && candidate.status !== "destroyed");
    })
    .slice(0, limit);
