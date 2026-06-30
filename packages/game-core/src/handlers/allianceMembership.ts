import type {
  Alliance,
  AllianceChatMessage,
  AllianceInvite,
  CreateAllianceCommand,
  InviteAllianceMemberCommand,
  JoinAllianceCommand,
  RespondAllianceInviteCommand,
  SendAllianceChatMessageCommand
} from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import { CORE_EVENT_TYPES, createEvent } from "../events";
import type { GameCoreContext } from "../engine/context";
import { canJoinOrCreateAlliance } from "../rules/alliances/allianceLifecycle";
import { addPlayerToAlliance } from "./allianceJoin";
import {
  createInitialAllianceMembership,
  nowIsoFromContext,
  rejected,
  sanitizeAllianceName,
  sanitizeAllianceTag,
  type AllianceMembershipResult
} from "./allianceMembershipUtils";

type AllianceMembershipCommand =
  | CreateAllianceCommand
  | JoinAllianceCommand
  | InviteAllianceMemberCommand
  | RespondAllianceInviteCommand
  | SendAllianceChatMessageCommand;

export const handleAllianceMembershipCommand = (
  state: CoreGameState,
  command: AllianceMembershipCommand,
  context: GameCoreContext
): AllianceMembershipResult => {
  switch (command.type) {
    case "create-alliance":
      return createAlliance(state, command, context);
    case "join-alliance":
      return joinAlliance(state, command, context);
    case "invite-alliance-member":
      return inviteAllianceMember(state, command, context);
    case "respond-alliance-invite":
      return respondAllianceInvite(state, command, context);
    case "send-alliance-chat-message":
      return sendAllianceChatMessage(state, command, context);
    default:
      return rejected(state, "unsupported_command", "Unsupported alliance membership command.");
  }
};

const createAlliance = (
  state: CoreGameState,
  command: CreateAllianceCommand,
  context: GameCoreContext
): AllianceMembershipResult => {
  const player = state.playersById[command.playerId];
  if (!player) return rejected(state, "PLAYER_NOT_FOUND", "Player was not found.");
  const nowIso = nowIsoFromContext(context);
  const eligibility = canJoinOrCreateAlliance(state, player.id, "create", nowIso);
  if (eligibility !== true) return rejected(state, eligibility, "Player cannot create an alliance right now.");

  const name = sanitizeAllianceName(command.payload.name);
  if (!name) return rejected(state, "ALLIANCE_NAME_REQUIRED", "Alliance name is required.");
  const tag = sanitizeAllianceTag(command.payload.tag || name);
  const allianceId = `alliance:${command.id}`;
  const membership = createInitialAllianceMembership(allianceId, player.id, "leader", nowIso, context);
  const alliance: Alliance = {
    id: allianceId,
    serverInstanceId: state.serverInstance.id,
    name,
    tag,
    ownerPlayerId: player.id,
    memberIds: [player.id],
    membershipByPlayerId: { [player.id]: membership },
    kickVotesById: {},
    status: "active",
    createdAt: nowIso,
    version: 1
  };

  const nextState: CoreGameState = {
    ...state,
    alliancesById: { ...state.alliancesById, [alliance.id]: alliance },
    playersById: {
      ...state.playersById,
      [player.id]: { ...player, allianceId: alliance.id, lastActionAt: command.issuedAt, version: player.version + 1 }
    },
    root: {
      ...state.root,
      allianceIds: [...state.root.allianceIds.filter((id) => id !== alliance.id), alliance.id],
      version: state.root.version + 1
    }
  };

  return {
    nextState,
    events: [createEvent(CORE_EVENT_TYPES.allianceCreated, { allianceId: alliance.id, playerId: player.id, name })],
    errors: []
  };
};

const joinAlliance = (
  state: CoreGameState,
  command: JoinAllianceCommand,
  context: GameCoreContext
): AllianceMembershipResult =>
  addPlayerToAlliance(state, command.playerId, command.payload.allianceId, context, `${command.id}:join`);

