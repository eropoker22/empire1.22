import {
  ATTACK_WEAPON_IDS,
  type AttackWeaponId,
  type DefenseWeaponId
} from "@empire/shared-types";
import type { AttackWeaponsBalanceConfig } from "../../contracts";
import { calculateAttackWeaponPower } from "./attackWeaponBalance";

/**
 * Responsibility: Houses deterministic combat math helpers.
 * Belongs here: isolated numeric helpers for combat calculations.
 * Does not belong here: state mutation or command routing.
 */
export const calculateCombatDelta = (): number => 0;

const DEFENSE_POWER_BY_WEAPON: Record<DefenseWeaponId, number> = {
  vest: 6,
  barricades: 12,
  cameras: 6,
  "defense-tower": 20,
  alarm: 10
};

export const calculateBaseAttackPower = (
  loadout: Partial<Record<AttackWeaponId, number>>,
  attackWeapons: AttackWeaponsBalanceConfig,
  modifiers: Partial<Record<AttackWeaponId, number>> = {}
): number => calculateAttackWeaponPower(loadout, attackWeapons, modifiers);

export const hasFullAttackWeaponSet = (
  loadout: Partial<Record<AttackWeaponId, number>>
): boolean => ATTACK_WEAPON_IDS.every((weaponId) => (loadout[weaponId] ?? 0) > 0);

export const calculateSmgComboBonus = (
  loadout: Partial<Record<AttackWeaponId, number>>,
  modifiers: Partial<Record<AttackWeaponId, number>> = {}
): number => {
  if (!hasFullAttackWeaponSet(loadout)) {
    return 0;
  }

  return (loadout.smg ?? 0) * 0.2 * Math.max(0, Number(modifiers.smg ?? 1));
};

export const calculateGrenadeDefenseIgnorePercent = (
  grenadeCount: number
): number => Math.max(0, grenadeCount) * 0.3;

export const calculateBazookaTotalDestructionBonusPercent = (
  bazookaCount: number
): number => Math.max(0, bazookaCount) * 0.5;

export const calculateEffectiveDefenseAfterGrenades = (
  defensePercent: number,
  grenadeCount: number
): number => Math.max(0, defensePercent - calculateGrenadeDefenseIgnorePercent(grenadeCount));

export const calculateTotalAttackPower = (
  loadout: Partial<Record<AttackWeaponId, number>>,
  attackWeapons: AttackWeaponsBalanceConfig,
  strengthMultiplier = 1,
  modifiers: Partial<Record<AttackWeaponId, number>> = {}
): number => (calculateBaseAttackPower(loadout, attackWeapons, modifiers) + calculateSmgComboBonus(loadout, modifiers)) * Math.max(0, Number(strengthMultiplier || 1));

export const calculateBaseDefensePower = (
  loadout: Partial<Record<DefenseWeaponId, number>>,
  modifiers: Partial<Record<DefenseWeaponId, number>> = {}
): number =>
  Object.entries(loadout).reduce((totalPower, [weaponId, amount]) => {
    const normalizedAmount = Math.max(0, amount ?? 0);
    const defensePower = DEFENSE_POWER_BY_WEAPON[weaponId as DefenseWeaponId] ?? 0;
    const multiplier = Math.max(0, Number(modifiers[weaponId as DefenseWeaponId] ?? 1));
    return totalPower + normalizedAmount * defensePower * multiplier;
  }, 0);

export const calculateVestPopulationLossReductionPercent = (
  vestCount: number
): number => Math.max(0, vestCount) * 0.5;

export const hasSpyDetectionChance = (cameraCount: number): boolean => cameraCount >= 5;

export const calculateTowerAttackReductionPercent = (
  towerCount: number
): number => Math.max(0, towerCount) * 0.3;

export const hasRobberyFailureChance = (alarmCount: number): boolean => alarmCount >= 5;

export const calculateReducedAttackPowerFromTowers = (
  attackPower: number,
  towerCount: number
): number => {
  const reductionPercent = calculateTowerAttackReductionPercent(towerCount);
  return Math.max(0, attackPower * (1 - reductionPercent / 100));
};
