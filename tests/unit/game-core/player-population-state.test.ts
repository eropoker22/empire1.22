import { describe, expect, it } from "vitest";
import {
  normalizePlayerPopulationState,
  resolvePlayerPopulation
} from "@empire/game-core";
import { createCoreStateFixture } from "../../fixtures/game-state-fixtures";

describe("canonical player population state", () => {
  it("hydrates a legacy gang-members-only snapshot into population", () => {
    const state = createCoreStateFixture();
    delete state.playersById["player:1"].population;
    state.resourceStatesById["resource:1"].balances = {
      ...state.resourceStatesById["resource:1"].balances,
      "gang-members": 12
    };

    const migrated = normalizePlayerPopulationState(state);

    expect(migrated.playersById["player:1"].population).toBe(12);
    expect(migrated.resourceStatesById["resource:1"].balances).not.toHaveProperty("gang-members");
    expect(migrated.resourceStatesById["resource:1"].balances).not.toHaveProperty("population");
  });

  it("prefers explicit population and never adds a legacy alias", () => {
    const state = createCoreStateFixture();
    state.playersById["player:1"].population = 24;
    state.resourceStatesById["resource:1"].balances = {
      ...state.resourceStatesById["resource:1"].balances,
      population: 24,
      "gang-members": 12,
      gangMembers: 9,
      gang_members: 7
    };

    const migrated = normalizePlayerPopulationState(state);

    expect(resolvePlayerPopulation(migrated, "player:1")).toBe(24);
    expect(migrated.playersById["player:1"].population).toBe(24);
    expect(migrated.resourceStatesById["resource:1"].balances).not.toHaveProperty("population");
    expect(migrated.resourceStatesById["resource:1"].balances).not.toHaveProperty("gang-members");
    expect(migrated.resourceStatesById["resource:1"].balances).not.toHaveProperty("gangMembers");
    expect(migrated.resourceStatesById["resource:1"].balances).not.toHaveProperty("gang_members");
    expect(normalizePlayerPopulationState(migrated)).toBe(migrated);
  });

  it("treats null population as missing while preserving explicit zero", () => {
    const legacyFallbackState = createCoreStateFixture();
    legacyFallbackState.playersById["player:1"].population = null as unknown as number;
    legacyFallbackState.resourceStatesById["resource:1"].balances["gang-members"] = 12;

    expect(resolvePlayerPopulation(legacyFallbackState, "player:1")).toBe(12);
    expect(
      normalizePlayerPopulationState(legacyFallbackState).playersById["player:1"].population
    ).toBe(12);

    const explicitZeroState = createCoreStateFixture();
    explicitZeroState.playersById["player:1"].population = 0;
    explicitZeroState.resourceStatesById["resource:1"].balances["gang-members"] = 12;

    expect(resolvePlayerPopulation(explicitZeroState, "player:1")).toBe(0);
  });
});
