import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, runTick } from "../../../packages/game-core/src/engine";
import { createCraftItemCommandFixture } from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const context = {
  config: resolveModeConfig("free")
};
const TICKS_PER_MINUTE = Math.ceil(60_000 / context.config.tickRateMs);

describe("craft-item command flow", () => {
  it("starts a processing job, reserves inputs, and credits output on a later server tick", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { "metal-parts": 4 }
    });
    const buildingId = building.id;
    const crafted = applyCommand(
      state,
      createCraftItemCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId,
          recipeId: "tech-core"
        }
      }),
      context
    );

    expect(crafted.errors).toEqual([]);
    expect(crafted.nextState.resourceStatesById["resource:1"]?.balances["metal-parts"]).toBe(0);
    expect(crafted.nextState.resourceStatesById["resource:1"]?.balances["tech-core"]).toBeUndefined();
    expect(crafted.nextState.buildingsById[buildingId]?.processing).toEqual({
      recipeId: "tech-core",
      startedAtTick: 0,
      completesAtTick: 6 * TICKS_PER_MINUTE
    });
    expect(crafted.events).toHaveLength(1);
    expect(crafted.events[0]?.type).toBe("item-processing-started");
    expect(crafted.events[0]?.payload).toMatchObject({
      buildingId,
      completesAtTick: 6 * TICKS_PER_MINUTE,
      districtId: "district:1",
      playerId: "player:1",
      recipeId: "tech-core"
    });

    const afterOneTick = runTick(crafted.nextState, context);

    expect(afterOneTick.nextState.buildingsById[buildingId]?.processing?.recipeId).toBe("tech-core");
    expect(afterOneTick.nextState.resourceStatesById["resource:1"]?.balances["tech-core"]).toBeUndefined();
    expect(afterOneTick.events.some((event) => event.type === "item-crafted")).toBe(false);

    let completionTick = afterOneTick;
    for (let index = 1; index < 6 * TICKS_PER_MINUTE; index += 1) {
      completionTick = runTick(completionTick.nextState, context);
    }

    expect(completionTick.nextState.buildingsById[buildingId]?.processing).toBeNull();
    expect(completionTick.nextState.resourceStatesById["resource:1"]?.balances["tech-core"]).toBe(1);
    const processingNotifications = completionTick.nextState.root.notificationIds
      .map((notificationId) => completionTick.nextState.notificationsById[notificationId])
      .filter((notification) => notification?.category === "processing.completed");
    expect(processingNotifications).toHaveLength(1);
    expect(processingNotifications[0]?.recipientId).toBe("player:1");
    expect(completionTick.events).toHaveLength(2);
    expect(completionTick.events[0]?.type).toBe("item-crafted");
    expect(completionTick.events[1]?.type).toBe("notification-created");
  });

  it.each([
    ["factory", "combat-module", { "metal-parts": 10, "tech-core": 3 }, "combat-module", 1, 12],
    ["drug_lab", "ghost-serum", { chemicals: 4, biomass: 2, "stim-pack": 2 }, "ghost-serum", 1, 20],
    ["armory", "pistol", { "metal-parts": 6, "tech-core": 2 }, "pistol", 2, 5],
    ["armory", "bazooka", { "metal-parts": 10, "tech-core": 4 }, "bazooka", 1, 14],
    ["armory", "defense-tower", { "metal-parts": 10, "tech-core": 4 }, "defense-tower", 1, 16]
  ])("processes %s recipe %s through fixed building craft slots", (
    buildingTypeId,
    recipeId,
    playerBalances,
    outputResourceKey,
    outputAmount,
    expectedMinutes
  ) => {
    const { state, building } = createCoreStateWithFixedBuildingFixture(buildingTypeId, {
      playerBalances
    });
    const buildingId = building.id;
    const crafted = applyCommand(
      state,
      createCraftItemCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId,
          recipeId
        }
      }),
      context
    );

    expect(crafted.errors).toEqual([]);
    expect(crafted.nextState.buildingsById[buildingId]?.processing).toMatchObject({
      recipeId,
      startedAtTick: 0,
      completesAtTick: expectedMinutes * TICKS_PER_MINUTE
    });

    let nextState = crafted.nextState;
    for (let index = 0; index < expectedMinutes * TICKS_PER_MINUTE; index += 1) {
      nextState = runTick(nextState, context).nextState;
    }

    expect(nextState.buildingsById[buildingId]?.processing).toBeNull();
    expect(nextState.resourceStatesById["resource:1"]?.balances[outputResourceKey]).toBe(outputAmount);
  });

  it.each([
    ["drug_lab", "pulse-shot", { chemicals: 1, biomass: 0 }],
    ["factory", "tech-core", { "metal-parts": 3 }],
    ["armory", "pistol", { "metal-parts": 2, "tech-core": 0 }]
  ])("rejects %s recipe %s without required inputs", (
    buildingTypeId,
    recipeId,
    playerBalances
  ) => {
    const { state, building } = createCoreStateWithFixedBuildingFixture(buildingTypeId, {
      playerBalances
    });

    const crafted = applyCommand(
      state,
      createCraftItemCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          recipeId
        }
      }),
      context
    );

    expect(crafted.nextState).toBe(state);
    expect(crafted.events).toEqual([]);
    expect(crafted.errors.map((error) => error.code)).toContain("craft_missing_inputs");
  });

  it("does not credit a completed craft job twice after processing is cleared", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: {
        "metal-parts": 10
      }
    });
    const crafted = applyCommand(
      state,
      createCraftItemCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          recipeId: "tech-core"
        }
      }),
      context
    );

    expect(crafted.errors).toEqual([]);

    let nextState = crafted.nextState;
    for (let index = 0; index < 6 * TICKS_PER_MINUTE; index += 1) {
      nextState = runTick(nextState, context).nextState;
    }

    expect(nextState.buildingsById[building.id]?.processing).toBeNull();
    expect(nextState.resourceStatesById["resource:1"]?.balances["tech-core"]).toBe(1);

    const repeatedTick = runTick(nextState, context);

    expect(repeatedTick.events.filter((event) => event.type === "item-crafted")).toEqual([]);
    expect(repeatedTick.nextState.resourceStatesById["resource:1"]?.balances["tech-core"]).toBe(1);
  });
});
