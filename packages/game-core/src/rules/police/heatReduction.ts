import type { HeatReductionMethod } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";

export const getHeatReductionOptions = (state: CoreGameState, playerId: string, context?: GameCoreContext) => {
  const config = context?.config.balance.police?.heatReduction;
  const player = state.playersById[playerId];
  if (!config || !context || !player) return [];
  const police = state.policeStatesById[player.policeStateId];
  const balances = state.resourceStatesById[player.resourceStateId]?.balances ?? {};
  const influence = Object.values(state.districtsById).reduce((sum, district) =>
    sum + (district.ownerPlayerId === playerId && district.status !== "destroyed" ? Math.max(0, Number(district.influence || 0)) : 0), 0);
  const recentCount = (police?.heatReductionHistory ?? []).filter((entry) =>
    entry.tick <= state.root.tick && state.root.tick - entry.tick < config.auditWindowTicks && entry.method !== "influence"
  ).length;
  return (Object.keys(config.methods) as HeatReductionMethod[]).map((method) => {
    const option = config.methods[method];
    const available = method === "influence" ? influence : Math.max(0, Number(balances[method === "clean" ? "cash" : "dirty-cash"] || 0));
    const cooldownUntilTick = Math.max(police?.heatReductionCooldowns?.[method] ?? 0, police?.heatReductionGlobalCooldownUntilTick ?? 0);
    const reason = player.status !== "active" ? "Hráč není aktivní."
      : state.matchResult ? "Hra již skončila."
      : !(Number(police?.heat || 0) > 0) ? "Heat hráče je již nulový."
      : cooldownUntilTick > state.root.tick ? "Vyčkej na dokončení cooldownu."
      : available < option.cost ? "Nemáš dost prostředků." : null;
    return {
      method,
      cost: option.cost,
      heatReduction: option.heatReduction,
      actualHeatReduction: Math.min(option.heatReduction, Math.max(0, Number(police?.heat || 0))),
      auditRiskPct: method === "influence" ? 0 : Math.min(config.maxAuditRiskPct, option.baseAuditRiskPct + recentCount * config.auditRiskPerRecentActionPct),
      auditFineMax: method === "influence" ? 0 : Math.floor(option.cost * config.auditFinePct / 100),
      auditHeatGain: method === "influence" ? 0 : config.auditHeatGain,
      cooldownTicks: option.cooldownTicks,
      remainingMs: Math.max(0, cooldownUntilTick - state.root.tick) * context.config.tickRateMs,
      available: reason === null,
      reason
    };
  });
};
