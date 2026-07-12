import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, runTick } from "../../../packages/game-core/src/engine";
import { createCollectProductionCommandFixture, createCraftItemCommandFixture } from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };

const completeTicks = (
  state: ReturnType<typeof createCoreStateWithFixedBuildingFixture>["state"],
  count: number
) => {
  let next = state;
  for (let index = 0; index < count; index += 1) next = runTick(next, context).nextState;
  return next;
};

const craft = (buildingId: string, recipeId: string, quantity = 1) => createCraftItemCommandFixture({
  payload: { districtId: "district:1", buildingId, recipeId, quantity }
});

describe("craft-item command flow", () => {
  it("routes Factory craft intents through an authoritative line and keeps completed output local until collect", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 900, "metal-parts": 4 }
    });
    const started = applyCommand(state, craft(building.id, "tech-core"), context);
    const duration = Math.ceil(context.config.balance.factory!.recipes["tech-core"].durationTicksPerUnit * context.config.balance.cooldownMultiplier);

    expect(started.errors).toEqual([]);
    expect(started.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({ cash: 0, "metal-parts": 0 });
    expect(started.nextState.buildingsById[building.id]?.productionLines?.["tech-core"]).toMatchObject({ queuedAmount: 1, activeStartedAtTick: 0 });

    const completed = completeTicks(started.nextState, duration);
    expect(completed.resourceStatesById["resource:" + building.id]?.balances["tech-core"]).toBe(1);
    expect(completed.resourceStatesById["resource:1"]?.balances["tech-core"]).toBeUndefined();

    const collected = applyCommand(completed, createCollectProductionCommandFixture({
      payload: { districtId: "district:1", buildingId: building.id, resourceKey: "tech-core" }
    }), context);
    expect(collected.errors).toEqual([]);
    expect(collected.nextState.resourceStatesById["resource:1"]?.balances["tech-core"]).toBe(1);
  });

  it.each([
    ["armory", "pistol", { "metal-parts": 3, "tech-core": 1 }, "pistol"],
    ["armory", "bazooka", { "metal-parts": 3, "combat-module": 2 }, "bazooka"],
    ["armory", "defense-tower", { "tech-core": 3, "combat-module": 2 }, "defense-tower"]
  ])("routes %s recipe %s to an independent local production line", (
    buildingTypeId,
    recipeId,
    playerBalances,
    outputResourceKey
  ) => {
    const { state, building } = createCoreStateWithFixedBuildingFixture(buildingTypeId, { playerBalances });
    const started = applyCommand(state, craft(building.id, recipeId), context);
    const recipes = context.config.balance.armory!.recipes;
    const duration = Math.ceil(recipes[recipeId as keyof typeof recipes].durationTicksPerUnit * context.config.balance.cooldownMultiplier);
    const completed = completeTicks(started.nextState, duration);

    expect(started.errors).toEqual([]);
    expect(started.nextState.buildingsById[building.id]?.processing).toBeNull();
    expect(started.nextState.buildingsById[building.id]?.productionLines?.[recipeId]).toMatchObject({ queuedAmount: 1 });
    expect(completed.resourceStatesById["resource:" + building.id]?.balances[outputResourceKey]).toBe(1);
    expect(completed.resourceStatesById["resource:1"]?.balances[outputResourceKey]).toBeUndefined();
  });

  it.each([
    ["factory", "tech-core", { cash: 900, "metal-parts": 3 }, "factory_missing_inputs"],
    ["armory", "pistol", { "metal-parts": 2, "tech-core": 0 }, "armory_missing_inputs"]
  ])("rejects %s recipe %s atomically when an input is missing", (
    buildingTypeId,
    recipeId,
    playerBalances,
    errorCode
  ) => {
    const { state, building } = createCoreStateWithFixedBuildingFixture(buildingTypeId, { playerBalances });
    const rejected = applyCommand(state, craft(building.id, recipeId), context);
    expect(rejected.nextState).toBe(state);
    expect(rejected.events).toEqual([]);
    expect(rejected.errors.map((error) => error.code)).toContain(errorCode);
  });

  it("does not complete the same Armory line twice after its queue is consumed", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("armory", {
      playerBalances: { "metal-parts": 2 }
    });
    const started = applyCommand(state, craft(building.id, "baseball-bat"), context);
    const duration = Math.ceil(context.config.balance.armory!.recipes["baseball-bat"].durationTicksPerUnit * context.config.balance.cooldownMultiplier);
    const completed = completeTicks(started.nextState, duration);
    const repeated = runTick(completed, context).nextState;

    expect(completed.resourceStatesById["resource:" + building.id]?.balances["baseball-bat"]).toBe(1);
    expect(repeated.resourceStatesById["resource:" + building.id]?.balances["baseball-bat"]).toBe(1);
    expect(repeated.buildingsById[building.id]?.productionLines?.["baseball-bat"]?.queuedAmount).toBe(0);
  });
});
