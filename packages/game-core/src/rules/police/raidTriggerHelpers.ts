import type { PendingRaid, PoliceEvent, PoliceRaidSeverity, PoliceState } from "@empire/shared-types";
import type { CoreEvent } from "../../events";
import { CORE_EVENT_TYPES, createEvent } from "../../events";

export const createWarningIfAllowed = (
  policeState: PoliceState,
  aggregatePressure: number,
  currentTick: number,
  cooldownTicks: number
): { nextPoliceState: PoliceState; event: CoreEvent } | null => {
  if (isWarningCooldownActive(policeState, currentTick, cooldownTicks)) return null;
  const policeEvent: PoliceEvent = {
    id: `police:event:${policeState.ownerPlayerId}:${currentTick}:warning`,
    type: "police-warning",
    playerId: policeState.ownerPlayerId,
    severity: "medium",
    message: "Policie sleduje tvoje nejhlučnější akce. Tlak roste.",
    createdAtTick: currentTick,
    payload: { aggregatePressure }
  };
  return {
    nextPoliceState: {
      ...policeState,
      policeEvents: [policeEvent, ...(policeState.policeEvents ?? [])].slice(0, 12),
      lastWarningAtTick: currentTick,
      version: policeState.version + 1
    },
    event: createEvent(CORE_EVENT_TYPES.policeWarningIssued, {
      playerId: policeState.ownerPlayerId,
      policeStateId: policeState.id,
      aggregatePressure,
      severity: "medium"
    })
  };
};

export const getOpenPendingRaids = (policeState: PoliceState): PendingRaid[] =>
  (policeState.pendingRaids ?? []).filter((raid) => raid.status === "pending" || raid.status === "acknowledged");

export const isRaidCooldownActive = (policeState: PoliceState, currentTick: number, cooldownTicks: number): boolean => {
  const lastRaidTick = Math.max(
    Number(policeState.lastRaidCreatedAtTick ?? Number.NEGATIVE_INFINITY),
    Number(policeState.lastRaidResolvedAtTick ?? Number.NEGATIVE_INFINITY)
  );
  return Number.isFinite(lastRaidTick) && currentTick - lastRaidTick < Math.max(0, cooldownTicks);
};

export const resolveRaidSeverity = (aggregatePressure: number, extremeThreshold: number): PoliceRaidSeverity =>
  aggregatePressure >= extremeThreshold ? "extreme" : "high";

export const createRaidReason = (aggregatePressure: number, targetDistrictId: string | null): string =>
  targetDistrictId
    ? `aggregate-pressure:${aggregatePressure}:district:${targetDistrictId}`
    : `aggregate-pressure:${aggregatePressure}`;

export const createPendingRaidMessage = (severity: PoliceRaidSeverity): string =>
  severity === "extreme"
    ? "Hlídky sevřely čtvrť. Další hluk může spustit tvrdou razii."
    : "District je pod tlakem. Policie připravuje zásah.";

export const ensureFlag = (flags: string[], flag: string): string[] =>
  flags.includes(flag) ? flags : [...flags, flag];

const isWarningCooldownActive = (policeState: PoliceState, currentTick: number, cooldownTicks: number): boolean => {
  const lastWarningTick = Number(policeState.lastWarningAtTick ?? Number.NEGATIVE_INFINITY);
  return Number.isFinite(lastWarningTick) && currentTick - lastWarningTick < Math.max(0, cooldownTicks);
};
