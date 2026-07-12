import type { AttackWeaponId } from "@empire/shared-types";

export interface AttackWeaponBalanceConfig {
  label: string;
  description: string;
  baseAttackPower: number;
  populationRequired: number;
}

export type AttackWeaponsBalanceConfig = Record<AttackWeaponId, AttackWeaponBalanceConfig>;
