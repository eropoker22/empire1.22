import type { HeistDistrictCommand, PendingDistrictActionOperation } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import { CORE_EVENT_TYPES, createEvent, createNotification, type CoreEvent } from "../events";
import { resolveDistrictActionAvailability } from "../rules";
import { composeEntityId } from "../utils";

export const resolvePendingDistrictActionInvalidReason = (
  state: CoreGameState,
  operation: PendingDistrictActionOperation
): { code: string; message: string } | null => {
  const player = state.playersById[operation.playerId];
  if (!player) return { code: "PLAYER_NOT_FOUND", message: "Gang už v tomto městě neexistuje." };
  if (player.status !== "active") {
    return { code: "PLAYER_INACTIVE", message: "Gang už není aktivní a operaci nemůže dokončit." };
  }
  const sourceDistrict = state.districtsById[operation.sourceDistrictId];
  if (!sourceDistrict) return { code: "SOURCE_NOT_FOUND", message: "Výchozí district už neexistuje." };
  if (sourceDistrict.ownerPlayerId !== player.id) {
    return { code: "SOURCE_OWNER_CHANGED", message: "Gang během operace ztratil výchozí district." };
  }
  if (
    sourceDistrict.status === "destroyed"
    || sourceDistrict.status === "locked"
    || Number(sourceDistrict.lockdownUntilTick ?? 0) > state.root.tick
  ) {
    return { code: "SOURCE_UNAVAILABLE", message: "Výchozí district už nemůže operaci podporovat." };
  }
  const targetDistrict = state.districtsById[operation.targetDistrictId];
  if (!targetDistrict) return { code: "TARGET_NOT_FOUND", message: "Cílový district už neexistuje." };
  if (
    operation.targetOwnerPlayerId !== undefined
    && (targetDistrict.ownerPlayerId ?? null) !== operation.targetOwnerPlayerId
  ) {
    return { code: "TARGET_OWNER_CHANGED", message: "Cílový district během operace změnil vlastníka." };
  }
  if (
    (operation.operationType === "attack" || operation.operationType === "heist")
    && targetDistrict.ownerPlayerId
    && !state.playersById[targetDistrict.ownerPlayerId]
  ) {
    return { code: "TARGET_OWNER_MISSING", message: "Původní cíl už ve městě není dostupný." };
  }
  return resolveDistrictActionAvailability(state, player.id, targetDistrict.id, operation.operationType);
};

export const cancelPendingDistrictAction = (
  state: CoreGameState,
  operation: PendingDistrictActionOperation,
  reason: { code: string; message: string },
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[] } => {
  const now = context.clock?.nowIso?.() ?? context.clock?.now?.().toISOString() ?? new Date().toISOString();
  const targetDistrict = state.districtsById[operation.targetDistrictId];
  const commonPayload = {
    playerId: operation.playerId,
    sourceDistrictId: operation.sourceDistrictId,
    targetDistrictId: operation.targetDistrictId,
    cancelled: true,
    cancellationCode: reason.code,
    cancellationMessage: reason.message,
    issuedAtTick: operation.issuedAtTick,
    resolveAtTick: operation.resolveAtTick,
    tick: state.root.tick,
    createdAt: now
  };
  const notification = operation.operationType === "attack"
    ? createNotification({
        id: composeEntityId("notification", `${operation.command.id}:battle:${operation.playerId}`),
        recipientType: "player",
        recipientId: operation.playerId,
        category: "report.battle",
        title: "Útok zrušen: ulice změnily pravidla",
        bodyKey: "report.battle",
        payload: {
          ...commonPayload,
          reportId: composeEntityId("report", `${operation.command.id}:battle:${operation.playerId}`),
          reportType: "battle",
          actionType: "attack-district",
          attackerPlayerId: operation.playerId,
          defenderPlayerId: targetDistrict?.ownerPlayerId ?? null,
          result: "failure",
          outcomeTier: "failed_raid",
          districtCaptured: false,
          districtDestroyed: false,
          districtDamaged: false,
          trapTriggered: false,
          attackerLosses: {},
          defenderLosses: {},
          heatGained: 0,
          reportForAttacker: reason.message,
          reportForDefender: "",
          attackDurationTicks: Math.max(0, operation.resolveAtTick - operation.issuedAtTick)
        },
        createdAt: now,
        readAt: null
      })
    : operation.operationType === "heist"
      ? createNotification({
          id: composeEntityId("notification", `${operation.command.id}:heist-report`),
          recipientType: "player",
          recipientId: operation.playerId,
          category: "report.heist",
          title: "Heist zrušen: cíl změnil tvář",
          bodyKey: "report.heist",
          payload: {
            ...commonPayload,
            reportId: composeEntityId("report", `${operation.command.id}:heist`),
            reportType: "heist",
            actionType: "heist-district",
            targetOwnerPlayerId: targetDistrict?.ownerPlayerId ?? "",
            style: (operation.command as HeistDistrictCommand).payload.style,
            result: "failed",
            loot: {},
            populationLosses: 0,
            heatGained: 0,
            successChance: 0,
            detectionChance: 0,
            attackerIdentified: false
          },
          createdAt: now,
          readAt: null
        })
      : operation.operationType === "rob"
        ? createNotification({
            id: composeEntityId("notification", `${operation.command.id}:rob-report`),
            recipientType: "player",
            recipientId: operation.playerId,
            category: "report.rob",
            title: "Loupež zrušena: kořist zmizela",
            bodyKey: "report.rob",
            payload: {
              ...commonPayload,
              reportId: composeEntityId("report", `${operation.command.id}:rob`),
              reportType: "rob",
              actionType: "rob-district",
              result: "failed",
              loot: {},
              playerHeat: 0,
              districtHeat: Number(targetDistrict?.heat ?? 0),
              cooldownTicks: 0,
              poolChangedBeforeResolution: false,
              expectedLootPoolRevision: null,
              resolvedLootPoolRevision: Number(targetDistrict?.neutralLootPool?.version ?? 0)
            },
            createdAt: now,
            readAt: null
          })
        : createNotification({
            id: composeEntityId("notification", `${operation.command.id}:spy-report`),
            recipientType: "player",
            recipientId: operation.playerId,
            category: "report.spy",
            title: "Špionáž zrušena: stopa vychladla",
            bodyKey: "report.spy",
            payload: {
              ...commonPayload,
              reportId: composeEntityId("report", `${operation.command.id}:spy`),
              reportType: "spy",
              actionType: "spy-district",
              attackerPlayerId: operation.playerId,
              targetOwnerPlayerId: targetDistrict?.ownerPlayerId ?? null,
              targetSecurityRevision: Number(targetDistrict?.securityRevision ?? -1),
              result: "failed",
              detectedDefense: {},
              trapDetected: false,
              occupyUnlocked: false,
              revealedType: false,
              revealedDefense: false,
              heatGained: 0,
              blockedUntilTick: null,
              authorizationScope: null,
              authorizationExpiresAtTick: null
            },
            createdAt: now,
            readAt: null
          });
  const notificationIds = state.root.notificationIds.includes(notification.id)
    ? state.root.notificationIds
    : [...state.root.notificationIds, notification.id];
  return {
    nextState: {
      ...state,
      notificationsById: { ...state.notificationsById, [notification.id]: notification },
      root: { ...state.root, notificationIds, version: state.root.version + 1 }
    },
    events: [createEvent(CORE_EVENT_TYPES.notificationCreated, {
      notificationId: notification.id,
      recipientId: operation.playerId,
      category: notification.category,
      cancelled: true,
      cancellationCode: reason.code
    })]
  };
};
