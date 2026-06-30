import type { Alliance } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import { CORE_EVENT_TYPES, createEvent } from "../events";
import type { GameCoreContext } from "../engine/context";
import { canJoinOrCreateAlliance } from "../rules/alliances/allianceLifecycle";
import {
  createInitialAllianceMembership,
  nowIsoFromContext,
  rejected,
  type AllianceMembershipResult
} from "./allianceMembershipUtils";

export const addPlayerToAlliance = (
  state: CoreGameState,
  playerId: string,
  allianceId: string,
  context: GameCoreContext,
  sourceId: string
): AllianceMembershipResult => {
  const player = state.playersById[playerId];
  const alliance = state.alliancesById[allianceId];
  if (!player) return rejected(state, "PLAYER_NOT_FOUND", "Player was not found.");
  if (!alliance || alliance.status !== "active") return rejected(state, "ALLIANCE_NOT_FOUND", "Alliance was not found.");
  const nowIso = nowIsoFromContext(context);
  const eligibility = canJoinOrCreateAlliance(state, player.id, "join", nowIso);
  if (eligibility !== true) return rejected(state, eligibility, "Player cannot join an alliance right now.");
  if (alliance.memberIds.length >= context.config.balance.maxAllianceSize) return rejected(state, "ALLIANCE_FULL", "Alliance is full.");

  const membership = createInitialAllianceMembership(alliance.id, player.id, "member", nowIso, context);
  const nextAlliance: Alliance = {
    ...alliance,
    memberIds: [...alliance.memberIds.filter((id) => id !== player.id), player.id],
    membershipByPlayerId: { ...(alliance.membershipByPlayerId ?? {}), [player.id]: membership },
    version: alliance.version + 1
  };

  return {
    nextState: {
      ...state,
      alliancesById: { ...state.alliancesById, [alliance.id]: nextAlliance },
      playersById: {
        ...state.playersById,
        [player.id]: { ...player, allianceId: alliance.id, version: player.version + 1 }
      },
      root: { ...state.root, version: state.root.version + 1 }
    },
    events: [createEvent(CORE_EVENT_TYPES.allianceJoined, { allianceId: alliance.id, playerId, sourceId })],
    errors: []
  };
};
