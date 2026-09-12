import { expect, it } from "vitest";
import { createServerApp } from "../../apps/server/src/app";
import { createGameplaySliceFunctionHandler } from "../../apps/server/src/netlify/gameplay-slice-function";
import { sharedCitySpawnPool } from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";

it("delivers private chat only to members through real sessions, rejects forgeries and prevents duplicate sends", async () => {
  const environment = { NODE_ENV: "test", GAMEPLAY_SLICE_SNAPSHOT_SECRET: "alliance-chat-test-snapshot", GAMEPLAY_SLICE_SESSION_SECRET: "alliance-chat-test-session" };
  const server = createServerApp({ environment });
  const handler = createGameplaySliceFunctionHandler({ environment, server });
  const serverInstanceId = "instance:free:eu-central:public-1";
  const post = async (path: string, body: unknown) => JSON.parse((await handler({ httpMethod: "POST", path, body: JSON.stringify(body) })).body!);
  let sequence = 0;
  type Actor = { playerId: string; sessionToken: string; districtId: string };
  const load = (actor: Actor) => post("/api/gameplay-slice/load", { sessionToken: actor.sessionToken, serverInstanceId, districtId: actor.districtId });
  const send = async (actor: Actor, type: string, payload: unknown, id = `chat-test:${++sequence}`, commandPlayerId = actor.playerId) => {
    const snapshot = await load(actor);
    expect(snapshot.accepted).toBe(true);
    return post("/api/gameplay-slice/submit", { sessionToken: actor.sessionToken, snapshotToken: snapshot.snapshotToken, focusDistrictId: actor.districtId,
      command: { id, clientRequestId: id, type, mode: "free", playerId: commandPlayerId, serverInstanceId, issuedAt: "2026-09-12T00:00:00.000Z", payload } });
  };
  const join = async (accountId: string): Promise<Actor> => {
    const reservation = await post("/api/matchmaking/reserve", { accountId, mode: "free", preferredServerInstanceId: serverInstanceId });
    const joined = await post("/api/gameplay-slice/join", { accountId, joinTicket: reservation.reservation.joinTicket, serverInstanceId, factionId: "mafian" });
    expect(joined.accepted).toBe(true);
    const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
    const spawn = sharedCitySpawnPool.find(candidate => candidate.enabled && !runtime.state.districtsById[candidate.districtId]?.ownerPlayerId
      && ["residential", "park"].includes(runtime.state.districtsById[candidate.districtId]?.zone))!;
    const actor = { playerId: joined.readModel.player.playerId, sessionToken: joined.sessionToken, districtId: spawn.districtId };
    expect((await send(actor, "select-spawn-district", { districtId: spawn.districtId })).accepted).toBe(true);
    return actor;
  };
  const leader = await join("chat-leader");
  const member = await join("chat-member");
  const outsider = await join("chat-outsider");
  const runtime = server.instanceManager.getInstanceById(serverInstanceId)!;
  runtime.state.districtsById[leader.districtId].influence = 100;
  runtime.state.root.version += 1;
  await server.instanceManager.saveInstanceSnapshot(serverInstanceId);
  expect((await send(leader, "create-alliance", { name: "Chat test", tag: "CHAT" })).accepted).toBe(true);
  const allianceId = runtime.state.playersById[leader.playerId].allianceId!;
  expect((await send(leader, "invite-alliance-member", { allianceId, targetPlayerId: member.playerId })).accepted).toBe(true);
  expect((await send(member, "join-alliance", { allianceId })).accepted).toBe(true);
  expect((await send(member, "send-alliance-chat-message", { allianceId, body: "Soukromá zpráva členům" }, "private-message")).accepted).toBe(true);
  // Retrying the exact command must never append the message twice.
  await send(member, "send-alliance-chat-message", { allianceId, body: "Soukromá zpráva členům" }, "private-message");
  const memberView = await load(leader);
  expect(memberView.readModel.allianceBoard.activeAlliance.chatMessages.filter((message: { body: string }) => message.body === "Soukromá zpráva členům")).toHaveLength(1);
  const publicView = await load(outsider);
  expect(JSON.stringify(publicView.readModel.allianceBoard)).not.toContain("Soukromá zpráva členům");
  expect((await send(outsider, "send-alliance-chat-message", { allianceId, body: "Průnik" })).accepted).toBe(false);
  expect((await send(outsider, "send-alliance-chat-message", { allianceId, body: "Padělaná identita" }, "forged-chat", member.playerId)).accepted).toBe(false);
  expect((await send(member, "leave-alliance", { allianceId })).accepted).toBe(true);
  expect(JSON.stringify((await load(member)).readModel.allianceBoard)).not.toContain("Soukromá zpráva členům");
  expect((await send(member, "send-alliance-chat-message", { allianceId, body: "Po odchodu" })).accepted).toBe(false);
  expect(Object.values(runtime.state.allianceChatMessagesById || {}).filter(message => message.allianceId === allianceId)).toHaveLength(1);
}, 20_000);
