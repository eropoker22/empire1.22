import type { DistrictPanelSlotView } from "@empire/shared-types";
import type { CraftBuildingBalanceConfig, PowerStationBalanceConfig } from "../contracts/game-mode-config";
import type { CoreGameState } from "../entities/game-state";
import { resolvePowerStationInfrastructureMultiplier } from "../handlers/powerStationBuildingActions";
import { applyDayNightProductionMultiplier } from "../rules/day-night/dayNight";
import { composeEntityId } from "../utils";
import { formatInputSummary, formatResourceLabel, formatTickLabel } from "./district-building-action-formatters";
import type { DistrictPanelProjectionInput } from "./district-panel-projection-types";
import { resolveProjectionProductionLevelMultiplier } from "./production-level-projection";

export const createDistrictSlotViews = (params: {
  state: CoreGameState;
  input: DistrictPanelProjectionInput;
  district: CoreGameState["districtsById"][string];
  playerBalances: Record<string, number>;
  isOwnedByPlayer: boolean;
}): DistrictPanelSlotView[] =>
  Array.from({ length: params.district.slotCount }, (_value, slotIndex) => {
    const buildingId = params.district.buildingIds[slotIndex];
    const building = buildingId ? params.state.buildingsById[buildingId] : undefined;

    if (!building) {
      return createEmptySlotView(slotIndex);
    }

    const productionProfile = params.input.productionCatalog[building.buildingTypeId];
    const craftProfile = params.input.craftCatalog[building.buildingTypeId];
    const processingView = createProcessingView(building, craftProfile, params.state.root.tick);
    const productionState = productionProfile
      ? params.state.resourceStatesById[composeEntityId("resource", building.id)]
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
            amountPerTick: resolveProjectedProductionAmountPerTick({
              state: params.state,
              input: params.input,
              building,
              productionProfile,
              craftProfile
            }),
            canCollect: params.isOwnedByPlayer && building.ownerPlayerId === params.input.playerId && building.status === "active" && storedAmount > 0,
            collectDisabledReason: resolveCollectDisabledReason({
              isOwnedByPlayer: params.isOwnedByPlayer,
              ownerPlayerId: building.ownerPlayerId,
              playerId: params.input.playerId,
              buildingStatus: building.status,
              storedAmount,
              resourceLabel: productionProfile.resourceLabel
            })
          }
        : null,
      processing: processingView,
      craftOptions: craftProfile
        ? createCraftOptionViews({
            craftProfile,
            processingView,
            playerBalances: params.playerBalances,
            isOwnedByPlayer: params.isOwnedByPlayer,
            ownerPlayerId: building.ownerPlayerId,
            playerId: params.input.playerId,
            buildingStatus: building.status
          })
        : [],
      buildOptions: []
    };
  });

const createEmptySlotView = (slotIndex: number): DistrictPanelSlotView => ({
  slotIndex,
  buildingId: null,
  buildingTypeId: null,
  status: "empty",
  canBuild: false,
  production: null,
  processing: null,
  craftOptions: [],
  buildOptions: []
});

const createCraftOptionViews = (params: {
  craftProfile: CraftBuildingBalanceConfig;
  processingView: ReturnType<typeof createProcessingView>;
  playerBalances: Record<string, number>;
  isOwnedByPlayer: boolean;
  ownerPlayerId?: string | null;
  playerId: string;
  buildingStatus: CoreGameState["buildingsById"][string]["status"];
}) =>
  Object.entries(params.craftProfile.recipes).map(([recipeId, recipe]) => {
    const missingInputs = Object.entries(recipe.inputCosts).filter(
      ([resourceKey, requiredAmount]) =>
        Math.max(0, Number(params.playerBalances[resourceKey] || 0)) < requiredAmount
    );

    return {
      recipeId,
      label: recipe.label,
      inputSummary: formatInputSummary(recipe.inputCosts),
      outputResourceKey: recipe.outputResourceKey,
      outputResourceLabel: recipe.outputResourceLabel,
      outputAmount: recipe.outputAmount,
      canCraft:
        params.isOwnedByPlayer &&
        params.ownerPlayerId === params.playerId &&
        params.buildingStatus === "active" &&
        !params.processingView &&
        missingInputs.length === 0,
      craftDisabledReason: resolveCraftDisabledReason({
        ...params,
        missingInputs
      })
    };
  });

const resolveCollectDisabledReason = (params: {
  isOwnedByPlayer: boolean;
  ownerPlayerId?: string | null;
  playerId: string;
  buildingStatus: CoreGameState["buildingsById"][string]["status"];
  storedAmount: number;
  resourceLabel: string;
}): string | null =>
  !params.isOwnedByPlayer || params.ownerPlayerId !== params.playerId
    ? "Produkci tady může vybrat jen majitel budovy."
    : params.buildingStatus !== "active"
      ? "Produkci může vybrat jen aktivní budova."
      : params.storedAmount > 0
        ? null
        : `${params.resourceLabel} ještě není připravený k vybrání.`;

const resolveCraftDisabledReason = (params: {
  isOwnedByPlayer: boolean;
  ownerPlayerId?: string | null;
  playerId: string;
  buildingStatus: CoreGameState["buildingsById"][string]["status"];
  processingView: ReturnType<typeof createProcessingView>;
  missingInputs: [string, number][];
}): string | null =>
  !params.isOwnedByPlayer || params.ownerPlayerId !== params.playerId
    ? "Itemy tady může zpracovat jen majitel budovy."
    : params.buildingStatus !== "active"
      ? "Itemy může zpracovat jen aktivní budova."
      : params.processingView
        ? `${params.processingView.label} se dokončí za ${formatTickLabel(params.processingView.remainingTicks)}.`
        : params.missingInputs.length > 0
          ? `Chybí ${formatInputSummary(Object.fromEntries(params.missingInputs))}.`
          : null;

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

const resolveProjectedProductionAmountPerTick = (params: {
  state: CoreGameState;
  input: DistrictPanelProjectionInput;
  building: CoreGameState["buildingsById"][string];
  productionProfile: NonNullable<DistrictPanelProjectionInput["productionCatalog"][string]>;
  craftProfile?: DistrictPanelProjectionInput["craftCatalog"][string];
}): number => {
  const baseAmountPerTick = Math.max(0, Math.floor(
    params.productionProfile.amountPerTick
      * params.input.productionMultiplier
      * resolveProjectionProductionLevelMultiplier(
        params.building.level,
        params.productionProfile.upgrade ?? params.craftProfile?.upgrade
      )
      * resolveProductionInfrastructureMultiplier({
        state: params.state,
        building: params.building,
        powerStationConfig: params.input.powerStationConfig
      })
  ));

  return params.input.config
    ? Math.max(0, applyDayNightProductionMultiplier({
        state: params.state,
        context: { config: params.input.config },
        buildingTypeId: params.building.buildingTypeId,
        amountPerTick: baseAmountPerTick
      }))
    : baseAmountPerTick;
};

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
