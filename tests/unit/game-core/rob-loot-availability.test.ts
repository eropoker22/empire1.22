import { describe, expect, it } from "vitest";
import {
  applyCommand,
  type CoreGameState
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import type { NeutralDistrictLootPool } from "@empire/shared-types";
import { createRobDistrictCommandFixture } from "../../fixtures/command-fixtures";
import { createCombatStateFixture } from "../../fixtures/game-state-fixtures";
import { createDistrictRobTargetViews } from "../../../packages/game-core/src/projections/district-rob-target-projection";

const config = resolveModeConfig("free");
const context = { config };
const timing = {
  dayLengthTicks: config.balance.dayLengthTicks,
  nightLengthTicks: config.balance.nightLengthTicks
};

describe("neutral robbery loot availability", () => {
  it("rejects an exhausted pool before creating a pending operation and disables its read model", () => {
    const state = createNeutralRobState(exhaustedPool());
    const command = createRobDistrictCommandFixture({ id: "command:rob:exhausted-at-start" });

    const result = applyCommand(state, command, context);
    const view = createDistrictRobTargetViews(
      state,
      "player:1",
      "district:1",
      config.balance.conflict,
      command.issuedAt,
      timing
    ).find((target) => target.districtId === "district:2");

    expect(result.errors).toMatchObject([{ code: "TARGET_LOOT_EXHAUSTED" }]);
    expect(result.nextState).toBe(state);
    expect(Object.values(result.nextState.pendingDistrictActionOperationsById ?? {})).toEqual([]);
    expect(view).toMatchObject({
      enabled: false,
      disabledCode: "TARGET_LOOT_EXHAUSTED",
      lootPoolLevel: "exhausted",
      exhausted: true
    });
  });

  it("uses the same city-day regeneration boundary for validation and the read model", () => {
    const state = createNeutralRobState(exhaustedPool());
    const cityDayLength = Number(config.balance.dayLengthTicks ?? 0)
      + Number(config.balance.nightLengthTicks ?? 0);
    state.root.tick = cityDayLength;
    state.serverInstance.currentTick = cityDayLength;
    const command = createRobDistrictCommandFixture({ id: "command:rob:regenerated-at-start" });

    const view = createDistrictRobTargetViews(
      state,
      "player:1",
      "district:1",
      config.balance.conflict,
      command.issuedAt,
      timing
    ).find((target) => target.districtId === "district:2");
    const result = applyCommand(state, command, context);

    expect(view).toMatchObject({
      enabled: true,
      disabledCode: null,
      exhausted: false,
      expectedLootPoolRevision: 2
    });
    expect(result.errors).toEqual([]);
    expect(Object.values(result.nextState.pendingDistrictActionOperationsById ?? {})).toHaveLength(1);
  });
});

const createNeutralRobState = (neutralLootPool: NeutralDistrictLootPool): CoreGameState => {
  const state = createCombatStateFixture();
  state.playersById["player:1"] = { ...state.playersById["player:1"], population: 2 };
  state.districtsById["district:2"] = {
    ...state.districtsById["district:2"],
    ownerPlayerId: null,
    controllerAllianceId: null,
    status: "neutral",
    defenseLoadout: {},
    heat: 0,
    neutralLootPool
  };
  return state;
};

const exhaustedPool = (): NeutralDistrictLootPool => ({
  initialSeed: "exhausted-test-pool",
  initialCash: 5_000,
  initialDirtyCash: 3_000,
  initialResources: {
    chemicals: 4,
    biomass: 4,
    "metal-parts": 4,
    "stim-pack": 0,
    "tech-core": 0,
    "combat-module": 0
  },
  cash: 999,
  dirtyCash: 0,
  resources: {
    chemicals: 1,
    biomass: 0,
    "metal-parts": 0,
    "stim-pack": 0,
    "tech-core": 0,
    "combat-module": 0
  },
  lastRegenerationCityDay: 0,
  version: 1
});
