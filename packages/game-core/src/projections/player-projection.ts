import {
  ATTACK_WEAPON_IDS,
  DEFAULT_PLAYER_COLOR,
  DEFENSE_WEAPON_IDS,
  type Notification,
  type PlayerEconomyView,
  type PlayerView,
  type VictoryState
} from "@empire/shared-types";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities/game-state";
import { createDayNightReadModel } from "./day-night-read-model-projection";
import { createEliminationReadModel } from "./elimination-read-model-projection";
import { createFactionReadModel } from "./faction-read-model-projection";
import { createFinalLockdownReadModel } from "./final-lockdown-read-model-projection";
import { createPoliceReadModel } from "./police-read-model-projection";
import { createPlayerAllianceLifecycleView } from "./alliance-lifecycle-projection";
import {
  normalizeStorageBalances,
  resolvePlayerStorageCapacitySummary
} from "../handlers/warehouseBuilding";
import { resolveAttackWeaponInventory } from "../rules";
import { createFactoryProductionBuildingView } from "./factory-production-projection";
import { isFactoryOwnedBy } from "../handlers/factoryProductionShared";
import { createPlayerBoostView } from "./player-boost-projection";
import { createPlayerCityEventsView } from "./city-event-projection";
import { resolvePlayerOperationalLiveness } from "../rules/liveness/playerOperationalLiveness";

/**
 * Responsibility: Builds a minimal player-facing projection from authoritative core state.
 * Belongs here: read-only server-side shaping for UI-facing player views.
 * Does not belong here: client rendering logic or transport delivery.
 */
export const createPlayerView = (state: CoreGameState, playerId: string, context?: GameCoreContext): PlayerView => {
  const player = state.playersById[playerId];
  const notifications: Notification[] = state.root.notificationIds
    .map((notificationId) => state.notificationsById[notificationId])
    .filter((notification): notification is Notification => notification?.recipientId === playerId);

  const victoryState: VictoryState | null = state.victoryState;
  const resourceBalances = player
    ? normalizeStorageBalances(state.resourceStatesById[player.resourceStateId]?.balances ?? {})
    : {};
  const attackWeaponInventory = player
    ? resolveAttackWeaponInventory(resourceBalances, player.attackLoadout)
    : {};
  for (const weaponId of ATTACK_WEAPON_IDS) {
    if (!Object.prototype.hasOwnProperty.call(resourceBalances, weaponId)) {
      resourceBalances[weaponId] = Number(attackWeaponInventory[weaponId] || 0);
    }
  }
  if (player && Number.isFinite(Number(player.population))) {
    resourceBalances.population = Math.max(0, Number(player.population || 0));
  }
  const economy = createPlayerEconomyView(state, playerId, resourceBalances);
  const factoryBuilding = Object.values(state.buildingsById)
    .filter((building) => building.buildingTypeId === "factory"
      && isFactoryOwnedBy(state, building, playerId)
      && building.status === "active")
    .sort((left, right) => left.districtId.localeCompare(right.districtId) || left.id.localeCompare(right.id))[0] ?? null;

  return {
    playerId,
    instanceId: state.serverInstance.id,
    mode: state.serverInstance.mode,
    factionId: player?.factionId ?? "mafian",
    homeDistrictId: player?.homeDistrictId ?? null,
    color: player?.color ?? DEFAULT_PLAYER_COLOR,
    serverTime: context?.clock?.nowIso() ?? new Date().toISOString(),
    resourceBalances,
    storage: player && context?.config.balance.warehouse
      ? createPlayerStorageView(state, playerId, context)
      : null,
    attackWeapons: player && context?.config.balance.attackWeapons
      ? {
          availablePopulation: Math.max(0, Math.floor(Number(player.population ?? resourceBalances.population ?? 0))),
          weapons: ATTACK_WEAPON_IDS.map((weaponId) => {
            const weapon = context.config.balance.attackWeapons![weaponId];
            return {
              resourceKey: weaponId,
              label: weapon.label,
              description: weapon.description,
              baseAttackPower: weapon.baseAttackPower,
              populationRequired: weapon.populationRequired,
              availableAmount: Math.max(0, Number(attackWeaponInventory[weaponId] || 0))
            };
          })
        }
      : null,
    factoryProduction: factoryBuilding && context?.config.balance.factory
      ? createFactoryProductionBuildingView({
          state,
          building: factoryBuilding,
          playerId,
          config: context.config,
          tickRateMs: context.config.tickRateMs
        })
      : null,
    boosts: context ? createPlayerBoostView(state, playerId, context) : null,
    cityEvents: context ? createPlayerCityEventsView(state, playerId, context) : null,
    operationalLiveness: context ? resolvePlayerOperationalLiveness(state, playerId, context) : null,
    pendingEncirclementConfirmations: Object.values(state.encirclementConfirmationTokensById ?? {})
      .filter((token) => token.actorPlayerId === playerId && token.consumedAtTick === null && token.expiresAtTick > state.root.tick)
      .map((token) => ({
        token: token.id,
        targetDistrictId: token.targetDistrictId,
        sourceDistrictId: token.sourceDistrictId,
        affectedPlayerIds: token.affectedPlayerIds,
        expiresAtTick: token.expiresAtTick
      })),
    economy,
    faction: createFactionReadModel(state, playerId, context),
    dayNight: context ? createDayNightReadModel(state, context) : null,
    elimination: createEliminationReadModel(state, playerId, context),
    finalLockdown: createFinalLockdownReadModel(state, playerId, context),
    police: createPoliceReadModel(state, playerId, context),
    alliance: createPlayerAllianceLifecycleView(state, playerId, context),
    notifications,
    victoryState
  };
};

