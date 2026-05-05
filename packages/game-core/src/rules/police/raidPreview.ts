import type { PoliceRaidPreviewConsequences, PoliceRaidSeverity } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { resolvePoliceConfig } from "./policeConfig";

export const createRaidPreviewConsequences = (
  state: CoreGameState,
  playerId: string,
  severity: PoliceRaidSeverity,
  targetDistrictId: string | null,
  context?: GameCoreContext
): PoliceRaidPreviewConsequences => {
  const config = resolvePoliceConfig(context);
  const player = state.playersById[playerId] ?? null;
  const resourceState = player ? state.resourceStatesById[player.resourceStateId] ?? null : null;
  const balances = resourceState?.balances ?? {};
  const dirtyCash = sanitizeAmount(balances["dirty-cash"]);
  const dirtyPct = sanitizePercent(config.dirtyCashSeizurePercentBySeverity[severity]);
  let remainingCap = sanitizeOptionalCap(config.maxSeizedPerRaid);
  const seizedDirtyCash = applySeizureCap(Math.floor(dirtyCash * dirtyPct), remainingCap);
  remainingCap = reduceCap(remainingCap, seizedDirtyCash);
  const protectedResources = new Set([...(config.protectedResources ?? []), "dirty-cash"]);
  const resourcePct = sanitizePercent(config.resourceSeizurePercentBySeverity[severity]);
  const seizedResources: Record<string, number> = {};

  for (const [resourceKey, value] of Object.entries(balances).sort(([left], [right]) => left.localeCompare(right))) {
    if (protectedResources.has(resourceKey)) continue;
    const seized = applySeizureCap(Math.floor(sanitizeAmount(value) * resourcePct), remainingCap);
    if (seized <= 0) continue;
    seizedResources[resourceKey] = seized;
    remainingCap = reduceCap(remainingCap, seized);
  }

  const targetDistrict = targetDistrictId ? state.districtsById[targetDistrictId] ?? null : null;
  const lockdownTicks = Math.max(0, Math.floor(Number(config.lockdownTicksBySeverity[severity] || 0)));
  const disruptionTicks = Math.max(0, Math.floor(Number(config.buildingDisruptionTicksBySeverity[severity] || 0)));
  const lockedDistrictId = targetDistrict && lockdownTicks > 0 ? targetDistrict.id : null;
  const buildingDisruptionUntilTick = targetDistrict && disruptionTicks > 0 ? state.root.tick + disruptionTicks : null;
  const disruptedBuildingIds = targetDistrict && disruptionTicks > 0
    ? targetDistrict.buildingIds.filter((buildingId) => {
        const building = state.buildingsById[buildingId];
        return building !== undefined && building.status !== "destroyed";
      })
    : [];
  const policeState = player?.policeStateId ? state.policeStatesById[player.policeStateId] ?? null : null;
  const heatReducedBy = Math.min(
    sanitizeAmount(policeState?.heat),
    Math.max(0, Math.floor(Number(config.heatReductionBySeverity[severity] || 0)))
  );

  return {
    seizedDirtyCash,
    seizedResources,
    lockedDistrictId,
    lockdownUntilTick: lockedDistrictId ? state.root.tick + lockdownTicks : null,
    disruptedBuildingIds,
    buildingDisruptionUntilTick,
    heatReducedBy
  };
};

export const sanitizeAmount = (value: unknown): number => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
};

const sanitizePercent = (value: unknown): number => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const sanitizeOptionalCap = (value: unknown): number | null => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.floor(amount) : null;
};

const applySeizureCap = (amount: number, cap: number | null): number =>
  Math.max(0, Math.min(Math.max(0, amount), cap ?? Number.POSITIVE_INFINITY));

const reduceCap = (cap: number | null, amount: number): number | null =>
  cap === null ? null : Math.max(0, cap - amount);
