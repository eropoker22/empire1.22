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
  if (input.actionId === "armory_fortify") {
    const defenseAdded = {
      barricades: 2,
      cameras: 1,
      alarm: 1
    } satisfies Partial<Record<DefenseWeaponId, number>>;

    return {
      nextDistrict: {
        ...input.district,
        defenseLoadout: addDefenseLoadout(input.district.defenseLoadout, defenseAdded)
      },
      defenseAdded,
      intelRevealedDistrictIds: [],
      intelDetectedDefense: {},
      messages: [
        "Armory crews reinforced this district with barricades, cameras, and an alarm.",
        "The added defense is now part of attack and spy resolution."
      ]
    };
  }

  if (input.actionId === "data_center_tracking") {
    const intelRevealedDistrictIds = getIntelDistrictIds(input.state, input.district, 3);
    return {
      nextDistrict: input.district,
      defenseAdded: {},
      intelRevealedDistrictIds,
      intelDetectedDefense: Object.fromEntries(
        intelRevealedDistrictIds.map((districtId) => [
          districtId,
          input.state.districtsById[districtId]?.defenseLoadout ?? {}
        ])
      ),
      messages: intelRevealedDistrictIds.length > 0
        ? intelRevealedDistrictIds.map((districtId) => `Data center tracked ${districtId}.`)
        : ["Data center found no adjacent district to track."]
    };
  }

  if (input.actionId === "restaurant_street_gossip") {
    const intelRevealedDistrictIds = getIntelDistrictIds(input.state, input.district, 2);
    return {
      nextDistrict: input.district,
      defenseAdded: {},
      intelRevealedDistrictIds,
      intelDetectedDefense: {},
      messages: intelRevealedDistrictIds.length > 0
        ? intelRevealedDistrictIds.map((districtId) => `Street gossip revealed activity around ${districtId}.`)
        : ["Street gossip did not find a useful lead."]
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

const addDefenseLoadout = (
  currentLoadout: Partial<Record<DefenseWeaponId, number>>,
  addedLoadout: Partial<Record<DefenseWeaponId, number>>
): Partial<Record<DefenseWeaponId, number>> => ({
  ...currentLoadout,
  ...Object.fromEntries(
    Object.entries(addedLoadout).map(([weaponId, amount]) => [
      weaponId,
      Math.max(0, Number(currentLoadout[weaponId as DefenseWeaponId] || 0) + Number(amount || 0))
    ])
  )
});

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
