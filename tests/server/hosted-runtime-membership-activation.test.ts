import { describe, expect, it } from "vitest";
import { ensureGameplaySliceMembershipInState } from "../../apps/server/src/bootstrap/gameplay-slice-session-membership";
import {
  applyHostedMembershipActivation,
  type HostedMembershipRecord
} from "../../apps/server/src/admin/hosted/hosted-runtime-membership-activation";
import type { HostedServerRecord } from "../../apps/server/src/admin/hosted/hosted-control-plane-repository";
import { createServerInstanceRuntime } from "../../apps/server/src/runtime/instance-manager/instance-factory";
import { createCoreStateFixture } from "../fixtures/game-state-fixtures";

describe("hosted runtime membership activation", () => {
  it("synchronizes identity once and leaves player and root versions stable on replay", () => {
    const instanceId = "instance:membership-identity";
    const runtime = createServerInstanceRuntime(instanceId, "free");
    runtime.state = createCoreStateFixture(instanceId);
    const membership = createMembership(instanceId);
    const server = { mode: "free", startingPlayerState: undefined } as HostedServerRecord;
    const seeded = ensureGameplaySliceMembershipInState(runtime.state, {
      serverInstanceId: instanceId,
      playerId: membership.playerId,
      factionId: membership.factionId,
      mode: server.mode,
      startingPlayerState: server.startingPlayerState
    });

    expect(seeded.accepted).toBe(true);
    runtime.state = seeded.state;
    const player = runtime.state.playersById[membership.playerId];
    runtime.state.playersById[membership.playerId] = {
      ...player,
      accountId: "account:stale",
      name: "Stale Name",
      color: "#ffffff",
      metadata: {
        ...(player.metadata ?? {}),
        membershipId: membership.membershipId,
        avatarId: "avatar:stale",
        displayName: "Stale Name",
        gangName: "Stale Gang",
        setupComplete: true,
        starterPackageApplied: true
      }
    };
    const playerVersionBefore = runtime.state.playersById[membership.playerId].version;
    const rootVersionBefore = runtime.state.root.version;

    expect(applyHostedMembershipActivation(runtime, server, membership, new Date(0))).toBe(true);
    expect(runtime.state.playersById[membership.playerId]).toMatchObject({
      accountId: membership.accountId,
      name: membership.accountDisplayName,
      color: membership.gangColor,
      version: playerVersionBefore + 1,
      metadata: {
        membershipId: membership.membershipId,
        avatarId: membership.avatarId,
        displayName: membership.accountDisplayName,
        gangName: membership.gangName,
        setupComplete: true,
        starterPackageApplied: true
      }
    });
    expect(runtime.state.root.version).toBe(rootVersionBefore + 1);

    const playerVersionAfterSync = runtime.state.playersById[membership.playerId].version;
    const rootVersionAfterSync = runtime.state.root.version;
    expect(applyHostedMembershipActivation(runtime, server, membership, new Date(0))).toBe(false);
    expect(runtime.state.playersById[membership.playerId].version).toBe(playerVersionAfterSync);
    expect(runtime.state.root.version).toBe(rootVersionAfterSync);
  });
});

const createMembership = (serverInstanceId: string): HostedMembershipRecord => ({
  membershipId: "membership:identity",
  accountId: "account:identity",
  serverInstanceId,
  serverDisplayName: "Identity Test",
  serverMode: "free",
  accountDisplayName: "Identity Player",
  gangName: "Identity Gang",
  playerId: "player:1",
  reservedSpawnDistrictId: "district:1",
  status: "active",
  factionId: "mafian",
  avatarId: "avatar:identity",
  gangColor: "#ff4fa3",
  joinedAt: new Date(0).toISOString(),
  earlyLeaveDeadline: null,
  serverStartedAt: null,
  setupCompletedAt: new Date(0).toISOString(),
  earlyLeaveAt: null,
  completedAt: null,
  finalRank: null,
  finalScore: null,
  finalScoreBreakdown: null,
  starterPackageAppliedAt: new Date(0).toISOString(),
  joinTicketId: "join-ticket:identity",
  version: 1
});
