import type { Notification, PendingOccupyOperation, ResourceState } from "@empire/shared-types";
import { createNotification } from "../events";
import { composeEntityId } from "../utils";
import { deterministicUnitInterval } from "../utils/math";

export const createOccupyReportNotification = (input: {
  operation: PendingOccupyOperation;
  result: "success" | "failure";
  populationLost: number;
  populationRefunded: number;
  tick: number;
  eventId: string;
  streetNewsTemplateId: string;
}): Notification => createNotification({
  id: composeEntityId("notification", `${input.operation.commandId}:occupy-report`),
  recipientType: "player",
  recipientId: input.operation.playerId,
  category: "report.occupy",
  title: `Occupy report: ${input.operation.targetDistrictId}`,
  bodyKey: "report.occupy",
  payload: {
    reportId: composeEntityId("report", `${input.operation.commandId}:occupy`),
    reportType: "occupy",
    actionType: "occupy-district",
    playerId: input.operation.playerId,
    sourceDistrictId: input.operation.sourceDistrictId,
    targetDistrictId: input.operation.targetDistrictId,
    result: input.result,
    previousOwnerPlayerId: null,
    districtCaptured: input.result === "success",
    heatGained: input.operation.heatGain,
    influenceCost: input.operation.influenceCost,
    populationCost: input.operation.populationCost,
    populationLost: input.populationLost,
    populationRefunded: input.populationRefunded,
    failureChancePct: input.operation.failureChancePct,
    successChancePct: 100 - input.operation.failureChancePct,
    cooldownTicks: input.operation.cooldownTicks,
    issuedAtTick: input.operation.issuedAtTick,
    resolveAtTick: input.operation.resolveAtTick,
    tick: input.tick,
    createdAt: input.operation.resolveAt,
    eventId: input.eventId,
    streetNewsTemplateId: input.streetNewsTemplateId
  },
  createdAt: input.operation.resolveAt,
  readAt: null
});

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

export const resolveOccupyStreetNewsTemplateId = (input: {
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
    Math.floor(deterministicUnitInterval(
      `${input.worldSeed}:occupy-news:${input.commandId}:${input.targetDistrictId}:${input.tick}`
    ) * pool.length)
  );
  return pool[index] ?? pool[0]!;
};

export const createOccupyResolutionPlayerResourceState = (
  id: string,
  playerId: string,
  tick: number
): ResourceState => ({
  id,
  ownerType: "player",
  ownerId: playerId,
  balances: {},
  incomeModifiers: {},
  lastUpdatedTick: tick,
  version: 1
});
