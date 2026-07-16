import type { ClaimEmergencyRecoveryCommand } from "@empire/shared-types";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";
import type { CoreEvent } from "../events";
import { CORE_EVENT_TYPES, createEvent, createNotification } from "../events";
import { resolvePlayerOperationalLiveness } from "../rules/liveness";

type Result = { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] };

export const handleClaimEmergencyRecovery = (
  state: CoreGameState,
  command: ClaimEmergencyRecoveryCommand,
  context: GameCoreContext
): Result => {
  const player = state.playersById[command.playerId];
  const config = context.config.balance.playerLiveness?.emergencyRecovery;
  if (!player || !config?.enabled) return rejected(state, "emergency_recovery_unavailable", "Nouzová zakázka není dostupná.");
  const liveness = resolvePlayerOperationalLiveness(state, player.id, context);
  if (!liveness.emergencyRecovery.canClaim) {
    return rejected(state, "emergency_recovery_not_eligible", "Hráč má jinou dostupnou cestu pokračování.");
  }
  const resources = state.resourceStatesById[player.resourceStateId];
  if (!resources) return rejected(state, "emergency_recovery_unavailable", "Hráčský účet nemá resource state.");
  const notification = createNotification({
    id: `notification:emergency-recovery:${command.id}`,
    recipientType: "player",
    recipientId: player.id,
    category: "report.recovery",
    title: "Nouzová zakázka dokončena.",
    bodyKey: "report.emergency_recovery",
    payload: { cleanCash: config.cleanCash, population: config.population, claimedAtTick: state.root.tick },
    createdAt: command.issuedAt,
    readAt: null
  });
  return {
    nextState: {
      ...state,
      playersById: {
        ...state.playersById,
        [player.id]: {
          ...player,
          population: player.population === undefined ? undefined : Math.max(0, player.population) + config.population,
          emergencyRecoveryUsedAtTick: state.root.tick,
          lastActionAt: command.issuedAt,
          version: player.version + 1
        }
      },
      resourceStatesById: {
        ...state.resourceStatesById,
        [resources.id]: {
          ...resources,
          balances: {
            ...resources.balances,
            cash: Math.max(0, Number(resources.balances.cash ?? 0)) + config.cleanCash,
            population: Math.max(0, Number(resources.balances.population ?? player.population ?? 0)) + config.population
          },
          lastUpdatedTick: state.root.tick,
          version: resources.version + 1
        }
      },
      notificationsById: { ...state.notificationsById, [notification.id]: notification },
      root: {
        ...state.root,
        notificationIds: [...state.root.notificationIds, notification.id],
        version: state.root.version + 1
      }
    },
    events: [
      createEvent(CORE_EVENT_TYPES.emergencyRecoveryClaimed, {
        playerId: player.id,
        cleanCash: config.cleanCash,
        population: config.population,
        claimedAtTick: state.root.tick
      }),
      createEvent(CORE_EVENT_TYPES.notificationCreated, {
        notificationId: notification.id,
        recipientId: player.id,
        category: notification.category
      })
    ],
    errors: []
  };
};

const rejected = (state: CoreGameState, code: string, message: string): Result => ({
  nextState: state,
  events: [],
  errors: [{ code, message }]
});
