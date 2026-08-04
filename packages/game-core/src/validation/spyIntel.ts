import type { CoreGameState } from "../entities";
import type { MapActionBlockReason } from "../rules";

export type SpyAuthorizationPurpose = "attack_owned_district" | "occupy_empty_district";

/**
 * Responsibility: Read-only lookup for successful district spy intel.
 * Belongs here: shared validation/projection check over authoritative notifications.
 * Does not belong here: spy outcome calculation or UI visibility.
 */
export const hasSuccessfulSpyIntel = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string
): boolean =>
  Object.values(state.notificationsById).some((notification) => {
    if (notification.recipientId !== playerId || notification.category !== "report.spy") {
      return false;
    }

    const payload = notification.payload;
    if (!isSpyReportResolved(state, payload)) return false;
    return payload.targetDistrictId === targetDistrictId && payload.result === "success";
  });

export const hasRevealedDistrictTypeIntel = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string
): boolean =>
  Object.values(state.notificationsById).some((notification) => {
    if (notification.recipientId !== playerId || notification.category !== "report.spy") {
      return false;
    }

    const payload = notification.payload;
    if (!isSpyReportResolved(state, payload)) return false;
    if (payload.targetDistrictId !== targetDistrictId) {
      return false;
    }

    return payload.revealedType === true
      || (
        payload.revealedType === undefined
        && (payload.result === "success" || payload.result === "partial")
      );
  });

export const hasValidAttackAuthorization = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string
): boolean => {
  const targetDistrict = state.districtsById[targetDistrictId];

  if (!targetDistrict?.ownerPlayerId) {
    return false;
  }

  return Object.values(state.notificationsById).some((notification) => {
    if (notification.recipientId !== playerId || notification.category !== "report.spy") {
      return false;
    }

    const payload = notification.payload;
    if (!isSpyReportResolved(state, payload)) return false;
    if (
      payload.targetDistrictId !== targetDistrictId
      || payload.result !== "success"
      || payload.purpose !== "attack_owned_district"
    ) {
      return false;
    }

    if (
      typeof payload.authorizationExpiresAtTick !== "number"
      || payload.authorizationExpiresAtTick <= state.root.tick
    ) {
      return false;
    }

    if (
      payload.targetOwnerPlayerId !== targetDistrict.ownerPlayerId
    ) {
      return false;
    }

    if (
      typeof payload.targetSecurityRevision !== "number"
      || payload.targetSecurityRevision !== targetDistrict.securityRevision
    ) {
      return false;
    }

    return true;
  });
};

export const validateOccupyEmptyDistrictAuthorization = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string
): true | MapActionBlockReason => {
  const targetDistrict = state.districtsById[targetDistrictId];

  if (!targetDistrict || targetDistrict.ownerPlayerId || targetDistrict.status !== "neutral") {
    return "OCCUPY_TARGET_CHANGED";
  }

  const matchingReports = Object.values(state.notificationsById).filter((notification) => {
    if (notification.recipientId !== playerId || notification.category !== "report.spy") {
      return false;
    }

    const payload = notification.payload;
    if (!isSpyReportResolved(state, payload)) return false;
    return payload.targetDistrictId === targetDistrictId
      && payload.result === "success"
      && payload.purpose === "occupy_empty_district";
  });

  if (matchingReports.length === 0) {
    return "OCCUPY_SPY_REQUIRED";
  }

  const hasCurrentTargetSecurity = matchingReports.some((notification) => {
    const payload = notification.payload;
    return payload.targetStateAtSpy === "empty"
      && payload.targetOwnerPlayerId === null
      && payload.targetSecurityRevision === targetDistrict.securityRevision;
  });

  return hasCurrentTargetSecurity ? true : "OCCUPY_SPY_AUTH_INVALIDATED";
};

const isSpyReportResolved = (
  state: CoreGameState,
  payload: CoreGameState["notificationsById"][string]["payload"]
): boolean => typeof payload.resolveAtTick !== "number" || payload.resolveAtTick <= state.root.tick;
