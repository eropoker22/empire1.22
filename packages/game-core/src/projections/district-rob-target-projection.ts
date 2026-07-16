import type { RobDistrictCommand } from "@empire/shared-types";
import type { ConflictBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities/game-state";
import { createRobCooldownKey, createRobSourceCooldownKey } from "../rules";
import { validateRob } from "../validation";

export const createDistrictRobTargetViews = (
  state: CoreGameState,
  playerId: string,
  sourceDistrictId: string,
  conflictConfig?: ConflictBalanceConfig,
  issuedAt = new Date().toISOString()
) => {
  const source = state.districtsById[sourceDistrictId];
  if (!source) return [];
  const player = state.playersById[playerId];
  const availablePopulation = Math.floor(Number(
    player?.population ?? state.resourceStatesById[player?.resourceStateId]?.balances?.population ?? 0
  ));
  const hasPopulationForRob = Number.isFinite(availablePopulation) && availablePopulation >= 1;
  return source.adjacentDistrictIds.map((id) => state.districtsById[id]).filter(Boolean).map((target) => {
    const previewCommand: RobDistrictCommand = {
      id: `preview:rob:${source.id}:${target.id}`, type: "rob-district", mode: state.serverInstance.mode,
      playerId, serverInstanceId: state.serverInstance.id, issuedAt,
      payload: { targetDistrictId: target.id, sourceDistrictId: source.id,
        expectedTargetVersion: target.version, expectedSourceVersion: source.version,
        expectedConflictRevision: target.conflictRevision },
      clientRequestId: null
    };
    const errors = validateRob(state, previewCommand, conflictConfig);
    const cooldownRemainingTicks = maxCooldown(state, playerId, [
      createRobCooldownKey(target.id), createRobSourceCooldownKey(source.id)
    ]);
    const populationBlocked = hasPopulationForRob ? null : "INSUFFICIENT_POPULATION";
    const disabledCode = errors[0]?.code ?? populationBlocked ?? null;
    const pool = target.neutralLootPool;
    const initial = pool ? pool.initialCash + pool.initialDirtyCash
      + Object.values(pool.initialResources).reduce((sum, amount) => sum + Number(amount), 0) : 0;
    const current = pool ? pool.cash + pool.dirtyCash
      + Object.values(pool.resources).reduce((sum, amount) => sum + Number(amount), 0) : 0;
    const fraction = initial > 0 ? current / initial : 0;
    const lootPoolLevel = fraction <= 0 ? "exhausted" as const : fraction < 0.2 ? "low" as const
      : fraction < 0.65 ? "partial" as const : "rich" as const;
    return {
      districtId: target.id, name: target.name, ownerPlayerId: target.ownerPlayerId, status: target.status,
      enabled: errors.length === 0 && !populationBlocked, disabledCode,
      disabledReason: errors[0]?.message ?? (disabledCode ? actionReason(disabledCode) : null),
      cooldownRemainingTicks, expectedTargetVersion: target.version, expectedSourceVersion: source.version,
      expectedConflictRevision: target.conflictRevision,
      expectedLootPoolRevision: target.neutralLootPool?.version ?? 0,
      lootPoolLevel, exhausted: lootPoolLevel === "exhausted", heatRisk: { minimum: 1, maximum: 6 }
    };
  });
};

const maxCooldown = (state: CoreGameState, playerId: string, keys: string[]): number => {
  const player = state.playersById[playerId];
  const cooldowns = state.cooldownStatesById[player?.cooldownStateId ?? ""]?.cooldowns ?? {};
  return keys.reduce((max, key) => Math.max(max, Math.max(0, Number(cooldowns[key] ?? 0) - state.root.tick)), 0);
};

const actionReason = (code: string): string => code === "INSUFFICIENT_POPULATION"
  ? "K vykradení je potřeba alespoň 1 člen populace."
  : code;
