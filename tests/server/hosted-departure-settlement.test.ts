import { describe, expect, it } from "vitest";
import { copyFreeHostedStartingPlayerState, empireStreetsCityMapManifest } from "@empire/game-config";
import { expireBounties, resolveBountyClaims, createBountyReadModel } from "@empire/game-core";
import { createBounty, cancelBounty } from "../../packages/game-core/src/handlers/bountyCommands";
import { createPlayerMarketListing, cancelPlayerMarketListing, buyPlayerMarketListing, tickMarket } from "../../packages/game-core/src/rules/market/serverMarketSystem";
import { applyHostedEarlyLeaveCleanup } from "../../apps/server/src/admin/hosted/hosted-runtime-worker-state";
import { applyHostedMembershipActivation, type HostedMembershipRecord } from "../../apps/server/src/admin/hosted/hosted-runtime-membership-activation";
import { createServerInstanceRuntime } from "../../apps/server/src/runtime/instance-manager/instance-factory";
import { sharedCitySpawnPool } from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";
import type { HostedServerRecord } from "../../apps/server/src/admin/hosted/hosted-control-plane-repository";
import type { CreateBountyCommand, CancelBountyCommand } from "@empire/shared-types";

const at = "2026-09-10T10:00:00.000Z";
const createFixture = () => {
  const runtime = createServerInstanceRuntime("instance:settlement", "free", { clock: { now: () => new Date(at), nowIso: () => at } });
  const server = { mode: "free", startingPlayerState: copyFreeHostedStartingPlayerState() } as HostedServerRecord;
  const spawns = sharedCitySpawnPool.filter((entry) => entry.enabled && empireStreetsCityMapManifest.districts.some((district) =>
    district.id === entry.districtId && ["residential", "park"].includes(district.zone)));
  const memberships = [1, 2, 3].map((n, index) => ({
    membershipId: `membership:${n}`, accountId: `account:${n}`, playerId: `player:${n}`,
    serverInstanceId: runtime.record.id, status: "finalizing_setup", reservedSpawnDistrictId: spawns[index].districtId,
    factionId: "mafian", accountDisplayName: `Player ${n}`, gangName: `Gang ${n}`, gangColor: "#06b6d4", avatarId: "mafian:1"
  } as HostedMembershipRecord));
  for (const membership of memberships) applyHostedMembershipActivation(runtime, server, membership, new Date(at));
  const context = { config: runtime.config, clock: runtime.clock };
  const balances = (id = "player:1") => runtime.state.resourceStatesById[runtime.state.playersById[id].resourceStateId].balances;
  const bountyCommand: CreateBountyCommand = { id: "command:escrow", type: "create-bounty", mode: "free", playerId: "player:1",
    serverInstanceId: runtime.record.id, issuedAt: at, clientRequestId: null,
    payload: { targetPlayerId: "player:2", objectiveType: "attack-player", rewardCleanCash: 5000, durationHours: 1, isAnonymous: false } };
  const cancelCommand: CancelBountyCommand = { ...bountyCommand, id: "command:cancel", type: "cancel-bounty", payload: { bountyId: "bounty:command:escrow" } };
  const rejoin = (index = 0) => {
    const previous = memberships[index];
    expect(applyHostedEarlyLeaveCleanup(runtime, previous.playerId, previous.membershipId)).toBe(true);
    // Snapshot serialization represents a worker recovery boundary between the attempts.
    runtime.state = JSON.parse(JSON.stringify(runtime.state));
    const next = { ...previous, membershipId: `${previous.membershipId}:next` };
    applyHostedMembershipActivation(runtime, server, next, new Date(at));
    expect(applyHostedMembershipActivation(runtime, server, next, new Date(at))).toBe(false);
    return next;
  };
  return { runtime, server, context, balances, bountyCommand, cancelCommand, memberships, rejoin };
};

