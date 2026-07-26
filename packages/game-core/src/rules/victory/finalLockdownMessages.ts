import type { CityFeedEvent, Notification } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { createFinalEmpireRanking } from "./finalEmpireScore";

const FINAL_LOCKDOWN_FEED_TTL_MS = 15 * 60 * 60 * 1000;
const DEFAULT_TICK_RATE_MS = 10_000;

export const createFinalLockdownStartedNotification = (
  state: CoreGameState,
  playerId: string,
  createdAt: string
): Notification => ({
  id: `notification:final-lockdown:start:${state.root.tick}:${playerId}`,
  recipientType: "player",
  recipientId: playerId,
  category: "final_lockdown.started",
  title: "Final Lockdown začal",
  bodyKey: "final_lockdown.started",
  payload: {
    body: "Přežil jsi Očistu. Teď vyhraj město. Final Lockdown začal a skutečný odpočet běží.",
    startedAtTick: state.root.tick,
    serverInstanceId: state.serverInstance.id
  },
  createdAt,
  readAt: null
});

export const createFinalLockdownResolvedNotification = (
  state: CoreGameState,
  playerId: string,
  rank: number,
  score: number,
  createdAt: string
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
  createdAt,
  readAt: null
});

export const createFinalLockdownStartedFeedEvent = (
  state: CoreGameState,
  activePlayerCount: number,
  tickRateMs = DEFAULT_TICK_RATE_MS
): CityFeedEvent => ({
  id: `city-feed:final-lockdown:started:${state.root.tick}`,
  sourceEventId: `final-lockdown:started:${state.root.tick}:global_city:final_lockdown`,
  sourceType: "system",
  category: "system",
  severity: "extreme",
  truthiness: "confirmed",
  intelType: "confirmed_event",
  visibility: "all",
  createdAtTick: state.root.tick,
  expiresAtTick: state.root.tick + resolveFinalLockdownFeedTtlTicks(tickRateMs),
  freshness: "fresh",
  priority: 100,
  audience: "global_city",
  confidence: "confirmed",
  rumorCategory: "final_lockdown",
  templateId: "system.final_lockdown_started",
  message: `Final Lockdown začal. Ve válce zbývá ${activePlayerCount} aktivních gangů a serverový odpočet běží.`,
  messageKey: "system.final_lockdown_started",
  payload: {
    rumorCategory: "final_lockdown",
    confidence: "confirmed",
    audience: "global_city",
    intensityBand: "high",
    activePlayerCount
  }
});

export const createFinalLockdownResolvedFeedEvent = (
  state: CoreGameState,
  topScores: ReturnType<typeof createFinalEmpireRanking>,
  tickRateMs = DEFAULT_TICK_RATE_MS
): CityFeedEvent => ({
  id: `city-feed:final-lockdown:resolved:${state.root.tick}`,
  sourceEventId: `final-lockdown:resolved:${state.root.tick}:global_city:final_lockdown`,
  sourceType: "system",
  category: "system",
  severity: "extreme",
  truthiness: "confirmed",
  intelType: "confirmed_event",
  visibility: "all",
  createdAtTick: state.root.tick,
  expiresAtTick: state.root.tick + resolveFinalLockdownFeedTtlTicks(tickRateMs),
  freshness: "fresh",
  priority: 100,
  audience: "global_city",
  confidence: "confirmed",
  rumorCategory: "final_lockdown",
  templateId: "system.final_lockdown_resolved",
  message: "Final Lockdown skončil. Město má nové Top 3.",
  messageKey: "system.final_lockdown_resolved",
  payload: {
    rumorCategory: "final_lockdown",
    confidence: "confirmed",
    audience: "global_city",
    intensityBand: "high",
    topRankCount: topScores.length
  }
});

const resolveFinalLockdownFeedTtlTicks = (tickRateMs: number): number =>
  Math.max(1, Math.ceil(FINAL_LOCKDOWN_FEED_TTL_MS / Math.max(1, Number(tickRateMs) || DEFAULT_TICK_RATE_MS)));
