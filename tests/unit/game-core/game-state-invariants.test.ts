import { describe, expect, it } from "vitest";
import { checkGameStateInvariants } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  createCombatStateFixture,
  createCoreStateFixture
} from "../../fixtures/game-state-fixtures";

const freeConfig = resolveModeConfig("free");

describe("authoritative game-state invariants", () => {
  it("accepts a canonical normalized state", () => {
    const state = createCombatStateFixture("instance:1");
    for (const player of Object.values(state.playersById)) {
      player.population = Number(player.population ?? 0);
      state.cooldownStatesById[player.cooldownStateId] ??= {
        id: player.cooldownStateId,
        ownerType: "player",
        ownerId: player.id,
        cooldowns: {},
        version: 1
      };
      state.policeStatesById[player.policeStateId] ??= {
        id: player.policeStateId,
        ownerPlayerId: player.id,
        heat: 0,
        wantedLevel: 0,
        lastDecayTick: 0,
        activeFlags: [],
        version: 1
      };
    }

    const report = checkGameStateInvariants(state, {
      maxPlayers: freeConfig.balance.maxPlayersPerServer,
      maxAllianceSize: freeConfig.balance.maxAllianceSize
    });

    expect(report.violations).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.checked).toBeGreaterThan(20);
  });

  it("reports economy, ownership, identity and finalization corruption together", () => {
    const state = createCoreStateFixture();
    state.root.playerIds.push("player:1");
    state.resourceStatesById["resource:1"].balances.cash = -1;
    state.resourceStatesById["resource:1"].balances.chemicals = Number.NaN;
    state.districtsById["district:1"].ownerPlayerId = "player:missing";
    state.root.matchResultId = "match:missing";

    const report = checkGameStateInvariants(state, {
      maxPlayers: freeConfig.balance.maxPlayersPerServer,
      maxAllianceSize: freeConfig.balance.maxAllianceSize
    });

    expect(report.passed).toBe(false);
    expect(report.violations.map((violation) => violation.code)).toEqual(expect.arrayContaining([
      "ROOT_PLAYER_DUPLICATE",
      "RESOURCE_BALANCE_NEGATIVE",
      "RESOURCE_BALANCE_NOT_FINITE",
      "DISTRICT_OWNER_MISSING",
      "MATCH_RESULT_REFERENCE_ORPHANED"
    ]));
  });

  it("detects duplicate account membership and unsafe market stock", () => {
    const state = createCoreStateFixture();
    state.playersById["player:2"] = {
      ...state.playersById["player:1"],
      id: "player:2",
      resourceStateId: "resource:2",
      cooldownStateId: "cooldown:2",
      policeStateId: "police:2"
    };
    state.resourceStatesById["resource:2"] = {
      ...state.resourceStatesById["resource:1"],
      id: "resource:2",
      ownerId: "player:2"
    };
    state.cooldownStatesById["cooldown:2"] = {
      ...state.cooldownStatesById["cooldown:1"],
      id: "cooldown:2",
      ownerId: "player:2"
    };
    state.policeStatesById["police:2"] = {
      ...state.policeStatesById["police:1"],
      id: "police:2",
      ownerPlayerId: "player:2"
    };
    state.root.playerIds.push("player:2");
    state.market = { stock: { chemicals: -5 } };

    const report = checkGameStateInvariants(state);

    expect(report.violations.map((violation) => violation.code)).toEqual(expect.arrayContaining([
      "ACCOUNT_PLAYER_DUPLICATE",
      "MARKET_STOCK_INVALID"
    ]));
  });
});
