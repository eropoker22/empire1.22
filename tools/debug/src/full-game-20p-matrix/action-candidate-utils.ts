import {
  applyCommand,
  resolveBuildingUpgradeCost,
  type CoreGameState
} from "@empire/game-core";
import type { GameCommand } from "@empire/shared-types";
import type { ServerApp } from "../../../../apps/server/src/app/server-app";
import type { SeededRng } from "../free-br-simulation/seeded-rng";
import type { MutableSimulationClock } from "./mutable-clock";
import type { SimulationBot } from "./types";

export type Candidate = {
  type: GameCommand["type"];
  payload: Record<string, unknown>;
  weight: number;
  decisionContext: Record<string, unknown>;
};

export const PLAYER_MARKET_SELLER_RESERVE = 16;
export const PLAYER_MARKET_BUYER_RESERVE = 12;

export const conflictPayload = (
  source: CoreGameState["districtsById"][string],
  target: CoreGameState["districtsById"][string],
  payload: Record<string, unknown>
) => ({
  ...payload,
  expectedConflictRevision: target.conflictRevision,
  expectedSourceVersion: source.version,
  expectedTargetVersion: target.version
});

export const candidate = (
  type: GameCommand["type"],
  payload: Record<string, unknown>,
  weight: number,
  decisionContext: Record<string, unknown>
): Candidate => ({ type, payload, weight, decisionContext });

const previewCommand = (
  bot: SimulationBot,
  type: GameCommand["type"],
  payload: Record<string, unknown>,
  issuedAt: string,
  serverInstanceId: string
): GameCommand => ({
  id: `full-game-preview:${bot.playerId}:${type}`,
  type,
  mode: "free",
  playerId: bot.playerId,
  serverInstanceId,
  issuedAt,
  clientRequestId: `full-game-preview:${bot.playerId}:${type}`,
  payload
} as GameCommand);

export const previewCandidate = (
  state: CoreGameState,
  config: ReturnType<typeof requiredRuntime>["config"],
  bot: SimulationBot,
  entry: Candidate,
  clock?: MutableSimulationClock
): { accepted: boolean; reasonCode: string } => {
  const command = previewCommand(
    bot,
    entry.type,
    entry.payload,
    clock?.nowIso() ?? new Date(0).toISOString(),
    state.serverInstance.id
  );
  const result = applyCommand(structuredClone(state), command, clock ? { config, clock } : { config });
  return {
    accepted: result.errors.length === 0,
    reasonCode: result.errors[0]?.code ?? "PREVIEW_ACCEPTED"
  };
};

export const findReachableBountyTargets = (
  state: CoreGameState,
  creatorPlayerId: string
): CoreGameState["playersById"][string][] => Object.values(state.playersById).filter((target) => {
  if (target.id === creatorPlayerId || target.status !== "active") return false;
  const targetDistrictIds = Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === target.id && district.status !== "destroyed")
    .map((district) => district.id);
  return Object.values(state.playersById).some((hunter) => {
    if (hunter.id === creatorPlayerId || hunter.id === target.id || hunter.status !== "active") return false;
    return Object.values(state.districtsById).some((source) =>
      source.ownerPlayerId === hunter.id
      && source.status !== "destroyed"
      && source.adjacentDistrictIds.some((targetDistrictId) => targetDistrictIds.includes(targetDistrictId))
    );
  });
});

export const resolveResourceNeed = (
  state: CoreGameState,
  config: ReturnType<typeof requiredRuntime>["config"],
  playerId: string,
  buildings: CoreGameState["buildingsById"][string][]
): Map<string, number> => {
  const player = state.playersById[playerId];
  const balances = player ? state.resourceStatesById[player.resourceStateId]?.balances ?? {} : {};
  const needs = new Map<string, number>();
  const addCosts = (costs: Record<string, number> | undefined): void => {
    for (const [resourceId, amount] of Object.entries(costs ?? {})) {
      const missing = Math.max(0, Math.ceil(Number(amount) - Number(balances[resourceId] ?? 0)));
      if (missing > 0) needs.set(resourceId, Math.max(needs.get(resourceId) ?? 0, missing));
    }
  };
  for (const building of buildings) addCosts(resolveBuildingUpgradeCost(building, { config })?.costs);
  for (const action of Object.values(config.balance.buildingActions ?? {})) {
    if (buildings.some((building) => building.buildingTypeId === action.buildingType)) {
      addCosts(action.inputCost);
    }
  }
  return needs;
};

