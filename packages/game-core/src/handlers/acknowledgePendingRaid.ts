import type { AcknowledgePendingRaidCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import type { CoreEvent } from "../events";
import type { GameCoreContext } from "../engine/context";
import { acknowledgePendingRaid } from "../rules/police/raidLifecycle";

/**
 * Responsibility: Command boundary for marking a pending raid as seen.
 * Belongs here: server-authored pending raid acknowledgement.
 * Does not belong here: preventing or applying raid consequences.
 */
export const handleAcknowledgePendingRaid = (
  state: CoreGameState,
  command: AcknowledgePendingRaidCommand,
  _context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const result = acknowledgePendingRaid(state, command.playerId, command.payload.raidId);

  return {
    ...result,
    errors: []
  };
};
