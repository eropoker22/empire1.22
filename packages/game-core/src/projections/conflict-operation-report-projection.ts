import type {
  HeistReport,
  Notification,
  RobReport
} from "@empire/shared-types";

export const mapConflictOperationNotificationToReport = (
  notification: Notification
): HeistReport | RobReport | null => {
  const payload = notification.payload as Record<string, unknown>;
  if (notification.category === "report.heist") {
    return {
      reportId: String(payload.reportId ?? notification.id),
      reportType: "heist",
      actionType: "heist-district",
      playerId: String(payload.playerId ?? notification.recipientId),
      sourceDistrictId: String(payload.sourceDistrictId ?? ""),
      targetDistrictId: String(payload.targetDistrictId ?? ""),
      targetOwnerPlayerId: String(payload.targetOwnerPlayerId ?? ""),
      style: asHeistStyle(payload.style),
      result: asHeistOutcome(payload.result),
      loot: asNumberRecord(payload.loot),
      gangLosses: Number(payload.gangLosses ?? 0),
      heatGained: Number(payload.heatGained ?? 0),
      successChance: Number(payload.successChance ?? 0),
      detectionChance: Number(payload.detectionChance ?? 0),
      attackerIdentified: Boolean(payload.attackerIdentified),
      tick: Number(payload.tick ?? 0),
      createdAt: String(payload.createdAt ?? notification.createdAt),
      eventId: payload.eventId ? String(payload.eventId) : null
    };
  }

  if (notification.category === "report.rob") {
    return {
      reportId: String(payload.reportId ?? notification.id),
      reportType: "rob",
      actionType: "rob-district",
      playerId: String(payload.playerId ?? notification.recipientId),
      sourceDistrictId: String(payload.sourceDistrictId ?? ""),
      targetDistrictId: String(payload.targetDistrictId ?? ""),
      result: asRobOutcome(payload.result),
      loot: asNumberRecord(payload.loot),
      playerHeat: Number(payload.playerHeat ?? 0),
      districtHeat: Number(payload.districtHeat ?? 0),
      cooldownTicks: Number(payload.cooldownTicks ?? 0),
      poolChangedBeforeResolution: Boolean(payload.poolChangedBeforeResolution),
      expectedLootPoolRevision: typeof payload.expectedLootPoolRevision === "number"
        ? payload.expectedLootPoolRevision
        : null,
      resolvedLootPoolRevision: Number(payload.resolvedLootPoolRevision ?? 0),
      tick: Number(payload.tick ?? 0),
      createdAt: String(payload.createdAt ?? notification.createdAt),
      eventId: payload.eventId ? String(payload.eventId) : null
    };
  }

  return null;
};

const asHeistStyle = (value: unknown): HeistReport["style"] =>
  value === "stealth" || value === "all_in" ? value : "balanced";

const asHeistOutcome = (value: unknown): HeistReport["result"] =>
  value === "clean_success"
  || value === "success"
  || value === "detected"
  || value === "trap_triggered"
    ? value
    : "failed";

const asRobOutcome = (value: unknown): RobReport["result"] =>
  value === "success" || value === "partial" || value === "exhausted" ? value : "failed";

const asNumberRecord = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      Number(entryValue ?? 0)
    ])
  );
};
