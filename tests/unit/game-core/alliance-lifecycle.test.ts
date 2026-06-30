import { describe, expect, it } from "vitest";
import {
  applyCommand,
  calculateRequiredYesVotes,
  createInitialState,
  deriveAllianceMembershipStatus,
  runTick
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import type {
  Alliance,
  AllianceMembership,
  GameCommand,
  Player
} from "@empire/shared-types";
import { createPlayerFixture } from "../../fixtures/game-state-fixtures";

const BASE_TIME = "2026-01-01T00:00:00.000Z";

describe("alliance lifecycle", () => {
  it("derives the six hour READY cycle and rejects early READY", () => {
    const { state, membership } = createAllianceState(["player:1", "player:2"]);
    const config = resolveModeConfig("free");

    expect(deriveAllianceMembershipStatus(membership, addHours(BASE_TIME, 3), config.balance.allianceLifecycle)).toBe("active");
    expect(deriveAllianceMembershipStatus(membership, addHours(BASE_TIME, 5), config.balance.allianceLifecycle)).toBe("due_soon");
    expect(deriveAllianceMembershipStatus(membership, addHours(BASE_TIME, 7), config.balance.allianceLifecycle)).toBe("overdue");
    expect(deriveAllianceMembershipStatus(membership, addHours(BASE_TIME, 9), config.balance.allianceLifecycle)).toBe("vote_eligible");

    const result = applyCommand(
      state,
      command("confirm-alliance-ready", "player:1", { allianceId: "alliance:1" }),
      context(addHours(BASE_TIME, 3))
    );

    expect(result.errors[0]?.code).toBe("READY_TOO_EARLY");
  });

  it("accepts READY in due soon, overdue, and vote eligible windows", () => {
    for (const [label, nowIso] of [
      ["due_soon", addHours(BASE_TIME, 5)],
      ["overdue", addHours(BASE_TIME, 7)],
      ["vote_eligible", addHours(BASE_TIME, 9)]
    ] as const) {
      const { state } = createAllianceState(["player:1", "player:2"]);
      const result = applyCommand(
        state,
        command("confirm-alliance-ready", "player:1", { allianceId: "alliance:1" }, `command:ready:${label}`),
        context(nowIso)
      );

      const updated = result.nextState.alliancesById["alliance:1"].membershipByPlayerId?.["player:1"];
      expect(result.errors).toEqual([]);
      expect(updated?.status).toBe("active");
      expect(updated?.lastReadyAt).toBe(nowIso);
    }
  });

  it("calculates kick vote thresholds for 2, 3, and 4 member alliances", () => {
    expect(calculateRequiredYesVotes(1)).toBe(1);
    expect(calculateRequiredYesVotes(2)).toBe(2);
    expect(calculateRequiredYesVotes(3)).toBe(2);
  });

  it("starts a vote only for vote eligible members and READY cancels it", () => {
    const { state } = createAllianceState(["player:1", "player:2", "player:3"]);
    const voteResult = applyCommand(
      state,
      command("start-alliance-kick-vote", "player:1", {
        allianceId: "alliance:1",
        targetPlayerId: "player:2"
      }, "command:start-vote"),
      context(addHours(BASE_TIME, 9))
    );
    const vote = Object.values(voteResult.nextState.alliancesById["alliance:1"].kickVotesById ?? {})[0];
    expect(vote.status).toBe("pending");
    expect(vote.requiredYesVotes).toBe(2);

    const readyResult = applyCommand(
      voteResult.nextState,
      command("confirm-alliance-ready", "player:2", { allianceId: "alliance:1" }, "command:ready-cancel"),
      context(addHours(BASE_TIME, 9.25))
    );

    const cancelledVote = readyResult.nextState.alliancesById["alliance:1"].kickVotesById?.[vote.id];
    expect(readyResult.errors).toEqual([]);
    expect(cancelledVote?.status).toBe("cancelled_by_ready");
    expect(readyResult.nextState.alliancesById["alliance:1"].membershipByPlayerId?.["player:2"].status).toBe("active");
  });

  it("passes an inactive kick vote, removes membership, applies mild penalty, and creates truce", () => {
    const { state } = createAllianceState(["player:1", "player:2", "player:3", "player:4"]);
    const started = applyCommand(
      state,
      command("start-alliance-kick-vote", "player:1", {
        allianceId: "alliance:1",
        targetPlayerId: "player:2"
      }, "command:start-kick"),
      context(addHours(BASE_TIME, 9))
    );
    const voteId = Object.keys(started.nextState.alliancesById["alliance:1"].kickVotesById ?? {})[0];
    const firstYes = applyCommand(
      started.nextState,
      command("cast-alliance-kick-vote", "player:1", { voteId, choice: "yes" }, "command:vote-1"),
      context(addHours(BASE_TIME, 9.1))
    );
    const secondYes = applyCommand(
      firstYes.nextState,
      command("cast-alliance-kick-vote", "player:3", { voteId, choice: "yes" }, "command:vote-2"),
      context(addHours(BASE_TIME, 9.2))
    );

    const alliance = secondYes.nextState.alliancesById["alliance:1"];
    const penalty = Object.values(secondYes.nextState.allianceExitPenaltiesById ?? {})[0];
    expect(secondYes.errors).toEqual([]);
    expect(alliance.memberIds).not.toContain("player:2");
    expect(alliance.membershipByPlayerId?.["player:2"].removedReason).toBe("inactive_kick");
    expect(secondYes.nextState.playersById["player:2"].allianceId).toBeNull();
    expect(penalty.reason).toBe("inactive_kick");
    expect(penalty.influenceGenerationMultiplier).toBe(1);
    expect(Object.values(secondYes.nextState.formerAllianceTrucesById ?? {})).toHaveLength(3);
  });

  it("voluntary leader leave transfers leadership and applies the stronger debuff", () => {
    const { state } = createAllianceState(["player:1", "player:2"]);
    const result = applyCommand(
      state,
      command("leave-alliance", "player:1", {
        allianceId: "alliance:1",
        chosenSuccessorPlayerId: "player:2"
      }, "command:leave"),
      context(addHours(BASE_TIME, 1))
    );
    const alliance = result.nextState.alliancesById["alliance:1"];
    const penalty = Object.values(result.nextState.allianceExitPenaltiesById ?? {})[0];

    expect(result.errors).toEqual([]);
    expect(alliance.ownerPlayerId).toBe("player:2");
    expect(alliance.membershipByPlayerId?.["player:2"].role).toBe("leader");
    expect(penalty.reason).toBe("voluntary_leave");
    expect(penalty.influenceGenerationMultiplier).toBe(0.8);
    expect(penalty.actionCooldownMultiplier).toBe(1.15);
  });

  it("disband does not apply betrayal debuff", () => {
    const { state } = createAllianceState(["player:1", "player:2"]);
    const result = applyCommand(
      state,
      command("disband-alliance", "player:1", { allianceId: "alliance:1" }, "command:disband"),
      context(addHours(BASE_TIME, 1))
    );
    const penalties = Object.values(result.nextState.allianceExitPenaltiesById ?? {});

    expect(result.errors).toEqual([]);
    expect(result.nextState.alliancesById["alliance:1"].status).toBe("disbanded");
    expect(penalties).toHaveLength(2);
    expect(penalties.every((penalty) => penalty.reason === "alliance_disbanded")).toBe(true);
    expect(penalties.every((penalty) => penalty.influenceGenerationMultiplier === 1)).toBe(true);
  });

  it("creates, joins, invites and writes server alliance chat", () => {
    const state = createInitialState("instance:1", "free");
    for (const playerId of ["player:1", "player:2", "player:3"]) {
      state.playersById[playerId] = createPlayerFixture({
        id: playerId,
        accountId: `account:${playerId}`,
        name: playerId,
        resourceStateId: `resource:${playerId}`,
        cooldownStateId: `cooldown:${playerId}`,
        effectStateId: `effect:${playerId}`,
        policeStateId: `police:${playerId}`
      }) as Player;
      state.root.playerIds.push(playerId);
    }

    const created = applyCommand(
      state,
      command("create-alliance", "player:1", { name: "Neon Pact", tag: "NP" }, "command:create-alliance"),
      context(BASE_TIME)
    );
    const allianceId = Object.keys(created.nextState.alliancesById)[0];
    expect(created.errors).toEqual([]);
    expect(created.nextState.playersById["player:1"].allianceId).toBe(allianceId);

    const joined = applyCommand(
      created.nextState,
      command("join-alliance", "player:2", { allianceId }, "command:join-alliance"),
      context(BASE_TIME)
    );
    expect(joined.errors).toEqual([]);
    expect(joined.nextState.alliancesById[allianceId].memberIds).toContain("player:2");

    const invited = applyCommand(
      joined.nextState,
      command("invite-alliance-member", "player:1", { allianceId, targetPlayerId: "player:3" }, "command:invite-alliance"),
      context(BASE_TIME)
    );
    const inviteId = Object.keys(invited.nextState.allianceInvitesById ?? {})[0];
    expect(invited.errors).toEqual([]);
    expect(invited.nextState.allianceInvitesById?.[inviteId].status).toBe("pending");

    const accepted = applyCommand(
      invited.nextState,
      command("respond-alliance-invite", "player:3", { inviteId, response: "accept" }, "command:accept-invite"),
      context(BASE_TIME)
    );
    expect(accepted.errors).toEqual([]);
    expect(accepted.nextState.playersById["player:3"].allianceId).toBe(allianceId);

    const chatted = applyCommand(
      accepted.nextState,
      command("send-alliance-chat-message", "player:2", { allianceId, body: "Ready." }, "command:chat"),
      context(BASE_TIME)
    );
    expect(chatted.errors).toEqual([]);
    expect(Object.values(chatted.nextState.allianceChatMessagesById ?? {})[0]).toMatchObject({
      allianceId,
      authorPlayerId: "player:2",
      body: "Ready."
    });
  });

  it("scheduled processing emits readiness notifications once per cycle", () => {
    const { state } = createAllianceState(["player:1", "player:2"]);
    const first = runTick(state, context(addHours(BASE_TIME, 5.1)));
    const second = runTick(first.nextState, context(addHours(BASE_TIME, 5.2)));
    const warningIds = second.nextState.root.notificationIds.filter((id) =>
      id.startsWith("alliance-ready-warning:alliance:1:player:1")
    );

    expect(warningIds).toHaveLength(1);
  });
});

const context = (nowIso: string) => ({
  config: resolveModeConfig("free"),
  clock: {
    now: () => new Date(nowIso),
    nowIso: () => nowIso
  }
});

const command = (
  type: GameCommand["type"],
  playerId: string,
  payload: Record<string, unknown>,
  id = `command:${type}:${playerId}`
): GameCommand => ({
  id,
  type,
  mode: "free",
  playerId,
  serverInstanceId: "instance:1",
  issuedAt: BASE_TIME,
  payload,
  clientRequestId: null
} as unknown as GameCommand);

const createAllianceState = (playerIds: string[]) => {
  const state = createInitialState("instance:1", "free");
  for (const playerId of playerIds) {
    const player = createPlayerFixture({
      id: playerId,
      accountId: `account:${playerId}`,
      name: playerId,
      allianceId: "alliance:1",
      resourceStateId: `resource:${playerId}`,
      cooldownStateId: `cooldown:${playerId}`,
      effectStateId: `effect:${playerId}`,
      policeStateId: `police:${playerId}`
    }) as Player;
    state.playersById[playerId] = player;
    state.root.playerIds.push(playerId);
  }
  const membershipByPlayerId = Object.fromEntries(playerIds.map((playerId, index) => [
    playerId,
    createMembership(playerId, index === 0 ? "leader" : "member")
  ]));
  const alliance: Alliance = {
    id: "alliance:1",
    serverInstanceId: "instance:1",
    name: "Alliance",
    tag: "AL",
    ownerPlayerId: playerIds[0],
    memberIds: [...playerIds],
    membershipByPlayerId,
    kickVotesById: {},
    status: "active",
    createdAt: BASE_TIME,
    version: 1
  };
  state.alliancesById[alliance.id] = alliance;
  state.root.allianceIds.push(alliance.id);
  return { state, membership: membershipByPlayerId[playerIds[0]] };
};

const createMembership = (
  playerId: string,
  role: AllianceMembership["role"]
): AllianceMembership => ({
  allianceId: "alliance:1",
  playerId,
  role,
  joinedAt: BASE_TIME,
  status: "active",
  lastReadyAt: BASE_TIME,
  readyDueAt: addHours(BASE_TIME, 6),
  graceEndsAt: addHours(BASE_TIME, 8),
  version: 1
});

const addHours = (isoValue: string, hours: number): string =>
  new Date(Date.parse(isoValue) + hours * 60 * 60 * 1000).toISOString();
