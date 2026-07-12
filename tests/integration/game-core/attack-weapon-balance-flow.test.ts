import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "../../../packages/game-config/src";
import { applyCommand } from "../../../packages/game-core/src/engine";
import { createAttackDistrictCommandFixture } from "../../fixtures/command-fixtures";
import { createCombatStateFixture } from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };
const loadout = { pistol: 2, grenade: 1, smg: 1, bazooka: 1 };

const createWeaponState = (population: number) => {
  const state = createCombatStateFixture();
  state.playersById["player:1"] = {
    ...state.playersById["player:1"],
    population
  };
  state.resourceStatesById["resource:1"] = {
    ...state.resourceStatesById["resource:1"],
    balances: {
      ...state.resourceStatesById["resource:1"].balances,
      population,
      "baseball-bat": 0,
      pistol: 2,
      grenade: 1,
      smg: 1,
      bazooka: 1
    }
  };
  return state;
};

describe("authoritative attack weapon flow", () => {
  it("rejects a loadout when the required population is not available without mutating inventory", () => {
    const state = createWeaponState(7);
    const result = applyCommand(state, createAttackDistrictCommandFixture({
      payload: { districtId: "district:2", sourceDistrictId: "district:1", weapons: loadout }
    }), context);

    expect(result.errors).toEqual([expect.objectContaining({ code: "attack_insufficient_population" })]);
    expect(result.nextState).toBe(state);
    expect(state.resourceStatesById["resource:1"].balances).toMatchObject(loadout);
  });

  it("accepts the same loadout with enough population and uses the canonical base power", () => {
    const state = createWeaponState(8);
    const result = applyCommand(state, createAttackDistrictCommandFixture({
      payload: { districtId: "district:2", sourceDistrictId: "district:1", weapons: loadout }
    }), context);
    const payload = result.events.find((event) => event.type === "district-attacked")?.payload as Record<string, unknown>;

    expect(result.errors).toEqual([]);
    expect(payload.attackPower).toBe(82);
    expect(result.nextState.resourceStatesById["resource:1"].balances).toMatchObject({
      "baseball-bat": 0
    });
    for (const [weaponId, amount] of Object.entries(loadout)) {
      expect(Number(result.nextState.resourceStatesById["resource:1"].balances[weaponId] || 0)).toBeLessThanOrEqual(amount);
    }
  });

  it("rejects unavailable weapon amounts and invalid weapon quantities before combat state changes", () => {
    const state = createWeaponState(100);
    const unavailable = applyCommand(state, createAttackDistrictCommandFixture({
      payload: { districtId: "district:2", sourceDistrictId: "district:1", weapons: { pistol: 3 } }
    }), context);
    const invalid = applyCommand(state, createAttackDistrictCommandFixture({
      payload: { districtId: "district:2", sourceDistrictId: "district:1", weapons: { pistol: -1 } }
    }), context);

    expect(unavailable.errors).toEqual([expect.objectContaining({ code: "attack_insufficient_weapon_inventory" })]);
    expect(invalid.errors).toEqual([expect.objectContaining({ code: "attack_invalid_weapon_quantity" })]);
    expect(unavailable.nextState).toBe(state);
    expect(invalid.nextState).toBe(state);
  });
});
