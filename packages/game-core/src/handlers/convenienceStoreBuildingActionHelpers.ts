import type { CoreGameState } from "../entities";

export const pickConvenienceStoreDistrictHint = (
  state: CoreGameState,
  seed: string
): string | null => {
  const districts = Object.values(state.districtsById).filter(
    (district) => district.status !== "destroyed"
  );
  return districts.length > 0
    ? districts[Math.floor(convenienceStoreDeterministicRollPct(`${seed}:district-index`) / 100 * districts.length)]?.name ?? null
    : null;
};

export const pickConvenienceStoreAreaHint = (
  state: CoreGameState,
  seed: string
): string | null => {
  const districts = Object.values(state.districtsById).filter(
    (district) => district.status !== "destroyed"
  );
  const district = districts.length > 0
    ? districts[Math.floor(convenienceStoreDeterministicRollPct(`${seed}:area-index`) / 100 * districts.length)]
    : null;
  return district?.zone ? `${district.zone} zóně` : null;
};

export const pickConvenienceStoreBuildingHint = (
  state: CoreGameState,
  seed: string
): string | null => {
  const buildings = Object.values(state.buildingsById).filter(
    (building) => building.status === "active"
  );
  return buildings.length > 0
    ? buildings[Math.floor(convenienceStoreDeterministicRollPct(`${seed}:building-index`) / 100 * buildings.length)]?.buildingTypeId ?? null
    : null;
};

export const formatConvenienceStoreReliability = (truthChancePct: number): string =>
  truthChancePct >= 60 ? "střední" : truthChancePct >= 50 ? "nízká až střední" : "nízká";

export const convenienceStoreMinutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.max(1, Math.ceil((Math.max(0, Number(minutes || 0)) * 60 * 1000) / Math.max(1, tickRateMs)));

export const convenienceStoreDeterministicRollPct = (seed: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 10000 / 100;
};

export const getOwnedActiveConvenienceSupportBuildingCount = (
  state: CoreGameState,
  playerId: string,
  buildingTypeId: string
): number => Object.values(state.buildingsById).filter((building) =>
  building.buildingTypeId === buildingTypeId
  && building.ownerPlayerId === playerId
  && building.status === "active"
).length;
