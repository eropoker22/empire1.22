import type { GameModeConfig } from "../../contracts";
import type { CoreGameState } from "../../entities";

export const resolveEffectiveFinalLockdownTrigger = (
  state: CoreGameState,
  config: GameModeConfig
): number | null => {
  const canonicalTrigger = normalizePositiveInteger(config.balance.finalLockdown?.triggerActivePlayers);
  const pacingState = state.serverPacingState;
  if (!pacingState) return canonicalTrigger;
  if (!hasClosedRegistration(pacingState.registrationClosedAt)) return null;
  return normalizePositiveInteger(pacingState.effectiveFinalLockdownTrigger);
};

export const resolveEffectiveFirstEliminationTick = (
  state: CoreGameState,
  config: GameModeConfig
): number | null => {
  const canonicalTick = normalizeNonNegativeInteger(config.balance.elimination?.firstEliminationTick);
  const pacingState = state.serverPacingState;
  if (!pacingState) return canonicalTick;
  if (pacingState.eliminationEnabled !== true) return null;
  if (!hasClosedRegistration(pacingState.registrationClosedAt)) return null;

  const hostedTick = normalizeNonNegativeInteger(pacingState.effectiveFirstEliminationTick);
  if (canonicalTick === null) return hostedTick ?? 0;
  return Math.max(canonicalTick, hostedTick ?? canonicalTick);
};

export const resolveEffectiveEliminationMinimumPlayers = (
  state: CoreGameState,
  config: GameModeConfig
): number | null => {
  const canonicalMinimum = normalizePositiveInteger(config.balance.elimination?.minActivePlayers);
  if (canonicalMinimum === null) return null;
  if (!state.serverPacingState) return canonicalMinimum;
  if (state.serverPacingState.eliminationEnabled !== true) return null;
  if (!hasClosedRegistration(state.serverPacingState.registrationClosedAt)) return null;
  if (!config.balance.finalLockdown?.enabled) return canonicalMinimum;
  return resolveEffectiveFinalLockdownTrigger(state, config);
};

export const isServerPacingEliminationEnabled = (
  state: CoreGameState,
  config: GameModeConfig
): boolean => state.serverPacingState
  ? state.serverPacingState.eliminationEnabled === true
  : config.balance.elimination?.enabled === true;

export const isServerPacingGraceActive = (
  state: CoreGameState,
  config: GameModeConfig,
  tick = state.root.tick
): boolean => {
  if (!state.serverPacingState) return false;
  const effectiveFirstTick = resolveEffectiveFirstEliminationTick(state, config);
  return effectiveFirstTick === null || tick < effectiveFirstTick;
};

const hasClosedRegistration = (registrationClosedAt: string | null): boolean =>
  typeof registrationClosedAt === "string" && registrationClosedAt.trim().length > 0;

const normalizePositiveInteger = (value: number | null | undefined): number | null => {
  const normalized = Math.floor(Number(value));
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
};

const normalizeNonNegativeInteger = (value: number | null | undefined): number | null => {
  const normalized = Math.floor(Number(value));
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : null;
};
