import { describe, expect, it } from "vitest";
import {
  calculateBaseDefensePower,
  calculateReducedAttackPowerFromTowers,
  calculateSmgComboBonus,
  calculateTotalAttackPower
} from "../../../../packages/game-core/src/rules";
import { freeModeAttackWeaponsConfig } from "../../../../packages/game-config/src/public/free-mode-attack-weapons-config";

describe("combatMath", () => {
  it("adds SMG combo bonus only when all five attack weapons are present", () => {
    expect(
      calculateSmgComboBonus({
        "baseball-bat": 1,
        pistol: 1,
        grenade: 1,
        smg: 3,
        bazooka: 1
      })
    ).toBeCloseTo(0.6);
  });

  it("calculates total attack and district defense power", () => {
    expect(
      calculateTotalAttackPower({
        "baseball-bat": 1,
        pistol: 1,
        grenade: 1,
        smg: 1,
        bazooka: 1
      }, freeModeAttackWeaponsConfig)
    ).toBeCloseTo(77.2);

    expect(
      calculateBaseDefensePower({
        vest: 2,
        barricades: 1,
        cameras: 5,
        "defense-tower": 1,
        alarm: 5
      })
    ).toBe(124);
  });

  it("reduces attacker power with defense towers", () => {
    expect(calculateReducedAttackPowerFromTowers(100, 1)).toBeCloseTo(99.7);
  });
});
