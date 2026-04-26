import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, runTick } from "../../../packages/game-core/src/engine";
import {
  createCollectProductionCommandFixture,
  createCraftItemCommandFixture
} from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

describe("craft-item command flow", () => {
  it("starts a processing job, reserves inputs, and credits output on a later server tick", () => {
    const context = {
      config: resolveModeConfig("free")
    };
    const { state, building } = createCoreStateWithFixedBuildingFixture("pharmacy", {
      productionResourceKey: "chemicals"
    });
    const buildingId = building.id;
    const collectedState = applyCommand(
      runTick(runTick(state, context).nextState, context).nextState,
      createCollectProductionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId
        }
      }),
      context
    );

    expect(collectedState.nextState.resourceStatesById["resource:1"]?.balances.chemicals).toBe(12);

    const crafted = applyCommand(
      collectedState.nextState,
      createCraftItemCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId,
          recipeId: "stim-pack"
        }
      }),
      context
    );

    expect(crafted.errors).toEqual([]);
    expect(crafted.nextState.resourceStatesById["resource:1"]?.balances.chemicals).toBe(6);
    expect(crafted.nextState.resourceStatesById["resource:1"]?.balances["stim-pack"]).toBeUndefined();
    expect(crafted.nextState.buildingsById[buildingId]?.processing).toEqual({
      recipeId: "stim-pack",
      startedAtTick: 2,
      completesAtTick: 4
    });
    expect(crafted.events).toHaveLength(1);
    expect(crafted.events[0]?.type).toBe("item-processing-started");

    const afterOneTick = runTick(crafted.nextState, context);

    expect(afterOneTick.nextState.buildingsById[buildingId]?.processing?.recipeId).toBe("stim-pack");
    expect(afterOneTick.nextState.resourceStatesById["resource:1"]?.balances["stim-pack"]).toBeUndefined();
    expect(afterOneTick.events).toEqual([]);

    const afterSecondTick = runTick(afterOneTick.nextState, context);

    expect(afterSecondTick.nextState.buildingsById[buildingId]?.processing).toBeNull();
    expect(afterSecondTick.nextState.resourceStatesById["resource:1"]?.balances["stim-pack"]).toBe(1);
    expect(afterSecondTick.nextState.root.notificationIds).toHaveLength(1);
    expect(afterSecondTick.nextState.notificationsById[afterSecondTick.nextState.root.notificationIds[0]]?.category).toBe("processing.completed");
    expect(afterSecondTick.nextState.notificationsById[afterSecondTick.nextState.root.notificationIds[0]]?.recipientId).toBe("player:1");
    expect(afterSecondTick.events).toHaveLength(2);
    expect(afterSecondTick.events[0]?.type).toBe("item-crafted");
    expect(afterSecondTick.events[1]?.type).toBe("notification-created");
  });

  it.each([
    ["factory", "combat-module", { "metal-parts": 10, "tech-core": 3 }, "combat-module", 1],
    ["drug_lab", "ghost-serum", { chemicals: 4, biomass: 2, "stim-pack": 2 }, "ghost-serum", 1],
    ["armory", "pistol", { "metal-parts": 6, "tech-core": 2 }, "pistol", 2]
  ])("processes %s recipe %s through fixed building craft slots", (
    buildingTypeId,
    recipeId,
    playerBalances,
    outputResourceKey,
    outputAmount
  ) => {
    const context = {
      config: resolveModeConfig("free")
    };
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
    expect(crafted.nextState.buildingsById[buildingId]?.processing?.recipeId).toBe(recipeId);

    let nextState = crafted.nextState;
    for (let index = 0; index < 4; index += 1) {
      nextState = runTick(nextState, context).nextState;
    }

    expect(nextState.buildingsById[buildingId]?.processing).toBeNull();
    expect(nextState.resourceStatesById["resource:1"]?.balances[outputResourceKey]).toBe(outputAmount);
  });
});
