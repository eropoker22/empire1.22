import type {
  CooldownState,
  PlayerSpyOperationState,
  SpyDistrictCommand
} from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import { CORE_EVENT_TYPES, createEvent } from "../events";
import {
  calculateBaseDefensePower,
  applyDistrictOperationLock,
  resolveSpy,
  resolvePlayerSpyBoostEffects,
  type SpyOutcome
} from "../rules";
import {
  applyFactionChanceBonus,
  applyFactionTrapDetectionChance,
  getFactionPassiveModifiers,
  resolveFactionAlarmEffectivenessMultiplier,
  resolveFactionCameraEffectivenessMultiplier
} from "../rules/factions/factionRules";
import { composeEntityId } from "../utils";
import {
  getPlayerSpyOperationState,
  resolveAvailableSpySlot,
  validateSpy
} from "../validation";
import { increasePlayerPoliceHeat } from "./playerPoliceState";
import { applyGarageCooldownReductionTicks } from "./garageBuildingActions";
import { resolveCombinedCameraAlarmBonuses } from "./recruitmentCenterBuildingActions";
import { createSpyReportNotification } from "./conflictReportNotifications";
import { bumpDistrictConflictRevision } from "../state";

/**
 * Responsibility: Orchestrates one authoritative spy command and report creation.
 * Belongs here: command-scoped spy validation, cooldown update, and report emission.
 * Does not belong here: UI fog-of-war rendering or transport concerns.
 */
