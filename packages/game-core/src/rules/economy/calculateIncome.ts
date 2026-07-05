import type { CoreGameState } from "../../entities";
import type { BuildingActionEffectModifiers, FixedBuildingBalanceConfig } from "../../contracts";
import type { GameCoreContext } from "../../engine/context";
import {
  getFactionPassiveModifiers,
  resolveFactionIncomeMultiplier
} from "../factions/factionRules";
import { resolveFixedBuildingIncomeConfig } from "./fixedBuildingIncomeConfig";
import { resolveActiveAlliancePenaltyStatModifiers } from "../alliances/alliancePenaltyModifiers";

const HOUR_MS = 60 * 60 * 1000;

export interface ResolvedDistrictEffectModifiers {
  incomeMultiplier: number;
  cleanIncomeMultiplier: number;
  dirtyIncomeMultiplier: number;
  influenceMultiplier: number;
  heatMultiplier: number;
  influencePerDay: number;
  heatPerDay: number;
  attackMultiplier: number;
  defenseMultiplier: number;
}

export interface ActiveFixedBuildingConfig {
  building: CoreGameState["buildingsById"][string];
  config: FixedBuildingBalanceConfig;
}

/**
 * Responsibility: Calculates income from authoritative state and resolved config.
 * Belongs here: pure economy math and server-side derivations.
 * Does not belong here: persistence writes or client formatting.
 */
export const calculateIncome = (state: CoreGameState, context?: GameCoreContext): number =>
  Object.values(calculateIncomeByPlayerId(state, context)).reduce(
    (total, balances) =>
      total + Object.values(balances).reduce((playerTotal, amount) => playerTotal + amount, 0),
    0
  );

export const calculateIncomeByPlayerId = (
  state: CoreGameState,
  context?: GameCoreContext
): Record<string, Record<string, number>> => {
  const incomeByPlayerId: Record<string, Record<string, number>> = {};

  for (const district of Object.values(state.districtsById)) {
    const ownerPlayer = district.ownerPlayerId ? state.playersById[district.ownerPlayerId] : null;
    if (!district.ownerPlayerId || ownerPlayer?.status !== "active" || district.status === "destroyed") {
      continue;
    }

    for (const [resourceKey, rawAmount] of Object.entries(district.resourceModifiers)) {
      const factionMultiplier = context
        ? resolveFactionIncomeMultiplier(resourceKey, getFactionPassiveModifiers(state, district.ownerPlayerId, context))
        : 1;
      const penaltyMultiplier = context
        ? resolveActiveAlliancePenaltyStatModifiers(state, district.ownerPlayerId, nowIsoFromContext(context)).incomeMultiplier
        : 1;
      addIncome(incomeByPlayerId, district.ownerPlayerId, resourceKey, Number(rawAmount || 0) * factionMultiplier * penaltyMultiplier);
    }

    if (!context) {
      continue;
    }

    const fixedBuildingIncome = calculateFixedBuildingIncomeForDistrict(state, district, context);
    addIncome(incomeByPlayerId, district.ownerPlayerId, "cash", fixedBuildingIncome.cash);
    addIncome(incomeByPlayerId, district.ownerPlayerId, "dirty-cash", fixedBuildingIncome.dirtyCash);
  }

  return incomeByPlayerId;
};

export const getActiveFixedBuildingConfigsForDistrict = (
  state: CoreGameState,
  district: CoreGameState["districtsById"][string],
  context: GameCoreContext
): ActiveFixedBuildingConfig[] => {
  const fixedBuildings = context.config.balance.fixedBuildings;
  const ownerPlayer = district.ownerPlayerId ? state.playersById[district.ownerPlayerId] : null;
  if (!fixedBuildings || !district.ownerPlayerId || ownerPlayer?.status !== "active" || district.status === "destroyed") {
    return [];
  }

  return district.buildingIds.flatMap((buildingId) => {
    const building = state.buildingsById[buildingId];
    if (!building || building.status !== "active" || building.ownerPlayerId !== district.ownerPlayerId) {
      return [];
    }

    const config = fixedBuildings[building.buildingTypeId];
    return config ? [{ building, config }] : [];
  });
};

export const resolveActiveDistrictEffectModifiers = (
  state: CoreGameState,
  districtId: string
): ResolvedDistrictEffectModifiers => {
  const effectStates = Object.values(state.effectStatesById).filter(
    (effectState) => effectState.ownerType === "district" && effectState.ownerId === districtId
  );
  const resolved = createDefaultDistrictEffectModifiers();

  for (const effectState of effectStates) {
    for (const effect of effectState.effects) {
      if (effect.expiresAtTick !== null && effect.expiresAtTick <= state.root.tick) {
        continue;
      }

      const modifiers = extractEffectModifiers(effect.payload);
      multiplyModifier(resolved, "incomeMultiplier", modifiers.incomeMultiplier);
      multiplyModifier(resolved, "cleanIncomeMultiplier", modifiers.cleanIncomeMultiplier);
      multiplyModifier(resolved, "dirtyIncomeMultiplier", modifiers.dirtyIncomeMultiplier);
      multiplyModifier(resolved, "influenceMultiplier", modifiers.influenceMultiplier);
      multiplyModifier(resolved, "heatMultiplier", modifiers.heatMultiplier);
      multiplyModifier(resolved, "attackMultiplier", modifiers.attackMultiplier);
      multiplyModifier(resolved, "defenseMultiplier", modifiers.defenseMultiplier);
      addModifier(resolved, "influencePerDay", modifiers.influencePerDay);
      addModifier(resolved, "heatPerDay", modifiers.heatPerDay);
    }
  }

  return resolved;
};

