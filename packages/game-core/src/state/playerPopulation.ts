import type { Player, ResourceState } from "@empire/shared-types";
import type { CoreGameState } from "../entities";

/**
 * Player.population is the only authoritative people/manpower value.
 * Resource-balance aliases are accepted only while hydrating historical state.
 */
export const LEGACY_POPULATION_RESOURCE_KEYS = [
  "population",
  "gang-members",
  "gangMembers",
  "gang_members"
] as const;

export const resolvePlayerPopulation = (
  state: CoreGameState,
  playerOrId: Player | string | null | undefined
): number => {
  const player = typeof playerOrId === "string"
    ? state.playersById[playerOrId]
    : playerOrId;
  if (!player) return 0;

  const explicitPopulation = finiteNonNegative(player.population);
  if (explicitPopulation !== null) return explicitPopulation;

  const balances = state.resourceStatesById[player.resourceStateId]?.balances ?? {};
  for (const resourceKey of LEGACY_POPULATION_RESOURCE_KEYS) {
    const legacyValue = finiteNonNegative(balances[resourceKey]);
    if (legacyValue !== null) return legacyValue;
  }
  return 0;
};

export const withPlayerPopulation = (
  state: CoreGameState,
  playerId: string,
  population: number
): CoreGameState => {
  const player = state.playersById[playerId];
  if (!player) return state;
  const canonicalPopulation = Math.max(0, finiteNumberOrZero(population));
  if (player.population === canonicalPopulation) return state;
  return {
    ...state,
    playersById: {
      ...state.playersById,
      [player.id]: {
        ...player,
        population: canonicalPopulation,
        version: player.version + 1
      }
    }
  };
};

export const changePlayerPopulation = (
  state: CoreGameState,
  playerId: string,
  delta: number
): CoreGameState => withPlayerPopulation(
  state,
  playerId,
  resolvePlayerPopulation(state, playerId) + finiteNumberOrZero(delta)
);

/**
 * Idempotent snapshot hydration migration.
 *
 * Precedence is deliberately player.population -> balances.population ->
 * legacy gang aliases. Values are never added together. All balance aliases
 * are removed so a newly persisted snapshot has one source of truth only.
 */
export const normalizePlayerPopulationState = (state: CoreGameState): CoreGameState => {
  let playersById = state.playersById;
  let resourceStatesById = state.resourceStatesById;
  let playersChanged = false;
  let resourcesChanged = false;

  for (const player of Object.values(state.playersById)) {
    const canonicalPopulation = resolvePlayerPopulation(state, player);
    if (finiteNonNegative(player.population) !== canonicalPopulation) {
      if (!playersChanged) playersById = { ...playersById };
      playersById[player.id] = {
        ...player,
        population: canonicalPopulation,
        version: player.version + 1
      };
      playersChanged = true;
    }

    const resourceState = state.resourceStatesById[player.resourceStateId];
    if (!resourceState || !hasPopulationAlias(resourceState)) continue;
    if (!resourcesChanged) resourceStatesById = { ...resourceStatesById };
    resourceStatesById[resourceState.id] = removePopulationAliases(resourceState);
    resourcesChanged = true;
  }

  return playersChanged || resourcesChanged
    ? { ...state, playersById, resourceStatesById }
    : state;
};

const hasPopulationAlias = (resourceState: ResourceState): boolean =>
  LEGACY_POPULATION_RESOURCE_KEYS.some((resourceKey) =>
    Object.prototype.hasOwnProperty.call(resourceState.balances, resourceKey)
  );

const removePopulationAliases = (resourceState: ResourceState): ResourceState => {
  const balances = { ...resourceState.balances };
  for (const resourceKey of LEGACY_POPULATION_RESOURCE_KEYS) delete balances[resourceKey];
  return {
    ...resourceState,
    balances,
    version: resourceState.version + 1
  };
};

const finiteNonNegative = (value: unknown): number | null => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : null;
};

const finiteNumberOrZero = (value: unknown): number => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};
