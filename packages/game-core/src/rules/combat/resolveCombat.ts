import type {
  AttackWeaponId,
  DefenseWeaponId
} from "@empire/shared-types";

export type CombatOutcomeTier = "clean_capture" | "costly_capture" | "failed_raid" | "disaster";
export type LegacyBattleResult = "success" | "failure" | "blocked" | "catastrophe";

export interface ResolveCombatInput {
  attackLoadoutAfterTrap: Partial<Record<AttackWeaponId, number>>;
  defenseLoadout: Partial<Record<DefenseWeaponId, number>>;
  trapBlocked: boolean;
  districtDestroyed: boolean;
  effectiveAttackPower: number;
  effectiveDefensePower: number;
  trapLosses: Partial<Record<AttackWeaponId, number>>;
  heatGain: number;
}

export interface ResolveCombatResult {
  outcomeTier: CombatOutcomeTier;
  legacyResult: LegacyBattleResult;
  attackerLosses: Partial<Record<AttackWeaponId, number>>;
  defenderLosses: Partial<Record<DefenseWeaponId, number>>;
  nextAttackerLoadout: Partial<Record<AttackWeaponId, number>>;
  nextDefenseLoadout: Partial<Record<DefenseWeaponId, number>>;
  districtCaptured: boolean;
  districtDamaged: boolean;
  heatGained: number;
  reportForAttacker: string;
  reportForDefender: string;
}

const ATTACK_LOSS_ORDER: AttackWeaponId[] = [
  "baseball-bat",
  "pistol",
  "smg",
  "grenade",
  "bazooka"
];

const DEFENSE_LOSS_ORDER: DefenseWeaponId[] = [
  "alarm",
  "cameras",
  "barricades",
  "vest",
  "defense-tower"
];

/**
 * Responsibility: Pure authoritative combat result tiering and loadout loss math.
 * Belongs here: server-side outcome classification safe to test without UI.
 * Does not belong here: district ownership mutation or report persistence.
 */
export const resolveCombat = (input: ResolveCombatInput): ResolveCombatResult => {
  const outcomeTier = resolveOutcomeTier(input);
  const extraAttackerLosses = getExtraAttackerLosses(outcomeTier, input.attackLoadoutAfterTrap);
  const attackerLosses = mergeLosses(input.trapLosses, extraAttackerLosses);
  const defenderLosses = getDefenderLosses(outcomeTier, input.defenseLoadout);
  const districtCaptured = outcomeTier === "clean_capture" || outcomeTier === "costly_capture";
  const districtDamaged = outcomeTier === "costly_capture" || outcomeTier === "disaster";

  return {
    outcomeTier,
    legacyResult: toLegacyBattleResult(outcomeTier, input.trapBlocked, input.districtDestroyed),
    attackerLosses,
    defenderLosses,
    nextAttackerLoadout: applyLosses(input.attackLoadoutAfterTrap, extraAttackerLosses, ATTACK_LOSS_ORDER),
    nextDefenseLoadout: applyLosses(input.defenseLoadout, defenderLosses, DEFENSE_LOSS_ORDER),
    districtCaptured,
    districtDamaged,
    heatGained: Math.max(0, Math.floor(input.heatGain)),
    reportForAttacker: createAttackerReport(outcomeTier),
    reportForDefender: createDefenderReport(outcomeTier)
  };
};

const resolveOutcomeTier = (input: ResolveCombatInput): CombatOutcomeTier => {
  if (input.trapBlocked || input.districtDestroyed) {
    return "disaster";
  }

  if (input.effectiveAttackPower > input.effectiveDefensePower * 1.5) {
    return "clean_capture";
  }

  if (input.effectiveAttackPower > input.effectiveDefensePower) {
    return "costly_capture";
  }

  return "failed_raid";
};

const toLegacyBattleResult = (
  outcomeTier: CombatOutcomeTier,
  trapBlocked: boolean,
  districtDestroyed: boolean
): LegacyBattleResult => {
  if (trapBlocked) {
    return "blocked";
  }

  if (districtDestroyed || outcomeTier === "disaster") {
    return "catastrophe";
  }

  return outcomeTier === "clean_capture" || outcomeTier === "costly_capture"
    ? "success"
    : "failure";
};

