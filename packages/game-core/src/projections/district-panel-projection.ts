import type { DistrictPanelView } from "@empire/shared-types";
import type { CoreGameState } from "../entities/game-state";
import type {
  BuildingActionBalanceConfig,
  AirportBalanceConfig,
  CarDealerBalanceConfig,
  CentralBankBalanceConfig,
  CityHallBalanceConfig,
  ConvenienceStoreBalanceConfig,
  CraftBuildingBalanceConfig,
  FitnessClubBalanceConfig,
  GarageBalanceConfig,
  PowerStationBalanceConfig,
  ProductionBuildingBalanceConfig,
  RecruitmentCenterBalanceConfig,
  RecyclingCenterBalanceConfig,
  RestaurantBalanceConfig,
  SchoolBalanceConfig,
  ShoppingMallBalanceConfig,
  StockExchangeBalanceConfig,
  SmugglingTunnelBalanceConfig,
  StreetDealersBalanceConfig,
  StripClubBalanceConfig,
  VipLoungeBalanceConfig
} from "../contracts/game-mode-config";
import { resolvePowerStationInfrastructureMultiplier } from "../handlers/powerStationBuildingActions";
import { composeEntityId } from "../utils";
import { createDistrictAttackTargetViews } from "./district-attack-target-projection";
import { createDistrictPanelBuildingViews } from "./district-building-action-projection";
import type { DistrictPanelBuildingCatalogEntry } from "./district-building-catalog-types";
import { createDistrictSpyTargetViews } from "./district-spy-target-projection";

export interface DistrictPanelProjectionInput {
  playerId: string;
  districtId: string;
  buildCatalog: ReadonlyArray<DistrictPanelBuildingCatalogEntry>;
  productionCatalog: Readonly<Record<string, ProductionBuildingBalanceConfig>>;
  craftCatalog: Readonly<Record<string, CraftBuildingBalanceConfig>>;
  buildingActionCatalog: Readonly<Record<string, BuildingActionBalanceConfig>>;
  stripClubConfig?: StripClubBalanceConfig;
  restaurantConfig?: RestaurantBalanceConfig;
  convenienceStoreConfig?: ConvenienceStoreBalanceConfig;
  shoppingMallConfig?: ShoppingMallBalanceConfig;
  stockExchangeConfig?: StockExchangeBalanceConfig;
  centralBankConfig?: CentralBankBalanceConfig;
  airportConfig?: AirportBalanceConfig;
  cityHallConfig?: CityHallBalanceConfig;
  vipLoungeConfig?: VipLoungeBalanceConfig;
  powerStationConfig?: PowerStationBalanceConfig;
  recruitmentCenterConfig?: RecruitmentCenterBalanceConfig;
  fitnessClubConfig?: FitnessClubBalanceConfig;
  garageConfig?: GarageBalanceConfig;
  carDealerConfig?: CarDealerBalanceConfig;
  smugglingTunnelConfig?: SmugglingTunnelBalanceConfig;
  streetDealersConfig?: StreetDealersBalanceConfig;
  schoolConfig?: SchoolBalanceConfig;
  recyclingCenterConfig?: RecyclingCenterBalanceConfig;
  productionMultiplier: number;
  tickRateMs?: number;
}

/**
 * Responsibility: Shapes one district into a client-ready panel projection.
 * Belongs here: read-only mapping from authoritative state into UI-safe district data.
 * Does not belong here: transport delivery or command dispatch.
 */
