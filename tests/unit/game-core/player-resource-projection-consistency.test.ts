import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { createPlayerView } from "@empire/game-core";
import {
  createCoreStateFixture,
  createDistrictFixture
} from "../../fixtures/game-state-fixtures";

const context = {
  config: resolveModeConfig("free"),
  clock: {
    now: () => new Date("2026-07-31T18:00:00.000Z"),
    nowIso: () => "2026-07-31T18:00:00.000Z"
  }
};

describe("player resource projection consistency", () => {
  it("projects only canonical population and drops a conflicting legacy gang-members alias", () => {
    const state = createCoreStateFixture();
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      population: 42
    };
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        cash: 3_583.3,
        "dirty-cash": 412.2,
        "gang-members": 3,
        chemicals: 7,
        pistol: 2
      }
    };
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      influence: 1.4
    };
    state.districtsById["district:destroyed"] = createDistrictFixture({
      id: "district:destroyed",
      influence: 500,
      status: "destroyed"
    });
    state.root.districtIds.push("district:destroyed");

    const view = createPlayerView(state, "player:1", context);

    expect(view.economy).toMatchObject({
      cleanCash: 3_583.3,
      dirtyCash: 412.2,
      influence: 1.4,
      population: 42,
      materials: {
        chemicals: 7
      },
      weapons: {
        pistol: 2
      }
    });
    expect(view.resourceBalances).toMatchObject({
      cash: 3_583.3,
      "dirty-cash": 412.2,
      population: 42,
      chemicals: 7,
      pistol: 2
    });
    expect(view.resourceBalances).not.toHaveProperty("gang-members");
    expect(view.cityEvents?.agents.map((agent) => agent.currentInfluence))
      .toEqual([1, 1, 1]);
    expect(view.economy).not.toHaveProperty("gangMembers");
  });
});
