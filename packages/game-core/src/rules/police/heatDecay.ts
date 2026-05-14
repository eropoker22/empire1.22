import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { getActiveFixedBuildingConfigsForDistrict, resolveActiveDistrictEffectModifiers } from "../economy/calculateIncome";
import { resolveFixedBuildingIncomeConfig } from "../economy/fixedBuildingIncomeConfig";
import { resolvePoliceConfig } from "./policeConfig";
import { resolveWantedLevel } from "./wantedLevel";

export const applyPoliceHeatDecay = (
  state: CoreGameState,
  context?: GameCoreContext
): CoreGameState => {
  const config = resolvePoliceConfig(context).heatDecay;
  if (!config) return state;

  const playerResult = applyPlayerHeatDecay(state, config);
  const districtResult = applyDistrictHeatDecay(playerResult, context, config);
  return districtResult;
};

type HeatDecayConfig = NonNullable<ReturnType<typeof resolvePoliceConfig>["heatDecay"]>;

const applyPlayerHeatDecay = (
  state: CoreGameState,
  config: HeatDecayConfig
): CoreGameState => {
  const interval = sanitizeInterval(config.playerIntervalTicks);
  let changed = false;
  let policeStatesById = state.policeStatesById;

  for (const policeState of Object.values(state.policeStatesById)) {
    const elapsedTicks = state.root.tick - Math.max(0, Number(policeState.lastDecayTick ?? state.root.tick));
    const steps = Math.floor(elapsedTicks / interval);
    if (steps <= 0) continue;

    const hasPendingRaid = (policeState.pendingRaids ?? []).some((raid) =>
      raid.status === "pending" || raid.status === "acknowledged"
    );
    const nextLastDecayTick = Math.max(0, Number(policeState.lastDecayTick ?? state.root.tick)) + steps * interval;
    if (hasPendingRaid) {
      policeStatesById = {
        ...policeStatesById,
        [policeState.id]: {
          ...policeState,
          lastDecayTick: nextLastDecayTick,
          version: policeState.version + 1
        }
      };
      changed = true;
      continue;
    }

    const currentHeat = sanitizeHeat(policeState.heat);
    const decayPerStep = resolvePlayerDecayAmount(currentHeat, config);
    const nextHeat = Math.max(0, currentHeat - decayPerStep * steps);
    policeStatesById = {
      ...policeStatesById,
      [policeState.id]: {
        ...policeState,
        heat: nextHeat,
        wantedLevel: resolveWantedLevel(nextHeat),
        lastDecayTick: nextLastDecayTick,
        version: policeState.version + 1
      }
    };
    changed = true;
  }

  return changed ? { ...state, policeStatesById } : state;
};

const applyDistrictHeatDecay = (
  state: CoreGameState,
  context: GameCoreContext | undefined,
  config: HeatDecayConfig
): CoreGameState => {
  const interval = sanitizeInterval(config.districtIntervalTicks);
  let changed = false;
  let districtsById = state.districtsById;

  for (const district of Object.values(state.districtsById)) {
    if (district.status === "destroyed") continue;
    const initializedLastDecayTick = resolveInitializedDistrictDecayTick(district.lastHeatDecayTick);
    if (initializedLastDecayTick === null) {
      districtsById = {
        ...districtsById,
        [district.id]: {
          ...district,
          lastHeatDecayTick: state.root.tick,
          version: district.version + 1
        }
      };
      changed = true;
      continue;
    }

    const lastDecayTick = initializedLastDecayTick;
    const steps = Math.floor((state.root.tick - lastDecayTick) / interval);
    if (steps <= 0) continue;

    const decayPerStep = resolveDistrictDecayAmount(state, context, district, config);
    const nextHeat = Math.max(0, sanitizeHeat(district.heat) - decayPerStep * steps);
    districtsById = {
      ...districtsById,
      [district.id]: {
        ...district,
        heat: nextHeat,
        lastHeatDecayTick: lastDecayTick + steps * interval,
        version: district.version + 1
      }
    };
    changed = true;
  }

  return changed ? { ...state, districtsById } : state;
};

const resolvePlayerDecayAmount = (
  heat: number,
  config: HeatDecayConfig
): number => {
  const wantedLevel = resolveWantedLevel(heat) as 0 | 1 | 2 | 3 | 4 | 5;
  const explicit = config.playerDecayByWantedLevel[wantedLevel];
  const fallback = wantedLevel >= 3 ? config.playerDecayByWantedLevel[3] : config.playerDecayByWantedLevel[0];
  return Math.max(0, Math.floor(Number(explicit ?? fallback ?? 0)));
};

const resolveDistrictDecayAmount = (
  state: CoreGameState,
  context: GameCoreContext | undefined,
  district: CoreGameState["districtsById"][string],
  config: HeatDecayConfig
): number => {
  const baseDecay = Math.max(0, Number(config.districtBaseDecay || 0));
  if (baseDecay <= 0) return 0;

  const passiveHeatPerDay = context
    ? resolveDistrictPassiveHeatPerDay(state, context, district)
    : 0;
  const highPassiveThreshold = Math.max(0, Number(config.districtHighPassiveHeatPerDayThreshold || 0));
  const passiveMultiplier = highPassiveThreshold > 0 && passiveHeatPerDay >= highPassiveThreshold
    ? Math.max(0, Number(config.districtHighPassiveHeatMultiplier ?? 1))
    : 1;
  const lockdownMultiplier = district.status === "locked"
    ? Math.max(0, Number(config.districtLockdownDecayMultiplier ?? 1))
    : 1;
  const decay = baseDecay * passiveMultiplier * lockdownMultiplier;
  return decay > 0 ? Math.max(1, Math.floor(decay)) : 0;
};

const resolveDistrictPassiveHeatPerDay = (
  state: CoreGameState,
  context: GameCoreContext,
  district: CoreGameState["districtsById"][string]
): number => {
  const activeBuildings = getActiveFixedBuildingConfigsForDistrict(state, district, context);
  const modifiers = resolveActiveDistrictEffectModifiers(state, district.id);
  const baseHeatPerDay = activeBuildings.reduce((total, { building, config }) => {
    const resolvedConfig = resolveFixedBuildingIncomeConfig({
      state,
      context,
      districtId: district.id,
      building,
      config
    });
    return total + Number(resolvedConfig.heatPerDay || 0);
  }, 0);
  return Math.max(0, baseHeatPerDay * modifiers.heatMultiplier + modifiers.heatPerDay);
};

const resolveInitializedDistrictDecayTick = (value: unknown): number | null => {
  if (value === undefined || value === null) return null;
  const tick = Number(value);
  return Number.isFinite(tick) && tick >= 0 ? Math.floor(tick) : null;
};

const sanitizeInterval = (value: unknown): number => {
  const interval = Number(value || 0);
  return Number.isFinite(interval) && interval > 0 ? Math.floor(interval) : 1;
};

const sanitizeHeat = (value: unknown): number => {
  const heat = Number(value || 0);
  return Number.isFinite(heat) ? Math.max(0, Math.floor(heat)) : 0;
};
