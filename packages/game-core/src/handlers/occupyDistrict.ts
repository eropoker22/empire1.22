import type { Notification, OccupyDistrictCommand, ResourceState } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import { CORE_EVENT_TYPES, createEvent, createNotification } from "../events";
import { createOccupyCooldownKey, resolveOccupyBalance, resolveOccupyPopulationCost } from "../rules";
import {
  applyFactionCooldownTicks,
  applyFactionMultiplier,
  getFactionPassiveModifiers
} from "../rules/factions/factionRules";
import { validateOccupy } from "../validation";
import { createPlayerCooldownState, reassignCapturedDistrictBuildings } from "./attackDistrictHelpers";
import { resolveBountyClaims } from "./bountyCommands";
import { applyCarDealerCooldownReductionTicks } from "./carDealerBuildingActions";
import { increasePlayerPoliceHeat } from "./playerPoliceState";
import { composeEntityId } from "../utils";
import { deterministicUnitInterval } from "../utils/math";

/**
 * Responsibility: Claims one neutral district after successful spy intel.
 * Belongs here: validated ownership transfer and capture event emission.
 * Does not belong here: combat resolution, active faction abilities, or UI logic.
 */
export const handleOccupyDistrict = (
  state: CoreGameState,
  command: OccupyDistrictCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateOccupy(state, command, context.config.balance.conflict);

  if (errors.length > 0) {
    return {
      nextState: state,
      events: [],
      errors
    };
  }

  const player = state.playersById[command.playerId];
  const sourceDistrict = state.districtsById[command.payload.sourceDistrictId ?? ""]!;
  const targetDistrict = state.districtsById[command.payload.districtId];
  const balance = resolveOccupyBalance(context.config.balance.conflict);
  const populationCost = resolveOccupyPopulationCost(state, player.id);
  const factionModifiers = getFactionPassiveModifiers(state, player.id, context);
  const cooldownTicks = Math.max(
    resolveOccupyCooldownGuardrailTicks(context, balance.cooldownTicks),
    applyFactionCooldownTicks(
      applyCarDealerCooldownReductionTicks({
        baseTicks: balance.cooldownTicks,
        state,
        playerId: player.id,
        config: context.config.balance.carDealer,
        garageConfig: context.config.balance.garage,
        category: "districtOccupy"
      }),
      "occupy",
      factionModifiers
    )
  );
  const heatGain = resolveOccupyHeatGain(balance.heatGain, factionModifiers.aggressiveActionHeatGainMultiplier);
  const cooldownState = state.cooldownStatesById[player.cooldownStateId] ?? createPlayerCooldownState(player.id, player.cooldownStateId);
  const occupyCooldownKey = createOccupyCooldownKey(targetDistrict.id);
  const nextPoliceState = increasePlayerPoliceHeat(state, player, heatGain, state.root.tick);
  const occupyRoll = deterministicUnitInterval(
    `${state.serverInstance.worldSeed}:occupy:${command.id}:${player.id}:${targetDistrict.id}:${state.root.tick}`
  );
  const occupySucceeded = occupyRoll >= balance.failureChancePct / 100;
  const result = occupySucceeded ? "success" : "failure";
  const populationRefunded = occupySucceeded
    ? Math.max(0, Math.floor(populationCost * balance.populationRefundPct / 100))
    : 0;
  const populationLost = Math.max(0, populationCost - populationRefunded);
  const streetNewsTemplateId = resolveOccupyStreetNewsTemplateId({
    commandId: command.id,
    result,
    targetDistrictId: targetDistrict.id,
    tick: state.root.tick,
    worldSeed: state.serverInstance.worldSeed
  });
  const nextBuildingsById = occupySucceeded
    ? reassignCapturedDistrictBuildings(state, targetDistrict.buildingIds, player.id)
    : state.buildingsById;
  const playerResourceState =
    state.resourceStatesById[player.resourceStateId] ??
    createPlayerResourceState(player.resourceStateId, player.id, state.root.tick);
  const nextPlayerResourceState: ResourceState = {
    ...playerResourceState,
    balances: {
      ...playerResourceState.balances,
      population: Math.max(0, Number(playerResourceState.balances.population ?? player.population ?? 0) - populationLost)
    },
    lastUpdatedTick: state.root.tick,
    version: playerResourceState.version + (state.resourceStatesById[playerResourceState.id] ? 1 : 0)
  };
  const eventId = composeEntityId("event", `${command.id}:occupy-${result}`);
  const report = createOccupyReportNotification({
    command,
    playerId: player.id,
    sourceDistrictId: sourceDistrict.id,
    targetDistrictId: targetDistrict.id,
    result,
    heatGained: heatGain,
    influenceCost: balance.influenceCost,
    populationCost,
    populationLost,
    populationRefunded,
    failureChancePct: balance.failureChancePct,
    successChancePct: 100 - balance.failureChancePct,
    cooldownTicks,
    tick: state.root.tick,
    eventId,
    streetNewsTemplateId
  });

  const nextStateAfterAttempt: CoreGameState = {
    ...state,
    playersById: {
      ...state.playersById,
      [player.id]: {
        ...player,
        ...(player.population !== undefined
          ? { population: Math.max(0, Number(player.population || 0) - populationLost) }
          : {}),
        lastActionAt: command.issuedAt,
        version: player.version + 1
      }
    },
    districtsById: {
      ...state.districtsById,
      [sourceDistrict.id]: {
        ...sourceDistrict,
        influence: Math.max(0, Number(sourceDistrict.influence || 0) - balance.influenceCost),
        version: sourceDistrict.version + 1
      },
      [targetDistrict.id]: {
        ...targetDistrict,
        ...(occupySucceeded
          ? {
              ownerPlayerId: player.id,
              controllerAllianceId: player.allianceId,
              status: "claimed"
            }
          : {}),
        heat: Math.max(0, Number(targetDistrict.heat || 0) + heatGain),
        lastHeatDecayTick: state.root.tick,
        version: targetDistrict.version + 1
      }
    },
    buildingsById: nextBuildingsById,
    resourceStatesById: {
      ...state.resourceStatesById,
      [nextPlayerResourceState.id]: nextPlayerResourceState
    },
    cooldownStatesById: {
      ...state.cooldownStatesById,
      [cooldownState.id]: {
        ...cooldownState,
        cooldowns: {
          ...cooldownState.cooldowns,
          [occupyCooldownKey]: state.root.tick + cooldownTicks
        },
        version: cooldownState.version + (state.cooldownStatesById[cooldownState.id] ? 1 : 0)
      }
    },
    policeStatesById: {
      ...state.policeStatesById,
      [nextPoliceState.id]: nextPoliceState
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
  };
  const occupyEventPayload = {
    attackerPlayerId: player.id,
    districtId: targetDistrict.id,
    previousOwnerPlayerId: null,
    sourceDistrictId: command.payload.sourceDistrictId,
    actionType: "occupy-district",
    result,
    districtCaptured: occupySucceeded,
    heatGained: heatGain,
    influenceCost: balance.influenceCost,
    populationCost,
    populationLost,
    populationRefunded,
    failureChancePct: balance.failureChancePct,
    successChancePct: 100 - balance.failureChancePct,
    cooldownTicks,
    eventId,
    streetNewsTemplateId
  };
  const captureEvents = [
    createEvent(occupySucceeded ? CORE_EVENT_TYPES.districtCaptured : CORE_EVENT_TYPES.districtOccupyResolved, occupyEventPayload),
    createEvent(CORE_EVENT_TYPES.notificationCreated, {
      notificationId: report.id,
      recipientId: player.id,
      category: report.category
    })
  ];

  if (!occupySucceeded) {
    return {
      nextState: nextStateAfterAttempt,
      events: captureEvents,
      errors: []
    };
  }

  const bountyResult = resolveBountyClaims(nextStateAfterAttempt, {
    actorPlayerId: player.id,
    targetPlayerId: targetDistrict.ownerPlayerId,
    targetDistrictId: targetDistrict.id,
    actionType: "occupy-district",
    successfulAttack: false,
    capturesDistrict: true,
    destroysDistrict: false,
    commandId: command.id
  });

  return {
    nextState: bountyResult.nextState,
    events: [...captureEvents, ...bountyResult.events],
    errors: []
  };
};

const createOccupyReportNotification = (input: {
  command: OccupyDistrictCommand;
  playerId: string;
  sourceDistrictId: string;
  targetDistrictId: string;
  result: "success" | "failure";
  heatGained: number;
  influenceCost: number;
  populationCost: number;
  populationLost: number;
  populationRefunded: number;
  failureChancePct: number;
  successChancePct: number;
  cooldownTicks: number;
  tick: number;
  eventId: string;
  streetNewsTemplateId: string;
}): Notification =>
  createNotification({
    id: composeEntityId("notification", `${input.command.id}:occupy-report`),
    recipientType: "player",
    recipientId: input.playerId,
    category: "report.occupy",
    title: `Occupy report: ${input.targetDistrictId}`,
    bodyKey: "report.occupy",
    payload: {
      reportId: composeEntityId("report", `${input.command.id}:occupy`),
      reportType: "occupy",
      actionType: "occupy-district",
      playerId: input.playerId,
      sourceDistrictId: input.sourceDistrictId,
      targetDistrictId: input.targetDistrictId,
      result: input.result,
      previousOwnerPlayerId: null,
      districtCaptured: input.result === "success",
      heatGained: input.heatGained,
      influenceCost: input.influenceCost,
      populationCost: input.populationCost,
      populationLost: input.populationLost,
      populationRefunded: input.populationRefunded,
      failureChancePct: input.failureChancePct,
      successChancePct: input.successChancePct,
      cooldownTicks: input.cooldownTicks,
      tick: input.tick,
      createdAt: new Date(0).toISOString(),
      eventId: input.eventId,
      streetNewsTemplateId: input.streetNewsTemplateId
    },
    createdAt: new Date(0).toISOString(),
    readAt: null
  });

const resolveOccupyHeatGain = (baseHeatGain: number, aggressiveActionHeatGainMultiplier: number | undefined): number => {
  const base = Math.max(0, Number(baseHeatGain) || 0);
  const modified = Math.max(0, applyFactionMultiplier(base, aggressiveActionHeatGainMultiplier));
  if (modified > base) return Math.ceil(modified);
  if (modified < base) return Math.floor(modified);
  return modified;
};

const OCCUPY_SUCCESS_STREET_NEWS_TEMPLATE_IDS = Object.freeze([
  "rumor.attack_activity.confirmed.occupy_success.001",
  "rumor.attack_activity.confirmed.occupy_success.002",
  "rumor.attack_activity.confirmed.occupy_success.003",
  "rumor.attack_activity.confirmed.occupy_success.004",
  "rumor.attack_activity.confirmed.occupy_success.005"
]);

const OCCUPY_FAILURE_STREET_NEWS_TEMPLATE_IDS = Object.freeze([
  "rumor.attack_activity.confirmed.occupy_failure.001",
  "rumor.attack_activity.confirmed.occupy_failure.002",
  "rumor.attack_activity.confirmed.occupy_failure.003",
  "rumor.attack_activity.confirmed.occupy_failure.004",
  "rumor.attack_activity.confirmed.occupy_failure.005"
]);

const resolveOccupyStreetNewsTemplateId = (input: {
  commandId: string;
  result: "success" | "failure";
  targetDistrictId: string;
  tick: number;
  worldSeed: string;
}): string => {
  const pool = input.result === "success"
    ? OCCUPY_SUCCESS_STREET_NEWS_TEMPLATE_IDS
    : OCCUPY_FAILURE_STREET_NEWS_TEMPLATE_IDS;
  const index = Math.min(
    pool.length - 1,
    Math.floor(deterministicUnitInterval(`${input.worldSeed}:occupy-news:${input.commandId}:${input.targetDistrictId}:${input.tick}`) * pool.length)
  );
  return pool[index] ?? pool[0]!;
};

const createPlayerResourceState = (id: string, playerId: string, tick: number): ResourceState => ({
  id,
  ownerType: "player",
  ownerId: playerId,
  balances: {},
  incomeModifiers: {},
  lastUpdatedTick: tick,
  version: 1
});

const resolveOccupyCooldownGuardrailTicks = (context: GameCoreContext, configuredCooldownTicks: number): number => {
  if (context.config.mode !== "free") {
    return 0;
  }

  const guardrailTicks = Math.ceil((8 * 60 * 1000) / Math.max(1, context.config.tickRateMs));
  return configuredCooldownTicks >= guardrailTicks ? guardrailTicks : 0;
};
