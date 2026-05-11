import type { AttackWeaponId } from "@empire/shared-types";

export const resolveAttackEscapeMitigation = (input: {
  losses: Partial<Record<AttackWeaponId, number>>;
  nextLoadout: Partial<Record<AttackWeaponId, number>>;
  heatGained: number;
  enabled: boolean;
  bonusPct: number;
  equipmentLossReductionPct?: number;
  roll: number;
}): {
  losses: Partial<Record<AttackWeaponId, number>>;
  nextLoadout: Partial<Record<AttackWeaponId, number>>;
  heatGained: number;
  mitigated: boolean;
} => {
  const chance = Math.max(0, Math.min(0.95, Number(input.bonusPct || 0) / 100));
  if (!input.enabled || chance <= 0 || input.roll > chance) {
    const reducedByCorridor = applyFlatEquipmentLossReduction(input.losses, input.nextLoadout, input.equipmentLossReductionPct ?? 0);
    if (reducedByCorridor.changed) {
      return {
        losses: reducedByCorridor.losses,
        nextLoadout: reducedByCorridor.nextLoadout,
        heatGained: input.heatGained,
        mitigated: false
      };
    }
    return {
      losses: input.losses,
      nextLoadout: input.nextLoadout,
      heatGained: input.heatGained,
      mitigated: false
    };
  }

  const reducedLosses = { ...input.losses };
  const restoredWeaponId = (Object.keys(reducedLosses) as AttackWeaponId[]).find((weaponId) =>
    Math.max(0, Number(reducedLosses[weaponId] ?? 0)) > 0
  );
  if (!restoredWeaponId) {
    return {
      losses: input.losses,
      nextLoadout: input.nextLoadout,
      heatGained: Math.max(0, input.heatGained - 1),
      mitigated: true
    };
  }

  reducedLosses[restoredWeaponId] = Math.max(0, Number(reducedLosses[restoredWeaponId] ?? 0) - 1);
  if (reducedLosses[restoredWeaponId] === 0) {
    delete reducedLosses[restoredWeaponId];
  }

  return {
    losses: reducedLosses,
    nextLoadout: {
      ...input.nextLoadout,
      [restoredWeaponId]: Math.max(0, Number(input.nextLoadout[restoredWeaponId] ?? 0)) + 1
    },
    heatGained: Math.max(0, input.heatGained - 1),
    mitigated: true
  };
};

const applyFlatEquipmentLossReduction = (
  losses: Partial<Record<AttackWeaponId, number>>,
  nextLoadout: Partial<Record<AttackWeaponId, number>>,
  reductionPct: number
): { losses: Partial<Record<AttackWeaponId, number>>; nextLoadout: Partial<Record<AttackWeaponId, number>>; changed: boolean } => {
  if (reductionPct <= 0) return { losses, nextLoadout, changed: false };
  const reducedLosses = { ...losses };
  const restoredLoadout = { ...nextLoadout };
  let changed = false;
  for (const weaponId of Object.keys(reducedLosses) as AttackWeaponId[]) {
    const amount = Math.max(0, Number(reducedLosses[weaponId] ?? 0));
    const restored = Math.floor(amount * reductionPct / 100);
    if (restored <= 0) continue;
    const nextAmount = Math.max(0, amount - restored);
    if (nextAmount > 0) {
      reducedLosses[weaponId] = nextAmount;
    } else {
      delete reducedLosses[weaponId];
    }
    restoredLoadout[weaponId] = Math.max(0, Number(restoredLoadout[weaponId] ?? 0)) + restored;
    changed = true;
  }
  return { losses: reducedLosses, nextLoadout: restoredLoadout, changed };
};
