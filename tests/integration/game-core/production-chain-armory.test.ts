import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand } from "@empire/game-core";
import type { CoreGameState } from "@empire/game-core";
import {
  createCollectProductionCommandFixture,
  createCraftItemCommandFixture
} from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture, createFixedBuildingFixture } from "../../fixtures/game-state-fixtures";
import { advanceProductionUntilIdle } from "../../fixtures/timed-operation-fixtures";

const context = { config: resolveModeConfig("free") };

const craft = (buildingId: string, recipeId: string, quantity = 1) => createCraftItemCommandFixture({
  id: "command:chain:" + buildingId + ":" + recipeId + ":" + quantity,
  payload: { districtId: "district:1", buildingId, recipeId, quantity }
});

describe("authoritative production chain to Armory", () => {
  it("moves a production chain through due ticks into a Pistol", () => {
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

    const chemicals = applyCommand(state, craft(base.building.id, "chemicals", 2), context);
    expect(chemicals.nextState.resourceStatesById["resource:1"]?.balances.chemicals ?? 0).toBe(0);
    state = advanceProductionUntilIdle(chemicals.nextState, base.building.id, "chemicals", context);
    const chemicalsCollected = collect(state, base.building.id, "chemicals");
    state = chemicalsCollected.nextState;
    const neonDust = applyCommand(state, craft(drugLab.id, "neon-dust"), context);
    state = advanceProductionUntilIdle(neonDust.nextState, drugLab.id, "neon-dust", context);
    const neonDustCollected = collect(state, drugLab.id, "neon-dust");
    state = neonDustCollected.nextState;
    const metalParts = applyCommand(state, craft(factory.id, "metal-parts", 7), context);
    state = advanceProductionUntilIdle(metalParts.nextState, factory.id, "metal-parts", context);
    const metalPartsCollected = collect(state, factory.id, "metal-parts");
    state = metalPartsCollected.nextState;
    const techCore = applyCommand(state, craft(factory.id, "tech-core"), context);
    state = advanceProductionUntilIdle(techCore.nextState, factory.id, "tech-core", context);
    const techCoreCollected = collect(state, factory.id, "tech-core");
    state = techCoreCollected.nextState;
    const pistol = applyCommand(state, craft(armory.id, "pistol"), context);
    state = advanceProductionUntilIdle(pistol.nextState, armory.id, "pistol", context);
    const pistolCollected = collect(state, armory.id, "pistol");
    const completed = pistolCollected.nextState;

    expect([
      chemicals.errors,
      neonDust.errors,
      metalParts.errors,
      techCore.errors,
      pistol.errors
    ]).toEqual([[], [], [], [], []]);
    expect([
      chemicalsCollected.errors,
      neonDustCollected.errors,
      metalPartsCollected.errors,
      techCoreCollected.errors,
      pistolCollected.errors
    ]).toEqual([[], [], [], [], []]);
    expect(pistol.nextState.resourceStatesById["resource:1"]?.balances.pistol ?? 0).toBe(0);
    expect(completed.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 5780,
      chemicals: 0,
      "neon-dust": 1,
      "metal-parts": 0,
      "tech-core": 0,
      pistol: 1
    });
    expect([base.building.id, drugLab.id, factory.id, armory.id].every((buildingId) => {
      const building = completed.buildingsById[buildingId];
      return building?.processing === null
        && Object.values(building.productionLines ?? {}).every((line) => line.queuedAmount === 0);
    })).toBe(true);
  });

  it("prevents a pending craft from making reserved inputs available to another craft", () => {
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
    const factoryCraft = applyCommand(state, craft(base.building.id, "tech-core", 2), context);
    const armoryCraft = applyCommand(factoryCraft.nextState, craft(armory.id, "pistol"), context);
    const completedFactory = advanceProductionUntilIdle(
      factoryCraft.nextState,
      base.building.id,
      "tech-core",
      context
    );

    expect(factoryCraft.errors).toEqual([]);
    expect(factoryCraft.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 0,
      "metal-parts": 1,
      "tech-core": 1
    });
    expect(armoryCraft.errors[0]?.code).toBe("armory_missing_inputs");
    expect(armoryCraft.nextState).toBe(factoryCraft.nextState);
    expect(completedFactory.resourceStatesById["resource:1"]?.balances["tech-core"]).toBe(1);
    expect(completedFactory.resourceStatesById[`resource:${base.building.id}`]?.balances["tech-core"]).toBe(2);
  });
});

const collect = (state: CoreGameState, buildingId: string, resourceKey: string) => applyCommand(
  state,
  createCollectProductionCommandFixture({
    id: `command:chain:collect:${buildingId}:${resourceKey}:${state.root.tick}`,
    payload: { districtId: "district:1", buildingId, resourceKey }
  }),
  context
);
