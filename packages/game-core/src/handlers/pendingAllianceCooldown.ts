import type { PendingDistrictActionOperation } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { resolveActiveAlliancePenaltyStatModifiers } from "../rules/alliances/alliancePenaltyModifiers";
import { calendarTimeAtTick } from "../rules/elimination/serverCalendar";

export const snapshotAllianceActionCooldown = (state: CoreGameState, operation: PendingDistrictActionOperation, context: GameCoreContext): number =>
  resolveActiveAlliancePenaltyStatModifiers(state, operation.playerId,
    context.clock?.nowIso() ?? new Date(calendarTimeAtTick(state, state.root.tick, context.config.tickRateMs)).toISOString(),
    operation.operationType).actionCooldownMultiplier;

/** The penalty is a recovery lock, not slower travel. Snapshot it on acceptance.
 * Existing faction/garage/day modifiers have already produced the base cooldown.
 * Healthy spies have no base recovery: apply only the extra fraction of travel.
 * Target protection and mission duration are unchanged. Cancellation has no new lock. */
export const applyPendingAllianceCooldown = (state: CoreGameState, operation: PendingDistrictActionOperation): CoreGameState => {
  const multiplier = operation.allianceCooldownMultiplier ?? 1;
  const player = state.playersById[operation.playerId];
  const cooldown = player ? state.cooldownStatesById[player.cooldownStateId] : null;
  if (!cooldown || !player || !Number.isFinite(multiplier) || multiplier <= 1) return state;
  const cooldowns = { ...cooldown.cooldowns };
  const spyExtra = operation.operationType === "spy" ? Math.ceil((operation.resolveAtTick - operation.issuedAtTick) * (multiplier - 1)) : 0;
  for (const key of operation.cooldownKeys) {
    const base = Math.max(0, Number(cooldowns[key] ?? state.root.tick) - state.root.tick);
    cooldowns[key] = state.root.tick + Math.max(Math.ceil(base * multiplier), spyExtra);
  }
  const spyUntil = cooldowns[`spy:${operation.targetDistrictId}`];
  const spyState = state.playerSpyOperationStatesByPlayerId?.[player.id];
  const nextState: CoreGameState = {
    ...state,
    cooldownStatesById: { ...state.cooldownStatesById, [cooldown.id]: { ...cooldown, cooldowns, version: cooldown.version + 1 } },
    ...(operation.spySlotId && spyState ? { playerSpyOperationStatesByPlayerId: {
      ...state.playerSpyOperationStatesByPlayerId,
      [player.id]: { ...spyState, slots: spyState.slots.map(slot => slot.slotId === operation.spySlotId
        ? { ...slot, availableAtTick: Math.max(slot.availableAtTick, spyUntil) } : slot) as typeof spyState.slots, version: spyState.version + 1 }
    } } : {})
  };
  const prefix = `notification:${operation.command.id}:`;
  const recoveryUntil = Math.max(...operation.cooldownKeys.map(key => cooldowns[key]));
  const notificationsById = { ...nextState.notificationsById };
  for (const [id, note] of Object.entries(notificationsById)) {
    if (!id.startsWith(prefix) || !note.category.startsWith("report.")) continue;
    notificationsById[id] = { ...note, payload: { ...note.payload,
      cooldownEndsAtTick: operation.operationType === "spy" ? spyUntil : recoveryUntil,
      cooldownTicks: recoveryUntil - state.root.tick,
      ...(operation.operationType === "spy" && note.payload.blockedUntilTick ? { blockedUntilTick: spyUntil } : {})
    } };
  }
  return { ...nextState, notificationsById };
};
