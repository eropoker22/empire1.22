import type { CityFeedEvent, DayNightReadModel } from "@empire/shared-types";
import type { DayNightBalanceConfig, DayNightModifiersConfig, DayNightPhaseConfig, DayNightPhaseId } from "../../contracts";
import type { GameCoreContext } from "../../engine/context";
import type { CoreGameState } from "../../entities";

type AnyRecord = Record<string, any>;

const EMPTY_MODIFIERS: DayNightModifiersConfig = Object.freeze({});
const GAME_PHASE_DURATION_MINUTES = 12 * 60;
const DAY_GAME_START_HOUR = 6;
const NIGHT_GAME_START_HOUR = 18;
const DEFAULT_TICK_RATE_MS = 1000;

export interface DayNightPhaseState {
  phaseId: DayNightPhaseId;
  config: DayNightPhaseConfig;
  startedAtTick: number;
  endsAtTick: number;
  remainingTicks: number;
  progressPct: number;
  elapsedTicks: number;
  durationTicks: number;
}

export const getCurrentDayNightPhase = (
  state: Pick<CoreGameState, "root"> | AnyRecord,
  context?: Pick<GameCoreContext, "config">,
  tickOverride?: number
): DayNightPhaseState => {
  const config = resolveDayNightConfig(context);
  const tick = Math.max(0, Math.floor(Number(tickOverride ?? state?.root?.tick ?? 0) || 0));
  const phases = resolveOrderedPhases(config);
  const totalDuration = phases.reduce((total, phase) => total + getPhaseDuration(phase), 0);
  let offset = totalDuration > 0 ? tick % totalDuration : 0;
  let startedAtTick = tick - offset;

  for (const phase of phases) {
    const duration = getPhaseDuration(phase);
    if (offset < duration) return toPhaseState(phase, startedAtTick, offset);
    offset -= duration;
    startedAtTick += duration;
  }

  return toPhaseState(phases[0], tick, 0);
};

export const getDayNightModifiers = (
  state: Pick<CoreGameState, "root"> | AnyRecord,
  context?: Pick<GameCoreContext, "config">
): DayNightModifiersConfig =>
  resolveDayNightConfig(context).enabled
    ? getCurrentDayNightPhase(state, context).config.modifiers
    : EMPTY_MODIFIERS;

export const isNightPhase = (
  state: Pick<CoreGameState, "root"> | AnyRecord,
  context?: Pick<GameCoreContext, "config">
): boolean => getCurrentDayNightPhase(state, context).phaseId === "night";

export const isDayPhase = (
  state: Pick<CoreGameState, "root"> | AnyRecord,
  context?: Pick<GameCoreContext, "config">
): boolean => getCurrentDayNightPhase(state, context).phaseId === "day";

export const createDayNightReadModel = (
  state: CoreGameState,
  context?: Pick<GameCoreContext, "config">
): DayNightReadModel => {
  const phase = getCurrentDayNightPhase(state, context);
  const gameClock = resolveDayNightGameClock(phase);
  return {
    phaseId: phase.phaseId,
    label: phase.config.label,
    startedAtTick: phase.startedAtTick,
    endsAtTick: phase.endsAtTick,
    remainingTicks: phase.remainingTicks,
    progressPct: phase.progressPct,
    gameClockLabel: gameClock.gameClockLabel,
    gameHour: gameClock.gameHour,
    gameMinute: gameClock.gameMinute,
    phaseStartsAtGameHour: gameClock.phaseStartsAtGameHour,
    phaseEndsAtGameHour: gameClock.phaseEndsAtGameHour,
    realPhaseDurationMs: resolveRealPhaseDurationMs(phase, context),
    effectSummary: [...phase.config.effectSummary],
    recommendations: createPhaseRecommendations(phase.phaseId),
    uiThemeHint: phase.config.uiThemeHint
  };
};

export const createDayNightTransitionFeedEvent = (
  state: CoreGameState,
  context: GameCoreContext,
  previousTick: number,
  currentTick: number
): CityFeedEvent | null => {
  const config = resolveDayNightConfig(context);
  if (!config.enabled) return null;
  const previousPhase = getCurrentDayNightPhase(state, context, previousTick);
  const currentPhase = getCurrentDayNightPhase(state, context, currentTick);
  if (previousPhase.phaseId === currentPhase.phaseId) return null;

  const sourceEventId = `day-night:${currentPhase.phaseId}:${currentPhase.startedAtTick}`;
  return {
    id: `city-feed:${sourceEventId}`,
    sourceEventId,
    sourceType: "system",
    category: "system",
    severity: "low",
    truthiness: "confirmed",
    intelType: "confirmed_event",
    visibility: "all",
    createdAtTick: currentTick,
    message: currentPhase.config.cityFeedMessages[0] || currentPhase.config.label,
    messageKey: `dayNight.${currentPhase.phaseId}`,
    payload: {
      phaseId: currentPhase.phaseId,
      startedAtTick: currentPhase.startedAtTick,
      endsAtTick: currentPhase.endsAtTick,
      uiThemeHint: currentPhase.config.uiThemeHint
    }
  };
};

