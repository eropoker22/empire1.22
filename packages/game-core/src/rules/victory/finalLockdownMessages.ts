import type { CityFeedEvent, Notification } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { createFinalEmpireRanking } from "./finalEmpireScore";

export const createFinalLockdownStartedNotification = (state: CoreGameState, playerId: string): Notification => ({
  id: `notification:final-lockdown:start:${state.root.tick}:${playerId}`,
  recipientType: "player",
  recipientId: playerId,
  category: "final_lockdown.started",
  title: "Final Lockdown začal",
  bodyKey: "final_lockdown.started",
  payload: {
    body: "Přežil jsi čistky. Teď vyhraj město. Final Lockdown začal — 12 aktivních hodin do rozsudku.",
    startedAtTick: state.root.tick,
    serverInstanceId: state.serverInstance.id
  },
  createdAt: new Date(0).toISOString(),
  readAt: null
});

export const createFinalLockdownResolvedNotification = (
  state: CoreGameState,
  playerId: string,
  rank: number,
  score: number
): Notification => ({
  id: `notification:final-lockdown:resolved:${state.root.tick}:${playerId}`,
  recipientType: "player",
  recipientId: playerId,
  category: "final_lockdown.resolved",
  title: rank === 1 ? "Město je tvoje" : `Final Lockdown: #${rank}`,
  bodyKey: "final_lockdown.resolved",
  payload: {
    body: rank === 1
      ? "Final Lockdown skončil. Tvoje impérium bere město."
      : `Final Lockdown skončil. Končíš na #${rank}.`,
    rank,
    score: Math.round(score * 100) / 100,
    serverInstanceId: state.serverInstance.id
  },
  createdAt: new Date(0).toISOString(),
  readAt: null
});

export const createFinalLockdownStartedFeedEvent = (state: CoreGameState): CityFeedEvent => ({
  id: `city-feed:final-lockdown:started:${state.root.tick}`,
  sourceEventId: `final-lockdown:started:${state.root.tick}`,
  sourceType: "system",
  category: "system",
  severity: "extreme",
  truthiness: "confirmed",
  intelType: "confirmed_event",
  visibility: "all",
  createdAtTick: state.root.tick,
  message: "Final Lockdown začal. Přežilo 8 gangů. Město spouští posledních 12 aktivních hodin o trůn.",
  messageKey: "system.final_lockdown_started",
  payload: {
    startedAtTick: state.root.tick
  }
});

export const createFinalLockdownResolvedFeedEvent = (
  state: CoreGameState,
  topScores: ReturnType<typeof createFinalEmpireRanking>
): CityFeedEvent => ({
  id: `city-feed:final-lockdown:resolved:${state.root.tick}`,
  sourceEventId: `final-lockdown:resolved:${state.root.tick}`,
  sourceType: "system",
  category: "system",
  severity: "extreme",
  truthiness: "confirmed",
  intelType: "confirmed_event",
  visibility: "all",
  createdAtTick: state.root.tick,
  message: "Final Lockdown skončil. Město má nové Top 3.",
  messageKey: "system.final_lockdown_resolved",
  payload: {
    top3: topScores.map((score, index) => ({
      rank: index + 1,
      playerId: score.playerId,
      playerName: score.playerName,
      score: Math.round(score.score * 100) / 100
    }))
  }
});
