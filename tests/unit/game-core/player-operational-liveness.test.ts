import { describe, expect, it } from "vitest";
import { resolvePlayerOperationalLiveness, resolveUsableConflictOriginDistricts } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  createAllianceFixture,
  createCoreStateFixture,
  createDistrictFixture,
  createPlayerFixture
} from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };

describe("player operational liveness", () => {
  it("reports an open neutral frontier as immediately playable", () => {
    const state = createCoreStateFixture();
    state.playersById["player:1"] = { ...state.playersById["player:1"], population: 10 };
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"], adjacentDistrictIds: ["district:2"]
    };
    state.districtsById["district:2"] = createDistrictFixture({
      id: "district:2", ownerPlayerId: null, status: "neutral", adjacentDistrictIds: ["district:1"]
    });

    expect(resolvePlayerOperationalLiveness(state, "player:1", context)).toMatchObject({
      state: "open_frontier",
      canProgressNow: true,
      invalidInvariant: false,
      directTargets: ["district:2"]
    });
  });

  it("distinguishes a finite temporary seal from a permanent invalid softlock", () => {
    const state = createCoreStateFixture();
    state.root.tick = 20;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"], stabilizingUntilTick: 50
    };

    expect(resolvePlayerOperationalLiveness(state, "player:1", context)).toMatchObject({
      state: "temporarily_sealed",
      canProgressNow: false,
      canProgressLater: true,
      nextProgressAtTick: 50,
      nextProgressReason: "stabilization",
      invalidInvariant: false
    });

    state.districtsById["district:1"] = { ...state.districtsById["district:1"], stabilizingUntilTick: null };
    expect(resolvePlayerOperationalLiveness(state, "player:1", context)).toMatchObject({
      state: "invalid_softlock",
      invalidInvariant: true,
      blockingReasons: ["ACTIVE_PLAYER_SOFTLOCKED"]
    });
  });

  it("uses an allied one-hop corridor as a progression route", () => {
    const state = createCoreStateFixture();
    state.playersById["player:1"] = { ...state.playersById["player:1"], allianceId: "alliance:1" };
    state.playersById["player:2"] = createPlayerFixture({
      id: "player:2", accountId: "account:2", allianceId: "alliance:1", homeDistrictId: "district:2"
    });
    state.alliancesById["alliance:1"] = createAllianceFixture({ memberIds: ["player:1", "player:2"] });
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"], adjacentDistrictIds: ["district:2"]
    };
    state.districtsById["district:2"] = createDistrictFixture({
      id: "district:2", ownerPlayerId: "player:2", adjacentDistrictIds: ["district:1", "district:3"]
    });
    state.districtsById["district:3"] = createDistrictFixture({
      id: "district:3", ownerPlayerId: null, status: "neutral", adjacentDistrictIds: ["district:2"]
    });

    expect(resolvePlayerOperationalLiveness(state, "player:1", context)).toMatchObject({
      state: "allied_encircled",
      canProgressNow: true,
      corridorAvailable: true,
      corridorTargets: ["district:3"],
      invalidInvariant: false
    });
  });

  it("marks active zero-territory as invalid and defeated zero-territory as terminal", () => {
    const state = createCoreStateFixture();
    state.districtsById["district:1"] = { ...state.districtsById["district:1"], ownerPlayerId: null };

    expect(resolvePlayerOperationalLiveness(state, "player:1", context)).toMatchObject({
      state: "no_territory",
      invalidInvariant: true
    });
    state.playersById["player:1"] = { ...state.playersById["player:1"], status: "defeated" };
    expect(resolvePlayerOperationalLiveness(state, "player:1", context)).toMatchObject({
      state: "defeated",
      invalidInvariant: false
    });
  });

  it("classifies stabilization-blocked origins per action", () => {
    const state = createCoreStateFixture();
    state.root.tick = 10;
    state.districtsById["district:1"] = { ...state.districtsById["district:1"], stabilizingUntilTick: 40 };

    expect(resolveUsableConflictOriginDistricts(state, "player:1", "attack")).toMatchObject({
      usableOriginDistrictIds: [],
      temporarilyBlockedOriginDistrictIds: ["district:1"]
    });
    expect(resolveUsableConflictOriginDistricts(state, "player:1", "spy")).toMatchObject({
      usableOriginDistrictIds: ["district:1"],
      temporarilyBlockedOriginDistrictIds: []
    });
  });
});