describe("hosted departure escrow boundaries", () => {
  it("cannot cancel or expire old bounty into a new starter, including repeated cleanup and activation", () => {
    const f = createFixture();
    f.runtime.state = createBounty(f.runtime.state, f.bountyCommand, f.context).nextState;
    expect(f.balances().cash).toBe(1000);
    f.rejoin();
    expect(f.balances().cash).toBe(6000);
    const cancelled = cancelBounty(f.runtime.state, f.cancelCommand, f.context);
    expect(cancelled.errors[0]?.code).toBe("bounty_cancel_not_active");
    f.runtime.state = cancelled.nextState;
    f.runtime.state.root.tick += 100000;
    f.runtime.state = expireBounties(f.runtime.state, f.context).nextState;
    expect(f.balances().cash).toBe(6000);
    expect(applyHostedEarlyLeaveCleanup(f.runtime, "player:1", "membership:1")).toBe(false);
    expect(f.runtime.state.playersById["player:1"].status).toBe("active");
  });

  it("refunds the active creator exactly once when the target leaves, before or after expiry/claim attempts", () => {
    const f = createFixture();
    f.runtime.state = createBounty(f.runtime.state, f.bountyCommand, f.context).nextState;
    f.rejoin(1);
    expect(f.balances().cash).toBe(6000);
    expect(f.runtime.state.bountiesById!["bounty:command:escrow"]).toMatchObject({ status: "cancelled", settlementReason: "target_left", refundedCleanCash: 5000 });
    expect(createBountyReadModel(f.runtime.state, "player:1").recentBountyEvents.some((entry) => entry.label.includes("odměna vrácena"))).toBe(true);
    f.runtime.state = resolveBountyClaims(f.runtime.state, { actorPlayerId: "player:3", targetPlayerId: "player:2", targetDistrictId: f.memberships[1].reservedSpawnDistrictId,
      actionType: "attack-district", successfulAttack: true, capturesDistrict: true, destroysDistrict: false, commandId: "late-claim" }).nextState;
    f.runtime.state.root.tick += 100000;
    f.runtime.state = expireBounties(f.runtime.state, f.context).nextState;
    expect(f.balances().cash).toBe(6000);
    expect(f.balances("player:3").cash).toBe(6000);
  });

  it("never refunds an already claimed bounty on target cleanup", () => {
    const f = createFixture();
    f.runtime.state = createBounty(f.runtime.state, f.bountyCommand, f.context).nextState;
    f.runtime.state = resolveBountyClaims(f.runtime.state, { actorPlayerId: "player:3", targetPlayerId: "player:2", targetDistrictId: f.memberships[1].reservedSpawnDistrictId,
      actionType: "attack-district", successfulAttack: true, capturesDistrict: false, destroysDistrict: false, commandId: "claim" }).nextState;
    f.rejoin(1);
    expect(f.balances().cash).toBe(1000);
    expect(f.balances("player:3").cash).toBe(11000);
  });

  it.each(["cancel", "expire", "buy"])("closes old market escrow before rejoin: %s", (operation) => {
    const f = createFixture();
    const listing = createPlayerMarketListing(f.runtime.state, f.runtime.state.playersById["player:1"], "chemicals", 5, 10, "cleanCash", Date.parse(at));
    expect(listing.success).toBe(true);
    f.runtime.state = listing.nextState as typeof f.runtime.state;
    expect(f.balances().chemicals).toBe(5);
    f.rejoin();
    const current = f.runtime.state;
    if (operation === "cancel") f.runtime.state = cancelPlayerMarketListing(current, current.playersById["player:1"], listing.listingId!, Date.parse(at)).nextState as typeof current;
    if (operation === "expire") f.runtime.state = tickMarket(current, Date.parse(at) + 3600000).nextState as typeof current;
    if (operation === "buy") {
      const purchase = buyPlayerMarketListing(current, current.playersById["player:2"], listing.listingId!, Date.parse(at));
      expect(purchase.success).toBe(false);
      f.runtime.state = purchase.nextState as typeof current;
      expect(f.balances("player:2").cash).toBe(6000);
    }
    expect(f.balances().chemicals).toBe(10);
    expect(f.balances().cash).toBe(6000);
  });

  it("a purchase committed before leave keeps the buyer's goods and cannot pay the new attempt", () => {
    const f = createFixture();
    const listing = createPlayerMarketListing(f.runtime.state, f.runtime.state.playersById["player:1"], "chemicals", 5, 10, "cleanCash", Date.parse(at));
    f.runtime.state = listing.nextState as typeof f.runtime.state;
    const purchase = buyPlayerMarketListing(f.runtime.state, f.runtime.state.playersById["player:2"], listing.listingId!, Date.parse(at));
    expect(purchase.success).toBe(true);
    f.runtime.state = purchase.nextState as typeof f.runtime.state;
    f.rejoin();
    expect(f.balances("player:2").chemicals).toBe(15);
    expect(f.balances("player:2").cash).toBe(5950);
    expect(f.balances().cash).toBe(6000);
    expect(buyPlayerMarketListing(f.runtime.state, f.runtime.state.playersById["player:2"], listing.listingId!, Date.parse(at)).success).toBe(false);
  });
});