const inviteAllianceMember = (
  state: CoreGameState,
  command: InviteAllianceMemberCommand,
  context: GameCoreContext
): AllianceMembershipResult => {
  const alliance = state.alliancesById[command.payload.allianceId];
  const actorMembership = alliance?.membershipByPlayerId?.[command.playerId];
  const target = state.playersById[command.payload.targetPlayerId];
  if (!alliance || alliance.status !== "active") return rejected(state, "ALLIANCE_NOT_FOUND", "Alliance was not found.");
  if (!actorMembership || actorMembership.role !== "leader") return rejected(state, "ALLIANCE_INVITE_NOT_ALLOWED", "Only alliance leader can invite members.");
  if (!target) return rejected(state, "TARGET_PLAYER_NOT_FOUND", "Target player was not found.");
  if (target.allianceId) return rejected(state, "TARGET_ALREADY_IN_ALLIANCE", "Target player is already in an alliance.");
  if (alliance.memberIds.length >= context.config.balance.maxAllianceSize) return rejected(state, "ALLIANCE_FULL", "Alliance is full.");

  const pendingExists = Object.values(state.allianceInvitesById ?? {}).some((invite) =>
    invite.allianceId === alliance.id && invite.targetPlayerId === target.id && invite.status === "pending"
  );
  if (pendingExists) return rejected(state, "ALLIANCE_INVITE_ALREADY_PENDING", "Alliance invite is already pending.");

  const nowIso = nowIsoFromContext(context);
  const invite: AllianceInvite = {
    id: `alliance-invite:${command.id}`,
    allianceId: alliance.id,
    invitedByPlayerId: command.playerId,
    targetPlayerId: target.id,
    status: "pending",
    createdAt: nowIso,
    respondedAt: null,
    version: 1
  };

  return {
    nextState: {
      ...state,
      allianceInvitesById: { ...(state.allianceInvitesById ?? {}), [invite.id]: invite },
      root: { ...state.root, version: state.root.version + 1 }
    },
    events: [createEvent(CORE_EVENT_TYPES.allianceInviteCreated, { allianceId: alliance.id, inviteId: invite.id, targetPlayerId: target.id })],
    errors: []
  };
};

const respondAllianceInvite = (
  state: CoreGameState,
  command: RespondAllianceInviteCommand,
  context: GameCoreContext
): AllianceMembershipResult => {
  const invite = state.allianceInvitesById?.[command.payload.inviteId];
  if (!invite || invite.status !== "pending") return rejected(state, "ALLIANCE_INVITE_NOT_FOUND", "Alliance invite was not found.");
  if (invite.targetPlayerId !== command.playerId) return rejected(state, "ALLIANCE_INVITE_NOT_OWNED", "Alliance invite belongs to another player.");

  const nowIso = nowIsoFromContext(context);
  const response = command.payload.response === "accept" ? "accepted" : "rejected";
  const inviteState: CoreGameState = {
    ...state,
    allianceInvitesById: {
      ...(state.allianceInvitesById ?? {}),
      [invite.id]: { ...invite, status: response, respondedAt: nowIso, version: invite.version + 1 }
    },
    root: { ...state.root, version: state.root.version + 1 }
  };

  if (response === "rejected") {
    return {
      nextState: inviteState,
      events: [createEvent(CORE_EVENT_TYPES.allianceInviteResponded, { inviteId: invite.id, response })],
      errors: []
    };
  }

  const joined = addPlayerToAlliance(inviteState, command.playerId, invite.allianceId, context, `${command.id}:accept`);
  return {
    ...joined,
    events: [createEvent(CORE_EVENT_TYPES.allianceInviteResponded, { inviteId: invite.id, response }), ...joined.events]
  };
};

const sendAllianceChatMessage = (
  state: CoreGameState,
  command: SendAllianceChatMessageCommand,
  context: GameCoreContext
): AllianceMembershipResult => {
  const alliance = state.alliancesById[command.payload.allianceId];
  const membership = alliance?.membershipByPlayerId?.[command.playerId];
  if (!alliance || alliance.status !== "active" || !membership || membership.status === "removed") {
    return rejected(state, "ALLIANCE_CHAT_NOT_ALLOWED", "Player is not an active alliance member.");
  }

  const body = String(command.payload.body || "").trim().slice(0, 240);
  if (!body) return rejected(state, "ALLIANCE_CHAT_EMPTY", "Alliance chat message is empty.");
  const message: AllianceChatMessage = {
    id: `alliance-chat:${command.id}`,
    allianceId: alliance.id,
    authorPlayerId: command.playerId,
    body,
    createdAt: nowIsoFromContext(context),
    version: 1
  };

  return {
    nextState: {
      ...state,
      allianceChatMessagesById: { ...(state.allianceChatMessagesById ?? {}), [message.id]: message },
      root: { ...state.root, version: state.root.version + 1 }
    },
    events: [createEvent(CORE_EVENT_TYPES.allianceChatMessageSent, { allianceId: alliance.id, messageId: message.id, authorPlayerId: command.playerId })],
    errors: []
  };
};
