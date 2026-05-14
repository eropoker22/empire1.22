import type { PoliceRaidPreviewConsequences, PoliceRaidSeverity } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { resolveCourthouseRaidMitigation } from "../../handlers/courthouseBuildingActions";
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
  const baseSeizedDirtyCash = applySeizureCap(Math.floor(dirtyCash * dirtyPct), remainingCap);
  const mitigation = resolveCourthouseRaidMitigation({
    state,
    playerId,
    config: context?.config.balance.courthouse
  });
  const consequenceMultiplier = 1 - mitigation.reductionPct / 100;
  const seizedDirtyCash = mitigateLoss(baseSeizedDirtyCash, consequenceMultiplier);
  remainingCap = reduceCap(remainingCap, baseSeizedDirtyCash);
  const protectedResources = new Set([...(config.protectedResources ?? []), "dirty-cash"]);
  const resourcePct = sanitizePercent(config.resourceSeizurePercentBySeverity[severity]);
  const baseSeizedResources: Record<string, number> = {};
  const seizedResources: Record<string, number> = {};

  for (const [resourceKey, value] of Object.entries(balances).sort(([left], [right]) => left.localeCompare(right))) {
    if (protectedResources.has(resourceKey)) continue;
    const baseSeized = applySeizureCap(Math.floor(sanitizeAmount(value) * resourcePct), remainingCap);
    if (baseSeized <= 0) continue;
    baseSeizedResources[resourceKey] = baseSeized;
    const seized = mitigateLoss(baseSeized, consequenceMultiplier);
    if (seized > 0) {
      seizedResources[resourceKey] = seized;
    }
    remainingCap = reduceCap(remainingCap, baseSeized);
  }

  const targetDistrict = targetDistrictId ? state.districtsById[targetDistrictId] ?? null : null;
  const lockdownTicks = Math.max(0, Math.floor(Number(config.lockdownTicksBySeverity[severity] || 0)));
  const disruptionTicks = Math.max(0, Math.floor(Number(config.buildingDisruptionTicksBySeverity[severity] || 0)));
  const mitigatedLockdownTicks = mitigateDurationTicks(lockdownTicks, consequenceMultiplier);
  const mitigatedDisruptionTicks = mitigateDurationTicks(disruptionTicks, consequenceMultiplier);
  const lockedDistrictId = targetDistrict && mitigatedLockdownTicks > 0 ? targetDistrict.id : null;
  const buildingDisruptionUntilTick = targetDistrict && mitigatedDisruptionTicks > 0 ? state.root.tick + mitigatedDisruptionTicks : null;
  const disruptedBuildingIds = targetDistrict && mitigatedDisruptionTicks > 0
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
    lockdownUntilTick: lockedDistrictId ? state.root.tick + mitigatedLockdownTicks : null,
    disruptedBuildingIds,
    buildingDisruptionUntilTick,
    heatReducedBy,
    courthouseMitigation: mitigation.reductionPct > 0
      ? {
          source: "courthouse",
          ownedCount: mitigation.ownedCount,
          reductionPct: mitigation.reductionPct,
          message: "Následky razie byly zmírněny díky Soudu.",
          originalConsequences: {
            seizedDirtyCash: baseSeizedDirtyCash,
            seizedResources: baseSeizedResources,
            lockdownTicks,
            buildingDisruptionTicks: disruptionTicks,
            heatReducedBy
          }
        }
      : null
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

const mitigateLoss = (amount: number, multiplier: number): number =>
  Math.max(0, Math.floor(amount * multiplier));

const mitigateDurationTicks = (ticks: number, multiplier: number): number => {
  if (ticks <= 0) return 0;
  return Math.max(1, Math.ceil(ticks * multiplier));
};