export const createDefaultDistrictEffectModifiers = (): ResolvedDistrictEffectModifiers => ({
  incomeMultiplier: 1,
  cleanIncomeMultiplier: 1,
  dirtyIncomeMultiplier: 1,
  influenceMultiplier: 1,
  heatMultiplier: 1,
  influencePerDay: 0,
  heatPerDay: 0,
  attackMultiplier: 1,
  defenseMultiplier: 1
});

const calculateFixedBuildingIncomeForDistrict = (
  state: CoreGameState,
  district: CoreGameState["districtsById"][string],
  context: GameCoreContext
): { cash: number; dirtyCash: number } => {
  const activeBuildings = getActiveFixedBuildingConfigsForDistrict(state, district, context);
  if (activeBuildings.length === 0) {
    return { cash: 0, dirtyCash: 0 };
  }

  const ticksPerHour = HOUR_MS / Math.max(1, context.config.tickRateMs);
  const modifiers = resolveActiveDistrictEffectModifiers(state, district.id);
  const factionModifiers = getFactionPassiveModifiers(state, district.ownerPlayerId, context);
  const penaltyMultiplier = resolveActiveAlliancePenaltyStatModifiers(state, district.ownerPlayerId, nowIsoFromContext(context)).incomeMultiplier;
  const incomeMultiplier = Math.max(0, Number(context.config.balance.incomeMultiplier || 0)) * modifiers.incomeMultiplier * penaltyMultiplier;
  const cleanFactionMultiplier = resolveFactionIncomeMultiplier("cash", factionModifiers);
  const dirtyFactionMultiplier = resolveFactionIncomeMultiplier("dirty-cash", factionModifiers);

  return activeBuildings.reduce(
    (totals, { building, config }) => {
      const resolvedConfig = resolveFixedBuildingIncomeConfig({
        state,
        context,
        districtId: district.id,
        building,
        config
      });
      return {
        cash: totals.cash + resolvePerTick(resolvedConfig.cleanPerHour, ticksPerHour) * incomeMultiplier * modifiers.cleanIncomeMultiplier * cleanFactionMultiplier,
        dirtyCash: totals.dirtyCash + resolvePerTick(resolvedConfig.dirtyPerHour, ticksPerHour) * incomeMultiplier * modifiers.dirtyIncomeMultiplier * dirtyFactionMultiplier
      };
    },
    { cash: 0, dirtyCash: 0 }
  );
};

const addIncome = (
  incomeByPlayerId: Record<string, Record<string, number>>,
  playerId: string,
  resourceKey: string,
  rawAmount: unknown
): void => {
  const amount = Math.max(0, Number(rawAmount || 0));

  if (!resourceKey || amount <= 0 || !Number.isFinite(amount)) {
    return;
  }

  incomeByPlayerId[playerId] = {
    ...incomeByPlayerId[playerId],
    [resourceKey]: (incomeByPlayerId[playerId]?.[resourceKey] ?? 0) + amount
  };
};

const resolvePerTick = (perHour: number, ticksPerHour: number): number => {
  const amount = Number(perHour || 0);
  return Number.isFinite(amount) && ticksPerHour > 0 ? Math.max(0, amount) / ticksPerHour : 0;
};

const extractEffectModifiers = (payload: Record<string, unknown>): BuildingActionEffectModifiers => {
  const nested = isRecord(payload.effectModifiers) ? payload.effectModifiers : null;
  const source = nested ?? payload;

  return {
    incomeMultiplier: getNumericModifier(source, "incomeMultiplier"),
    cleanIncomeMultiplier: getNumericModifier(source, "cleanIncomeMultiplier"),
    dirtyIncomeMultiplier: getNumericModifier(source, "dirtyIncomeMultiplier"),
    influenceMultiplier: getNumericModifier(source, "influenceMultiplier"),
    heatMultiplier: getNumericModifier(source, "heatMultiplier"),
    influencePerDay: getNumericModifier(source, "influencePerDay"),
    heatPerDay: getNumericModifier(source, "heatPerDay"),
    attackMultiplier: getNumericModifier(source, "attackMultiplier"),
    defenseMultiplier: getNumericModifier(source, "defenseMultiplier")
  };
};

const getNumericModifier = (
  source: Record<string, unknown>,
  key: keyof BuildingActionEffectModifiers
): number | undefined => {
  const value = Number(source[key]);
  return Number.isFinite(value) ? value : undefined;
};

const multiplyModifier = (
  resolved: ResolvedDistrictEffectModifiers,
  key: keyof Pick<
    ResolvedDistrictEffectModifiers,
    | "incomeMultiplier"
    | "cleanIncomeMultiplier"
    | "dirtyIncomeMultiplier"
    | "influenceMultiplier"
    | "heatMultiplier"
    | "attackMultiplier"
    | "defenseMultiplier"
  >,
  value: number | undefined
): void => {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return;
  }

  resolved[key] *= value;
};

const addModifier = (
  resolved: ResolvedDistrictEffectModifiers,
  key: keyof Pick<ResolvedDistrictEffectModifiers, "influencePerDay" | "heatPerDay">,
  value: number | undefined
): void => {
  if (value === undefined || !Number.isFinite(value)) {
    return;
  }

  resolved[key] += value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const nowIsoFromContext = (context: GameCoreContext): string =>
  context.clock?.nowIso?.() ?? context.clock?.now?.().toISOString() ?? new Date().toISOString();
