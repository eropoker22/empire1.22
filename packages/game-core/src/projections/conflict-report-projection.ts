import type {
  BattleReport,
  ConflictReportView,
  Notification,
  SpyReport
} from "@empire/shared-types";
import type { CoreGameState } from "../entities";

export interface ConflictReportProjectionInput {
  playerId: string;
  limit: number;
}

/**
 * Responsibility: Converts stored authoritative report notifications into client-safe report views.
 * Belongs here: read-only historical report shaping for the migrated PvP slice.
 * Does not belong here: report persistence or transport logic.
 */
export const createConflictReportViews = (
  state: CoreGameState,
  input: ConflictReportProjectionInput
): ConflictReportView[] =>
  [...state.root.notificationIds]
    .reverse()
    .map((notificationId) => state.notificationsById[notificationId])
    .filter((notification): notification is Notification => notification?.recipientId === input.playerId)
    .map(mapNotificationToReport)
    .filter((report): report is ConflictReportView => report !== null)
    .slice(0, input.limit);

const mapNotificationToReport = (notification: Notification): ConflictReportView | null => {
  const payload = notification.payload as Record<string, unknown>;

  if (notification.category === "report.spy") {
    return {
      reportId: String(payload.reportId ?? notification.id),
      reportType: "spy",
      actionType: "spy-district",
      playerId: String(payload.playerId ?? notification.recipientId),
      attackerPlayerId: String(payload.attackerPlayerId ?? notification.recipientId),
      sourceDistrictId: String(payload.sourceDistrictId ?? ""),
      targetDistrictId: String(payload.targetDistrictId ?? ""),
      targetOwnerPlayerId: payload.targetOwnerPlayerId ? String(payload.targetOwnerPlayerId) : null,
      targetSecurityRevision: Number(payload.targetSecurityRevision ?? -1),
      authorizationScope: asSpyAuthorizationScope(payload.authorizationScope),
      issuedAtTick: Number(payload.issuedAtTick ?? payload.tick ?? 0),
      authorizationExpiresAtTick: typeof payload.authorizationExpiresAtTick === "number"
        ? payload.authorizationExpiresAtTick
        : null,
      result: asSpyOutcome(payload.result),
      detectedDefense: asNumberRecord(payload.detectedDefense),
      trapDetected: Boolean(payload.trapDetected),
      occupyUnlocked: payload.occupyUnlocked === undefined
        ? payload.result === "success"
        : Boolean(payload.occupyUnlocked),
      revealedType: payload.revealedType === undefined
        ? payload.result === "success" || payload.result === "partial"
        : Boolean(payload.revealedType),
      revealedDefense: payload.revealedDefense === undefined
        ? payload.result === "success"
        : Boolean(payload.revealedDefense),
      heatGained: Number(payload.heatGained ?? 0),
      blockedUntilTick: typeof payload.blockedUntilTick === "number" ? payload.blockedUntilTick : null,
      tick: Number(payload.tick ?? 0),
      createdAt: String(payload.createdAt ?? notification.createdAt),
      eventId: payload.eventId ? String(payload.eventId) : null
    } satisfies SpyReport;
  }

  if (notification.category === "report.battle") {
    const result = payload.result === "success" || payload.result === "blocked" || payload.result === "catastrophe"
      ? payload.result
      : "failure";

    return {
      reportId: String(payload.reportId ?? notification.id),
      reportType: "battle",
      actionType: "attack-district",
      playerId: String(payload.playerId ?? notification.recipientId),
      attackerPlayerId: String(payload.attackerPlayerId ?? notification.recipientId),
      defenderPlayerId: payload.defenderPlayerId ? String(payload.defenderPlayerId) : null,
      sourceDistrictId: String(payload.sourceDistrictId ?? ""),
      targetDistrictId: String(payload.targetDistrictId ?? ""),
      result,
      outcomeTier: asBattleOutcomeTier(payload.outcomeTier),
      districtCaptured: Boolean(payload.districtCaptured),
      districtDestroyed: Boolean(payload.districtDestroyed),
      districtDamaged: Boolean(payload.districtDamaged),
      trapTriggered: Boolean(payload.trapTriggered),
      attackerLosses: asNumberRecord(payload.attackerLosses),
      defenderLosses: asNumberRecord(payload.defenderLosses),
      detectedDefense: asNumberRecord(payload.detectedDefense),
      combatPopulationLoss: Number(payload.combatPopulationLoss ?? 0),
      occupationPopulationLoss: Number(payload.occupationPopulationLoss ?? 0),
      defenderPopulationLoss: Number(payload.defenderPopulationLoss ?? 0),
      vestPopulationSaved: Number(payload.vestPopulationSaved ?? 0),
      survivingDefenseAbandoned: Boolean(payload.survivingDefenseAbandoned),
      catastropheBaseChance: Number(payload.catastropheBaseChance ?? 0),
      bazookaCatastropheBonus: Number(payload.bazookaCatastropheBonus ?? 0),
      catastropheFinalChance: Number(payload.catastropheFinalChance ?? 0),
      heatGained: Number(payload.heatGained ?? 0),
      reportForAttacker: String(payload.reportForAttacker ?? ""),
      reportForDefender: String(payload.reportForDefender ?? ""),
      attackDurationTicks: Number(payload.attackDurationTicks ?? 0),
      tick: Number(payload.tick ?? 0),
      createdAt: String(payload.createdAt ?? notification.createdAt),
      eventId: payload.eventId ? String(payload.eventId) : null
    } satisfies BattleReport;
  }

  if (notification.category === "report.occupy") {
    return {
      reportId: String(payload.reportId ?? notification.id),
      reportType: "occupy",
      actionType: "occupy-district",
      playerId: String(payload.playerId ?? notification.recipientId),
      sourceDistrictId: String(payload.sourceDistrictId ?? ""),
      targetDistrictId: String(payload.targetDistrictId ?? ""),
      result: payload.result === "failure" ? "failure" : "success",
      previousOwnerPlayerId: payload.previousOwnerPlayerId ? String(payload.previousOwnerPlayerId) : null,
      districtCaptured: payload.districtCaptured === undefined ? payload.result !== "failure" : Boolean(payload.districtCaptured),
      heatGained: Number(payload.heatGained ?? 0),
      influenceCost: Number(payload.influenceCost ?? 0),
      populationCost: Number(payload.populationCost ?? 0),
      populationLost: Number(payload.populationLost ?? payload.populationCost ?? 0),
      populationRefunded: Number(payload.populationRefunded ?? 0),
      failureChancePct: Number(payload.failureChancePct ?? 0),
      successChancePct: Number(payload.successChancePct ?? 100),
      cooldownTicks: Number(payload.cooldownTicks ?? 0),
      streetNewsTemplateId: payload.streetNewsTemplateId ? String(payload.streetNewsTemplateId) : undefined,
      tick: Number(payload.tick ?? 0),
      createdAt: String(payload.createdAt ?? notification.createdAt),
      eventId: payload.eventId ? String(payload.eventId) : null
    };
  }

  if (notification.category === "report.building-action") {
    return {
      reportId: String(payload.reportId ?? notification.id),
      reportType: "building-action",
      actionType: "run-building-action",
      playerId: String(payload.playerId ?? notification.recipientId),
      districtId: String(payload.districtId ?? ""),
      buildingId: String(payload.buildingId ?? ""),
      buildingTypeId: String(payload.buildingTypeId ?? ""),
      buildingType: payload.buildingType ? String(payload.buildingType) : undefined,
      buildingActionId: String(payload.buildingActionId ?? ""),
      actionId: payload.actionId ? String(payload.actionId) : undefined,
      result: "success",
      success: payload.success === undefined ? true : Boolean(payload.success),
      inputCost: asNumberRecord(payload.inputCost),
      outputGain: asNumberRecord(payload.outputGain),
      resourceDelta: asNumberRecord(payload.resourceDelta),
      cashDelta: Number(payload.cashDelta ?? 0),
      dirtyCashDelta: Number(payload.dirtyCashDelta ?? 0),
      heatDelta: Number(payload.heatDelta ?? payload.heatGain ?? 0),
      influenceDelta: Number(payload.influenceDelta ?? payload.influenceChange ?? 0),
      producedItems: asNumberRecord(payload.producedItems),
      consumedItems: asNumberRecord(payload.consumedItems),
      cooldownUntilTick: Number(payload.cooldownUntilTick ?? 0),
      message: payload.message ? String(payload.message) : undefined,
      policeImpact: asUnknownRecord(payload.policeImpact),
      defenseAdded: asNumberRecord(payload.defenseAdded),
      intelRevealedDistrictIds: asStringArray(payload.intelRevealedDistrictIds),
      intelDetectedDefense: asNumberRecordByKey(payload.intelDetectedDefense),
      messages: asStringArray(payload.messages),
      casinoResult: asUnknownRecord(payload.casinoResult),
      exchangeResult: asUnknownRecord(payload.exchangeResult),
      arcadeResult: asUnknownRecord(payload.arcadeResult),
      apartmentResult: asUnknownRecord(payload.apartmentResult),
      clinicResult: asUnknownRecord(payload.clinicResult),
      recyclingResult: asUnknownRecord(payload.recyclingResult),
      stripClubResult: asUnknownRecord(payload.stripClubResult),
      powerStationResult: asUnknownRecord(payload.powerStationResult),
      smugglingTunnelResult: asUnknownRecord(payload.smugglingTunnelResult),
      airportResult: asUnknownRecord(payload.airportResult),
      cityHallResult: asUnknownRecord(payload.cityHallResult),
      centralBankResult: asUnknownRecord(payload.centralBankResult),
      lobbyClubResult: asUnknownRecord(payload.lobbyClubResult),
      schoolResult: asUnknownRecord(payload.schoolResult),
      streetDealerResult: asUnknownRecord(payload.streetDealerResult),
      stockExchangeResult: asUnknownRecord(payload.stockExchangeResult),
      heatGain: Number(payload.heatGain ?? 0),
      influenceChange: Number(payload.influenceChange ?? 0),
      tick: Number(payload.tick ?? 0),
      createdAt: String(payload.createdAt ?? notification.createdAt),
      eventId: payload.eventId ? String(payload.eventId) : null
    };
  }

  return null;
};

const asSpyOutcome = (value: unknown): SpyReport["result"] => {
  if (
    value === "success"
    || value === "partial"
    || value === "failed"
    || value === "critical_failed"
  ) {
    return value;
  }

  return "failed";
};

const asSpyAuthorizationScope = (value: unknown): SpyReport["authorizationScope"] =>
  value === "attack_owned_district" || value === "occupy_empty_district" ? value : null;

const asUnknownRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return { ...(value as Record<string, unknown>) };
};

const asNumberRecord = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      Number(entryValue ?? 0)
    ])
  );
};

const asStringArray = (value: unknown): string[] => Array.isArray(value)
  ? value.map((entry) => String(entry || "").trim()).filter(Boolean)
  : [];

const asBattleOutcomeTier = (value: unknown): BattleReport["outcomeTier"] => {
  if (
    value === "clean_capture"
    || value === "costly_capture"
    || value === "failed_raid"
    || value === "disaster"
  ) {
    return value;
  }

  return "failed_raid";
};

const asNumberRecordByKey = (value: unknown): Record<string, Record<string, number>> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      asNumberRecord(entryValue)
    ])
  );
};
