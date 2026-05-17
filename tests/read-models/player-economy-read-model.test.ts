import { describe, expect, it } from "vitest";
import { createPlayerView } from "../../packages/game-core/src";
import {
  createCoreStateFixture,
  createDistrictFixture
} from "../fixtures/game-state-fixtures";

describe("player economy read model projection", () => {
  it("projects player resources into canonical economy buckets from authoritative state", () => {
    const state = createCoreStateFixture();
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      population: 24
    };
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        cash: 1500,
        "dirty-cash": 375,
        chemicals: 8,
        biomass: 5,
        "stim-pack": 1,
        "neon-dust": 3,
        pistol: 2,
        vest: 1,
        "gang-members": 12
      }
    };
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      influence: 17
    };
    state.districtsById["district:2"] = createDistrictFixture({
      id: "district:2",
      ownerPlayerId: "player:1",
      influence: 4
    });
    state.root.districtIds.push("district:2");

    const player = createPlayerView(state, "player:1");

    expect(player.economy).toMatchObject({
      cleanCash: 1500,
      dirtyCash: 375,
      influence: 21,
      population: 24,
      gangMembers: 12,
      resources: {
        cash: 1500,
        "dirty-cash": 375,
        "gang-members": 12
      },
      materials: {
        chemicals: 8,
        biomass: 5,
        "stim-pack": 1
      },
      drugs: {
        "neon-dust": 3
      },
      weapons: {
        pistol: 2,
        vest: 1
      }
    });
    expect(player.resourceBalances).toMatchObject({
      cash: 1500,
      "dirty-cash": 375,
      population: 24
    });
    expect("heat" in player.economy).toBe(false);
  });

  it("projects missing player economy safely without creating resource state", () => {
    const state = createCoreStateFixture();

    const player = createPlayerView(state, "player:missing");

    expect(player.economy).toMatchObject({
      cleanCash: 0,
      dirtyCash: 0,
      influence: 0,
      population: 0,
      gangMembers: 0,
      resources: {}
    });
  });
});
