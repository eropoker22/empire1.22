import {
  applyCommand,
  type CoreGameState,
  type GameCoreContext
} from "@empire/game-core";
import type {
  AttackDistrictCommand,
  CollectProductionCommand,
  CraftItemCommand,
  SpyDistrictCommand
} from "@empire/shared-types";
import { PLAYER_FACTION_IDS, type PlayerFactionId } from "@empire/shared-types";
import type { FactionBotBehaviorProfile } from "./factionBotBehavior";
import { resolveFactionBotBehavior } from "./factionBotBehavior";
import { attachStarterBuildings } from "./state";
import type { PacingMetrics } from "./types";

export const executeBotActions = (
  state: CoreGameState,
  context: GameCoreContext,
  metrics: PacingMetrics,
  tick: number,
  previousTick = Math.max(0, tick - 1)
): void => {
  const baseAttackIntervalTicks = Math.max(24, Math.floor((context.config.balance.conflict?.attackCooldownTicks ?? 36) * 4));
  const baseExtraAttackChancePct = Math.max(0, (144 / baseAttackIntervalTicks - 1) * 100);
  const economyIntervalTicks = 720;

  for (const playerId of state.root.playerIds) {
    const player = state.playersById[playerId];
    if (player?.status !== "active") continue;
    const profile = resolveFactionBotBehavior(player.factionId);
    const isDangerZone = isPlayerInDangerZone(state, context, playerId);

    const economyTick = findScheduledTick(playerId, economyIntervalTicks, previousTick, tick);
    if (economyTick !== null) {
      collectReadyProduction(state, context, playerId, economyTick);
      craftArmoryPistol(state, context, playerId, economyTick);
    }

    const attackIntervalTicks = resolveAttackIntervalTicks(baseAttackIntervalTicks, profile, isDangerZone);
    const extraAttackChancePct = resolveExtraAttackChancePct(baseExtraAttackChancePct, profile, isDangerZone);
    const attackTick = findScheduledTick(playerId, attackIntervalTicks, previousTick, tick);
    if (attackTick !== null && shouldAttemptAttack(state, playerId, attackTick, profile, isDangerZone)) {
      attackBestRoute(state, context, metrics, playerId, attackTick, profile, isDangerZone);
      if (shouldRunExtraAttack(playerId, tick, extraAttackChancePct)) {
        attackBestRoute(state, context, metrics, playerId, attackTick + 1, profile, isDangerZone);
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
  tick: number,
  profile = resolveFactionBotBehavior(state.playersById[playerId]?.factionId),
  wasInDangerZone = isPlayerInDangerZone(state, context, playerId)
): void => {
  const route = findAttackRoute(state, playerId, tick, profile);
  if (!route) return;
  const factionStats = getFactionActionStats(metrics, state.playersById[playerId]?.factionId);
  const shouldSpy = shouldSpyBeforeAttack(playerId, route.targetDistrictId, tick, profile, wasInDangerZone);
  if (shouldSpy) {
    const spySucceeded = spyDistrictRoute(state, context, metrics, playerId, route, tick);
    if (!spySucceeded && !shouldAttackAfterFailedSpy(playerId, route.targetDistrictId, tick, profile, wasInDangerZone)) {
      return;
    }
  }

  const targetBefore = state.districtsById[route.targetDistrictId]?.ownerPlayerId ?? null;
  const result = applyCommand(state, {
    id: `command:pacing:attack:${playerId}:${route.targetDistrictId}:${tick}`,
    type: "attack-district",
    mode: "free",
    playerId,
    serverInstanceId: state.serverInstance.id,
    issuedAt: new Date(tick * context.config.tickRateMs).toISOString(),
    payload: {
      ...route,
      weapons: { ...(state.playersById[playerId]?.attackLoadout ?? {}) }
    },
    clientRequestId: null
  } satisfies AttackDistrictCommand, context);

  metrics.totalAttacks += 1;
  factionStats.attackCount += 1;
  if (result.errors.length > 0) {
    metrics.failedAttacks += 1;
    return;
  }

  copyState(state, result.nextState);
  const targetAfter = state.districtsById[route.targetDistrictId]?.ownerPlayerId ?? null;
  if (targetBefore !== playerId && targetAfter === playerId) {
    metrics.successfulAttacks += 1;
    metrics.districtCaptures += 1;
    factionStats.successfulAttacks += 1;
    attachStarterBuildings(state, route.targetDistrictId, playerId);
    if (wasInDangerZone && !isPlayerInDangerZone(state, context, playerId)) {
      factionStats.dangerZoneEscapes += 1;
    }
  } else {
    metrics.failedAttacks += 1;
  }
};

const spyDistrictRoute = (
  state: CoreGameState,
  context: GameCoreContext,
  metrics: PacingMetrics,
  playerId: string,
  route: { sourceDistrictId: string; districtId: string; targetDistrictId: string },
  tick: number
): boolean => {
  const factionStats = getFactionActionStats(metrics, state.playersById[playerId]?.factionId);
  factionStats.spyAttempts += 1;
  const result = applyCommand(state, {
    id: `command:pacing:spy:${playerId}:${route.targetDistrictId}:${tick}`,
    type: "spy-district",
    mode: "free",
    playerId,
    serverInstanceId: state.serverInstance.id,
    issuedAt: new Date(tick * context.config.tickRateMs).toISOString(),
    payload: { districtId: route.targetDistrictId, sourceDistrictId: route.sourceDistrictId },
    clientRequestId: null
  } satisfies SpyDistrictCommand, context);
  if (result.errors.length > 0) {
    return false;
  }
  const spyEvent = result.events.find((event) => event.type === "district-spied");
  const spyPayload = spyEvent?.payload as { result?: unknown } | undefined;
  const success = spyPayload?.result === "success";
  if (success) {
    factionStats.spySuccesses += 1;
  }
  copyState(state, result.nextState);
  return success;
};

const getFactionActionStats = (
  metrics: PacingMetrics,
  factionId: unknown
): PacingMetrics["factionActionStats"][PlayerFactionId] => {
  const normalizedFactionId = PLAYER_FACTION_IDS.includes(factionId as PlayerFactionId)
    ? factionId as PlayerFactionId
    : "mafian";
  metrics.factionActionStats[normalizedFactionId] ??= {
    attackCount: 0,
    successfulAttacks: 0,
    spyAttempts: 0,
    spySuccesses: 0,
    dangerZoneEscapes: 0
  };
  return metrics.factionActionStats[normalizedFactionId];
};

const findAttackRoute = (
  state: CoreGameState,
  playerId: string,
  tick: number,
  profile: FactionBotBehaviorProfile
): { sourceDistrictId: string; districtId: string; targetDistrictId: string } | null => {
  const owned = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId && district.status !== "destroyed")
    .sort((left, right) => scoreRouteSeed(playerId, left.id, tick) - scoreRouteSeed(playerId, right.id, tick));

  for (const source of owned) {
    const targets = source.adjacentDistrictIds
      .map((districtId) => state.districtsById[districtId])
      .filter((district) => district && district.status !== "destroyed" && district.ownerPlayerId !== playerId)
      .sort((left, right) =>
        targetPriority(left, state, state.playersById[playerId]?.allianceId ?? null, profile)
        - targetPriority(right, state, state.playersById[playerId]?.allianceId ?? null, profile)
        || scoreRouteSeed(playerId, left.id, tick) - scoreRouteSeed(playerId, right.id, tick)
      );
    const target = targets[0];
    if (target) return { sourceDistrictId: source.id, districtId: target.id, targetDistrictId: target.id };
  }

  return null;
};

const targetPriority = (
  district: CoreGameState["districtsById"][string],
  state: CoreGameState,
  allianceId: string | null,
  profile: FactionBotBehaviorProfile
): number => {
  if (allianceId && district.controllerAllianceId === allianceId) return 100;
  const defenseScore = Object.values(district.defenseLoadout ?? {}).reduce((sum, amount) => sum + Number(amount || 0), 0);
  const ownerControlledDistricts = district.ownerPlayerId ? countControlledDistricts(state, district.ownerPlayerId) : 0;
  const preferredZoneBias = resolvePreferredZoneBias(district.zone, profile);
  const neutralScore = district.ownerPlayerId ? 2 : Math.max(0, 1.1 - profile.neutralTargetBias);
  const weakTargetScore = (defenseScore + ownerControlledDistricts * 0.7) / Math.max(0.6, profile.weakTargetBias);
  return neutralScore + weakTargetScore - preferredZoneBias;
};

const resolvePreferredZoneBias = (zone: string, profile: FactionBotBehaviorProfile): number => {
  if (profile.economyFocus === "finance" && zone === "downtown") return 1.2;
  if (profile.economyFocus === "dirty" && zone === "park") return 0.9;
  if (profile.economyFocus === "tech" && zone === "industrial") return 0.8;
  if (profile.economyFocus === "clean" && zone === "commercial") return 0.7;
  if (profile.economyFocus === "influence" && zone === "residential") return 0.6;
  return 0;
};

const resolveAttackIntervalTicks = (
  baseAttackIntervalTicks: number,
  profile: FactionBotBehaviorProfile,
  isDangerZone: boolean
): number => {
  const dangerMultiplier = isDangerZone ? Math.max(1, profile.dangerZoneAttackMultiplier) : 1;
  return Math.max(24, Math.floor((baseAttackIntervalTicks * profile.attackIntervalMultiplier) / dangerMultiplier));
};

const resolveExtraAttackChancePct = (
  baseExtraAttackChancePct: number,
  profile: FactionBotBehaviorProfile,
  isDangerZone: boolean
): number =>
  Math.max(0, baseExtraAttackChancePct * profile.extraAttackChanceMultiplier * (isDangerZone ? 1.25 : 1));

const shouldAttemptAttack = (
  state: CoreGameState,
  playerId: string,
  tick: number,
  profile: FactionBotBehaviorProfile,
  isDangerZone: boolean
): boolean => {
  const policeState = state.policeStatesById[state.playersById[playerId]?.policeStateId ?? ""];
  const heatPct = Math.max(0, Number(policeState?.heat || 0)) / 100;
  const heatPenalty = !isDangerZone && heatPct > profile.heatTolerance ? 0.68 : 1;
  const thresholdPct = Math.max(8, Math.min(100, profile.attackTendency * heatPenalty * (isDangerZone ? 1.18 : 1) * 100));
  return stableHash(`${playerId}:${tick}:attack-profile`) % 10_000 < thresholdPct * 100;
};

const shouldSpyBeforeAttack = (
  playerId: string,
  targetDistrictId: string,
  tick: number,
  profile: FactionBotBehaviorProfile,
  isDangerZone: boolean
): boolean => {
  const pressurePenalty = isDangerZone ? 0.82 : 1;
  const thresholdPct = Math.max(0, Math.min(100, profile.spyTendency * pressurePenalty * 100));
  return stableHash(`${playerId}:${targetDistrictId}:${tick}:spy-profile`) % 10_000 < thresholdPct * 100;
};

const shouldAttackAfterFailedSpy = (
  playerId: string,
  targetDistrictId: string,
  tick: number,
  profile: FactionBotBehaviorProfile,
  isDangerZone: boolean
): boolean => {
  const thresholdPct = Math.max(0, Math.min(100, profile.blindAttackTolerance * (isDangerZone ? 1.35 : 1) * 100));
  return stableHash(`${playerId}:${targetDistrictId}:${tick}:blind-attack`) % 10_000 < thresholdPct * 100;
};

const isPlayerInDangerZone = (
  state: CoreGameState,
  context: GameCoreContext,
  playerId: string
): boolean => {
  const activePlayers = state.root.playerIds.filter((id) => state.playersById[id]?.status === "active");
  const minActivePlayers = context.config.balance.elimination?.minActivePlayers ?? 8;
  if (activePlayers.length <= minActivePlayers || !activePlayers.includes(playerId)) return false;
  const dangerZoneSize = Math.max(1, context.config.balance.elimination?.dangerZoneSize ?? 3);
  return activePlayers
    .sort((left, right) =>
      playerSurvivalScore(state, left) - playerSurvivalScore(state, right)
      || left.localeCompare(right)
    )
    .slice(0, dangerZoneSize)
    .includes(playerId);
};

const playerSurvivalScore = (state: CoreGameState, playerId: string): number => {
  const controlledDistricts = countControlledDistricts(state, playerId);
  const influence = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId && district.status !== "destroyed")
    .reduce((sum, district) => sum + Math.max(0, Number(district.influence || 0)), 0);
  const resources = state.resourceStatesById[state.playersById[playerId]?.resourceStateId ?? ""]?.balances ?? {};
  return controlledDistricts * 1000 + influence * 12 + Math.max(0, Number(resources.cash || 0)) / 100;
};

const countControlledDistricts = (state: CoreGameState, playerId: string): number =>
  Object.values(state.districtsById).filter((district) => district.ownerPlayerId === playerId && district.status !== "destroyed").length;

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
