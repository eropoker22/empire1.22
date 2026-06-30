import type {
  AllianceLifecycleCommand
} from "@empire/shared-types";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import {
  castAllianceKickVote,
  confirmAllianceReady,
  disbandAlliance,
  leaveAlliance,
  startInactiveMemberKickVote
} from "../rules/alliances/allianceLifecycle";
import { handleAllianceMembershipCommand } from "./allianceMembership";

export const handleAllianceLifecycleCommand = (
  state: CoreGameState,
  command: AllianceLifecycleCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  switch (command.type) {
    case "create-alliance":
    case "join-alliance":
    case "invite-alliance-member":
    case "respond-alliance-invite":
    case "send-alliance-chat-message":
      return handleAllianceMembershipCommand(state, command, context);
    case "confirm-alliance-ready":
      return confirmAllianceReady(state, command, context);
    case "start-alliance-kick-vote":
      return startInactiveMemberKickVote(state, command, context);
    case "cast-alliance-kick-vote":
      return castAllianceKickVote(state, command, context);
    case "leave-alliance":
      return leaveAlliance(state, command, context);
    case "disband-alliance":
      return disbandAlliance(state, command, context);
    default:
      return {
        nextState: state,
        events: [],
        errors: [{ code: "unsupported_command", message: "Unsupported alliance command." }]
      };
  }
};
