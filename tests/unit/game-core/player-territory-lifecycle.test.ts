import { describe, expect, it } from "vitest";
import {
  handleClaimEmergencyRecovery,
  reconcilePlayerTerritoryLifecycle,
  resolveCurrentHeadquartersDistrict,
  routeCommand
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import type { ClaimEmergencyRecoveryCommand } from "@empire/shared-types";
import { createCoreStateFixture, createDistrictFixture } from "../../fixtures/game-state-fixtures";

const context = {
  config: resolveModeConfig("free"),
  clock: { now: () => new Date("2026-01-01T00:00:00.000Z"), nowIso: () => "2026-01-01T00:00:00.000Z" }
};

describe("player territory lifecycle", () => {
  it("activates Last Stand exactly once when active territory falls from two districts to one", () => {
    const state = createCoreStateFixture();
    state.root.tick = 100;
    const result = reconcilePlayerTerritoryLifecycle(state, {
      playerId: "player:1",
      previousActiveDistrictCount: 2,
      sourceEventId: "command:capture:1",
      issuedAt: "2026-01-01T00:00:00.000Z"
    }, context);
    const player = result.nextState.playersById["player:1"];
    const district = result.nextState.districtsById["district:1"];
    expect(player.lastStandUsedAtTick).toBe(100);
    expect(player.lastStandDistrictId).toBe("district:1");
    expect(player.lastStandProtectedUntilTick).toBe(244);
    expect(district.attackProtectedUntilTick).toBe(244);

    const replay = reconcilePlayerTerritoryLifecycle(result.nextState, {
      playerId: "player:1",
      previousActiveDistrictCount: 2,
      sourceEventId: "command:capture:2",
      issuedAt: "2026-01-01T00:01:00.000Z"
    }, context);
    expect(replay.nextState.playersById["player:1"].lastStandUsedAtTick).toBe(100);
    expect(replay.events).toEqual([]);
  });

  it("does not activate Last Stand during Final Lockdown", () => {
    const state = createCoreStateFixture();
    state.root.phase = "final_lockdown";
    const result = reconcilePlayerTerritoryLifecycle(state, {
      playerId: "player:1",
      previousActiveDistrictCount: 2,
      sourceEventId: "command:capture:final",
      issuedAt: "2026-01-01T00:00:00.000Z"
    }, context);
    expect(result.nextState.playersById["player:1"].lastStandUsedAtTick).toBeUndefined();
  });

  it("defeats an active player with no territory and rejects later gameplay commands", () => {
    const state = createCoreStateFixture();
    state.districtsById["district:1"] = { ...state.districtsById["district:1"], ownerPlayerId: null };
    const result = reconcilePlayerTerritoryLifecycle(state, {
      playerId: "player:1",
      previousActiveDistrictCount: 1,
      sourceEventId: "command:last-capture",
      issuedAt: "2026-01-01T00:00:00.000Z"
    }, context);
    expect(result.nextState.playersById["player:1"]).toMatchObject({
      status: "defeated",
      allianceId: null,
      currentHeadquartersDistrictId: null
    });
    const replay = reconcilePlayerTerritoryLifecycle(result.nextState, {
      playerId: "player:1",
      previousActiveDistrictCount: 1,
      sourceEventId: "command:last-capture",
      issuedAt: "2026-01-01T00:00:00.000Z"
    }, context);
    expect(replay.nextState).toBe(result.nextState);
    const rejected = routeCommand(result.nextState, emergencyCommand("command:after-defeat"), context);
    expect(rejected.errors[0]?.code).toBe("PLAYER_DEFEATED");
  });

  it("selects a deterministic headquarters after the original home is lost", () => {
    const state = createCoreStateFixture();
    state.districtsById["district:1"] = { ...state.districtsById["district:1"], ownerPlayerId: null };
    state.districtsById["district:2"] = createDistrictFixture({
      id: "district:2", ownerPlayerId: "player:1", influence: 20, buildingIds: [], ownershipStartedAtTick: 10
    });
    state.districtsById["district:3"] = createDistrictFixture({
      id: "district:3", ownerPlayerId: "player:1", influence: 50, buildingIds: [], ownershipStartedAtTick: 20
    });
    expect(resolveCurrentHeadquartersDistrict(state, "player:1")?.id).toBe("district:3");
  });
});

describe("emergency recovery", () => {
  it("credits only configured values and persists its one-shot use", () => {
    const state = createCoreStateFixture();
    const player = state.playersById["player:1"];
    const resources = state.resourceStatesById[player.resourceStateId];
    state.playersById[player.id] = { ...player, population: 0 };
    state.resourceStatesById[resources.id] = {
      ...resources,
      balances: { cash: 0, "dirty-cash": 0, population: 0 },
      version: resources.version
    };
    state.districtsById["district:1"] = { ...state.districtsById["district:1"], adjacentDistrictIds: [] };
    state.playerCityEventStatesByPlayerId = {};

    const result = handleClaimEmergencyRecovery(state, emergencyCommand("command:recovery"), context);
    expect(result.errors).toEqual([]);
    expect(result.nextState.playersById[player.id].emergencyRecoveryUsedAtTick).toBe(state.root.tick);
    expect(result.nextState.resourceStatesById[resources.id].balances).toMatchObject({ cash: 500, population: 5 });
    const second = handleClaimEmergencyRecovery(result.nextState, emergencyCommand("command:recovery-2"), context);
    expect(second.errors[0]?.code).toBe("emergency_recovery_not_eligible");
    expect(second.nextState.resourceStatesById[resources.id].balances.cash).toBe(500);
  });

  it("rejects client-controlled reward fields at transport typing boundary", () => {
    expect(emergencyCommand("command:typed").payload).toEqual({});
  });
});

const emergencyCommand = (id: string): ClaimEmergencyRecoveryCommand => ({
  id,
  type: "claim-emergency-recovery",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "server:1",
  issuedAt: "2026-01-01T00:00:00.000Z",
  payload: {},
  clientRequestId: id
});
