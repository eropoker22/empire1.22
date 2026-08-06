import type { GameplayPassivePopulationSourceView } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import {
  getApartmentBlockMetadata
} from "../handlers/apartmentBlockBuildingActions";
import {
  getConvenienceStoreMetadata
} from "../handlers/convenienceStoreBuildingActions";
import { getSchoolMetadata } from "../handlers/schoolBuildingActions";
import { finiteNumber } from "./gameplay-economy-rate-state";

export const createPassivePopulationSources = (
  rateState: CoreGameState,
  nextTickState: CoreGameState,
  district: CoreGameState["districtsById"][string],
  playerId: string,
  context: GameCoreContext,
  ticksPerHour: number
): GameplayPassivePopulationSourceView[] => {
  if (
    district.ownerPlayerId !== playerId
    || rateState.playersById[playerId]?.status !== "active"
    || district.status === "destroyed"
  ) {
    return [];
  }

  const sources: GameplayPassivePopulationSourceView[] = [];
  const buildingTypeIds = new Set(
    [
      context.config.balance.apartmentBlock,
      context.config.balance.convenienceStore,
      context.config.balance.school
    ]
      .filter((config) => finiteNumber(config?.populationPerMinute) > 0)
      .map((config) => config?.buildingTypeId)
      .filter((buildingTypeId): buildingTypeId is string => Boolean(buildingTypeId))
  );

  for (const buildingId of district.buildingIds) {
    const building = rateState.buildingsById[buildingId];
    if (
      !building
      || building.status !== "active"
      || building.ownerPlayerId !== playerId
      || !buildingTypeIds.has(building.buildingTypeId)
    ) {
      continue;
    }
    const storage = resolvePopulationStorageEvidence(
      building,
      nextTickState.buildingsById[building.id],
      context
    );
    sources.push({
      sourceId: `${building.id}:stored-population`,
      sourceKind: "building-storage",
      districtId: district.id,
      buildingId: building.id,
      buildingTypeId: building.buildingTypeId,
      target: "building-storage",
      amountPerTick: storage.amountPerTick,
      amountPerHour: storage.amountPerTick * ticksPerHour,
      playerBalanceAmountPerTick: 0,
      storedAmount: storage.storedAmount,
      capacity: storage.capacity,
      isFull: storage.isFull,
      status: storage.status
    });
  }

  return sources;
};

export const createPassivePopulationSourceSummary = (
  sources: GameplayPassivePopulationSourceView[]
): string => {
  if (sources.length === 0) {
    return "Pasivní populace: 0 / h · žádný zdroj v districtu";
  }
  const sourceLabels = sources.map((source) => (
    source.target === "player-balance"
      ? `${source.buildingTypeId ?? "district modifier"}: +${formatRate(source.amountPerHour)} / h do hráčova zůstatku`
      : `${source.buildingTypeId}: +${formatRate(source.amountPerHour)} / h do zásoby (${formatRate(source.storedAmount)}/${formatRate(source.capacity)}; topbar +0; ${formatPopulationSourceStatus(source.status)})`
  ));
  return `Pasivní zdroje populace: ${sourceLabels.join(", ")}`;
};

interface PopulationStorageEvidence {
  amountPerTick: number;
  storedAmount: number;
  capacity: number;
  isFull: boolean;
  status: GameplayPassivePopulationSourceView["status"];
}

const resolvePopulationStorageEvidence = (
  building: CoreGameState["buildingsById"][string],
  nextBuilding: CoreGameState["buildingsById"][string] | undefined,
  context: GameCoreContext
): PopulationStorageEvidence => {
  const apartmentConfig = context.config.balance.apartmentBlock;
  if (building.buildingTypeId === apartmentConfig?.buildingTypeId) {
    const current = getApartmentBlockMetadata(building);
    const next = getApartmentBlockMetadata(nextBuilding ?? building);
    return createPopulationStorageEvidence(
      current.storedPopulation,
      next.storedPopulation,
      next.lastCapacity ?? current.lastCapacity ?? apartmentConfig.baseCapacity,
      current.lastUpdatedTick
    );
  }

  const convenienceConfig = context.config.balance.convenienceStore;
  if (building.buildingTypeId === convenienceConfig?.buildingTypeId) {
    const current = getConvenienceStoreMetadata(building);
    const next = getConvenienceStoreMetadata(nextBuilding ?? building);
    return createPopulationStorageEvidence(
      current.storedPopulation,
      next.storedPopulation,
      next.populationCapacity
        ?? current.populationCapacity
        ?? convenienceConfig.basePopulationCapacity,
      current.populationLastUpdatedTick
    );
  }

  const current = getSchoolMetadata(building);
  const next = getSchoolMetadata(nextBuilding ?? building);
  return createPopulationStorageEvidence(
    current.storedStudents,
    next.storedStudents,
    next.lastCapacity
      ?? current.lastCapacity
      ?? context.config.balance.school?.baseStudentCapacity
      ?? 1,
    current.lastUpdatedTick
  );
};

const createPopulationStorageEvidence = (
  currentAmount: number,
  nextAmount: number,
  rawCapacity: number,
  lastUpdatedTick: number | undefined
): PopulationStorageEvidence => {
  const storedAmount = Math.max(0, finiteNumber(currentAmount));
  const capacity = Math.max(1, finiteNumber(rawCapacity));
  const currentStoredAmount = Math.min(capacity, storedAmount);
  const amountPerTick = Math.max(
    0,
    finiteNumber(nextAmount) - currentStoredAmount
  );
  const isFull = currentStoredAmount >= capacity;
  return {
    amountPerTick,
    storedAmount,
    capacity,
    isFull,
    status: isFull
      ? "capacity-full"
      : lastUpdatedTick === undefined
        ? "initializing"
        : amountPerTick > 0
          ? "producing"
          : "paused"
  };
};

const formatRate = (value: number | null): string => {
  const normalized = finiteNumber(value);
  return Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toFixed(4).replace(/0+$/u, "").replace(/\.$/u, "");
};

const formatPopulationSourceStatus = (
  status: GameplayPassivePopulationSourceView["status"]
): string => {
  switch (status) {
    case "capacity-full":
      return "kapacita plná";
    case "initializing":
      return "inicializace";
    case "paused":
      return "produkce pozastavena";
    default:
      return "produkce aktivní";
  }
};
