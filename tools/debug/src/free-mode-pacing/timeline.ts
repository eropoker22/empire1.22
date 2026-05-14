import {
  CORE_EVENT_TYPES,
  createDistrictControlScores,
  type CoreEvent,
  type CoreGameState,
  type ResolvedGameModeConfig
} from "@empire/game-core";
import type { EliminationTimelineEntry } from "./types";

export const recordEliminationTimelineEntries = (
  state: CoreGameState,
  config: ResolvedGameModeConfig,
  events: CoreEvent[],
  timeline: EliminationTimelineEntry[]
): void => {
  for (const event of events) {
    if (event.type !== CORE_EVENT_TYPES.playerEliminated || !isRecord(event.payload)) continue;

    const tick = readNumber(event.payload.eliminatedAtTick, state.root.tick);
    const entry: EliminationTimelineEntry = {
      eliminationNumber: readNumber(state.eliminationState?.eliminationCount, timeline.length + 1),
      tick,
      hour: round(tick / ticksPerHour(config)),
      eliminatedPlayerId: String(event.payload.playerId ?? ""),
      finalPlacement: readNumber(event.payload.finalPlacement, 0),
      eliminatedPlayerScore: round(readNumber(event.payload.score, 0)),
      eliminatedPlayerControlledDistricts: readNumber(event.payload.controlledDistricts, 0),
      activePlayersRemaining: readNumber(event.payload.activePlayersRemaining, 0),
      topAllianceControlPercentAfterElimination: topAllianceControlPercent(state)
    };

    if (isNewTimelineEntry(entry, timeline)) {
      timeline.push(entry);
    }
  }
};

const topAllianceControlPercent = (state: CoreGameState): number => {
  const activeDistricts = Object.values(state.districtsById).filter((district) => district.status !== "destroyed");
  const topAlliance = createDistrictControlScores(state, activeDistricts)
    .find((score) => score.subjectType === "alliance");
  return activeDistricts.length > 0 ? round(((topAlliance?.controlledDistricts ?? 0) / activeDistricts.length) * 100) : 0;
};

const isNewTimelineEntry = (
  entry: EliminationTimelineEntry,
  timeline: EliminationTimelineEntry[]
): boolean =>
  Boolean(entry.eliminatedPlayerId)
  && !timeline.some((item) => item.tick === entry.tick && item.eliminatedPlayerId === entry.eliminatedPlayerId);

const ticksPerHour = (config: ResolvedGameModeConfig): number =>
  Math.round((60 * 60 * 1000) / config.tickRateMs);

const readNumber = (value: unknown, fallback: number): number => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const round = (value: number): number =>
  Math.round(value * 100) / 100;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
