import type { ReducePoliceHeatCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreError } from "../errors";
import type { CoreEvent } from "../events";
import { createEvent } from "../events";
import { getHeatReductionOptions } from "../rules/police/heatReduction";
import { resolveWantedLevel } from "../rules/police/wantedLevel";
import { spendPlayerInfluence } from "../rules/economy/playerInfluence";

export const handleReducePoliceHeat = (state: CoreGameState, command: ReducePoliceHeatCommand, context: GameCoreContext): {
  nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[];
} => {
  const option = getHeatReductionOptions(state, command.playerId, context).find((entry) => entry.method === command.payload.method);
  if (!option?.available) return { nextState: state, events: [], errors: [{ code: "heat_reduction_unavailable", message: option?.reason ?? "Neplatná metoda snížení heat." }] };
  const player = state.playersById[command.playerId];
  const police = state.policeStatesById[player.policeStateId];
  const resource = state.resourceStatesById[player.resourceStateId];
  const config = context.config.balance.police!.heatReduction!;
  const currency = option.method === "dirty" ? "dirty-cash" : "cash";
  const balances = { ...(resource?.balances ?? {}) };
  if (option.method !== "influence") balances[currency] = Math.max(0, Number(balances[currency] || 0) - option.cost);
  // The client cannot choose its audit roll by changing a command ID or cost.
  const audited = auditRoll(`${state.serverInstance.worldSeed}:heat-audit:${player.id}:${state.root.tick}:${option.method}`) < option.auditRiskPct;
  const fine = audited ? Math.min(option.auditFineMax, Math.floor(Math.max(0, Number(balances[currency] || 0)))) : 0;
  if (fine > 0) balances[currency] -= fine;
  const auditHeatGain = audited ? option.auditHeatGain : 0;
  const heat = Math.max(0, police.heat - option.actualHeatReduction) + auditHeatGain;
  const message = `Heat −${option.actualHeatReduction}. Zaplaceno ${option.cost} ${option.method === "influence" ? "vlivu" : `${option.method} cash`}.`
    + (audited ? ` Audit: +${auditHeatGain} heat, pokuta ${fine} ${option.method} cash.` : ` Audit neproběhl (riziko ${option.auditRiskPct} %).`);
  const entry = { tick: state.root.tick, method: option.method, auditRiskPct: option.auditRiskPct, audited, heatReduced: option.actualHeatReduction, auditHeatGain, fine, paid: option.cost, message,
    createdAt: context.clock?.nowIso() ?? new Date(Date.parse(state.serverInstance.startedAt || new Date(0).toISOString()) + state.root.tick * context.config.tickRateMs).toISOString() };
  return {
    nextState: {
      ...state,
      districtsById: option.method === "influence" ? spendPlayerInfluence({ state, playerId: player.id, amount: option.cost }) : state.districtsById,
      resourceStatesById: resource && option.method !== "influence" ? { ...state.resourceStatesById, [resource.id]: { ...resource, balances, lastUpdatedTick: state.root.tick, version: resource.version + 1 } } : state.resourceStatesById,
      policeStatesById: { ...state.policeStatesById, [police.id]: { ...police, heat, wantedLevel: resolveWantedLevel(heat),
        heatReductionCooldowns: { ...police.heatReductionCooldowns, [option.method]: state.root.tick + option.cooldownTicks },
        heatReductionGlobalCooldownUntilTick: state.root.tick + config.globalCooldownTicks,
        heatReductionHistory: [entry, ...(police.heatReductionHistory ?? [])].slice(0, 20),
        policeEvents: [{ id: `police:heat-reduction:${player.id}:${state.root.tick}`, type: "police-heat-reduced", playerId: player.id, severity: audited ? "medium" as const : "low" as const,
          message, createdAtTick: state.root.tick, payload: { ...entry } }, ...(police.policeEvents ?? [])].slice(0, 12),
        version: police.version + 1 } }
    },
    events: [createEvent("police-heat-reduced", { playerId: player.id, ...entry, heatAfter: heat })],
    errors: []
  };
};

const auditRoll = (seed: string): number => {
  let hash = 2166136261;
  for (const char of seed) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) / 4294967296 * 100;
};
