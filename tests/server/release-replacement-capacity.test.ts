import { describe, expect, it } from "vitest";
import { copyFreeHostedStartingPlayerState, empireStreetsCityMapManifest } from "@empire/game-config";
import { applyHostedMembershipActivation, type HostedMembershipRecord } from "../../apps/server/src/admin/hosted/hosted-runtime-membership-activation";
import { applyHostedEarlyLeaveCleanup } from "../../apps/server/src/admin/hosted/hosted-runtime-worker-state";
import { createServerInstanceRuntime } from "../../apps/server/src/runtime/instance-manager/instance-factory";
import { dispatchInstanceCommand } from "../../apps/server/src/runtime/instance-manager/instance-command-dispatch";
import { sharedCitySpawnPool } from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";
import type { HostedServerRecord } from "../../apps/server/src/admin/hosted";
import type { GameCommand } from "@empire/shared-types";

const at = "2026-09-10T12:00:00.000Z";
const clock = { now: () => new Date(at), nowIso: () => at };
function fixture() {
  const runtime = createServerInstanceRuntime("instance:release-cap", "free", { clock });
  const server = { mode: "free", startingPlayerState: copyFreeHostedStartingPlayerState() } as HostedServerRecord;
  const spawns = sharedCitySpawnPool.filter(e => e.enabled && empireStreetsCityMapManifest.districts.some(d => d.id === e.districtId && ["residential", "park"].includes(d.zone)));
  const factions = Object.keys(runtime.config.balance.factions!);
  const member = (n: number, spawn = spawns[n - 1].districtId): HostedMembershipRecord => ({
    membershipId: `membership:${n}`, accountId: `account:${n}`, playerId: `player:${n}`,
    serverInstanceId: runtime.record.id, status: "finalizing_setup", reservedSpawnDistrictId: spawn,
    factionId: factions[(n - 1) % factions.length], accountDisplayName: `Release ${n}`,
    gangName: `Gang ${n}`, gangColor: "#06b6d4", avatarId: "mafian:1"
  } as HostedMembershipRecord);
  for (let n = 1; n <= 20; n++) applyHostedMembershipActivation(runtime, server, member(n), new Date(at));
  return { runtime, server, member, spawns };
}
const chat = (playerId: string, id: string): GameCommand => ({ id, clientRequestId: null, issuedAt: at,
  mode: "free", serverInstanceId: "instance:release-cap", playerId, type: "send-city-chat-message", payload: { body: "Kontrola vstupu" } });

describe("release capacity across hosted membership attempts", () => {
  it("dispatches for the original player and replacement with 21 historical identities, including a fresh runtime", async () => {
    const { runtime, server, member, spawns } = fixture();
    expect(applyHostedEarlyLeaveCleanup(runtime, "player:1", "membership:1")).toBe(true);
    expect(applyHostedMembershipActivation(runtime, server, member(21, spawns[0].districtId), new Date(at))).toBe(true);
    expect(runtime.state.root.playerIds).toHaveLength(21);
    expect(Object.values(runtime.state.playersById).filter(p => p.status === "active")).toHaveLength(20);
    for (const id of ["player:2", "player:21"]) {
      const result = await dispatchInstanceCommand(runtime, chat(id, `first:${id}`));
      expect(result.errors).toEqual([]);
    }
    const restored = createServerInstanceRuntime(runtime.record.id, "free", { clock: { now: () => new Date(Date.parse(at) + 3000), nowIso: () => new Date(Date.parse(at) + 3000).toISOString() } });
    restored.state = JSON.parse(JSON.stringify(runtime.state));
    for (const id of ["player:2", "player:21"]) expect((await dispatchInstanceCommand(restored, { ...chat(id, `restored:${id}`), issuedAt: new Date(Date.parse(at) + 3000).toISOString() })).errors).toEqual([]);
    expect(() => applyHostedMembershipActivation(restored, server, member(22, spawns[21].districtId), new Date(at))).toThrow();
    expect(restored.state.root.playerIds).toHaveLength(21);
  });
  it("does not release a defeated participant's seat", () => {
    const { runtime, server, member, spawns } = fixture();
    runtime.state.playersById["player:1"].status = "defeated";
    expect(() => applyHostedMembershipActivation(runtime, server, member(21, spawns[20].districtId), new Date(at))).toThrow();
  });
  it("protects a returning account's new attempt from repeated old cleanup", async () => {
    const { runtime, server, member, spawns } = fixture();
    expect(applyHostedEarlyLeaveCleanup(runtime, "player:1", "membership:1")).toBe(true);
    const returning = { ...member(1, spawns[0].districtId), membershipId: "membership:return" };
    expect(applyHostedMembershipActivation(runtime, server, returning, new Date(at))).toBe(true);
    expect(applyHostedEarlyLeaveCleanup(runtime, "player:1", "membership:1")).toBe(false);
    expect(runtime.state.playersById["player:1"].metadata?.membershipId).toBe("membership:return");
    expect((await dispatchInstanceCommand(runtime, chat("player:1", "returning"))).errors).toEqual([]);
  });
});
