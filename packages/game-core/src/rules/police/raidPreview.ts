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
  const baseSeizedDirtyCash = Math.max(0, Math.floor(dirtyCash * dirtyPct));
  const mitigation = resolveCourthouseRaidMitigation({
    state,
    playerId,
    config: context?.config.balance.courthouse
  });
  const consequenceMultiplier = 1 - mitigation.reductionPct / 100;
  const seizedDirtyCash = mitigateLoss(baseSeizedDirtyCash, consequenceMultiplier);
  const protectedResources = new Set([
    ...(config.protectedResources ?? []),
    "dirty-cash", "cash", "clean-cash", "cleanCash", "population", "gang-members"
  ]);
  let remainingResourceCap = resolveResourceSeizureCap(severity, config.maxSeizedPerRaid);
  const baseSeizedResources: Record<string, number> = {};
  const seizedResources: Record<string, number> = {};

  for (const [resourceKey, value] of Object.entries(balances).sort(([left], [right]) => left.localeCompare(right))) {
    if (protectedResources.has(resourceKey)) continue;
    const baseSeized = resolveCategoryAwareSeizure(resourceKey, value, severity, remainingResourceCap);
    if (baseSeized <= 0) continue;
    baseSeizedResources[resourceKey] = baseSeized;
    const seized = mitigateLoss(baseSeized, consequenceMultiplier);
    if (seized > 0) {
      seizedResources[resourceKey] = seized;
    }
    remainingResourceCap = reduceCap(remainingResourceCap, baseSeized);
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
    courtMitigationPct: mitigation.reductionPct,
    courtBuildingsOwned: mitigation.ownedCount,
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

const BULK_RESOURCES = new Set([
  "chemicals", "biomass", "metal-parts", "neon-dust", "baseball-bat", "barricades"
]);
const TACTICAL_RESOURCES = new Set([
  "stim-pack", "pulse-shot", "velvet-smoke", "tech-core", "pistol", "grenade", "vest", "cameras", "alarm"
]);
const STRATEGIC_RESOURCES = new Set([
  "combat-module", "ghost-serum", "overdrive-x", "smg", "bazooka", "defense-tower"
]);

const resolveResourceSeizureCap = (severity: PoliceRaidSeverity, configuredCap: unknown): number | null => {
  const categoryCap = severity === "high" ? 12 : severity === "extreme" ? 20 : 0;
  const explicitCap = sanitizeOptionalCap(configuredCap);
  return explicitCap === null ? categoryCap : Math.min(categoryCap, explicitCap);
};

const resolveCategoryAwareSeizure = (
  resourceKey: string,
  value: unknown,
  severity: PoliceRaidSeverity,
  remainingCap: number | null
): number => {
  const amount = sanitizeAmount(value);
  if (amount <= 0 || remainingCap === 0 || severity === "low" || severity === "medium") return 0;
  let seized = 0;
  if (BULK_RESOURCES.has(resourceKey)) {
    seized = Math.floor(amount * (severity === "high" ? 0.05 : 0.1));
  } else if (TACTICAL_RESOURCES.has(resourceKey)) {
    const maxPerResource = severity === "high" ? 1 : 2;
    seized = Math.min(maxPerResource, Math.floor(amount * (severity === "high" ? 0.05 : 0.1)));
  } else if (STRATEGIC_RESOURCES.has(resourceKey) && severity === "extreme" && amount >= 3) {
    seized = 1;
  }
  return applySeizureCap(seized, remainingCap);
};

const mitigateDurationTicks = (ticks: number, multiplier: number): number => {
  if (ticks <= 0) return 0;
  return Math.max(1, Math.ceil(ticks * multiplier));
};
