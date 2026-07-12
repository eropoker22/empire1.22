import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, runTick } from "@empire/game-core";
import type { CoreGameState } from "@empire/game-core";
import type { CancelProductionLineCommand } from "@empire/shared-types";
import { createCollectProductionCommandFixture, createCraftItemCommandFixture } from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture, createFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };

const advance = (state: ReturnType<typeof createCoreStateWithFixedBuildingFixture>["state"], count: number) => {
  let next = state;
  for (let index = 0; index < count; index += 1) next = runTick(next, context).nextState;
  return next;
};

const craft = (buildingId: string, recipeId: string, quantity = 1) => createCraftItemCommandFixture({
  id: "command:chain:" + buildingId + ":" + recipeId + ":" + quantity,
  payload: { districtId: "district:1", buildingId, recipeId, quantity }
});

const collect = (buildingId: string, resourceKey: string) => createCollectProductionCommandFixture({
  id: "command:chain:collect:" + buildingId + ":" + resourceKey,
  payload: { districtId: "district:1", buildingId, resourceKey }
});

describe("authoritative production chain to Armory", () => {
  it("moves a one-piece production chain through local outputs and the global storage into a Pistol", () => {
    const base = createCoreStateWithFixedBuildingFixture("pharmacy", {
      playerBalances: { cash: 10_000 }
    });
    const drugLab = createFixedBuildingFixture("drug_lab", { id: "building:district-1:drug-lab:1" });
    const factory = createFixedBuildingFixture("factory", { id: "building:district-1:factory:1" });
    const armory = createFixedBuildingFixture("armory", { id: "building:district-1:armory:1" });
    let state: CoreGameState = {
      ...base.state,
      buildingsById: {
        ...base.state.buildingsById,
        [drugLab.id]: drugLab,
        [factory.id]: factory,
        [armory.id]: armory
      },
      districtsById: {
        ...base.state.districtsById,
        "district:1": {
          ...base.state.districtsById["district:1"]!,
          buildingIds: [base.building.id, drugLab.id, factory.id, armory.id]
        }
      }
    };

    state = advance(applyCommand(state, craft(base.building.id, "chemicals", 2), context).nextState, 80);
    state = applyCommand(state, collect(base.building.id, "chemicals"), context).nextState;

    state = advance(applyCommand(state, craft(drugLab.id, "neon-dust"), context).nextState, 100);
    state = applyCommand(state, collect(drugLab.id, "neon-dust"), context).nextState;

    state = advance(applyCommand(state, craft(factory.id, "metal-parts", 7), context).nextState, 500);
    state = applyCommand(state, collect(factory.id, "metal-parts"), context).nextState;

    state = advance(applyCommand(state, craft(factory.id, "tech-core"), context).nextState, 150);
    state = applyCommand(state, collect(factory.id, "tech-core"), context).nextState;

    const pistolStart = applyCommand(state, craft(armory.id, "pistol"), context);
    state = advance(pistolStart.nextState, 100);
    const pistolCollect = applyCommand(state, collect(armory.id, "pistol"), context);

    expect(pistolStart.errors).toEqual([]);
    expect(pistolCollect.errors).toEqual([]);
    expect(pistolCollect.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 5780,
      chemicals: 0,
      "neon-dust": 1,
      "metal-parts": 0,
      "tech-core": 0,
      pistol: 1
    });
  });

  it("prevents Factory and Armory from reserving the same Metal Parts twice and refunds only committed reservations", () => {
    const base = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 1800, "metal-parts": 9, "tech-core": 1 }
    });
    const armory = createFixedBuildingFixture("armory", { id: "building:district-1:armory:1" });
    const state = {
      ...base.state,
      buildingsById: { ...base.state.buildingsById, [armory.id]: armory },
      districtsById: {
        ...base.state.districtsById,
        "district:1": {
          ...base.state.districtsById["district:1"]!,
          buildingIds: [base.building.id, armory.id]
        }
      }
    };
    const factoryStart = applyCommand(state, craft(base.building.id, "tech-core", 2), context);
    const armoryStart = applyCommand(factoryStart.nextState, craft(armory.id, "pistol"), context);
    const cancel: CancelProductionLineCommand = {
      id: "command:chain:cancel:factory",
      type: "cancel-production-line",
      mode: "free",
      playerId: "player:1",
      serverInstanceId: "instance:1",
      issuedAt: new Date(0).toISOString(),
      clientRequestId: null,
      payload: { districtId: "district:1", buildingId: base.building.id, recipeId: "tech-core" }
    };

    expect(factoryStart.errors).toEqual([]);
    expect(armoryStart.errors[0]?.code).toBe("armory_missing_inputs");
    expect(armoryStart.nextState.resourceStatesById["resource:1"]?.balances["metal-parts"]).toBe(1);
    const canceled = applyCommand(factoryStart.nextState, cancel, context);
    expect(canceled.errors).toEqual([]);
    expect(canceled.nextState.resourceStatesById["resource:1"]?.balances["metal-parts"]).toBe(5);
    expect(applyCommand(canceled.nextState, cancel, context).errors[0]?.code).toBe("factory_no_waiting_items");
  });
});