const createPlayerStorageView = (
  state: CoreGameState,
  playerId: string,
  context: GameCoreContext
): NonNullable<PlayerView["storage"]> => {
  const summary = resolvePlayerStorageCapacitySummary(state, playerId, context.config.balance.warehouse!);
  const cityEvents = createPlayerCityEventsView(state, playerId, context);
  const sourceRewards = state.playerCityEventStatesByPlayerId?.[playerId]?.pendingRewards ?? [];
  return {
    ...summary,
    pendingDeliveries: (cityEvents?.pendingRewards ?? []).map((reward) => {
      const source = sourceRewards.find((entry) => entry.pendingRewardId === reward.pendingRewardId);
      return {
        id: reward.pendingRewardId,
        source: "city-event" as const,
        resourceKey: reward.resourceKey,
        label: reward.resourceKey,
        amount: reward.amount,
        reason: reward.reason,
        storageAvailable: reward.canClaim,
        claimState: reward.canClaim ? "claimable" as const : "blocked" as const,
        createdAtTick: source?.createdAtTick ?? state.root.tick,
        expiresAtTick: null
      };
    })
  };
};

const MATERIAL_RESOURCE_IDS = [
  "chemicals",
  "biomass",
  "stim-pack",
  "metal-parts",
  "tech-core",
  "combat-module"
] as const;

const DRUG_RESOURCE_IDS = [
  "neon-dust",
  "pulse-shot",
  "velvet-smoke",
  "ghost-serum",
  "overdrive-x"
] as const;

const createPlayerEconomyView = (
  state: CoreGameState,
  playerId: string,
  resourceBalances: Record<string, number>
): PlayerEconomyView => {
  const player = state.playersById[playerId];
  const resources = sanitizeBalances(resourceBalances);
  const population = Math.max(0, Number(player?.population ?? resources.population ?? 0));
  const gangMembers = Math.max(0, Number(resources["gang-members"] ?? population));

  return {
    cleanCash: amountOf(resources, "cash"),
    dirtyCash: amountOf(resources, "dirty-cash"),
    influence: calculateOwnedDistrictInfluence(state, playerId),
    population,
    gangMembers,
    resources,
    materials: pickBalances(resources, MATERIAL_RESOURCE_IDS),
    drugs: pickBalances(resources, DRUG_RESOURCE_IDS),
    weapons: pickBalances(resources, [...ATTACK_WEAPON_IDS, ...DEFENSE_WEAPON_IDS])
  };
};

const sanitizeBalances = (balances: Record<string, number>): Record<string, number> =>
  Object.fromEntries(
    Object.entries(balances)
      .filter(([resourceId]) => resourceId.length > 0)
      .map(([resourceId, amount]) => [resourceId, Math.max(0, Number(amount || 0))])
      .filter(([, amount]) => Number.isFinite(amount))
  );

const amountOf = (balances: Record<string, number>, resourceId: string): number =>
  Math.max(0, Number(balances[resourceId] ?? 0));

const pickBalances = (
  balances: Record<string, number>,
  resourceIds: readonly string[]
): Record<string, number> =>
  Object.fromEntries(resourceIds.map((resourceId) => [resourceId, amountOf(balances, resourceId)]));

const calculateOwnedDistrictInfluence = (state: CoreGameState, playerId: string): number =>
  Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId)
    .reduce((total, district) => total + Math.max(0, Number(district.influence || 0)), 0);