export const resolveAggregateMarketDemand = (
  state: CoreGameState,
  config: ReturnType<typeof requiredRuntime>["config"],
  sellerPlayerId: string
): Map<string, number> => {
  const demand = new Map<string, number>();
  for (const player of Object.values(state.playersById)) {
    if (player.id === sellerPlayerId || player.status !== "active") continue;
    const buildings = Object.values(state.buildingsById).filter((building) =>
      building.ownerPlayerId === player.id && building.status === "active"
    );
    for (const [resourceId, amount] of resolveResourceNeed(state, config, player.id, buildings)) {
      demand.set(resourceId, (demand.get(resourceId) ?? 0) + amount);
    }
    const balances = state.resourceStatesById[player.resourceStateId]?.balances ?? {};
    for (const resourceId of ["chemicals", "biomass", "metal-parts", "stim-pack"]) {
      const reserveNeed = Math.max(0, PLAYER_MARKET_BUYER_RESERVE - Math.floor(Number(balances[resourceId] ?? 0)));
      if (reserveNeed > 0) demand.set(resourceId, (demand.get(resourceId) ?? 0) + reserveNeed);
    }
  }
  return demand;
};

export const advanceOneTick = (
  server: ServerApp,
  clock: MutableSimulationClock,
  instanceId: string
): void => {
  const runtime = requiredRuntime(server, instanceId);
  clock.advance(runtime.config.tickRateMs);
  server.instanceManager.tickInstance(instanceId);
};

export const pickOptional = <T>(rng: SeededRng, values: readonly T[]): T | null =>
  values.length > 0 ? rng.pick(values) : null;

export const attackWeapons = (
  loadout: Record<string, number> | undefined,
  inventory: Record<string, number> = {}
): Record<string, number> => {
  const available = Object.keys(inventory).length > 0 ? inventory : loadout ?? {};
  const selected = Object.fromEntries(Object.entries(available)
    .filter(([, amount]) => Number(amount) > 0)
    .slice(0, 3)
    .map(([weaponId, amount]) => [weaponId, Math.min(5, Math.floor(Number(amount)))]));
  return Object.keys(selected).length ? selected : { pistol: 1 };
};

export const firstRecipeId = (
  config: ReturnType<typeof requiredRuntime>["config"],
  buildingType: string
): string | null => {
  const key = buildingType === "drug_lab" ? "drugLab" : buildingType;
  const recipes = (config.balance as unknown as Record<string, { recipes?: Record<string, unknown> }>)[key]?.recipes;
  return recipes ? Object.keys(recipes)[0] ?? null : null;
};

export const weights = (archetype: SimulationBot["archetype"]) => {
  const base = { attack: 1, defense: 1, economy: 1, production: 1, market: 1, spy: 1, crime: 1, expand: 1, bounty: 0.5 };
  const boosts: Record<SimulationBot["archetype"], Partial<typeof base>> = {
    aggressor: { attack: 5, expand: 3, bounty: 2 }, turtle: { defense: 6, economy: 2 }, economist: { economy: 5, production: 5, market: 3 },
    expander: { expand: 6, spy: 2, attack: 2 }, spymaster: { spy: 7, attack: 2 }, "high-heat-criminal": { crime: 7, attack: 3 },
    stealth: { spy: 4, crime: 1, attack: 0.5 }, "market-trader": { market: 8, economy: 3 }, "bounty-hunter": { bounty: 7, attack: 4 },
    "alliance-diplomat": { economy: 2, defense: 2 }, opportunist: { attack: 3, expand: 4, market: 2 }, balanced: {}
  };
  return { ...base, ...boosts[archetype] };
};

export const requiredRuntime = (server: ServerApp, instanceId: string) => {
  const runtime = server.instanceManager.getInstanceById(instanceId);
  if (!runtime) throw new Error(`Runtime ${instanceId} is missing.`);
  return runtime;
};
