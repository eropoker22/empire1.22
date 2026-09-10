import type {
  FactionDefinition,
  FactionPassiveModifiers,
  PlayerFactionId
} from "@empire/shared-types";
import { PLAYER_FACTION_IDS } from "@empire/shared-types";
import type { GameModeConfig } from "../../contracts";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";

const DEFAULT_FACTION_ID: PlayerFactionId = "mafian";
const ILLEGAL_PRODUCTION_BUILDINGS = new Set(["drug_lab", "smuggling_tunnel", "street_dealers"]);
const TECH_RESOURCE_KEYS = new Set(["tech-core", "data", "intel"]);
const LEGACY_FACTION_ALIASES: Partial<Record<string, PlayerFactionId>> = {
  mafia: "mafian",
  cartel: "kartel",
  cult: "kult",
  secret: "tajna-organizace",
  hackers: "hackeri",
  bikers: "motorkarsky-gang",
  military: "soukroma-armada",
  corporation: "korporace"
};

export const normalizeFactionId = (
  factionId: unknown,
  config?: GameModeConfig
): PlayerFactionId => {
  const raw = String(factionId || "").trim().toLowerCase();
  const normalized = LEGACY_FACTION_ALIASES[raw] ?? raw;
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

export const resolveFactionPassiveModifiersFromDefinitions = (
  factions: Partial<Record<PlayerFactionId, FactionDefinition>> | null | undefined,
  factionId: unknown
): FactionPassiveModifiers => {
  if (!factions) return {};
  return factions[normalizeFactionId(factionId)]?.passiveModifiers ?? {};
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

export const applyFactionTrapDetectionChance = (
  chance: number,
  modifiers: FactionPassiveModifiers
): number => applyFactionChanceBonus(chance, modifiers.trapDetectionChanceBonus);

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
  const illegal = ILLEGAL_PRODUCTION_BUILDINGS.has(buildingTypeId.replace(/-/g, "_"))
    ? safeMultiplier(modifiers.illegalProductionMultiplier)
    : 1;
  const tech = TECH_RESOURCE_KEYS.has(resourceKey) ? safeMultiplier(modifiers.techProductionMultiplier) : 1;
  return base * illegal * tech;
};

export const applyFactionRumorTruthChancePct = (
  truthChancePct: number | undefined,
  modifiers: FactionPassiveModifiers
): number | undefined => {
  if (truthChancePct === undefined) return undefined;
  const base = Math.max(0, Number(truthChancePct) || 0);
  const modified = applyFactionMultiplier(base, modifiers.rumorTruthMultiplier);
  return Math.min(95, Math.max(0, modified));
};

export const isFactionIllegalActionBuilding = (buildingTypeId: string): boolean =>
  ILLEGAL_PRODUCTION_BUILDINGS.has(buildingTypeId.replace(/-/g, "_"));

export const applyFactionHeatGain = (
  heatGain: number,
  modifiers: FactionPassiveModifiers
): number => Math.max(0, applyFactionMultiplier(heatGain, modifiers.heatGainMultiplier));

export const applyFactionIllegalActionHeatGain = (
  heatGain: number,
  modifiers: FactionPassiveModifiers
): number => {
  const base = Math.max(0, Number(heatGain) || 0);
  const modified = Math.max(0, applyFactionMultiplier(applyFactionHeatGain(base, modifiers), modifiers.illegalActionHeatGainMultiplier));
  if (modified > base) return Math.ceil(modified);
  if (modified < base) return Math.floor(modified);
  return modified;
};

export const applyFactionAggressiveHeatGain = (
  heatGain: number,
  modifiers: FactionPassiveModifiers
): number => {
  const base = Math.max(0, Number(heatGain) || 0);
  const modified = Math.max(0, applyFactionMultiplier(applyFactionHeatGain(base, modifiers), modifiers.aggressiveActionHeatGainMultiplier));
  if (modified > base) return Math.ceil(modified);
  if (modified < base) return Math.floor(modified);
  return modified;
};

export const applyFactionInfluenceGain = (
  influenceChange: number,
  modifiers: FactionPassiveModifiers
): number =>
  influenceChange > 0
    ? applyFactionMultiplier(influenceChange, modifiers.influenceGainMultiplier)
    : influenceChange;

export type FactionCooldownAction = "attack" | "occupy" | "robbery";

export const resolveFactionCooldownMultiplier = (
  action: FactionCooldownAction,
  modifiers: FactionPassiveModifiers
): number => {
  const actionMultiplier = action === "attack"
    ? safeMultiplier(modifiers.attackCooldownMultiplier)
    : action === "occupy"
      ? safeMultiplier(modifiers.occupyCooldownMultiplier)
      : safeMultiplier(modifiers.robberyCooldownMultiplier);
  const legacyAttackDurationMultiplier = action === "attack"
    ? safeMultiplier(modifiers.attackDurationMultiplier)
    : 1;
  return actionMultiplier * legacyAttackDurationMultiplier;
};

export const applyFactionCooldownTicks = (
  ticks: number,
  action: FactionCooldownAction,
  modifiers: FactionPassiveModifiers
): number => Math.max(0, Math.ceil(Math.max(0, Number(ticks) || 0) * resolveFactionCooldownMultiplier(action, modifiers)));

export const applyFactionRobberyDirtyCashLoot = (
  dirtyCash: number,
  modifiers: FactionPassiveModifiers
): number => Math.max(0, Math.floor(applyFactionMultiplier(dirtyCash, modifiers.robberyDirtyCashLootMultiplier)));

export const applyFactionRobberyLoot = (
  loot: number,
  modifiers: FactionPassiveModifiers
): number => Math.max(0, Math.floor(applyFactionMultiplier(loot, modifiers.robberyLootMultiplier)));

export const applyFactionSmugglingIncome = (
  dirtyCash: number,
  modifiers: FactionPassiveModifiers
): number => Math.max(0, applyFactionMultiplier(dirtyCash, modifiers.smugglingIncomeMultiplier));

export const applyFactionEquipmentLosses = <TKey extends string>(
  losses: Partial<Record<TKey, number>>,
  modifiers: FactionPassiveModifiers
): Partial<Record<TKey, number>> => {
  const multiplier = safeMultiplier(modifiers.equipmentLossMultiplier);
  if (multiplier === 1) return losses;

  const nextLosses: Partial<Record<TKey, number>> = {};
  for (const [key, value] of Object.entries(losses) as Array<[TKey, number]>) {
    const reduced = Math.max(0, Math.floor(Math.max(0, Number(value) || 0) * multiplier));
    if (reduced > 0) {
      nextLosses[key] = reduced;
    }
  }
  return nextLosses;
};

export const resolveFactionDefenseSystemEffectivenessMultiplier = (
  modifiers: FactionPassiveModifiers
): number => safeMultiplier(modifiers.defenseSystemEffectivenessMultiplier);

export const resolveFactionCameraEffectivenessMultiplier = (
  modifiers: FactionPassiveModifiers
): number => resolveFactionDefenseSystemEffectivenessMultiplier(modifiers) * safeMultiplier(modifiers.cameraEffectivenessMultiplier);

export const resolveFactionAlarmEffectivenessMultiplier = (
  modifiers: FactionPassiveModifiers
): number => resolveFactionDefenseSystemEffectivenessMultiplier(modifiers) * safeMultiplier(modifiers.alarmEffectivenessMultiplier);

export const resolveFactionBaseDefensePowerMultiplier = (
  modifiers: FactionPassiveModifiers
): number => safeMultiplier(modifiers.baseDefensePowerMultiplier);

export const applyFactionDefenseSystemEffectiveness = (
  baseMultiplier: number,
  modifiers: FactionPassiveModifiers
): number => applyFactionMultiplier(baseMultiplier, modifiers.defenseSystemEffectivenessMultiplier);

export const applyFactionPopulationGeneration = (
  population: number,
  modifiers: FactionPassiveModifiers
): number => Math.max(0, applyFactionMultiplier(population, modifiers.populationGenerationMultiplier));

export const applyFactionStartingPackage = (
  state: CoreGameState,
  _playerId: string,
  _context: GameCoreContext
): CoreGameState => {
  return state;
};

const isFactionId = (value: string): value is PlayerFactionId =>
  PLAYER_FACTION_IDS.includes(value as PlayerFactionId);

const safeMultiplier = (value: number | undefined): number => {
  const multiplier = Number(value);
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
};
