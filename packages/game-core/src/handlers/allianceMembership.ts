import type {
  Alliance,
  AllianceChatMessage,
  AllianceInvite,
  CreateAllianceCommand,
  InviteAllianceMemberCommand,
  JoinAllianceCommand,
  RespondAllianceInviteCommand,
  SendAllianceChatMessageCommand,
  SendPublicAllianceInviteCommand,
  SendPublicAllianceMessageCommand
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
  sanitizeAllianceEmblemColor,
  sanitizeAllianceName,
  sanitizeAllianceTag,
  type AllianceMembershipResult
} from "./allianceMembershipUtils";

type AllianceMembershipCommand =
  | CreateAllianceCommand
  | JoinAllianceCommand
  | InviteAllianceMemberCommand
  | RespondAllianceInviteCommand
  | SendAllianceChatMessageCommand
  | SendPublicAllianceMessageCommand
  | SendPublicAllianceInviteCommand;

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
    case "send-public-alliance-message":
      return sendPublicAllianceMessage(state, command, context);
    case "send-public-alliance-invite":
      return sendPublicAllianceInvite(state, command, context);
    default:
      return rejected(state, "unsupported_command", "Nepodporovaný membership command aliance.");
  }
};

const createAlliance = (
  state: CoreGameState,
  command: CreateAllianceCommand,
  context: GameCoreContext
): AllianceMembershipResult => {
  const player = state.playersById[command.playerId];
  if (!player) return rejected(state, "PLAYER_NOT_FOUND", "Hráč nebyl nalezen.");
  const nowIso = nowIsoFromContext(context);
  const eligibility = canJoinOrCreateAlliance(state, player.id, "create", nowIso);
  if (eligibility !== true) return rejected(state, eligibility, "Teď nemůžeš založit alianci.");

  const name = sanitizeAllianceName(command.payload.name);
  if (!name) return rejected(state, "ALLIANCE_NAME_REQUIRED", "Název aliance je povinný.");
  const tag = sanitizeAllianceTag(command.payload.tag || name);
  const emblemColor = sanitizeAllianceEmblemColor(command.payload.emblemColor);
  const allianceId = `alliance:${command.id}`;
  const membership = createInitialAllianceMembership(allianceId, player.id, "leader", nowIso, context);
  const alliance: Alliance = {
    id: allianceId,
    serverInstanceId: state.serverInstance.id,
    name,
    tag,
    emblemColor,
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
  if (!alliance || alliance.status !== "active") return rejected(state, "ALLIANCE_NOT_FOUND", "Aliance nebyla nalezena.");
  if (!actorMembership || actorMembership.role !== "leader") return rejected(state, "ALLIANCE_INVITE_NOT_ALLOWED", "Členy může zvát jen leader aliance.");
  if (!target) return rejected(state, "TARGET_PLAYER_NOT_FOUND", "Cílový hráč nebyl nalezen.");
  if (target.allianceId) return rejected(state, "TARGET_ALREADY_IN_ALLIANCE", "Cílový hráč už je v alianci.");
  if (alliance.memberIds.length >= context.config.balance.maxAllianceSize) return rejected(state, "ALLIANCE_FULL", "Aliance je plná.");

  const pendingExists = Object.values(state.allianceInvitesById ?? {}).some((invite) =>
    invite.allianceId === alliance.id && invite.targetPlayerId === target.id && invite.status === "pending"
  );
  if (pendingExists) return rejected(state, "ALLIANCE_INVITE_ALREADY_PENDING", "Pozvánka do aliance už čeká na odpověď.");

  const nowIso = nowIsoFromContext(context);
  const invite: AllianceInvite = {
    id: `alliance-invite:${command.id}`,
    allianceId: alliance.id,
    invitedByPlayerId: command.playerId,
    targetPlayerId: target.id,
    targetAllianceId: null,
    kind: "member",
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
  if (!invite || invite.status !== "pending") return rejected(state, "ALLIANCE_INVITE_NOT_FOUND", "Pozvánka do aliance nebyla nalezena.");
  if (invite.targetPlayerId !== command.playerId) return rejected(state, "ALLIANCE_INVITE_NOT_OWNED", "Pozvánka patří jinému hráči.");

  const nowIso = nowIsoFromContext(context);
  const response = command.payload.response === "accept" ? "accepted" : "rejected";
  const isContactInvite = invite.kind === "alliance_contact";
  const targetAllianceId = invite.targetAllianceId ?? invite.allianceId;
  const isExternalJoinRequest = isContactInvite && invite.allianceId === targetAllianceId && invite.invitedByPlayerId !== invite.targetPlayerId;
  if (response === "accepted" && isExternalJoinRequest) {
    const joined = addPlayerToAlliance(state, invite.invitedByPlayerId, targetAllianceId, context, `${command.id}:accept-public`);
    if (joined.errors.length) return joined;
    const currentInvite = joined.nextState.allianceInvitesById?.[invite.id] ?? invite;
    return {
      nextState: {
        ...joined.nextState,
        allianceInvitesById: {
          ...(joined.nextState.allianceInvitesById ?? {}),
          [invite.id]: { ...currentInvite, status: response, respondedAt: nowIso, version: currentInvite.version + 1 }
        },
        root: { ...joined.nextState.root, version: joined.nextState.root.version + 1 }
      },
      events: [createEvent(CORE_EVENT_TYPES.allianceInviteResponded, { inviteId: invite.id, response }), ...joined.events],
      errors: []
    };
  }
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

  if (isContactInvite) {
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
    return rejected(state, "ALLIANCE_CHAT_NOT_ALLOWED", "Hráč není aktivní člen aliance.");
  }

  const body = String(command.payload.body || "").trim().slice(0, 240);
  if (!body) return rejected(state, "ALLIANCE_CHAT_EMPTY", "Zpráva do aliance je prázdná.");
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

const sendPublicAllianceMessage = (
  state: CoreGameState,
  command: SendPublicAllianceMessageCommand,
  context: GameCoreContext
): AllianceMembershipResult => {
  const actor = state.playersById[command.playerId];
  const actorAlliance = actor?.allianceId ? state.alliancesById[actor.allianceId] : null;
  const actorActiveAlliance = actorAlliance?.status === "active" ? actorAlliance : null;
  const targetAlliance = state.alliancesById[command.payload.allianceId];
  if (!actor) return rejected(state, "PLAYER_NOT_FOUND", "Hráč nebyl nalezen.");
  if (!targetAlliance || targetAlliance.status !== "active") {
    return rejected(state, "ALLIANCE_NOT_FOUND", "Cílová aliance nebyla nalezena.");
  }
  if (targetAlliance.id === actorActiveAlliance?.id) {
    return rejected(state, "PUBLIC_ALLIANCE_CONTACT_SELF", "Cílová aliance musí být jiná.");
  }

  const body = String(command.payload.body || "").trim().slice(0, 240);
  if (!body) return rejected(state, "ALLIANCE_CHAT_EMPTY", "Zpráva do aliance je prázdná.");
  const message: AllianceChatMessage = {
    id: `alliance-public-chat:${command.id}`,
    allianceId: targetAlliance.id,
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
    events: [createEvent(CORE_EVENT_TYPES.allianceChatMessageSent, { allianceId: targetAlliance.id, messageId: message.id, authorPlayerId: command.playerId })],
    errors: []
  };
};

const sendPublicAllianceInvite = (
  state: CoreGameState,
  command: SendPublicAllianceInviteCommand,
  context: GameCoreContext
): AllianceMembershipResult => {
  const actor = state.playersById[command.playerId];
  const actorAlliance = actor?.allianceId ? state.alliancesById[actor.allianceId] : null;
  const actorActiveAlliance = actorAlliance?.status === "active" ? actorAlliance : null;
  const targetAlliance = state.alliancesById[command.payload.allianceId];
  if (!actor) return rejected(state, "PLAYER_NOT_FOUND", "Hráč nebyl nalezen.");
  if (!targetAlliance || targetAlliance.status !== "active") {
    return rejected(state, "ALLIANCE_NOT_FOUND", "Cílová aliance nebyla nalezena.");
  }
  if (targetAlliance.id === actorActiveAlliance?.id) {
    return rejected(state, "PUBLIC_ALLIANCE_CONTACT_SELF", "Cílová aliance musí být jiná.");
  }
  const sourceAllianceId = actorActiveAlliance?.id ?? targetAlliance.id;

  const pendingExists = Object.values(state.allianceInvitesById ?? {}).some((invite) =>
    invite.kind === "alliance_contact"
    && invite.allianceId === sourceAllianceId
    && invite.invitedByPlayerId === actor.id
    && invite.targetAllianceId === targetAlliance.id
    && invite.status === "pending"
  );
  if (pendingExists) return rejected(state, "ALLIANCE_INVITE_ALREADY_PENDING", "Kontakt s touto aliancí už čeká na odpověď.");

  const nowIso = nowIsoFromContext(context);
  const invite: AllianceInvite = {
    id: `alliance-contact-invite:${command.id}`,
    allianceId: sourceAllianceId,
    invitedByPlayerId: command.playerId,
    targetPlayerId: targetAlliance.ownerPlayerId,
    targetAllianceId: targetAlliance.id,
    kind: "alliance_contact",
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
    events: [createEvent(CORE_EVENT_TYPES.allianceInviteCreated, { allianceId: sourceAllianceId, inviteId: invite.id, targetPlayerId: targetAlliance.ownerPlayerId })],
    errors: []
  };
};
