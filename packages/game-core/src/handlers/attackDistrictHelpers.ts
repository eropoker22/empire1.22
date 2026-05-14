import type {
  AttackDistrictCommand,
  AttackWeaponId,
  CooldownState,
  DefenseWeaponId,
  Notification
} from "@empire/shared-types";
import { createNotification } from "../events";
import type { CoreGameState } from "../entities";
import { composeEntityId } from "../utils";

export const createPlayerCooldownState = (
  playerId: string,
  cooldownStateId: string
): CooldownState => ({
  id: cooldownStateId,
  ownerType: "player",
  ownerId: playerId,
  cooldowns: {},
  version: 1
});

export const filterDefenseLoadout = (
  loadout: CoreGameState["districtsById"][string]["defenseLoadout"]
) =>
  Object.fromEntries(
    Object.entries(loadout).filter(([, amount]) => Math.max(0, Number(amount ?? 0)) > 0)
  );

export const reassignCapturedDistrictBuildings = (
  state: CoreGameState,
  buildingIds: string[],
  ownerPlayerId: string
): CoreGameState["buildingsById"] =>
  buildingIds.reduce<CoreGameState["buildingsById"]>((collection, buildingId) => {
    const building = collection[buildingId];

    return building
      ? {
          ...collection,
          [building.id]: {
            ...building,
            ownerPlayerId,
            status: building.status === "destroyed" ? "destroyed" : "active",
            metadata: removeEliminationDisableMetadata(building.metadata),
            version: building.version + 1
          }
        }
      : collection;
  }, state.buildingsById);

const removeEliminationDisableMetadata = (
  metadata: CoreGameState["buildingsById"][string]["metadata"]
): CoreGameState["buildingsById"][string]["metadata"] => {
  if (!metadata) return metadata;
  const remaining = { ...metadata };
  delete remaining.disabledByEliminationAtTick;
  delete remaining.defeatedOwnerPlayerId;
  return remaining;
};

export const markDestroyedDistrictBuildings = (
  state: CoreGameState,
  buildingIds: string[]
): CoreGameState["buildingsById"] =>
  buildingIds.reduce<CoreGameState["buildingsById"]>((collection, buildingId) => {
    const building = collection[buildingId];

    return building
      ? {
          ...collection,
          [building.id]: {
            ...building,
            status: "destroyed",
            version: building.version + 1
          }
        }
      : collection;
  }, state.buildingsById);

export const createBattleReportNotification = (input: {
  command: AttackDistrictCommand;
  recipientPlayerId: string;
  defenderPlayerId: string | null;
  targetDistrictId: string;
  result: "success" | "failure" | "blocked" | "catastrophe";
  outcomeTier: "clean_capture" | "costly_capture" | "failed_raid" | "disaster";
  districtCaptured: boolean;
  districtDestroyed: boolean;
  districtDamaged: boolean;
  trapTriggered: boolean;
  trapType: "toxic" | null;
  trapReport: string | null;
  attackerLosses: Partial<Record<AttackWeaponId, number>>;
  defenderLosses: Partial<Record<DefenseWeaponId, number>>;
  heatGained: number;
  reportForAttacker: string;
  reportForDefender: string;
  attackDurationTicks: number;
  detectedDefense: ReturnType<typeof filterDefenseLoadout>;
  tick: number;
  eventId: string;
}): Notification =>
  createNotification({
    id: composeEntityId("notification", `${input.command.id}:battle:${input.recipientPlayerId}`),
    recipientType: "player",
    recipientId: input.recipientPlayerId,
    category: "report.battle",
    title: `Battle report: ${input.targetDistrictId}`,
    bodyKey: "report.battle",
    payload: {
      reportId: composeEntityId("report", `${input.command.id}:battle:${input.recipientPlayerId}`),
      reportType: "battle",
      actionType: "attack-district",
      playerId: input.recipientPlayerId,
      attackerPlayerId: input.command.playerId,
      defenderPlayerId: input.defenderPlayerId,
      sourceDistrictId: input.command.payload.sourceDistrictId,
      targetDistrictId: input.targetDistrictId,
      result: input.result,
      outcomeTier: input.outcomeTier,
      districtCaptured: input.districtCaptured,
      districtDestroyed: input.districtDestroyed,
      districtDamaged: input.districtDamaged,
      trapTriggered: input.trapTriggered,
      trapType: input.trapType,
      trapReport: input.trapReport,
      attackerLosses: input.attackerLosses,
      defenderLosses: input.defenderLosses,
      heatGained: input.heatGained,
      reportForAttacker: input.reportForAttacker,
      reportForDefender: input.reportForDefender,
      attackDurationTicks: input.attackDurationTicks,
      detectedDefense: input.detectedDefense,
      tick: input.tick,
      createdAt: new Date(0).toISOString(),
      eventId: input.eventId
    },
    createdAt: new Date(0).toISOString(),
    readAt: null
  });

export const createBattleReportNotifications = (input: {
  command: AttackDistrictCommand;
  attackerPlayerId: string;
  defenderPlayerId: string | null;
  targetDistrict: CoreGameState["districtsById"][string];
  result: "success" | "failure" | "blocked" | "catastrophe";
  outcomeTier: "clean_capture" | "costly_capture" | "failed_raid" | "disaster";
  districtCaptured: boolean;
  districtDestroyed: boolean;
  districtDamaged: boolean;
  trapTriggered: boolean;
  trapType: "toxic" | null;
  trapReport: string | null;
  attackerLosses: Partial<Record<AttackWeaponId, number>>;
  defenderLosses: Partial<Record<DefenseWeaponId, number>>;
  heatGained: number;
  reportForAttacker: string;
  reportForDefender: string;
  attackDurationTicks: number;
  tick: number;
}): Notification[] => {
  const eventId = composeEntityId("event", `${input.command.id}:district-attacked`);
  const baseReport = {
    command: input.command,
    defenderPlayerId: input.defenderPlayerId,
    targetDistrictId: input.targetDistrict.id,
    result: input.result,
    outcomeTier: input.outcomeTier,
    districtCaptured: input.districtCaptured,
    districtDestroyed: input.districtDestroyed,
    districtDamaged: input.districtDamaged,
    trapTriggered: input.trapTriggered,
    trapType: input.trapType,
    trapReport: input.trapReport,
    attackerLosses: input.attackerLosses,
    defenderLosses: input.defenderLosses,
    heatGained: input.heatGained,
    reportForAttacker: input.reportForAttacker,
    reportForDefender: input.reportForDefender,
    attackDurationTicks: input.attackDurationTicks,
    detectedDefense: filterDefenseLoadout(input.targetDistrict.defenseLoadout),
    tick: input.tick,
    eventId
  };
  const attackerReport = createBattleReportNotification({
    ...baseReport,
    recipientPlayerId: input.attackerPlayerId
  });
  const defenderReport = input.defenderPlayerId && input.defenderPlayerId !== input.attackerPlayerId
    ? createBattleReportNotification({
        ...baseReport,
        recipientPlayerId: input.defenderPlayerId
      })
    : null;

  return defenderReport ? [attackerReport, defenderReport] : [attackerReport];
};