export const createDistrictPanelView = (
  state: CoreGameState,
  input: DistrictPanelProjectionInput
): DistrictPanelView | null => {
  const district = state.districtsById[input.districtId];

  if (!district) {
    return null;
  }

  const filledBuildings = district.buildingIds
    .map((buildingId) => state.buildingsById[buildingId])
    .filter((building) => building !== undefined && building.status !== "destroyed");
  const filledSlotCount = filledBuildings.length;
  const isOwnedByPlayer = district.ownerPlayerId === input.playerId;
  const player = state.playersById[input.playerId];
  const playerBalances = player
    ? state.resourceStatesById[player.resourceStateId]?.balances ?? {}
    : {};
  const attackTargets = createDistrictAttackTargetViews(state, input.playerId, district.id);
  const spyTargets = createDistrictSpyTargetViews(state, input.playerId, district.id);
  const trap = createTrapView(state, input.playerId, district.id);
  const isDestroyed = district.status === "destroyed";

  return {
    districtId: district.id,
    name: district.name,
    zone: district.zone,
    status: district.status,
    ownerPlayerId: isDestroyed ? null : district.ownerPlayerId,
    isOwnedByPlayer: isDestroyed ? false : isOwnedByPlayer,
    heat: isDestroyed ? 0 : district.heat,
    influence: isDestroyed ? 0 : district.influence,
    slotCount: district.slotCount,
    filledSlotCount,
    buildings: isDestroyed
      ? []
      : createDistrictPanelBuildingViews({
      state,
      buildings: filledBuildings,
      buildCatalog: input.buildCatalog,
      actionCatalog: input.buildingActionCatalog,
      stripClubConfig: input.stripClubConfig,
      restaurantConfig: input.restaurantConfig,
      convenienceStoreConfig: input.convenienceStoreConfig,
      shoppingMallConfig: input.shoppingMallConfig,
      stockExchangeConfig: input.stockExchangeConfig,
      centralBankConfig: input.centralBankConfig,
      airportConfig: input.airportConfig,
      cityHallConfig: input.cityHallConfig,
      vipLoungeConfig: input.vipLoungeConfig,
      powerStationConfig: input.powerStationConfig,
      recruitmentCenterConfig: input.recruitmentCenterConfig,
      fitnessClubConfig: input.fitnessClubConfig,
      garageConfig: input.garageConfig,
      carDealerConfig: input.carDealerConfig,
      smugglingTunnelConfig: input.smugglingTunnelConfig,
      streetDealersConfig: input.streetDealersConfig,
      schoolConfig: input.schoolConfig,
      recyclingCenterConfig: input.recyclingCenterConfig,
      district,
      playerId: input.playerId,
      playerBalances,
      tick: state.root.tick,
      tickRateMs: input.tickRateMs
    }),
    attackTargets: isDestroyed ? [] : attackTargets,
    spyTargets: isDestroyed ? [] : spyTargets,
    trap: isDestroyed ? null : trap,
    slots: isDestroyed ? [] : Array.from({ length: district.slotCount }, (_value, slotIndex) => {
      const buildingId = district.buildingIds[slotIndex];
      const building = buildingId ? state.buildingsById[buildingId] : undefined;

      if (building) {
        const productionProfile = input.productionCatalog[building.buildingTypeId];
        const craftProfile = input.craftCatalog[building.buildingTypeId];
        const processingView = createProcessingView(building, craftProfile, state.root.tick);
        const productionState = productionProfile
          ? state.resourceStatesById[composeEntityId("resource", building.id)]
          : null;
        const storedAmount = productionProfile
          ? Math.max(0, Number(productionState?.balances?.[productionProfile.resourceKey] || 0))
          : 0;

        return {
          slotIndex,
          buildingId: building.id,
          buildingTypeId: building.buildingTypeId,
          status: building.status,
          canBuild: false,
          production: productionProfile
            ? {
                resourceKey: productionProfile.resourceKey,
                resourceLabel: productionProfile.resourceLabel,
                storedAmount,
                storageCap: productionProfile.storageCap,
                amountPerTick: Math.max(0, Math.floor(productionProfile.amountPerTick * input.productionMultiplier * resolveProductionInfrastructureMultiplier({
                  state,
                  building,
                  powerStationConfig: input.powerStationConfig
                }))),
                canCollect: isOwnedByPlayer && building.ownerPlayerId === input.playerId && building.status === "active" && storedAmount > 0,
                collectDisabledReason: !isOwnedByPlayer || building.ownerPlayerId !== input.playerId
                  ? "Only the building owner can collect production here."
                  : building.status !== "active"
                    ? "Only active buildings can collect production."
                    : storedAmount > 0
                      ? null
                      : `No ${productionProfile.resourceLabel} ready to collect yet.`
              }
            : null,
          processing: processingView,
          craftOptions: craftProfile
            ? Object.entries(craftProfile.recipes).map(([recipeId, recipe]) => {
                const missingInputs = Object.entries(recipe.inputCosts).filter(
                  ([resourceKey, requiredAmount]) =>
                    Math.max(0, Number(playerBalances[resourceKey] || 0)) < requiredAmount
                );

                return {
                  recipeId,
                  label: recipe.label,
                  inputSummary: formatInputSummary(recipe.inputCosts),
                  outputResourceKey: recipe.outputResourceKey,
                  outputResourceLabel: recipe.outputResourceLabel,
                  outputAmount: recipe.outputAmount,
                  canCraft:
                    isOwnedByPlayer &&
                    building.ownerPlayerId === input.playerId &&
                    building.status === "active" &&
                    !processingView &&
                    missingInputs.length === 0,
                  craftDisabledReason: !isOwnedByPlayer || building.ownerPlayerId !== input.playerId
                    ? "Only the building owner can process items here."
                    : building.status !== "active"
                      ? "Only active buildings can process items."
                      : processingView
                        ? `Processing ${processingView.label} completes in ${formatTickLabel(processingView.remainingTicks)}.`
                      : missingInputs.length > 0
                        ? `Need ${formatInputSummary(Object.fromEntries(missingInputs))}.`
                        : null
                };
              })
            : [],
          buildOptions: []
        };
      }

      return {
        slotIndex,
        buildingId: null,
        buildingTypeId: null,
        status: "empty",
        canBuild: false,
        production: null,
        processing: null,
        craftOptions: [],
        buildOptions: []
      };
    })
  };
};

