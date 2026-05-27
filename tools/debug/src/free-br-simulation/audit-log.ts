import type { FreeBrActionType, FreeBrAuditEvent, FreeBrPlayer, FreeBrSimulationState } from "./types";

const localTimeFormatter = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: "Europe/Bratislava",
  dateStyle: "short",
  timeStyle: "short"
});

export const addAuditEvent = (
  state: FreeBrSimulationState,
  input: {
    player?: FreeBrPlayer | null;
    actionType: FreeBrActionType;
    targetDistrictId?: number | null;
    targetPlayerId?: string | null;
    result: string;
    heatDelta?: number;
    influenceDelta?: number;
    cashDelta?: number;
    dirtyCashDelta?: number;
    districtDelta?: number;
    notes?: string;
  }
): void => {
  if (state.auditLevel === "matrix") return;

  const event: FreeBrAuditEvent = {
    tick: state.tick,
    simulatedTime: new Date(state.startAtMs + state.tick * state.config.tickRateMs).toISOString(),
    localTime: formatLocalTime(state),
    playerId: input.player?.id ?? null,
    factionId: input.player?.factionId ?? null,
    strategyId: input.player?.strategyId ?? null,
    actionType: input.actionType,
    targetDistrictId: input.targetDistrictId ?? null,
    targetPlayerId: input.targetPlayerId ?? null,
    result: input.result,
    heatDelta: input.heatDelta ?? 0,
    influenceDelta: input.influenceDelta ?? 0,
    cashDelta: input.cashDelta ?? 0,
    dirtyCashDelta: input.dirtyCashDelta ?? 0,
    districtDelta: input.districtDelta ?? 0,
    notes: input.notes ?? ""
  };
  state.events.push(event);
};

export const formatLocalTime = (state: FreeBrSimulationState, tick = state.tick): string =>
  localTimeFormatter.format(new Date(state.startAtMs + tick * state.config.tickRateMs));

export const formatEventJsonl = (events: readonly FreeBrAuditEvent[]): string =>
  events.map((event) => JSON.stringify(event)).join("\n");
