import {
  PLAYER_BOOST_IDS,
  type ActivePlayerBoostState,
  type PlayerBoostEffectSnapshot,
  type PlayerBoostId,
  type PlayerBoostState
} from "@empire/shared-types";
import type { CoreGameState } from "../../entities";

const PRODUCTION_BUILDING_TYPES = new Set(["pharmacy", "drug_lab", "factory", "armory"]);

export const createEmptyPlayerBoostState = (): PlayerBoostState => ({
  version: 1,
  active: null,
  cooldownUntilTickByBoostId: {}
});

export const normalizePlayerBoostState = (value: unknown): PlayerBoostState => {
  const raw = isRecord(value) ? value : {};
  const active = normalizeActiveBoost(raw.active);
  const rawCooldowns = isRecord(raw.cooldownUntilTickByBoostId)
    ? raw.cooldownUntilTickByBoostId
    : {};
  const cooldownUntilTickByBoostId: PlayerBoostState["cooldownUntilTickByBoostId"] = {};
  for (const boostId of PLAYER_BOOST_IDS) {
    const deadline = Number(rawCooldowns[boostId]);
    if (Number.isFinite(deadline) && deadline > 0) {
      cooldownUntilTickByBoostId[boostId] = Math.floor(deadline);
    }
  }
  return {
    version: Math.max(1, Math.floor(Number(raw.version || 1))),
    active,
    cooldownUntilTickByBoostId
  };
};

export const getPlayerBoostState = (
  state: CoreGameState,
  playerId: string
): PlayerBoostState => normalizePlayerBoostState(state.playerBoostStatesByPlayerId?.[playerId]);

export const getActivePlayerBoost = (
  state: CoreGameState,
  playerId: string,
  tick = state.root.tick
): ActivePlayerBoostState | null => {
  const active = getPlayerBoostState(state, playerId).active;
  return active && active.expiresAtTick > tick ? active : null;
};

export const resolvePlayerSpyBoostEffects = (
  state: CoreGameState,
  playerId: string,
  tick = state.root.tick
): Required<Pick<PlayerBoostEffectSnapshot,
  "spyDurationMultiplier" | "criticalFailureChanceMultiplier" | "extraIntelBlocksOnSuccess">> & {
    boostId: PlayerBoostId | null;
  } => {
  const active = getActivePlayerBoost(state, playerId, tick);
  if (active?.boostId !== "ghost-network") {
    return {
      boostId: null,
      spyDurationMultiplier: 1,
      criticalFailureChanceMultiplier: 1,
      extraIntelBlocksOnSuccess: 0
    };
  }
  return {
    boostId: active.boostId,
    spyDurationMultiplier: positiveMultiplier(active.effectSnapshot.spyDurationMultiplier, 1),
    criticalFailureChanceMultiplier: positiveMultiplier(active.effectSnapshot.criticalFailureChanceMultiplier, 1),
    extraIntelBlocksOnSuccess: Math.max(0, Math.floor(Number(active.effectSnapshot.extraIntelBlocksOnSuccess || 0)))
  };
};

export const getPlayerProductionBoostMultiplier = (
  state: CoreGameState,
  playerId: string,
  tick = state.root.tick
): number => {
  const active = getActivePlayerBoost(state, playerId, tick);
  return active?.boostId === "industrial-overdrive"
    ? positiveMultiplier(active.effectSnapshot.productionSpeedMultiplier, 1)
    : 1;
};

export const getPlayerTacticalGridMultiplier = (
  state: CoreGameState,
  playerId: string | null | undefined,
  tick = state.root.tick
): number => {
  if (!playerId) return 1;
  const active = getActivePlayerBoost(state, playerId, tick);
  return active?.boostId === "tactical-grid" && active.status === "armed"
    ? positiveMultiplier(active.effectSnapshot.combatPowerMultiplier, 1)
    : 1;
};

export const rescalePlayerProductionAtBoostBoundary = (
  state: CoreGameState,
  playerId: string,
  boundaryTick: number,
  fromMultiplier: number,
  toMultiplier: number
): CoreGameState => {
  const safeFrom = positiveMultiplier(fromMultiplier, 1);
  const safeTo = positiveMultiplier(toMultiplier, 1);
  if (safeFrom === safeTo) return state;
  let buildingsById = state.buildingsById;
  let changed = false;

  for (const building of Object.values(state.buildingsById)) {
    if (!PRODUCTION_BUILDING_TYPES.has(building.buildingTypeId) || building.status !== "active") continue;
    const ownerPlayerId = building.ownerPlayerId === "player:neutral"
      ? state.districtsById[building.districtId]?.ownerPlayerId
      : building.ownerPlayerId;
    if (ownerPlayerId !== playerId || !building.productionLines) continue;
    let productionLines = building.productionLines;
    let buildingChanged = false;
    for (const [recipeId, line] of Object.entries(building.productionLines)) {
      if (line.activeCompletesAtTick === null || line.activeCompletesAtTick <= boundaryTick) continue;
      const remainingTicks = line.activeCompletesAtTick - boundaryTick;
      const nextRemainingTicks = Math.max(1, Math.ceil(remainingTicks * safeFrom / safeTo));
      if (nextRemainingTicks === remainingTicks) continue;
      productionLines = {
        ...productionLines,
        [recipeId]: {
          ...line,
          activeCompletesAtTick: boundaryTick + nextRemainingTicks,
          version: line.version + 1
        }
      };
      buildingChanged = true;
    }
    if (buildingChanged) {
      buildingsById = {
        ...buildingsById,
        [building.id]: {
          ...building,
          productionLines,
          version: building.version + 1
        }
      };
      changed = true;
    }
  }

  return changed ? { ...state, buildingsById } : state;
};

const normalizeActiveBoost = (value: unknown): ActivePlayerBoostState | null => {
  if (!isRecord(value) || !PLAYER_BOOST_IDS.includes(value.boostId as PlayerBoostId)) return null;
  const activatedAtTick = Math.floor(Number(value.activatedAtTick));
  const expiresAtTick = Math.floor(Number(value.expiresAtTick));
  if (!Number.isFinite(activatedAtTick) || !Number.isFinite(expiresAtTick) || expiresAtTick <= activatedAtTick) return null;
  return {
    boostId: value.boostId as PlayerBoostId,
    activatedAtTick,
    expiresAtTick,
    status: value.status === "armed" ? "armed" : "timed",
    effectSnapshot: normalizeEffectSnapshot(value.effectSnapshot)
  };
};

const normalizeEffectSnapshot = (value: unknown): PlayerBoostEffectSnapshot => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, raw]) => Number.isFinite(Number(raw)))
      .map(([key, raw]) => [key, Number(raw)])
  ) as PlayerBoostEffectSnapshot;
};

const positiveMultiplier = (value: unknown, fallback: number): number => {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
