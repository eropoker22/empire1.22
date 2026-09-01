import type { PendingDistrictActionOperation } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";

export const stampPendingOperationReportTiming = (
  state: CoreGameState,
  operation: PendingDistrictActionOperation,
  context: GameCoreContext
): CoreGameState => {
  const notificationPrefix = `notification:${operation.command.id}:`;
  const issuedAtMs = Date.parse(operation.command.issuedAt);
  const scheduledDurationMs = Math.max(0, operation.resolveAtTick - operation.issuedAtTick)
    * Math.max(1, context.config.tickRateMs);
  const resolvedAt = new Date(
    (Number.isFinite(issuedAtMs) ? issuedAtMs : 0) + scheduledDurationMs
  ).toISOString();
  let notificationsById = state.notificationsById;
  let changed = false;
  for (const [notificationId, notification] of Object.entries(state.notificationsById)) {
    if (!notificationId.startsWith(notificationPrefix) || !notification.category.startsWith("report.")) continue;
    if (!changed) notificationsById = { ...notificationsById };
    notificationsById[notificationId] = {
      ...notification,
      createdAt: resolvedAt,
      payload: {
        ...notification.payload,
        issuedAt: operation.command.issuedAt,
        createdAt: resolvedAt,
        resolveAt: resolvedAt,
        issuedAtTick: operation.issuedAtTick,
        resolveAtTick: operation.resolveAtTick
      }
    };
    changed = true;
  }
  return changed ? { ...state, notificationsById } : state;
};
