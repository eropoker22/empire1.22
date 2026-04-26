import {
  ATTACK_WEAPON_IDS,
  type AttackWeaponId,
  type DefenseWeaponId
} from "@empire/shared-types";

/**
 * Responsibility: Houses deterministic combat math helpers.
 * Belongs here: isolated numeric helpers for combat calculations.
 * Does not belong here: state mutation or command routing.
 */
export const calculateCombatDelta = (): number => 0;

const ATTACK_POWER_BY_WEAPON: Record<AttackWeaponId, number> = {
  "baseball-bat": 5,
  pistol: 10,
  grenade: 14,
  smg: 18,
  bazooka: 30
};

const DEFENSE_POWER_BY_WEAPON: Record<DefenseWeaponId, number> = {
  vest: 6,
  barricades: 12,
  cameras: 6,
  "defense-tower": 20,
  alarm: 10
};

export const calculateBaseAttackPower = (
  loadout: Partial<Record<AttackWeaponId, number>>
): number =>
  Object.entries(loadout).reduce((totalPower, [weaponId, amount]) => {
    const normalizedAmount = Math.max(0, amount ?? 0);
    const attackPower = ATTACK_POWER_BY_WEAPON[weaponId as AttackWeaponId] ?? 0;
    return totalPower + normalizedAmount * attackPower;
  }, 0);

export const hasFullAttackWeaponSet = (
  loadout: Partial<Record<AttackWeaponId, number>>
): boolean => ATTACK_WEAPON_IDS.every((weaponId) => (loadout[weaponId] ?? 0) > 0);

export const calculateSmgComboBonus = (
  loadout: Partial<Record<AttackWeaponId, number>>
): number => {
  if (!hasFullAttackWeaponSet(loadout)) {
    return 0;
  }

  return (loadout.smg ?? 0) * 0.2;
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
  loadout: Partial<Record<AttackWeaponId, number>>
): number => calculateBaseAttackPower(loadout) + calculateSmgComboBonus(loadout);

export const calculateBaseDefensePower = (
  loadout: Partial<Record<DefenseWeaponId, number>>
): number =>
  Object.entries(loadout).reduce((totalPower, [weaponId, amount]) => {
    const normalizedAmount = Math.max(0, amount ?? 0);
    const defensePower = DEFENSE_POWER_BY_WEAPON[weaponId as DefenseWeaponId] ?? 0;
    return totalPower + normalizedAmount * defensePower;
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
