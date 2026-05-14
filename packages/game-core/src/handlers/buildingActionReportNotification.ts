import type { Notification, RunBuildingActionCommand } from "@empire/shared-types";
import type { BuildingActionBalanceConfig } from "../contracts";
import { createNotification } from "../events";
import { composeEntityId } from "../utils";
import type { BuildingActionSpecialEffectResult } from "./buildingActionSpecialEffects";

export interface BuildingActionReportNotificationInput {
  command: RunBuildingActionCommand;
  action: BuildingActionBalanceConfig;
  districtId: string;
  buildingId: string;
  buildingTypeId: string;
  playerId: string;
  cooldownUntilTick: number;
  specialEffect: BuildingActionSpecialEffectResult;
  policeImpact: Record<string, unknown>;
  casinoResult?: Record<string, unknown>;
  exchangeResult?: Record<string, unknown>;
  arcadeResult?: Record<string, unknown>;
  apartmentResult?: Record<string, unknown>;
  clinicResult?: Record<string, unknown>;
  recyclingResult?: Record<string, unknown>;
  stripClubResult?: Record<string, unknown>;
  powerStationResult?: Record<string, unknown>;
  smugglingTunnelResult?: Record<string, unknown>;
  airportResult?: Record<string, unknown>;
  cityHallResult?: Record<string, unknown>;
  centralBankResult?: Record<string, unknown>;
  lobbyClubResult?: Record<string, unknown>;
  schoolResult?: Record<string, unknown>;
  streetDealerResult?: Record<string, unknown>;
  stockExchangeResult?: Record<string, unknown>;
  tick: number;
  eventId: string;
}

export const createBuildingActionReportNotification = (
  input: BuildingActionReportNotificationInput
): Notification => {
  const resourceDelta = createResourceDelta(input.action.inputCost, input.action.outputGain);

  return createNotification({
    id: composeEntityId("notification", `${input.command.id}:building-action-report`),
    recipientType: "player",
    recipientId: input.playerId,
    category: "report.building-action",
    title: input.action.label,
    bodyKey: "report.building-action",
    payload: {
      reportId: composeEntityId("report", `${input.command.id}:building-action`),
      reportType: "building-action",
      actionType: "run-building-action",
      playerId: input.playerId,
      districtId: input.districtId,
      buildingId: input.buildingId,
      buildingTypeId: input.buildingTypeId,
      success: true,
      buildingActionId: input.action.actionId,
      actionId: input.action.actionId,
      buildingType: input.buildingTypeId,
      actionLabel: input.action.label,
      result: "success",
      inputCost: sanitizeNumberRecord(input.action.inputCost),
      outputGain: sanitizeNumberRecord(input.action.outputGain),
      resourceDelta,
      cashDelta: resourceDelta.cash ?? 0,
      dirtyCashDelta: resourceDelta["dirty-cash"] ?? 0,
      heatDelta: sanitizeNumber(input.action.heatGain),
      influenceDelta: sanitizeNumber(input.action.influenceChange),
      producedItems: sanitizeNumberRecord(input.action.outputGain),
      consumedItems: sanitizeNumberRecord(input.action.inputCost),
      cooldownUntilTick: Math.max(0, Math.floor(sanitizeNumber(input.cooldownUntilTick))),
      message: input.action.reportText,
      defenseAdded: input.specialEffect.defenseAdded,
      intelRevealedDistrictIds: input.specialEffect.intelRevealedDistrictIds,
      intelDetectedDefense: input.specialEffect.intelDetectedDefense,
      messages: input.specialEffect.messages,
      casinoResult: input.casinoResult,
      exchangeResult: input.exchangeResult,
      arcadeResult: input.arcadeResult,
      apartmentResult: input.apartmentResult,
      clinicResult: input.clinicResult,
      recyclingResult: input.recyclingResult,
      stripClubResult: input.stripClubResult,
      powerStationResult: input.powerStationResult,
      smugglingTunnelResult: input.smugglingTunnelResult,
      airportResult: input.airportResult,
      cityHallResult: input.cityHallResult,
      centralBankResult: input.centralBankResult,
      lobbyClubResult: input.lobbyClubResult,
      schoolResult: input.schoolResult,
      streetDealerResult: input.streetDealerResult,
      stockExchangeResult: input.stockExchangeResult,
      heatGain: sanitizeNumber(input.action.heatGain),
      influenceChange: sanitizeNumber(input.action.influenceChange),
      effectModifiers: input.action.effectModifiers,
      reportText: input.action.reportText,
      policeImpact: input.policeImpact,
      tick: input.tick,
      createdAt: new Date(0).toISOString(),
      eventId: input.eventId
    },
    createdAt: new Date(0).toISOString(),
    readAt: null
  });
};

export const createResourceDelta = (
  inputCost: Record<string, number>,
  outputGain: Record<string, number>
): Record<string, number> => {
  const delta: Record<string, number> = {};
  for (const [key, value] of Object.entries(sanitizeNumberRecord(outputGain))) {
    delta[key] = sanitizeNumber(delta[key]) + value;
  }
  for (const [key, value] of Object.entries(sanitizeNumberRecord(inputCost))) {
    delta[key] = sanitizeNumber(delta[key]) - value;
  }
  return Object.fromEntries(Object.entries(delta).filter(([, value]) => value !== 0));
};

export const sanitizeNumberRecord = (value: Record<string, number> | undefined): Record<string, number> =>
  Object.fromEntries(
    Object.entries(value ?? {})
      .map(([key, amount]) => [key, sanitizeNumber(amount)] as const)
      .filter(([key, amount]) => Boolean(key) && amount !== 0)
  );

export const sanitizeNumber = (value: unknown): number => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};
