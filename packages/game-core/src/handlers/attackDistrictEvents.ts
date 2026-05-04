import type {
  AttackDistrictCommand,
  AttackWeaponId,
  Notification
} from "@empire/shared-types";
import { CORE_EVENT_TYPES, createEvent, type CoreEvent } from "../events";

export const createDistrictAttackEvents = (input: {
  command: AttackDistrictCommand;
  attackerReport: Notification;
  defenderReport: Notification | null;
  targetDistrictId: string;
  previousOwnerPlayerId: string | null;
  activeTrapId: string | null;
  trapType: "toxic" | null;
  trapLosses: Partial<Record<AttackWeaponId, number>>;
  trapReport: string | null;
  attackSucceeded: boolean;
  attackPayload: Record<string, unknown>;
}): CoreEvent[] => {
  const events: CoreEvent[] = [
    createEvent(CORE_EVENT_TYPES.districtAttacked, {
      attackerPlayerId: input.command.playerId,
      districtId: input.targetDistrictId,
      ...input.attackPayload
    }),
    createEvent(CORE_EVENT_TYPES.notificationCreated, {
      notificationId: input.attackerReport.id,
      recipientId: input.attackerReport.recipientId,
      category: input.attackerReport.category
    })
  ];

  if (input.defenderReport) {
    events.push(
      createEvent(CORE_EVENT_TYPES.notificationCreated, {
        notificationId: input.defenderReport.id,
        recipientId: input.defenderReport.recipientId,
        category: input.defenderReport.category
      })
    );
  }

  if (input.activeTrapId) {
    events.push(
      createEvent(CORE_EVENT_TYPES.trapTriggered, {
        trapId: input.activeTrapId,
        districtId: input.targetDistrictId,
        attackerPlayerId: input.command.playerId,
        trapType: input.trapType,
        attackerLosses: input.trapLosses,
        report: input.trapReport
      })
    );
  }

  if (input.attackSucceeded) {
    events.push(
      createEvent(CORE_EVENT_TYPES.districtCaptured, {
        attackerPlayerId: input.command.playerId,
        districtId: input.targetDistrictId,
        previousOwnerPlayerId: input.previousOwnerPlayerId
      })
    );
  }

  return events;
};
