import {
  applyCommand,
  type CoreGameState,
  type GameCoreContext
} from "@empire/game-core";
import type {
  AttackDistrictCommand,
  CollectProductionCommand,
  CraftItemCommand
} from "@empire/shared-types";
import { attachStarterBuildings } from "./state";
import type { PacingMetrics } from "./types";

export const executeBotActions = (
  state: CoreGameState,
  context: GameCoreContext,
  metrics: PacingMetrics,
  tick: number,
  previousTick = Math.max(0, tick - 1)
): void => {
  const attackIntervalTicks = Math.max(24, Math.floor((context.config.balance.conflict?.attackCooldownTicks ?? 36) * 4));
  const extraAttackChancePct = Math.max(0, (144 / attackIntervalTicks - 1) * 100);
  const economyIntervalTicks = 720;

  for (const playerId of state.root.playerIds) {
    if (state.playersById[playerId]?.status !== "active") continue;

    const economyTick = findScheduledTick(playerId, economyIntervalTicks, previousTick, tick);
    if (economyTick !== null) {
      collectReadyProduction(state, context, playerId, economyTick);
      craftArmoryPistol(state, context, playerId, economyTick);
    }

    const attackTick = findScheduledTick(playerId, attackIntervalTicks, previousTick, tick);
    if (attackTick !== null) {
      attackBestRoute(state, context, metrics, playerId, attackTick);
      if (shouldRunExtraAttack(playerId, tick, extraAttackChancePct)) {
        attackBestRoute(state, context, metrics, playerId, attackTick + 1);
      }
    }
  }
};

const collectReadyProduction = (
  state: CoreGameState,
  context: GameCoreContext,
  playerId: string,
  tick: number
): void => {
  for (const building of Object.values(state.buildingsById).filter((entry) => entry.ownerPlayerId === playerId)) {
    const profile = context.config.balance.productionBuildings?.[building.buildingTypeId];
    if (!profile) continue;
    const resourceState = state.resourceStatesById[`resource:${building.id}`];
    if (Math.max(0, Number(resourceState?.balances[profile.resourceKey] || 0)) <= 0) continue;

    const result = applyCommand(state, {
      id: `command:pacing:collect:${playerId}:${building.id}:${tick}`,
      type: "collect-production",
      mode: "free",
      playerId,
      serverInstanceId: state.serverInstance.id,
      issuedAt: new Date(tick * context.config.tickRateMs).toISOString(),
      payload: { districtId: building.districtId, buildingId: building.id },
      clientRequestId: null
    } satisfies CollectProductionCommand, context);
    if (result.errors.length === 0) copyState(state, result.nextState);
  }
};

const craftArmoryPistol = (
  state: CoreGameState,
  context: GameCoreContext,
  playerId: string,
  tick: number
): void => {
  const armory = Object.values(state.buildingsById).find((building) =>
    building.ownerPlayerId === playerId && building.buildingTypeId === "armory" && !building.processing
  );
  if (!armory) return;

  const result = applyCommand(state, {
    id: `command:pacing:craft:${playerId}:${tick}`,
    type: "craft-item",
    mode: "free",
    playerId,
    serverInstanceId: state.serverInstance.id,
    issuedAt: new Date(tick * context.config.tickRateMs).toISOString(),
    payload: { districtId: armory.districtId, buildingId: armory.id, recipeId: "pistol" },
    clientRequestId: null
  } satisfies CraftItemCommand, context);
  if (result.errors.length === 0) copyState(state, result.nextState);
};

const attackBestRoute = (
  state: CoreGameState,
  context: GameCoreContext,
  metrics: PacingMetrics,
  playerId: string,
  tick: number
): void => {
  const route = findAttackRoute(state, playerId, tick);
  if (!route) return;

  const targetBefore = state.districtsById[route.targetDistrictId]?.ownerPlayerId ?? null;
  const result = applyCommand(state, {
    id: `command:pacing:attack:${playerId}:${route.targetDistrictId}:${tick}`,
    type: "attack-district",
    mode: "free",
    playerId,
    serverInstanceId: state.serverInstance.id,
    issuedAt: new Date(tick * context.config.tickRateMs).toISOString(),
    payload: route,
    clientRequestId: null
  } satisfies AttackDistrictCommand, context);

  metrics.totalAttacks += 1;
  if (result.errors.length > 0) {
    metrics.failedAttacks += 1;
    return;
  }

  copyState(state, result.nextState);
  const targetAfter = state.districtsById[route.targetDistrictId]?.ownerPlayerId ?? null;
  if (targetBefore !== playerId && targetAfter === playerId) {
    metrics.successfulAttacks += 1;
    metrics.districtCaptures += 1;
    attachStarterBuildings(state, route.targetDistrictId, playerId);
  } else {
    metrics.failedAttacks += 1;
  }
};

const findAttackRoute = (
  state: CoreGameState,
  playerId: string,
  tick: number
): { sourceDistrictId: string; districtId: string; targetDistrictId: string } | null => {
  const owned = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId && district.status !== "destroyed")
    .sort((left, right) => scoreRouteSeed(playerId, left.id, tick) - scoreRouteSeed(playerId, right.id, tick));

  for (const source of owned) {
    const targets = source.adjacentDistrictIds
      .map((districtId) => state.districtsById[districtId])
      .filter((district) => district && district.status !== "destroyed" && district.ownerPlayerId !== playerId)
      .sort((left, right) =>
        targetPriority(left, state.playersById[playerId]?.allianceId ?? null)
        - targetPriority(right, state.playersById[playerId]?.allianceId ?? null)
        || scoreRouteSeed(playerId, left.id, tick) - scoreRouteSeed(playerId, right.id, tick)
      );
    const target = targets[0];
    if (target) return { sourceDistrictId: source.id, districtId: target.id, targetDistrictId: target.id };
  }

  return null;
};

const targetPriority = (district: CoreGameState["districtsById"][string], allianceId: string | null): number => {
  if (!district.ownerPlayerId) return 0;
  if (allianceId && district.controllerAllianceId === allianceId) return 4;
  return 2;
};

const playerOffset = (playerId: string, interval: number): number =>
  (stableHash(playerId) % Math.max(1, Math.floor(interval / 12))) * 12;

const findScheduledTick = (
  playerId: string,
  interval: number,
  previousTick: number,
  currentTick: number
): number | null => {
  const offset = playerOffset(playerId, interval);
  let scheduledTick = offset;
  if (scheduledTick <= previousTick) {
    scheduledTick += Math.ceil((previousTick - scheduledTick + 1) / interval) * interval;
  }
  return scheduledTick > 0 && scheduledTick <= currentTick ? scheduledTick : null;
};

const shouldRunExtraAttack = (playerId: string, tick: number, chancePct: number): boolean => {
  if (chancePct <= 0) return false;
  return stableHash(`${playerId}:${Math.floor(tick / 720)}:extra-attack`) % 10_000 < Math.min(100, chancePct) * 100;
};

const scoreRouteSeed = (playerId: string, districtId: string, tick: number): number =>
  stableHash(`${playerId}:${districtId}:${Math.floor(tick / 720)}`);

const stableHash = (value: string): number => {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const copyState = (target: CoreGameState, source: CoreGameState): void => {
  Object.assign(target, source);
};
