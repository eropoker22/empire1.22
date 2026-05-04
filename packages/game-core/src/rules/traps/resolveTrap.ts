import type { AttackWeaponId } from "@empire/shared-types";

export interface ResolveTrapInput {
  attackLoadout: Partial<Record<AttackWeaponId, number>>;
  trapAttackLosses: number;
}

export interface ResolveTrapResult {
  losses: Partial<Record<AttackWeaponId, number>>;
  nextLoadout: Partial<Record<AttackWeaponId, number>>;
  blocked: boolean;
  trapType: "toxic";
  report: string;
}

const LOSS_ORDER: AttackWeaponId[] = [
  "baseball-bat",
  "pistol",
  "smg",
  "grenade",
  "bazooka"
];

/**
 * Responsibility: Pure deterministic trap loss resolution.
 * Belongs here: translating one triggered trap into attacker loadout losses.
 * Does not belong here: trap state persistence or UI messaging.
 */
export const resolveTrap = (input: ResolveTrapInput): ResolveTrapResult => {
  let remainingLosses = Math.max(0, input.trapAttackLosses);
  const nextLoadout = { ...input.attackLoadout };
  const losses: Partial<Record<AttackWeaponId, number>> = {};

  for (const weaponId of LOSS_ORDER) {
    while (remainingLosses > 0 && Math.max(0, Number(nextLoadout[weaponId] ?? 0)) > 0) {
      nextLoadout[weaponId] = Math.max(0, Number(nextLoadout[weaponId] ?? 0) - 1);
      losses[weaponId] = Math.max(0, Number(losses[weaponId] ?? 0) + 1);
      remainingLosses -= 1;
    }
  }

  return {
    losses,
    nextLoadout,
    blocked: LOSS_ORDER.every((weaponId) => Math.max(0, Number(nextLoadout[weaponId] ?? 0)) === 0),
    trapType: "toxic",
    report: "Toxic trap triggered and burned through the attacking loadout."
  };
};
