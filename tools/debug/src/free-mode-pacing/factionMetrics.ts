import type { CoreGameState } from "@empire/game-core";
import { PLAYER_FACTION_IDS, type PlayerFactionId } from "@empire/shared-types";

export interface FactionPacingMetrics {
  topFactionByControl: string | null;
  eliminatedByFaction: Record<string, number>;
  averageControlByFaction: Record<string, number>;
  averageSurvivalTimeByFaction: Record<string, number>;
  factionWinRate?: Record<string, number>;
}

export const createFactionPacingMetrics = (
  state: CoreGameState,
  ticksPerHour = 1
): FactionPacingMetrics => {
  const controlByFaction = createEmptyFactionNumberMap();
  const playersByFaction = createEmptyFactionNumberMap();
  const eliminatedByFaction = createEmptyFactionNumberMap();
  const survivalByFaction = createEmptyFactionNumberMap();

  for (const player of Object.values(state.playersById)) {
    const factionId = normalizeFactionId(player.factionId);
    playersByFaction[factionId] += 1;
    if (player.status === "defeated") {
      eliminatedByFaction[factionId] += 1;
    }
    survivalByFaction[factionId] += player.status === "active"
      ? state.root.tick / Math.max(1, ticksPerHour)
      : Number(player.metadata?.defeatedAtTick ?? state.root.tick) / Math.max(1, ticksPerHour);
  }

  for (const district of Object.values(state.districtsById)) {
    if (district.status === "destroyed" || !district.ownerPlayerId) continue;
    const owner = state.playersById[district.ownerPlayerId];
    if (owner) controlByFaction[normalizeFactionId(owner.factionId)] += 1;
  }

  return {
    topFactionByControl: findTopFaction(controlByFaction),
    eliminatedByFaction,
    averageControlByFaction: averageByFaction(controlByFaction, playersByFaction),
    averageSurvivalTimeByFaction: averageByFaction(survivalByFaction, playersByFaction)
  };
};

export const createFactionWinRate = (states: readonly CoreGameState[]): Record<string, number> => {
  const wins = createEmptyFactionNumberMap();
  for (const state of states) {
    const winnerPlayerId = state.matchResult?.winnerPlayerId;
    const winner = winnerPlayerId ? state.playersById[winnerPlayerId] : null;
    if (winner) wins[normalizeFactionId(winner.factionId)] += 1;
  }
  return Object.fromEntries(
    Object.entries(wins).map(([factionId, count]) => [factionId, states.length > 0 ? round(count / states.length) : 0])
  );
};

const createEmptyFactionNumberMap = (): Record<PlayerFactionId, number> =>
  Object.fromEntries(PLAYER_FACTION_IDS.map((factionId) => [factionId, 0])) as Record<PlayerFactionId, number>;

const normalizeFactionId = (value: unknown): PlayerFactionId =>
  PLAYER_FACTION_IDS.includes(value as PlayerFactionId) ? value as PlayerFactionId : "mafian";

const averageByFaction = (
  totals: Record<string, number>,
  counts: Record<string, number>
): Record<string, number> =>
  Object.fromEntries(
    Object.entries(totals).map(([factionId, total]) => [factionId, round(total / Math.max(1, counts[factionId] ?? 0))])
  );

const findTopFaction = (controlByFaction: Record<string, number>): string | null => {
  const top = Object.entries(controlByFaction).sort((left, right) => right[1] - left[1])[0];
  return top && top[1] > 0 ? top[0] : null;
};

const round = (value: number): number => Math.round(value * 100) / 100;
