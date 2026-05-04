import type { ApartmentBlockBalanceConfig, PowerStationBalanceConfig, RecruitmentCenterBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { resolvePowerStationInfrastructureMultiplier } from "./powerStationBuildingActions";
import { resolveRecruitmentCenterSupportBonuses } from "./recruitmentCenterBuildingActions";

export interface ApartmentBlockActionResolution {
  balances: Record<string, number>;
  buildingMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: Record<string, number>;
  reportText: string;
  apartmentResult: Record<string, unknown>;
}

interface ApartmentBlockMetadata {
  storedPopulation: number;
  lastUpdatedTick?: number;
  lastCapacity?: number;
  wasFull?: boolean;
}

export const getOwnedApartmentBlockCount = (
  state: CoreGameState,
  playerId: string,
  config: ApartmentBlockBalanceConfig
): number =>
  getOwnedApartmentBlocks(state, playerId, config).length;

export const resolveApartmentBlockNetworkMultipliers = (
  count: number,
  config: ApartmentBlockBalanceConfig
): { populationProductionMultiplier: number; capacityMultiplier: number } => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    populationProductionMultiplier: Math.min(
      config.network.maxPopulationProductionMultiplier,
      1 + extra * config.network.populationProductionBonusPctPerExtraBlock / 100
    ),
    capacityMultiplier: Math.min(
      config.network.maxCapacityMultiplier,
      1 + extra * config.network.capacityBonusPctPerExtraBlock / 100
    )
  };
};

export const getApartmentBlockMetadata = (
  building: CoreGameState["buildingsById"][string]
): ApartmentBlockMetadata => {
  const raw = isRecord(building.metadata?.apartmentBlock) ? building.metadata?.apartmentBlock : {};
  return {
    storedPopulation: Math.max(0, Number(raw.storedPopulation || 0)),
    lastUpdatedTick: asOptionalTick(raw.lastUpdatedTick),
    lastCapacity: asOptionalNumber(raw.lastCapacity),
    wasFull: Boolean(raw.wasFull)
  };
};

export const applyApartmentBlockPopulationProduction = (
  state: CoreGameState,
  config: ApartmentBlockBalanceConfig,
  tickRateMs: number,
  powerStationConfig?: PowerStationBalanceConfig,
  recruitmentCenterConfig?: RecruitmentCenterBalanceConfig
): CoreGameState => {
  let buildingsById = state.buildingsById;
  let changed = false;

  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== config.buildingTypeId || building.status !== "active" || !building.ownerPlayerId) {
      continue;
    }
    const metadata = getApartmentBlockMetadata(building);
    const lastTick = metadata.lastUpdatedTick ?? state.root.tick;
    const elapsedTicks = Math.max(0, state.root.tick - lastTick);
    const ownedCount = getOwnedApartmentBlockCount(state, building.ownerPlayerId, config);
    const multipliers = resolveApartmentBlockNetworkMultipliers(ownedCount, config);
    const recruitmentBonuses = resolveRecruitmentCenterSupportBonuses({
      state,
      playerId: building.ownerPlayerId,
      config: recruitmentCenterConfig
    });
    const infrastructureMultiplier = resolvePowerStationInfrastructureMultiplier({
      state,
      playerId: building.ownerPlayerId,
      config: powerStationConfig,
      tick: state.root.tick,
      target: "apartmentPopulationProduction"
    });
    const recruitmentPopulationMultiplier = 1 + recruitmentBonuses.populationProductionBonusPct / 100;
    const recruitmentCapacityMultiplier = 1 + recruitmentBonuses.apartmentCapacityBonusPct / 100;
    const capacity = Math.max(1, Math.floor(config.baseCapacity * multipliers.capacityMultiplier * recruitmentCapacityMultiplier + 1e-9));
    const currentStored = Math.min(capacity, metadata.storedPopulation);
    const gain = currentStored >= capacity
      ? 0
      : config.populationPerMinute * multipliers.populationProductionMultiplier * recruitmentPopulationMultiplier * infrastructureMultiplier * elapsedTicks * Math.max(1, tickRateMs) / 60000;
    const nextStored = Math.min(capacity, currentStored + gain);
    const nextMetadata: ApartmentBlockMetadata = {
      storedPopulation: nextStored,
      lastUpdatedTick: state.root.tick,
      lastCapacity: capacity,
      wasFull: nextStored >= capacity
    };

    if (
      Math.abs(nextMetadata.storedPopulation - metadata.storedPopulation) <= Number.EPSILON
      && nextMetadata.lastUpdatedTick === metadata.lastUpdatedTick
      && nextMetadata.lastCapacity === metadata.lastCapacity
      && nextMetadata.wasFull === metadata.wasFull
    ) {
      continue;
    }

    buildingsById = {
      ...buildingsById,
      [building.id]: {
        ...building,
        metadata: withApartmentBlockMetadata(building, nextMetadata),
        version: building.version + 1
      }
    };
    changed = true;
  }

  return changed ? { ...state, buildingsById } : state;
};

export const resolveApartmentBlockAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  actionId: string;
  balances: Record<string, number>;
  apartmentConfig: ApartmentBlockBalanceConfig;
}): ApartmentBlockActionResolution | null => {
  if (input.actionId !== input.apartmentConfig.collectPopulation.actionId) {
    return null;
  }
  const metadata = getApartmentBlockMetadata(input.building);
  const collected = Math.max(0, Math.floor(metadata.storedPopulation));
  const remaining = Math.max(0, metadata.storedPopulation - collected);
  const nextMetadata: ApartmentBlockMetadata = {
    ...metadata,
    storedPopulation: remaining,
    lastUpdatedTick: input.state.root.tick,
    wasFull: false
  };

  return {
    balances: {
      ...input.balances,
      "gang-members": Math.max(0, Number(input.balances["gang-members"] || 0) + collected)
    },
    buildingMetadata: withApartmentBlockMetadata(input.building, nextMetadata),
    heatGain: 0,
    influenceChange: 0,
    inputCost: {},
    outputGain: {
      population: collected,
      "gang-members": collected
    },
    reportText: `Vybral jsi ${collected} nových členů gangu z Bytového bloku.`,
    apartmentResult: {
      type: "collect",
      collectedPopulation: collected,
      remainingStoredPopulation: remaining
    }
  };
};

export const validateApartmentBlockAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  actionId: string;
  apartmentConfig?: ApartmentBlockBalanceConfig;
}): string | null => {
  const config = input.apartmentConfig;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId || input.actionId !== config.collectPopulation.actionId) {
    return null;
  }
  if (Math.floor(getApartmentBlockMetadata(input.building).storedPopulation) <= 0) {
    return "apartment_block_no_population";
  }
  return null;
};

const getOwnedApartmentBlocks = (
  state: CoreGameState,
  playerId: string,
  config: ApartmentBlockBalanceConfig
) =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  );

const withApartmentBlockMetadata = (
  building: CoreGameState["buildingsById"][string],
  apartmentBlock: ApartmentBlockMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  apartmentBlock
});

const asOptionalTick = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : undefined;
};

const asOptionalNumber = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