const getExtraAttackerLosses = (
  outcomeTier: CombatOutcomeTier,
  loadout: Partial<Record<AttackWeaponId, number>>
): Partial<Record<AttackWeaponId, number>> => {
  if (outcomeTier === "clean_capture") {
    return {};
  }

  const lossCount = outcomeTier === "costly_capture" ? 1 : outcomeTier === "failed_raid" ? 2 : 3;
  return takeLosses(loadout, ATTACK_LOSS_ORDER, lossCount);
};

const getDefenderLosses = (
  outcomeTier: CombatOutcomeTier,
  loadout: Partial<Record<DefenseWeaponId, number>>
): Partial<Record<DefenseWeaponId, number>> => {
  if (outcomeTier === "failed_raid") {
    return takeLosses(loadout, DEFENSE_LOSS_ORDER, 1);
  }

  if (outcomeTier === "clean_capture") {
    return takeLosses(loadout, DEFENSE_LOSS_ORDER, 2);
  }

  if (outcomeTier === "costly_capture") {
    return takeLosses(loadout, DEFENSE_LOSS_ORDER, 3);
  }

  return takeLosses(loadout, DEFENSE_LOSS_ORDER, 4);
};

const takeLosses = <TKey extends string>(
  loadout: Partial<Record<TKey, number>>,
  order: TKey[],
  lossCount: number
): Partial<Record<TKey, number>> => {
  let remainingLosses = Math.max(0, Math.floor(lossCount));
  const losses: Partial<Record<TKey, number>> = {};

  for (const key of order) {
    const available = Math.max(0, Number(loadout[key] ?? 0));
    const loss = Math.min(available, remainingLosses);

    if (loss > 0) {
      losses[key] = loss;
      remainingLosses -= loss;
    }

    if (remainingLosses <= 0) {
      break;
    }
  }

  return losses;
};

const mergeLosses = <TKey extends string>(
  left: Partial<Record<TKey, number>>,
  right: Partial<Record<TKey, number>>
): Partial<Record<TKey, number>> => {
  const merged: Partial<Record<TKey, number>> = { ...left };

  for (const [key, value] of Object.entries(right) as Array<[TKey, number]>) {
    merged[key] = Math.max(0, Number(merged[key] ?? 0) + Number(value ?? 0));
  }

  return merged;
};

const applyLosses = <TKey extends string>(
  loadout: Partial<Record<TKey, number>>,
  losses: Partial<Record<TKey, number>>,
  order: TKey[]
): Partial<Record<TKey, number>> => {
  const nextLoadout = { ...loadout };

  for (const key of order) {
    const nextAmount = Math.max(0, Number(nextLoadout[key] ?? 0) - Number(losses[key] ?? 0));

    if (nextAmount > 0) {
      nextLoadout[key] = nextAmount;
    } else if (key in nextLoadout || Number(losses[key] ?? 0) > 0) {
      nextLoadout[key] = 0;
    } else {
      delete nextLoadout[key];
    }
  }

  return nextLoadout;
};

const createAttackerReport = (outcomeTier: CombatOutcomeTier): string => {
  switch (outcomeTier) {
    case "clean_capture":
      return "Attack resolved as a clean capture.";
    case "costly_capture":
      return "Attack captured the district, but losses were sustained.";
    case "failed_raid":
      return "Attack failed and the target district held.";
    case "disaster":
      return "Attack collapsed into a disaster.";
  }
};

const createDefenderReport = (outcomeTier: CombatOutcomeTier): string => {
  switch (outcomeTier) {
    case "clean_capture":
      return "Defense was overrun and the district was captured.";
    case "costly_capture":
      return "Defense inflicted losses but the district was captured.";
    case "failed_raid":
      return "Defense held and repelled the raid.";
    case "disaster":
      return "The attack triggered severe damage before ending.";
  }
};
