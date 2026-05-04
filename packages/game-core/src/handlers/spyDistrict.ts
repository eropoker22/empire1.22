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
import { resolveSpy } from "../rules";
import { composeEntityId } from "../utils";
import { validateSpy } from "../validation";
import { applyGarageCooldownReductionTicks } from "./garageBuildingActions";
import { resolveCombinedCameraAlarmBonuses } from "./recruitmentCenterBuildingActions";

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
    (trap) => trap.districtId === targetDistrict.id && trap.status === "active"
  );
  const reportEventId = composeEntityId("event", `${command.id}:district-spied`);
  const combinedCameraAlarmBonuses = resolveCombinedCameraAlarmBonuses({
    state,
    playerId: targetDistrict.ownerPlayerId,
    recruitmentCenterConfig: context.config.balance.recruitmentCenter,
    powerStationConfig: context.config.balance.powerStation,
    tick: state.root.tick
  });
  const reportResult = resolveSpy({
    worldSeed: state.serverInstance.worldSeed,
    playerId: player.id,
    targetDistrictId: targetDistrict.id,
    tick: state.root.tick,
    defenseLoadout: targetDistrict.defenseLoadout,
    hasActiveTrap: Boolean(activeTrap),
    spyBaseSuccessChance: context.config.balance.conflict?.spyBaseSuccessChance ?? 0.72,
    spyTrapRevealChance: context.config.balance.conflict?.spyTrapRevealChance ?? 0.22,
    cameraStrengthBonusPct: combinedCameraAlarmBonuses.cameraStrengthBonusPct,
    alarmStrengthBonusPct: combinedCameraAlarmBonuses.alarmStrengthBonusPct
  });
  const report = createSpyReportNotification({
    command,
    playerId: player.id,
    targetDistrictId: targetDistrict.id,
    reportResult,
    tick: state.root.tick,
    eventId: reportEventId
  });
  const spyCooldownKey = `spy:${targetDistrict.id}`;
  const spyCooldownTicks = applyGarageCooldownReductionTicks({
    baseTicks: context.config.balance.conflict?.spyCooldownTicks ?? 2,
    state,
    playerId: player.id,
    config: context.config.balance.garage,
    category: "districtSpy"
  });

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
            [spyCooldownKey]: state.root.tick + spyCooldownTicks
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
        trapDetected: reportResult.trapDetected
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
  reportResult: ReturnType<typeof resolveSpy>;
  tick: number;
  eventId: string;
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
      result: input.reportResult.result,
      detectedDefense: input.reportResult.detectedDefense,
      trapDetected: input.reportResult.trapDetected,
      tick: input.tick,
      createdAt: new Date(0).toISOString(),
      eventId: input.eventId
    },
    createdAt: new Date(0).toISOString(),
    readAt: null
  });
