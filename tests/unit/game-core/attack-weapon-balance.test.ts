import { describe, expect, it } from "vitest";
import { freeModeAttackWeaponsConfig } from "../../../packages/game-config/src/public/free-mode-attack-weapons-config";
import {
  calculateAttackPopulationRequired,
  calculateAttackWeaponPower,
  normalizeAttackWeaponLoadout,
  validateAttackWeaponsConfig
} from "../../../packages/game-core/src/rules";

describe("attack weapon balance", () => {
  it("defines the canonical attack power and population requirement for every weapon", () => {
    expect(freeModeAttackWeaponsConfig).toMatchObject({
      "baseball-bat": { baseAttackPower: 5, populationRequired: 1 },
      pistol: { baseAttackPower: 10, populationRequired: 1 },
      grenade: { baseAttackPower: 14, populationRequired: 1 },
      smg: { baseAttackPower: 18, populationRequired: 2 },
      bazooka: { baseAttackPower: 30, populationRequired: 3 }
    });
    expect(() => validateAttackWeaponsConfig(freeModeAttackWeaponsConfig)).not.toThrow();
  });

  it("calculates individual and mixed weapon loadouts from canonical values", () => {
    expect(calculateAttackWeaponPower({ "baseball-bat": 3 }, freeModeAttackWeaponsConfig)).toBe(15);
    expect(calculateAttackPopulationRequired({ "baseball-bat": 3 }, freeModeAttackWeaponsConfig)).toBe(3);
    expect(calculateAttackWeaponPower({ pistol: 3 }, freeModeAttackWeaponsConfig)).toBe(30);
    expect(calculateAttackPopulationRequired({ pistol: 3 }, freeModeAttackWeaponsConfig)).toBe(3);
    expect(calculateAttackWeaponPower({ grenade: 3 }, freeModeAttackWeaponsConfig)).toBe(42);
    expect(calculateAttackPopulationRequired({ grenade: 3 }, freeModeAttackWeaponsConfig)).toBe(3);
    expect(calculateAttackWeaponPower({ smg: 3 }, freeModeAttackWeaponsConfig)).toBe(54);
    expect(calculateAttackPopulationRequired({ smg: 3 }, freeModeAttackWeaponsConfig)).toBe(6);
    expect(calculateAttackWeaponPower({ bazooka: 3 }, freeModeAttackWeaponsConfig)).toBe(90);
    expect(calculateAttackPopulationRequired({ bazooka: 3 }, freeModeAttackWeaponsConfig)).toBe(9);

    const loadout = { pistol: 2, grenade: 1, smg: 1, bazooka: 1 };
    expect(calculateAttackWeaponPower(loadout, freeModeAttackWeaponsConfig)).toBe(82);
    expect(calculateAttackPopulationRequired(loadout, freeModeAttackWeaponsConfig)).toBe(8);
  });

  it("rejects unknown and non-integer weapon quantities without a fallback", () => {
    expect(normalizeAttackWeaponLoadout({ railgun: 1 }).errorCode).toBe("attack_unknown_weapon");
    expect(normalizeAttackWeaponLoadout({ pistol: 1.5 }).errorCode).toBe("attack_invalid_weapon_quantity");
    expect(normalizeAttackWeaponLoadout({ pistol: -1 }).errorCode).toBe("attack_invalid_weapon_quantity");
  });
});
