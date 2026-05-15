import type {
  AttackWeaponId,
  DefenseWeaponId,
  FactionDefinition,
  FactionPassiveModifiers,
  FactionStartingPackage,
  PlayerFactionId
} from "@empire/shared-types";
import { PLAYER_FACTION_IDS } from "@empire/shared-types";
import type { GameModeConfig } from "../../contracts";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { resolveWantedLevel } from "../police/wantedLevel";

const DEFAULT_FACTION_ID: PlayerFactionId = "mafian";
const ILLEGAL_PRODUCTION_BUILDINGS = new Set(["drug_lab", "smuggling_tunnel", "street_dealers"]);
const TECH_RESOURCE_KEYS = new Set(["tech-core", "data", "intel"]);

export const normalizeFactionId = (
  factionId: unknown,
  config?: GameModeConfig
): PlayerFactionId => {
  const normalized = String(factionId || "").trim().toLowerCase();
  const configured = config?.balance.factions;
  if (isFactionId(normalized) && (!configured || configured[normalized])) {
    return normalized;
  }
  if (!configured || configured[DEFAULT_FACTION_ID]) {
    return DEFAULT_FACTION_ID;
  }
  return Object.keys(configured)[0] as PlayerFactionId;
};

export const getFactionDefinition = (
  config: GameModeConfig,
  factionId: unknown
): FactionDefinition | null => {
  const factions = config.balance.factions;
  if (!factions) return null;
  return factions[normalizeFactionId(factionId, config)] ?? null;
};

export const resolvePlayerFaction = (
  state: CoreGameState,
  playerId: string,
  context: GameCoreContext
): FactionDefinition | null => getFactionDefinition(context.config, state.playersById[playerId]?.factionId);

export const getFactionPassiveModifiers = (
  state: CoreGameState,
  playerId: string | null | undefined,
  context: GameCoreContext
): FactionPassiveModifiers => {
  if (!playerId) return {};
  return resolvePlayerFaction(state, playerId, context)?.passiveModifiers ?? {};
};

export const applyFactionMultiplier = (value: number, modifier: number | undefined): number => {
  const multiplier = Number(modifier);
  return Number.isFinite(multiplier) && multiplier > 0 ? value * multiplier : value;
};

export const applyFactionChanceBonus = (chance: number, bonus: number | undefined): number => {
  const delta = Number(bonus);
  const nextChance = chance + (Number.isFinite(delta) ? delta : 0);
  return Math.max(0, Math.min(0.98, nextChance));
};

export const resolveFactionIncomeMultiplier = (
  resourceKey: string,
  modifiers: FactionPassiveModifiers
): number => {
  if (resourceKey === "cash") return safeMultiplier(modifiers.cleanIncomeMultiplier);
  if (resourceKey === "dirty-cash") return safeMultiplier(modifiers.dirtyIncomeMultiplier);
  return 1;
};

export const resolveFactionProductionMultiplier = (
  resourceKey: string,
  buildingTypeId: string,
  modifiers: FactionPassiveModifiers
): number => {
  const base = safeMultiplier(modifiers.productionMultiplier);
  const illegal = ILLEGAL_PRODUCTION_BUILDINGS.has(buildingTypeId)
    ? safeMultiplier(modifiers.illegalProductionMultiplier)
    : 1;
  const tech = TECH_RESOURCE_KEYS.has(resourceKey) ? safeMultiplier(modifiers.techProductionMultiplier) : 1;
  return base * illegal * tech;
};

export const applyFactionHeatGain = (
  heatGain: number,
  modifiers: FactionPassiveModifiers
): number => Math.max(0, applyFactionMultiplier(heatGain, modifiers.heatGainMultiplier));

export const applyFactionInfluenceGain = (
  influenceChange: number,
  modifiers: FactionPassiveModifiers
): number =>
  influenceChange > 0
    ? applyFactionMultiplier(influenceChange, modifiers.influenceGainMultiplier)
    : influenceChange;

