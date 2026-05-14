import type { PoliceSystemBalanceConfig } from "../../contracts";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { getCityHallMetadata, getOwnedCityHall } from "../../handlers/cityHallMetadata";

export interface CityHallPoliceMitigation {
  active: boolean;
  source: "city_hall_official_cover";
  label: string;
  districtId: string | null;
  rawReductionPct: number;
  effectiveReductionPct: number;
  triggerChancePct: number;
  rollPct: number | null;
  extremePressureMultiplier: number;
}

export const resolveCityHallPoliceMitigation = (input: {
  state: CoreGameState;
  context?: GameCoreContext;
  playerId: string;
  targetDistrictId?: string | null;
  severity?: "high" | "extreme" | string;
  rollSeed?: string;
}): CityHallPoliceMitigation | null => {
  const cityHallConfig = input.context?.config.balance.cityHall;
  if (!cityHallConfig || !input.targetDistrictId) return null;

  const cityHall = getOwnedCityHall(input.state, input.playerId, cityHallConfig);
  if (!cityHall) return null;

  const metadata = getCityHallMetadata(cityHall, input.state.root.tick);
  const cover = metadata.officialCoverByDistrictId[input.targetDistrictId];
  if (!cover || cover.expiresAtTick <= input.state.root.tick) return null;

  const policeConfig = input.context?.config.balance.police as PoliceSystemBalanceConfig | undefined;
  const capPct = clampPct(policeConfig?.maxPoliticalRaidTriggerReductionPct ?? 45);
  const extremeMultiplier = Math.max(0, Math.min(1, Number(policeConfig?.extremePoliticalRaidReductionMultiplier ?? 0.5)));
  const rawReductionPct = clampPct(cover.policeControlChanceReductionPct);
  const severityMultiplier = input.severity === "extreme" ? extremeMultiplier : 1;
  const effectiveReductionPct = Math.min(capPct, Math.floor(rawReductionPct * severityMultiplier));
  if (effectiveReductionPct <= 0) return null;

  return {
    active: true,
    source: "city_hall_official_cover",
    label: "Political cover active",
    districtId: input.targetDistrictId,
    rawReductionPct,
    effectiveReductionPct,
    triggerChancePct: Math.max(0, 100 - effectiveReductionPct),
    rollPct: input.rollSeed ? deterministicRollPct(input.rollSeed) : null,
    extremePressureMultiplier: extremeMultiplier
  };
};

export const shouldCreateRaidAfterCityHallMitigation = (
  mitigation: CityHallPoliceMitigation | null
): boolean =>
  !mitigation || mitigation.rollPct === null || mitigation.rollPct < mitigation.triggerChancePct;

const clampPct = (value: unknown): number => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, Math.min(100, Math.floor(amount))) : 0;
};

const deterministicRollPct = (seed: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 10000 / 100;
};
