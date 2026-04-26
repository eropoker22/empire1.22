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
      result: payload.result === "success" ? "success" : "failure",
      detectedDefense: asNumberRecord(payload.detectedDefense),
      trapDetected: Boolean(payload.trapDetected),
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
      districtCaptured: Boolean(payload.districtCaptured),
      districtDestroyed: Boolean(payload.districtDestroyed),
      trapTriggered: Boolean(payload.trapTriggered),
      attackerLosses: asNumberRecord(payload.attackerLosses),
      detectedDefense: asNumberRecord(payload.detectedDefense),
      tick: Number(payload.tick ?? 0),
      createdAt: String(payload.createdAt ?? notification.createdAt),
      eventId: payload.eventId ? String(payload.eventId) : null
    } satisfies BattleReport;
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
      buildingActionId: String(payload.buildingActionId ?? ""),
      result: "success",
      inputCost: asNumberRecord(payload.inputCost),
      outputGain: asNumberRecord(payload.outputGain),
      defenseAdded: asNumberRecord(payload.defenseAdded),
      intelRevealedDistrictIds: asStringArray(payload.intelRevealedDistrictIds),
      intelDetectedDefense: asNumberRecordByKey(payload.intelDetectedDefense),
      messages: asStringArray(payload.messages),
      heatGain: Number(payload.heatGain ?? 0),
      influenceChange: Number(payload.influenceChange ?? 0),
      tick: Number(payload.tick ?? 0),
      createdAt: String(payload.createdAt ?? notification.createdAt),
      eventId: payload.eventId ? String(payload.eventId) : null
    };
  }

  return null;
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
