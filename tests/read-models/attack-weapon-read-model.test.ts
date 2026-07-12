import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "../../packages/game-config/src";
import { createPlayerView } from "../../packages/game-core/src/projections";
import { createCombatStateFixture } from "../fixtures/game-state-fixtures";

describe("attack weapon read model", () => {
  it("projects canonical weapon values and authoritative inventory for the attack UI", () => {
    const state = createCombatStateFixture();
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        ...state.resourceStatesById["resource:1"].balances,
        pistol: 2,
        smg: 1,
        bazooka: 1
      }
    };

    const view = createPlayerView(state, "player:1", { config: resolveModeConfig("free") });

    expect(view.attackWeapons).toMatchObject({
      availablePopulation: 100,
      weapons: expect.arrayContaining([
        expect.objectContaining({ resourceKey: "pistol", baseAttackPower: 10, populationRequired: 1, availableAmount: 2 }),
        expect.objectContaining({ resourceKey: "smg", baseAttackPower: 18, populationRequired: 2, availableAmount: 1 }),
        expect.objectContaining({ resourceKey: "bazooka", baseAttackPower: 30, populationRequired: 3, availableAmount: 1 })
      ])
    });
  });
});
