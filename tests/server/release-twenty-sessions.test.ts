import { beforeAll, describe, expect, it } from "vitest";
import { PLAYER_FACTION_IDS } from "@empire/shared-types";
import { createServerApp } from "../../apps/server/src/app";
import { createGameplaySliceFunctionHandler } from "../../apps/server/src/netlify/gameplay-slice-function";
import { sharedCitySpawnPool } from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";
import { empireStreetsCityMapManifest, publicServerRegistry } from "@empire/game-config";

async function prepareTwentySessions() {
  const environment = { NODE_ENV: "test", GAMEPLAY_SLICE_SNAPSHOT_SECRET: "twenty-test-snapshot", GAMEPLAY_SLICE_SESSION_SECRET: "twenty-test-session" };
  const server = createServerApp({ environment });
  const serverInstanceId = "instance:free:eu-central:public-1";
  // Create an isolated twenty-seat instance through the existing creation service.
  server.serverInstanceCreationService.createGameServerInstance({ ...publicServerRegistry.find(s => s.serverInstanceId === serverInstanceId)!, capacity: 20 });
  const handler = createGameplaySliceFunctionHandler({ environment, server });
  const post = async (path: string, body: unknown) => JSON.parse((await handler({ httpMethod: "POST", path, body: JSON.stringify(body) })).body!);
  const spawns = sharedCitySpawnPool.filter(s => s.enabled && empireStreetsCityMapManifest.districts.some(d => d.id === s.districtId && ["residential", "park"].includes(d.zone)));
  const sessions: Array<{ sessionToken: string; playerId: string; districtId: string }> = [];
  for (let i = 0; i < 20; i++) {
    const accountId = `release-twenty-${i}`;
    const factionId = PLAYER_FACTION_IDS[i % PLAYER_FACTION_IDS.length];
    const reserve = await post("/api/matchmaking/reserve", { accountId, factionId, mode: "free", preferredServerInstanceId: serverInstanceId });
    expect(reserve.accepted, JSON.stringify({ i, errors: reserve.errors })).toBe(true);
    const join = await post("/api/gameplay-slice/join", { accountId, joinTicket: reserve.reservation.joinTicket, serverInstanceId, factionId });
    expect(join.accepted).toBe(true);
    const playerId = join.readModel.player.playerId;
    const selected = await post("/api/gameplay-slice/submit", { sessionToken: join.sessionToken, snapshotToken: join.snapshotToken,
      focusDistrictId: spawns[i].districtId, command: { id: `select:${i}`, type: "select-spawn-district", mode: "free", serverInstanceId,
        playerId, issuedAt: new Date().toISOString(), clientRequestId: null, payload: { districtId: spawns[i].districtId } } });
    expect(selected.errors).toEqual([]); expect(selected.accepted).toBe(true);
    sessions.push({ sessionToken: join.sessionToken, playerId, districtId: spawns[i].districtId });
  }
  return { server, serverInstanceId, sessions, post };
}

describe("twenty independent authorized sessions (in-memory ingress)", () => {
  let fixture: Awaited<ReturnType<typeof prepareTwentySessions>>;
  // Setup performs 60 sequential authenticated reserve/join/select requests and
  // seals development snapshots. It exceeded 20 s under full-suite contention;
  // keep its explicit setup budget separate from concurrent command assertions.
  beforeAll(async () => { fixture = await prepareTwentySessions(); }, 60000);
  it("accepts twenty concurrent load/submit calls and rejects excess admission", async () => {
  const { server, serverInstanceId, sessions, post } = fixture;
  expect(server.publicServerMatchmaking.listActiveReservations()).toHaveLength(0);
  const excess = await post("/api/matchmaking/reserve", { accountId: "release-twenty-excess", mode: "free", preferredServerInstanceId: serverInstanceId });
  expect(excess.accepted).toBe(false);
  expect(new Set(sessions.map(s => s.sessionToken)).size).toBe(20);
  expect(new Set(sessions.map(s => s.playerId)).size).toBe(20);
  const reads = await Promise.all(sessions.map(s => post("/api/gameplay-slice/load", { ...s, serverInstanceId })));
  expect(reads.every(r => r.accepted)).toBe(true);
  const results = await Promise.all(sessions.map((s, i) => post("/api/gameplay-slice/submit", { sessionToken: s.sessionToken,
    // This persistent in-process runtime uses its stored state. Hosted responses also omit the development-only full-state token.
    snapshotToken: null, focusDistrictId: s.districtId,
    command: { id: `concurrent:${i}`, type: "send-city-chat-message", mode: "free", serverInstanceId,
      playerId: s.playerId, issuedAt: new Date().toISOString(), clientRequestId: null, payload: { body: `Ověření účastníka ${i}` } } })));
  expect(results.map(r => r.errors)).toEqual(Array.from({ length: 20 }, () => []));
  expect(results.every(r => r.accepted)).toBe(true);
  }, 20000);
});
