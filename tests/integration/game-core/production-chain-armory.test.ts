import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand } from "@empire/game-core";
import type { CoreGameState } from "@empire/game-core";
import { createCraftItemCommandFixture } from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture, createFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };

const craft = (buildingId: string, recipeId: string, quantity = 1) => createCraftItemCommandFixture({
  id: "command:chain:" + buildingId + ":" + recipeId + ":" + quantity,
  payload: { districtId: "district:1", buildingId, recipeId, quantity }
});

describe("authoritative production chain to Armory", () => {
  it("moves a one-piece production chain directly through canonical storage into a Pistol", () => {
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
    const neonDust = applyCommand(chemicals.nextState, craft(drugLab.id, "neon-dust"), context);
    const metalParts = applyCommand(neonDust.nextState, craft(factory.id, "metal-parts", 7), context);
    const techCore = applyCommand(metalParts.nextState, craft(factory.id, "tech-core"), context);
    const pistol = applyCommand(techCore.nextState, craft(armory.id, "pistol"), context);

    expect([
      chemicals.errors,
      neonDust.errors,
      metalParts.errors,
      techCore.errors,
      pistol.errors
    ]).toEqual([[], [], [], [], []]);
    expect(pistol.nextState.root.tick).toBe(state.root.tick);
    expect(pistol.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 5780,
      chemicals: 0,
      "neon-dust": 1,
      "metal-parts": 0,
      "tech-core": 0,
      pistol: 1
    });
    expect([base.building.id, drugLab.id, factory.id, armory.id].every((buildingId) => {
      const building = pistol.nextState.buildingsById[buildingId];
      return building?.processing === null
        && Object.values(building.productionLines ?? {}).every((line) => line.queuedAmount === 0);
    })).toBe(true);
  });

  it("prevents sequential instant crafts from spending the same Metal Parts twice", () => {
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

    expect(factoryCraft.errors).toEqual([]);
    expect(factoryCraft.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 0,
      "metal-parts": 1,
      "tech-core": 3
    });
    expect(armoryCraft.errors[0]?.code).toBe("armory_missing_inputs");
    expect(armoryCraft.nextState).toBe(factoryCraft.nextState);
    expect(armoryCraft.nextState.buildingsById[base.building.id]?.productionLines ?? {}).toEqual({});
  });
});
