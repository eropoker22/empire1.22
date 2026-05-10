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
  const defenseAdded = DEFENSE_LOADOUT_BY_ACTION_ID[input.actionId] ?? null;
  if (defenseAdded) {
    const label = BUILDING_ACTION_MESSAGE_LABELS[input.actionId] ?? "Building crews";

    return {
      nextDistrict: {
        ...input.district,
        defenseLoadout: addDefenseLoadout(input.district.defenseLoadout, defenseAdded)
      },
      defenseAdded,
      intelRevealedDistrictIds: [],
      intelDetectedDefense: {},
      messages: [
        `${label} reinforced this district.`,
        "The added defense is now part of attack and spy resolution."
      ]
    };
  }

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

const DEFENSE_LOADOUT_BY_ACTION_ID: Record<string, Partial<Record<DefenseWeaponId, number>>> = {
  armory_fortify: {
    barricades: 2,
    cameras: 1,
    alarm: 1
  },
  court_case_pressure: {
    cameras: 1,
    alarm: 1
  },
  clinic_recovery_boost: {
    vest: 1,
    barricades: 1
  },
  school_discipline: {
    barricades: 1,
    cameras: 1
  },
  garage_escape_routes: {
    alarm: 1
  },
  warehouse_hidden_storage: {
    barricades: 1,
    cameras: 1
  }
};

const INTEL_EFFECT_BY_ACTION_ID: Record<string, { limit: number; detectDefense: boolean }> = {
  restaurant_street_gossip: { limit: 2, detectDefense: false },
  lobby_club_backroom_deal: { limit: 1, detectDefense: false },
  express_import: { limit: 1, detectDefense: false },
  black_charter: { limit: 1, detectDefense: false },
  evacuation_corridor: { limit: 1, detectDefense: false },
  convenience_street_info: { limit: 2, detectDefense: false },
  strip_club_compromise: { limit: 1, detectDefense: false },
};

const BUILDING_ACTION_MESSAGE_LABELS: Record<string, string> = {
  armory_fortify: "Armory crews",
  court_case_pressure: "Court pressure",
  clinic_recovery_boost: "Clinic recovery teams",
  school_discipline: "School discipline crews",
  garage_escape_routes: "Garage route crews",
  warehouse_hidden_storage: "Warehouse crews",
  restaurant_street_gossip: "Street gossip",
  lobby_club_backroom_deal: "Lobby contacts",
  express_import: "Airport import crews",
  black_charter: "Airport charter contacts",
  evacuation_corridor: "Airport evacuation crews",
  convenience_street_info: "Store gossip",
  strip_club_compromise: "Compromat",
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
