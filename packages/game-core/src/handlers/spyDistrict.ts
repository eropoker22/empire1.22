import type {
  CooldownState,
  Notification,
  SpyDistrictCommand
} from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import { CORE_EVENT_TYPES, createEvent, createNotification } from "../events";
import {
  calculateBaseDefensePower,
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
  SPY_BLOCKED_SLOT_COOLDOWN_PREFIX,
  SPY_ATTACK_AUTH_TTL_TICKS,
  validateSpy
} from "../validation";
import { applyGarageCooldownReductionTicks } from "./garageBuildingActions";
import { resolveCombinedCameraAlarmBonuses } from "./recruitmentCenterBuildingActions";

const LEGACY_SPY_CAPTURE_COOLDOWN_MS = 40_000;

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
  const blockedUntilTick = isBlockedSpyOutcome(reportResult.result)
    ? state.root.tick + resolveSpyCaptureCooldownTicks(context)
    : null;
  const report = createSpyReportNotification({
    command,
    playerId: player.id,
    targetDistrictId: targetDistrict.id,
    targetOwnerPlayerId: targetDistrict.ownerPlayerId,
    targetVersionAtSpy: targetDistrict.version,
    purpose: targetDistrict.ownerPlayerId ? "attack_owned_district" : "occupy_empty_district",
    reportResult,
    blockedUntilTick,
    tick: state.root.tick,
    eventId: reportEventId,
    boostSnapshot
  });
  const spyCooldownKey = `spy:${targetDistrict.id}`;
  const spyCooldownTicks = applyGarageCooldownReductionTicks({
    baseTicks: context.config.balance.conflict?.spyCooldownTicks ?? 2,
    state,
    playerId: player.id,
    config: context.config.balance.garage,
    category: "districtSpy"
  });
  const boostedSpyCooldownTicks = Math.max(1, Math.ceil(spyCooldownTicks * boostSnapshot.spyDurationMultiplier));
  const blockedSlotCooldown = blockedUntilTick === null
    ? {}
    : {
        [`${SPY_BLOCKED_SLOT_COOLDOWN_PREFIX}${command.id}`]: blockedUntilTick
      };

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
            [spyCooldownKey]: state.root.tick + boostedSpyCooldownTicks,
            ...blockedSlotCooldown
          },
          version: cooldownState.version + (state.cooldownStatesById[cooldownState.id] ? 1 : 0)
        }
      },
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

const createSpyReportNotification = (input: {
  command: SpyDistrictCommand;
  playerId: string;
  targetDistrictId: string;
  targetOwnerPlayerId: string | null;
  targetVersionAtSpy: number;
  purpose: "attack_owned_district" | "occupy_empty_district";
  reportResult: ReturnType<typeof resolveSpy>;
  blockedUntilTick: number | null;
  tick: number;
  eventId: string;
  boostSnapshot: ReturnType<typeof resolvePlayerSpyBoostEffects>;
}): Notification =>
  createNotification({
    id: composeEntityId("notification", `${input.command.id}:spy-report`),
    recipientType: "player",
    recipientId: input.playerId,
    category: "report.spy",
    title: `Spy report: ${input.targetDistrictId}`,
    bodyKey: "report.spy",
    payload: {
      reportId: composeEntityId("report", `${input.command.id}:spy`),
      reportType: "spy",
      actionType: "spy-district",
      playerId: input.playerId,
      attackerPlayerId: input.command.playerId,
      sourceDistrictId: input.command.payload.sourceDistrictId,
      targetDistrictId: input.targetDistrictId,
      targetOwnerPlayerId: input.targetOwnerPlayerId,
      targetStateAtSpy: input.targetOwnerPlayerId ? "owned" : "empty",
      targetVersionAtSpy: input.targetVersionAtSpy,
      purpose: input.reportResult.result === "success" ? input.purpose : null,
      result: input.reportResult.result,
      detectedDefense: input.reportResult.detectedDefense,
      trapDetected: input.reportResult.trapDetected,
      occupyUnlocked: input.reportResult.occupyUnlocked,
      revealedType: input.reportResult.revealedType,
      revealedDefense: input.reportResult.revealedDefense,
      heatGained: input.reportResult.heatGained,
      extraIntelBlocks: input.reportResult.extraIntelBlocks,
      boostSnapshot: input.boostSnapshot.boostId ? input.boostSnapshot : null,
      blockedUntilTick: input.blockedUntilTick,
      attackAuthorizationExpiresAtTick: input.reportResult.result === "success"
        ? input.tick + SPY_ATTACK_AUTH_TTL_TICKS
        : null,
      tick: input.tick,
      createdAt: new Date(0).toISOString(),
      eventId: input.eventId
    },
    createdAt: new Date(0).toISOString(),
    readAt: null
  });

const isBlockedSpyOutcome = (result: SpyOutcome): boolean =>
  result === "failed" || result === "critical_failed";

const resolveSpyCaptureCooldownTicks = (context: GameCoreContext): number =>
  Math.max(1, Math.ceil(LEGACY_SPY_CAPTURE_COOLDOWN_MS / Math.max(1, context.config.tickRateMs)));