const createTrapView = (
  state: CoreGameState,
  playerId: string,
  districtId: string
) => {
  const district = state.districtsById[districtId];

  if (!district || district.ownerPlayerId !== playerId) {
    return null;
  }

  const activeTrap = Object.values(state.trapsById).find(
    (trap) => trap.districtId === district.id && trap.status === "active"
  );
  const otherActiveTrap = Object.values(state.trapsById).find(
    (trap) => trap.ownerPlayerId === playerId && trap.status === "active" && trap.districtId !== district.id
  );

  return {
    enabled: !activeTrap && !otherActiveTrap,
    disabledReason: activeTrap
      ? `Trap already armed on ${district.name}.`
      : otherActiveTrap
        ? "Only one active trap can be armed at a time."
        : null,
    activeTrap: activeTrap
      ? {
          trapId: activeTrap.id,
          label: "Hidden trap armed",
          placedAtTick: activeTrap.placedAtTick
        }
      : null
  };
};

const formatInputSummary = (inputCosts: Record<string, number>): string =>
  Object.entries(inputCosts)
    .map(([resourceKey, amount]) => `${amount} ${formatResourceLabel(resourceKey)}`)
    .join(" + ");

const formatResourceLabel = (resourceKey: string): string =>
  resourceKey
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const createProcessingView = (
  building: CoreGameState["buildingsById"][string],
  craftProfile: CraftBuildingBalanceConfig | undefined,
  tick: number
) => {
  if (!building.processing) {
    return null;
  }

  const recipe = craftProfile?.recipes[building.processing.recipeId];

  if (!recipe) {
    return null;
  }

  return {
    recipeId: building.processing.recipeId,
    label: recipe.label,
    remainingTicks: Math.max(0, building.processing.completesAtTick - tick),
    totalTicks: Math.max(1, building.processing.completesAtTick - building.processing.startedAtTick),
    outputResourceKey: recipe.outputResourceKey,
    outputResourceLabel: recipe.outputResourceLabel,
    outputAmount: recipe.outputAmount
  };
};

const formatTickLabel = (tickCount: number): string => `${tickCount} ${tickCount === 1 ? "tick" : "ticks"}`;

const resolveProductionInfrastructureMultiplier = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  powerStationConfig?: PowerStationBalanceConfig;
}): number =>
  input.building.buildingTypeId === "factory"
    ? resolvePowerStationInfrastructureMultiplier({
        state: input.state,
        playerId: input.building.ownerPlayerId,
        config: input.powerStationConfig,
        tick: input.state.root.tick,
        target: "factoryProductionSpeed"
      })
    : 1;
