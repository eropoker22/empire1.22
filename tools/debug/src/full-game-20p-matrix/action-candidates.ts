import {
  getAttackWeaponInventory,
  hasEnoughResourcesForUpgrade,
  hasValidAttackAuthorization,
  resolveBuildingUpgradeCost,
  resolveDistrictRelation,
  validateOccupyEmptyDistrictAuthorization,
  type CoreGameState
} from "@empire/game-core";
import type { SeededRng } from "../free-br-simulation/seeded-rng";
import type { MutableSimulationClock } from "./mutable-clock";
import type { SimulationBot } from "./types";
import { appendEconomyCandidates } from "./action-economy-candidates";
import {
  attackWeapons,
  candidate,
  conflictPayload,
  firstRecipeId,
  pickOptional,
  requiredRuntime,
  weights,
  type Candidate
} from "./action-candidate-utils";

export const createCandidates = (
  state: CoreGameState,
  config: ReturnType<typeof requiredRuntime>["config"],
  bot: SimulationBot,
  clock: MutableSimulationClock,
  rng: SeededRng
): Candidate[] => {
  const player = state.playersById[bot.playerId]!;
  const owned = Object.values(state.districtsById).filter((district) =>
    district.ownerPlayerId === bot.playerId && district.status !== "destroyed"
  );
  const sources = owned.filter((district) => district.adjacentDistrictIds.length > 0);
  const source = pickOptional(rng, sources.length ? sources : owned);
  if (!source) return [];
  const adjacent = source.adjacentDistrictIds
    .map((id) => state.districtsById[id])
    .filter(Boolean);
  const neutral = adjacent.filter((district) =>
    !district.ownerPlayerId
    && district.status !== "destroyed"
    && district.status !== "locked"
  );
  const enemy = adjacent.filter((district) =>
    district.ownerPlayerId
    && district.ownerPlayerId !== bot.playerId
    && district.status !== "destroyed"
    && resolveDistrictRelation(state, player, district) === "enemy"
  );
  const resource = state.resourceStatesById[player.resourceStateId];
  const buildings = owned.flatMap((district) =>
    district.buildingIds.map((id) => state.buildingsById[id]).filter(Boolean)
  ).filter((building) => building.status === "active");
  const weight = weights(bot.archetype);
  const candidates: Candidate[] = [];

  const spyTarget = pickOptional(rng, [...neutral, ...enemy]);
  if (spyTarget) candidates.push(candidate(
    "spy-district",
    { districtId: spyTarget.id, sourceDistrictId: source.id },
    weight.spy,
    { source: source.id, target: spyTarget.id, relation: resolveDistrictRelation(state, player, spyTarget) }
  ));
  const robberyTarget = pickOptional(rng, neutral.filter((district) => district.neutralLootPool));
  if (robberyTarget) candidates.push(candidate("rob-district", conflictPayload(source, robberyTarget, {
    targetDistrictId: robberyTarget.id,
    expectedLootPoolRevision: robberyTarget.neutralLootPool?.version
  }), weight.crime, {
    source: source.id,
    target: robberyTarget.id,
    lootPoolVersion: robberyTarget.neutralLootPool?.version ?? null
  }));
  const enemyTarget = pickOptional(rng, enemy);
  if (enemyTarget) {
    const style = rng.pick(["stealth", "balanced", "all_in"] as const);
    candidates.push(candidate("heist-district", conflictPayload(source, enemyTarget, {
      targetDistrictId: enemyTarget.id,
      sourceDistrictId: source.id,
      style,
      populationSent: style === "all_in" ? 25 : style === "balanced" ? 10 : 5
    }), weight.crime, { source: source.id, target: enemyTarget.id, style }));
  }
  const authorizedEnemyTarget = pickOptional(rng, enemy.filter((district) =>
    hasValidAttackAuthorization(state, bot.playerId, district.id)
  ));
  if (authorizedEnemyTarget) {
    candidates.push(candidate("attack-district", conflictPayload(source, authorizedEnemyTarget, {
      districtId: authorizedEnemyTarget.id,
      sourceDistrictId: source.id,
      weapons: attackWeapons(player.attackLoadout, getAttackWeaponInventory(state, player))
    }), weight.attack, {
      source: source.id,
      target: authorizedEnemyTarget.id,
      authorized: true
    }));
  }
  const occupyTarget = pickOptional(rng, neutral.filter((district) =>
    validateOccupyEmptyDistrictAuthorization(state, bot.playerId, district.id) === true
  ));
  if (occupyTarget) candidates.push(candidate("occupy-district", conflictPayload(source, occupyTarget, {
    districtId: occupyTarget.id,
    sourceDistrictId: source.id
  }), weight.expand, {
    source: source.id,
    target: occupyTarget.id,
    authorization: "current-intel"
  }));

  const upgradeable = buildings.filter((building) => {
    const upgrade = resolveBuildingUpgradeCost(building, { config, clock });
    return upgrade && resource && hasEnoughResourcesForUpgrade(resource, upgrade.costs);
  });
  const upgradeBuilding = pickOptional(rng, upgradeable);
  if (upgradeBuilding) {
    candidates.push(candidate("upgrade-building", {
      districtId: upgradeBuilding.districtId,
      buildingId: upgradeBuilding.id
    }, weight.economy, {
      buildingId: upgradeBuilding.id,
      currentLevel: upgradeBuilding.level,
      prerequisites: "canonical-upgrade-cost-satisfied"
    }));
  }

  const productionBuilding = pickOptional(rng, buildings.filter((building) =>
    firstRecipeId(config, building.buildingTypeId)
  ));
  if (productionBuilding) {
    const recipeId = firstRecipeId(config, productionBuilding.buildingTypeId)!;
    candidates.push(candidate("craft-item", {
      districtId: productionBuilding.districtId,
      buildingId: productionBuilding.id,
      recipeId,
      quantity: 1
    }, weight.production, {
      buildingId: productionBuilding.id,
      recipeId,
      buildingStatus: productionBuilding.status
    }));
  }
  const collectible = buildings.flatMap((building) => {
    const recipeId = firstRecipeId(config, building.buildingTypeId);
    if (!recipeId) return [];
    return [candidate("collect-production", {
      districtId: building.districtId,
      buildingId: building.id,
      resourceKey: recipeId
    }, weight.production * 2, {
      buildingId: building.id,
      recipeId,
      readiness: "must-pass-canonical-command-preview"
    })];
  });
  const collectCandidate = pickOptional(rng, collectible);
  if (collectCandidate) candidates.push(collectCandidate);

  const buildingActions = buildings.flatMap((building) =>
    Object.values(config.balance.buildingActions ?? {})
      .filter((action) => action.buildingType === building.buildingTypeId)
      .map((action) => candidate("run-building-action", {
        districtId: building.districtId,
        buildingId: building.id,
        actionId: action.actionId
      }, weight.economy, {
        buildingId: building.id,
        actionId: action.actionId,
        buildingStatus: building.status
      }))
  );
  const buildingAction = pickOptional(rng, buildingActions);
  if (buildingAction) candidates.push(buildingAction);

  const defense = rng.pick(["vest", "barricades", "cameras", "alarm", "defense-tower"] as const);
  if (Number(resource?.balances[defense] ?? 0) > 0) candidates.push(candidate("place-defense", {
    targetDistrictId: source.id,
    defenseItemId: defense,
    amount: 1,
    expectedTargetVersion: source.version
  }, weight.defense, {
    target: source.id,
    defense,
    inventory: Number(resource?.balances[defense] ?? 0)
  }));

  appendEconomyCandidates({
    state,
    config,
    bot,
    clock,
    rng,
    buildings,
    resource,
    candidates,
    weight
  });
  return candidates.filter((entry) => entry.weight > 0);
};
