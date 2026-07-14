import type { PlayerBoostCardView, PlayerBoostView } from "@empire/shared-types";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import { getActivePlayerBoost, getPlayerBoostState } from "../rules/player-boosts";

const RESOURCE_LABELS: Record<string, string> = {
  "ghost-serum": "Ghost Serum",
  "pulse-shot": "Pulse Shot",
  "overdrive-x": "Overdrive X",
  "combat-module": "Combat Module"
};

export const createPlayerBoostView = (
  state: CoreGameState,
  playerId: string,
  context: GameCoreContext
): PlayerBoostView | null => {
  const config = context.config.balance.playerBoosts;
  const player = state.playersById[playerId];
  const resources = player ? state.resourceStatesById[player.resourceStateId] : null;
  if (!config || !player || !resources) return null;
  const nowMs = resolveNowMs(context);
  const tickToMs = (tick: number): number => nowMs + (tick - state.root.tick) * context.config.tickRateMs;
  const boostState = getPlayerBoostState(state, playerId);
  const active = getActivePlayerBoost(state, playerId);
  const activeView = active ? {
    boostId: active.boostId,
    label: config[active.boostId].label,
    category: config[active.boostId].category,
    status: active.status,
    activatedAtMs: tickToMs(active.activatedAtTick),
    expiresAtMs: tickToMs(active.expiresAtTick),
    remainingMs: Math.max(0, (active.expiresAtTick - state.root.tick) * context.config.tickRateMs),
    effectSummary: config[active.boostId].shortEffect,
    uiAccent: config[active.boostId].uiAccent
  } : null;
  const cards = Object.values(config).map((definition): PlayerBoostCardView => {
    const costs = Object.entries(definition.inputCosts).map(([resourceKey, required]) => {
      const stored = Math.max(0, Math.floor(Number(resources.balances[resourceKey] || 0)));
      return {
        resourceKey,
        label: RESOURCE_LABELS[resourceKey] ?? resourceKey,
        required,
        stored,
        enough: stored >= required,
        missingAmount: Math.max(0, required - stored)
      };
    });
    const playerCleanCash = Math.max(0, Math.floor(Number(resources.balances.cash || 0)));
    const cooldownTick = Number(boostState.cooldownUntilTickByBoostId[definition.boostId] || 0);
    const cooldownEndsAtMs = cooldownTick > state.root.tick ? tickToMs(cooldownTick) : null;
    const isActive = active?.boostId === definition.boostId;
    const isArmed = isActive && active.status === "armed";
    const isBlockedByActiveBoost = Boolean(active && !isActive);
    const hasEnoughCleanCash = playerCleanCash >= definition.cleanCashCost;
    const hasEnoughMaterials = costs.every((cost) => cost.enough);
    const cooldownRemainingMs = Math.max(0, (cooldownTick - state.root.tick) * context.config.tickRateMs);
    const activeRemainingMs = active ? Math.max(0, (active.expiresAtTick - state.root.tick) * context.config.tickRateMs) : 0;
    let disabledReason: string | null = null;
    if (isActive) {
      disabledReason = isArmed ? "boost_armed" : "boost_active";
    } else if (cooldownRemainingMs > 0 && (!isBlockedByActiveBoost || cooldownRemainingMs >= activeRemainingMs)) {
      disabledReason = "boost_on_cooldown";
    } else if (isBlockedByActiveBoost) {
      disabledReason = "boost_already_active";
    } else if (!hasEnoughCleanCash) {
      disabledReason = "boost_missing_clean_cash";
    } else if (!hasEnoughMaterials) {
      disabledReason = "boost_missing_resources";
    }
    return {
      boostId: definition.boostId,
      label: definition.label,
      category: definition.category,
      description: definition.description,
      shortEffect: definition.shortEffect,
      costs,
      cleanCashCost: definition.cleanCashCost,
      playerCleanCash,
      hasEnoughCleanCash,
      durationMs: definition.activeDurationTicks * context.config.tickRateMs,
      cooldownMs: definition.cooldownTicks * context.config.tickRateMs,
      cooldownEndsAtMs,
      cooldownRemainingMs,
      activeEndsAtMs: isActive && active ? tickToMs(active.expiresAtTick) : null,
      isActive,
      isArmed,
      isBlockedByActiveBoost,
      canActivate: disabledReason === null,
      disabledReason,
      uiAccent: definition.uiAccent,
      iconKey: definition.iconKey
    };
  });
  return { active: activeView, cards };
};

const resolveNowMs = (context: GameCoreContext): number => {
  const parsed = Date.parse(context.clock?.nowIso?.() ?? "");
  if (Number.isFinite(parsed)) return parsed;
  const clockNow = context.clock?.now?.().getTime();
  return Number.isFinite(clockNow) ? Number(clockNow) : Date.now();
};
