import { sharedCitySpawnPool } from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";
import { expect, it } from "vitest";
import { applyCommand } from "@empire/game-core";
import type { GameCommand } from "@empire/shared-types";
import { createServerApp } from "../../apps/server/src/app";
import { createGameplaySliceFunctionHandler } from "../../apps/server/src/netlify/gameplay-slice-function";
import { ensureGameplaySliceMembershipInState } from "../../apps/server/src/bootstrap/gameplay-slice-session-membership";

it("rejects a former leader's valid own session at actual HTTP command ingress", async () => {
  const environment = { NODE_ENV: "test", GAMEPLAY_SLICE_SNAPSHOT_SECRET: "release-test-snapshot", GAMEPLAY_SLICE_SESSION_SECRET: "release-test-session" };
  const server = createServerApp({ environment });
  const handler = createGameplaySliceFunctionHandler({ environment, server });
  const serverInstanceId = "instance:free:eu-central:public-1";
  const post = async (path: string, body: unknown) => JSON.parse((await handler({ httpMethod: "POST", path, body: JSON.stringify(body) })).body!);
  const reserve = await post("/api/matchmaking/reserve", { accountId: "release-alice", mode: "free", preferredServerInstanceId: serverInstanceId });
  const join = await post("/api/gameplay-slice/join", { accountId: "release-alice", joinTicket: reserve.reservation.joinTicket, serverInstanceId, preferredStartDistrictId: "district:1", factionId: "mafian" });
  expect(join.accepted).toBe(true);
  const playerId = join.readModel.player.playerId;
  const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
  const member = ensureGameplaySliceMembershipInState(runtime.state, { playerId: "player:successor", factionId: "kult", serverInstanceId, mode: "free" });
  expect(member.accepted).toBe(true); runtime.state = member.state;

  let index = 0;
  const command = (type: GameCommand["type"], actor: string, payload: unknown) => ({ id: `release:alliance:${++index}`, type, playerId: actor, payload,
    serverInstanceId, mode: "free", issuedAt: runtime.clock.nowIso(), clientRequestId: null } as GameCommand);
  const run = (type: GameCommand["type"], actor: string, payload: unknown) => {
    const result = applyCommand(runtime.state, command(type, actor, payload), { config: runtime.config, clock: runtime.clock, mapRules: { isEnabledSpawnCandidate: id => sharedCitySpawnPool.some(s => s.enabled && s.districtId === id) } });
    expect(result.errors).toEqual([]); runtime.state = result.nextState;
  };
  const spawn = sharedCitySpawnPool.find(s => s.enabled && ["residential", "park"].includes(runtime.state.districtsById[s.districtId]?.zone))!;
  run("select-spawn-district", playerId, { districtId: spawn.districtId });
  const home = runtime.state.districtsById[spawn.districtId]; home.influence = 100;
  const nextSpawn = sharedCitySpawnPool.find(s => s.enabled && s.districtId !== home.id && ["residential", "park"].includes(runtime.state.districtsById[s.districtId]?.zone))!;
  run("select-spawn-district", "player:successor", { districtId: nextSpawn.districtId });
  run("create-alliance", playerId, { name: "Release", tag: "REL" });
  const allianceId = runtime.state.playersById[playerId].allianceId!;
  run("invite-alliance-member", playerId, { allianceId, targetPlayerId: "player:successor" });
  run("join-alliance", "player:successor", { allianceId });
  run("leave-alliance", playerId, { allianceId, chosenSuccessorPlayerId: "player:successor" });
  await server.instanceManager.saveInstanceSnapshot(serverInstanceId);
  const load = await post("/api/gameplay-slice/load", { sessionToken: join.sessionToken, serverInstanceId, districtId: home.id });
  expect(load.accepted).toBe(true);
  const before = JSON.stringify({ alliances: runtime.state.alliancesById, penalties: runtime.state.allianceExitPenaltiesById, audit: runtime.state.allianceAuditEventsById });
  const denied = await post("/api/gameplay-slice/submit", { sessionToken: join.sessionToken, snapshotToken: load.snapshotToken,
    focusDistrictId: home.id, command: command("disband-alliance", playerId, { allianceId }) });
  expect(denied.accepted).toBe(false);
  expect(denied.errors.map((e: { code: string }) => e.code)).toContain("READY_NOT_ALLOWED");
  expect(JSON.stringify({ alliances: runtime.state.alliancesById, penalties: runtime.state.allianceExitPenaltiesById, audit: runtime.state.allianceAuditEventsById })).toBe(before);
  expect(runtime.state.alliancesById[allianceId].status).toBe("active");
});