const resolveDayNightConfig = (context?: Pick<GameCoreContext, "config">): DayNightBalanceConfig => {
  const configured = context?.config.balance.dayNight;
  const dayDuration = Math.max(1, Math.floor(Number(context?.config.balance.dayLengthTicks || 12)));
  const nightDuration = Math.max(1, Math.floor(Number(context?.config.balance.nightLengthTicks || 12)));
  return configured ?? {
    enabled: false,
    defaultPhase: "day",
    phases: {
      day: createFallbackPhase("day", dayDuration),
      night: createFallbackPhase("night", nightDuration)
    }
  };
};

const createFallbackPhase = (id: DayNightPhaseId, durationTicks: number): DayNightPhaseConfig => ({
  id,
  label: id === "day" ? "DEN" : "NOC",
  durationTicks,
  modifiers: EMPTY_MODIFIERS,
  cityFeedMessages: [],
  uiThemeHint: id,
  effectSummary: []
});

const resolveOrderedPhases = (config: DayNightBalanceConfig): DayNightPhaseConfig[] =>
  config.defaultPhase === "night"
    ? [config.phases.night, config.phases.day]
    : [config.phases.day, config.phases.night];

const getPhaseDuration = (phase: DayNightPhaseConfig): number =>
  Math.max(1, Math.floor(Number(phase.durationTicks || 1)));

const toPhaseState = (phase: DayNightPhaseConfig, startedAtTick: number, offset: number): DayNightPhaseState => {
  const duration = getPhaseDuration(phase);
  const endsAtTick = startedAtTick + duration;
  const elapsedTicks = Math.max(0, Math.min(duration - 1, Math.floor(offset)));
  return {
    phaseId: phase.id,
    config: phase,
    startedAtTick,
    endsAtTick,
    remainingTicks: Math.max(0, endsAtTick - (startedAtTick + offset)),
    progressPct: Math.round((offset / duration) * 10000) / 100,
    elapsedTicks,
    durationTicks: duration
  };
};

export const resolveDayNightGameClock = (phase: DayNightPhaseState): {
  gameClockLabel: string;
  gameHour: number;
  gameMinute: number;
  phaseStartsAtGameHour: number;
  phaseEndsAtGameHour: number;
} => {
  const phaseStartsAtGameHour = phase.phaseId === "day" ? DAY_GAME_START_HOUR : NIGHT_GAME_START_HOUR;
  const phaseEndsAtGameHour = phase.phaseId === "day" ? NIGHT_GAME_START_HOUR : DAY_GAME_START_HOUR;
  const gameMinutesIntoPhase = Math.min(
    GAME_PHASE_DURATION_MINUTES - 1,
    Math.floor((phase.elapsedTicks / Math.max(1, phase.durationTicks)) * GAME_PHASE_DURATION_MINUTES)
  );
  const absoluteGameMinutes = ((phaseStartsAtGameHour * 60) + gameMinutesIntoPhase) % (24 * 60);
  const gameHour = Math.floor(absoluteGameMinutes / 60);
  const gameMinute = absoluteGameMinutes % 60;

  return {
    gameClockLabel: `${formatClockPart(gameHour)}:${formatClockPart(gameMinute)}`,
    gameHour,
    gameMinute,
    phaseStartsAtGameHour,
    phaseEndsAtGameHour
  };
};

const resolveRealPhaseDurationMs = (
  phase: DayNightPhaseState,
  context?: Pick<GameCoreContext, "config">
): number => {
  const tickRateMs = Math.max(1, Math.round(Number(context?.config.tickRateMs || DEFAULT_TICK_RATE_MS)));
  return phase.durationTicks * tickRateMs;
};

const formatClockPart = (value: number): string =>
  String(Math.max(0, Math.floor(value))).padStart(2, "0");

const createPhaseRecommendations = (phaseId: DayNightPhaseId): string[] =>
  phaseId === "night"
    ? [
        "Dirty cash",
        "Kasino / Herna / Strip Club",
        "Pouliční dealeři / Pašovací tunel",
        "Heist / útok"
      ]
    : [
        "Legal income",
        "Magistrát / Soud / Banka / Burza",
        "Heat control",
        "Příprava útoku"
      ];

