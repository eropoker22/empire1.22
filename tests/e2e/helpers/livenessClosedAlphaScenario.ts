import {
  calculatePlayerFrontier,
  reconcilePlayerTerritoryLifecycle,
  resolveAllianceCorridorRoutes,
  resolvePlayerOperationalLiveness,
  validateMapAction
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { createAllianceFixture, createCoreStateFixture, createDistrictFixture, createPlayerFixture } from "../../fixtures/game-state-fixtures";

declare const process: { argv: string[] };

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
const context = {
  config: resolveModeConfig("free"),
  clock: { now: () => new Date("2026-07-15T12:00:00.000Z"), nowIso: () => "2026-07-15T12:00:00.000Z" }
};

const createCorridorState = () => {
  const state = createCoreStateFixture();
  state.playersById["player:1"] = { ...state.playersById["player:1"], allianceId: "alliance:1" };
  state.playersById["player:2"] = createPlayerFixture({ id: "player:2", allianceId: "alliance:1", homeDistrictId: "district:2" });
  state.playersById["player:3"] = createPlayerFixture({ id: "player:3", homeDistrictId: "district:3" });
  state.alliancesById["alliance:1"] = createAllianceFixture({ memberIds: ["player:1", "player:2"] });
  state.districtsById["district:1"] = { ...state.districtsById["district:1"], adjacentDistrictIds: ["district:2"] };
  state.districtsById["district:2"] = createDistrictFixture({ id: "district:2", ownerPlayerId: "player:2", adjacentDistrictIds: ["district:1", "district:3"] });
  state.districtsById["district:3"] = createDistrictFixture({ id: "district:3", ownerPlayerId: "player:3", adjacentDistrictIds: ["district:2"] });
  state.root.playerIds.push("player:2", "player:3");
  state.root.districtIds.push("district:2", "district:3");
  state.root.allianceIds.push("alliance:1");
  return state;
};

const runCorridor = () => {
  const state = createCorridorState();
  assert(calculatePlayerFrontier(state, "player:1").state === "allied_encircled", "Expected allied encirclement.");
  const route = resolveAllianceCorridorRoutes(state, "player:1")[0];
  assert(route?.routeDistrictId === "district:2", "Expected one-hop alliance route.");
  const allowed = validateMapAction(state, {
    actorPlayerId: "player:1",
    originDistrictId: "district:1",
    routeDistrictId: "district:2",
    expectedRouteVersion: state.districtsById["district:2"].version,
    targetDistrictId: "district:3",
    action: "spy"
  });
  assert(allowed.allowed && allowed.usedAllianceCorridor, "Corridor spy should be valid.");
  state.alliancesById["alliance:1"] = { ...state.alliancesById["alliance:1"], status: "disbanded", version: 2 };
  const invalidated = validateMapAction(state, {
    actorPlayerId: "player:1",
    originDistrictId: "district:1",
    routeDistrictId: "district:2",
    expectedRouteVersion: state.districtsById["district:2"].version,
    targetDistrictId: "district:3",
    action: "spy"
  });
  assert(!invalidated.allowed, "Disband must invalidate the corridor.");
};

const runLastStandDefeat = () => {
  const state = createCoreStateFixture();
  state.root.tick = 40;
  const lastStand = reconcilePlayerTerritoryLifecycle(state, {
    playerId: "player:1",
    previousActiveDistrictCount: 2,
    sourceEventId: "e2e:last-stand",
    issuedAt: context.clock.nowIso()
  }, context);
  assert(lastStand.nextState.playersById["player:1"].lastStandProtectedUntilTick === 184, "Last Stand deadline mismatch.");
  const noTerritory = {
    ...lastStand.nextState,
    districtsById: {
      ...lastStand.nextState.districtsById,
      "district:1": { ...lastStand.nextState.districtsById["district:1"], ownerPlayerId: null }
    }
  };
  const defeated = reconcilePlayerTerritoryLifecycle(noTerritory, {
    playerId: "player:1",
    previousActiveDistrictCount: 1,
    sourceEventId: "e2e:defeat",
    issuedAt: context.clock.nowIso()
  }, context);
  assert(defeated.nextState.playersById["player:1"].status === "defeated", "Zero-territory player remained active.");
  assert(resolvePlayerOperationalLiveness(defeated.nextState, "player:1", context).state === "defeated", "Defeat read model mismatch.");
};

const scenario = process.argv.find((entry) => entry.startsWith("--scenario="))?.split("=")[1];
if (scenario === "corridor") runCorridor();
else if (scenario === "last-stand-defeat") runLastStandDefeat();
else throw new Error(`Unknown liveness scenario: ${scenario}`);

console.log(JSON.stringify({ scenario, passed: true }));