export const applyFactionStartingPackage = (
  state: CoreGameState,
  playerId: string,
  context: GameCoreContext
): CoreGameState => {
  const player = state.playersById[playerId];
  const definition = player ? getFactionDefinition(context.config, player.factionId) : null;
  if (!player || !definition) return state;

  const pack = definition.startingPackage;
  return applyStartingPackageToState(state, playerId, pack);
};

const applyStartingPackageToState = (
  state: CoreGameState,
  playerId: string,
  pack: FactionStartingPackage
): CoreGameState => {
  const player = state.playersById[playerId];
  const resourceState = state.resourceStatesById[player.resourceStateId];
  const homeDistrict = player.homeDistrictId ? state.districtsById[player.homeDistrictId] : null;
  const policeState = state.policeStatesById[player.policeStateId];
  const resources = {
    ...(pack.cash ? { cash: pack.cash } : {}),
    ...(pack.dirtyCash ? { "dirty-cash": pack.dirtyCash } : {}),
    ...(pack.resources ?? {})
  };
  const nextResourceState = resourceState
    ? {
        ...resourceState,
        balances: addBalances(resourceState.balances, resources),
        version: resourceState.version + 1
      }
    : resourceState;
  const nextPlayer = {
    ...player,
    attackLoadout: addLoadout(player.attackLoadout, pack.attackLoadout),
    version: player.version + 1
  };
  const nextHomeDistrict = homeDistrict
    ? {
        ...homeDistrict,
        defenseLoadout: addLoadout(homeDistrict.defenseLoadout, pack.defenseLoadout),
        influence: Math.max(0, Number(homeDistrict.influence || 0) + Math.max(0, Number(pack.initialInfluence || 0))),
        version: homeDistrict.version + 1
      }
    : homeDistrict;
  const nextPoliceState = policeState && Number(pack.initialHeat || 0) > 0
    ? {
        ...policeState,
        heat: Math.max(0, Number(policeState.heat || 0) + Number(pack.initialHeat || 0)),
        wantedLevel: resolveWantedLevel(Math.max(0, Number(policeState.heat || 0) + Number(pack.initialHeat || 0))),
        version: policeState.version + 1
      }
    : policeState;

  return {
    ...state,
    playersById: { ...state.playersById, [player.id]: nextPlayer },
    resourceStatesById: nextResourceState
      ? { ...state.resourceStatesById, [nextResourceState.id]: nextResourceState }
      : state.resourceStatesById,
    districtsById: nextHomeDistrict
      ? { ...state.districtsById, [nextHomeDistrict.id]: nextHomeDistrict }
      : state.districtsById,
    policeStatesById: nextPoliceState
      ? { ...state.policeStatesById, [nextPoliceState.id]: nextPoliceState }
      : state.policeStatesById
  };
};

const isFactionId = (value: string): value is PlayerFactionId =>
  PLAYER_FACTION_IDS.includes(value as PlayerFactionId);

const safeMultiplier = (value: number | undefined): number => {
  const multiplier = Number(value);
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
};

const addBalances = (
  balances: Record<string, number>,
  delta: Record<string, number>
): Record<string, number> => {
  const next = { ...balances };
  for (const [resourceKey, amount] of Object.entries(delta)) {
    const safeAmount = Number(amount);
    if (resourceKey && Number.isFinite(safeAmount) && safeAmount > 0) {
      next[resourceKey] = Math.max(0, Number(next[resourceKey] || 0) + safeAmount);
    }
  }
  return next;
};

const addLoadout = <TWeaponId extends AttackWeaponId | DefenseWeaponId>(
  current: Partial<Record<TWeaponId, number>>,
  delta: Partial<Record<TWeaponId, number>> | undefined
): Partial<Record<TWeaponId, number>> => {
  const next = { ...current };
  for (const [weaponId, amount] of Object.entries(delta ?? {}) as [TWeaponId, number][]) {
    const safeAmount = Math.max(0, Math.floor(Number(amount || 0)));
    if (safeAmount > 0) next[weaponId] = Math.max(0, Math.floor(Number(next[weaponId] || 0))) + safeAmount;
  }
  return next;
};