export const handleSpyDistrict = (
  state: CoreGameState,
  command: SpyDistrictCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateSpy(state, command);

  if (errors.length > 0) {
    return {
      nextState: state,
      events: [],
      errors
    };
  }

  const player = state.playersById[command.playerId];
  const spyOperationState = getPlayerSpyOperationState(state, player.id);
  const selectedSlot = resolveAvailableSpySlot(state, player.id)!;
  const targetDistrict = state.districtsById[command.payload.districtId];
  const cooldownState = state.cooldownStatesById[player.cooldownStateId] ?? createPlayerCooldownState(player.id, player.cooldownStateId);
  const activeTrap = Object.values(state.trapsById).find(
    (trap) => targetDistrict.ownerPlayerId && trap.districtId === targetDistrict.id && trap.status === "active"
  );
  const targetDefenseLoadout = targetDistrict.ownerPlayerId ? targetDistrict.defenseLoadout : {};
  const reportEventId = composeEntityId("event", `${command.id}:district-spied`);
  const combinedCameraAlarmBonuses = resolveCombinedCameraAlarmBonuses({
    state,
    playerId: targetDistrict.ownerPlayerId,
    recruitmentCenterConfig: context.config.balance.recruitmentCenter,
    powerStationConfig: context.config.balance.powerStation,
    tick: state.root.tick
  });
  const defenderFactionModifiers = getFactionPassiveModifiers(state, targetDistrict.ownerPlayerId, context);
  const spyFactionModifiers = getFactionPassiveModifiers(state, player.id, context);
  const boostSnapshot = resolvePlayerSpyBoostEffects(state, player.id);
  const cameraStrengthBonusPct = ((1 + combinedCameraAlarmBonuses.cameraStrengthBonusPct / 100) * resolveFactionCameraEffectivenessMultiplier(defenderFactionModifiers) - 1) * 100;
  const alarmStrengthBonusPct = ((1 + combinedCameraAlarmBonuses.alarmStrengthBonusPct / 100) * resolveFactionAlarmEffectivenessMultiplier(defenderFactionModifiers) - 1) * 100;
  const reportResult = resolveSpy({
    worldSeed: state.serverInstance.worldSeed,
    playerId: player.id,
    targetDistrictId: targetDistrict.id,
    tick: state.root.tick,
    defenseLoadout: targetDefenseLoadout,
    targetSecurity: calculateBaseDefensePower(targetDefenseLoadout),
    hasActiveTrap: Boolean(activeTrap),
    spyBaseSuccessChance: applyFactionChanceBonus(
      context.config.balance.conflict?.spyBaseSuccessChance ?? 0.72,
      spyFactionModifiers.spySuccessChanceBonus
    ),
    spyTrapRevealChance: applyFactionTrapDetectionChance(
      context.config.balance.conflict?.spyTrapRevealChance ?? 0.22,
      spyFactionModifiers
    ),
    cameraStrengthBonusPct,
    alarmStrengthBonusPct,
    criticalFailureChanceMultiplier: boostSnapshot.criticalFailureChanceMultiplier,
    extraIntelBlocksOnSuccess: boostSnapshot.extraIntelBlocksOnSuccess
  });
  const spyCooldownTicks = applyGarageCooldownReductionTicks({
    baseTicks: context.config.balance.conflict?.spySlotCooldownTicks
      ?? context.config.balance.conflict?.spyCooldownTicks
      ?? 2,
    state,
    playerId: player.id,
    config: context.config.balance.garage,
    category: "districtSpy"
  });
  const boostedSpyCooldownTicks = Math.max(1, Math.ceil(spyCooldownTicks * boostSnapshot.spyDurationMultiplier));
  const slotAvailableAtTick = state.root.tick + boostedSpyCooldownTicks;
  const blockedUntilTick = isBlockedSpyOutcome(reportResult.result) ? slotAvailableAtTick : null;
  const report = createSpyReportNotification({
    command,
    playerId: player.id,
    targetDistrictId: targetDistrict.id,
    targetOwnerPlayerId: targetDistrict.ownerPlayerId,
    targetSecurityRevision: targetDistrict.securityRevision,
    purpose: targetDistrict.ownerPlayerId ? "attack_owned_district" : "occupy_empty_district",
    reportResult,
    blockedUntilTick,
    tick: state.root.tick,
    eventId: reportEventId,
    boostSnapshot,
    authorizationTtlTicks: context.config.balance.conflict?.spyAuthorizationTtlTicks ?? 120
  });
  const spyCooldownKey = `spy:${targetDistrict.id}`;
  const nextSpySlots = spyOperationState.slots.map((slot) => slot.slotId === selectedSlot.slotId
    ? { ...slot, availableAtTick: slotAvailableAtTick, lastMissionId: command.id }
    : slot) as PlayerSpyOperationState["slots"];
  const nextPoliceState = reportResult.result === "critical_failed"
    ? increasePlayerPoliceHeat(state, player, reportResult.heatGained, state.root.tick)
    : state.policeStatesById[player.policeStateId];

  return {
    nextState: {
      ...state,
      playersById: {
        ...state.playersById,
        [player.id]: {
          ...player,
          lastActionAt: command.issuedAt,
          version: player.version + 1
        }
      },
      cooldownStatesById: {
        ...state.cooldownStatesById,
        [cooldownState.id]: {
          ...cooldownState,
          cooldowns: {
            ...cooldownState.cooldowns,
            [spyCooldownKey]: slotAvailableAtTick
          },
          version: cooldownState.version + (state.cooldownStatesById[cooldownState.id] ? 1 : 0)
        }
      },
      districtsById: {
        ...state.districtsById,
        [targetDistrict.id]: bumpDistrictConflictRevision(applyDistrictOperationLock(
          targetDistrict,
          "spy",
          slotAvailableAtTick
        ))
      },
      playerSpyOperationStatesByPlayerId: {
        ...state.playerSpyOperationStatesByPlayerId,
        [player.id]: {
          ...spyOperationState,
          slots: nextSpySlots,
          version: spyOperationState.version + 1
        }
      },
      policeStatesById: nextPoliceState
        ? { ...state.policeStatesById, [nextPoliceState.id]: nextPoliceState }
        : state.policeStatesById,
      notificationsById: {
        ...state.notificationsById,
        [report.id]: report
      },
      root: {
        ...state.root,
        notificationIds: [...state.root.notificationIds, report.id],
        version: state.root.version + 1
      }
    },
    events: [
      createEvent(CORE_EVENT_TYPES.districtSpied, {
        attackerPlayerId: player.id,
        sourceDistrictId: command.payload.sourceDistrictId,
        targetDistrictId: targetDistrict.id,
        result: reportResult.result,
        trapDetected: reportResult.trapDetected,
        occupyUnlocked: reportResult.occupyUnlocked,
        blockedUntilTick,
        boostId: boostSnapshot.boostId
      }),
      createEvent(CORE_EVENT_TYPES.notificationCreated, {
        notificationId: report.id,
        recipientId: player.id,
        category: report.category
      })
    ],
    errors: []
  };
};

const createPlayerCooldownState = (
  playerId: string,
  cooldownStateId: string
): CooldownState => ({
  id: cooldownStateId,
  ownerType: "player",
  ownerId: playerId,
  cooldowns: {},
  version: 1
});

const isBlockedSpyOutcome = (result: SpyOutcome): boolean =>
  result === "failed" || result === "critical_failed";
