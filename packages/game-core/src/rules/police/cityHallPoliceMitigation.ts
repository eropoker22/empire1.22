import type { PoliceSystemBalanceConfig } from "../../contracts";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { getCityHallMetadata, getOwnedCityHall } from "../../handlers/cityHallMetadata";

export interface CityHallNetworkCover {
  active: boolean;
  source: "city_hall_official_cover";
  label: string;
  coveredDistrictIds: string[];
  expiresAtTick: number;
  rawReductionPct: number;
}

export interface CityHallPoliceMitigation {
  active: boolean;
  source: "city_hall_official_cover";
  label: string;
  districtId: string | null;
  coveredDistrictIds: string[];
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
  if (!input.targetDistrictId) return null;
  const targetDistrict = input.state.districtsById[input.targetDistrictId] ?? null;
  if (!targetDistrict || targetDistrict.ownerPlayerId !== input.playerId || targetDistrict.status === "destroyed") return null;

  const networkCover = resolveCityHallNetworkCover(input);
  if (!networkCover || !networkCover.coveredDistrictIds.includes(input.targetDistrictId)) return null;

  const policeConfig = input.context?.config.balance.police as PoliceSystemBalanceConfig | undefined;
  const capPct = clampPct(policeConfig?.maxPoliticalRaidTriggerReductionPct ?? 45);
  const extremeMultiplier = Math.max(0, Math.min(1, Number(policeConfig?.extremePoliticalRaidReductionMultiplier ?? 0.5)));
  const rawReductionPct = clampPct(networkCover.rawReductionPct);
  const severityMultiplier = input.severity === "extreme" ? extremeMultiplier : 1;
  const effectiveReductionPct = Math.min(capPct, Math.floor(rawReductionPct * severityMultiplier));
  if (effectiveReductionPct <= 0) return null;

  return {
    active: true,
    source: "city_hall_official_cover",
    label: networkCover.label,
    districtId: input.targetDistrictId,
    coveredDistrictIds: networkCover.coveredDistrictIds,
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

export const resolveCityHallNetworkCover = (input: {
  state: CoreGameState;
  context?: GameCoreContext;
  playerId: string;
}): CityHallNetworkCover | null => {
  const cityHallConfig = input.context?.config.balance.cityHall;
  if (!cityHallConfig) return null;

  const cityHall = getOwnedCityHall(input.state, input.playerId, cityHallConfig);
  if (!cityHall) return null;

  const metadata = getCityHallMetadata(cityHall, input.state.root.tick);
  const activeCovers = Object.values(metadata.officialCoverByDistrictId)
    .filter((cover) => {
      const district = input.state.districtsById[cover.districtId] ?? null;
      return cover.expiresAtTick > input.state.root.tick
        && district?.ownerPlayerId === input.playerId
        && district.status !== "destroyed";
    });
  if (!activeCovers.length) return null;

  const strongestCover = activeCovers.reduce((strongest, cover) =>
    clampPct(cover.policeControlChanceReductionPct) > clampPct(strongest.policeControlChanceReductionPct)
      ? cover
      : strongest
  );
  return {
    active: true,
    source: "city_hall_official_cover",
    label: "Politické krytí aktivní: snižuje šanci zásahu na tvé obsazené districty. Nečistí heat a nezastaví extrémní zásah.",
    coveredDistrictIds: activeCovers.map((cover) => cover.districtId),
    expiresAtTick: Math.max(...activeCovers.map((cover) => cover.expiresAtTick)),
    rawReductionPct: strongestCover.policeControlChanceReductionPct
  };
};

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
