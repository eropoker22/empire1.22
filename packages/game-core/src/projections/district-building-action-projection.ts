import type { DistrictPanelBuildingView } from "@empire/shared-types";
import type { BuildingActionBalanceConfig } from "../contracts/game-mode-config";
import type { CoreGameState } from "../entities/game-state";
import type { DistrictPanelBuildingCatalogEntry } from "./district-building-catalog-types";

export interface CreateDistrictPanelBuildingViewsInput {
  buildings: CoreGameState["buildingsById"][string][];
  buildCatalog: ReadonlyArray<DistrictPanelBuildingCatalogEntry>;
  actionCatalog: Readonly<Record<string, BuildingActionBalanceConfig>>;
  district: CoreGameState["districtsById"][string];
  playerId: string;
  playerBalances: Record<string, number>;
  tick: number;
}

export const createDistrictPanelBuildingViews = (
  input: CreateDistrictPanelBuildingViewsInput
): DistrictPanelBuildingView[] => {
  const buildingDefinitions = Object.fromEntries(input.buildCatalog.map((entry) => [entry.buildingTypeId, entry]));

  return input.buildings.map((building) => {
    const definition = buildingDefinitions[building.buildingTypeId];
    const actions = createBuildingActionViews({
      actionCatalog: input.actionCatalog,
      building,
      district: input.district,
      playerId: input.playerId,
      playerBalances: input.playerBalances,
      tick: input.tick
    });

    const baseLabel = definition?.label ?? formatResourceLabel(building.buildingTypeId);
    const variantName = normalizeBuildingDisplayName(building.displayName) ?? resolveCatalogVariantName(definition, building.id);

    return {
      buildingId: building.id,
      buildingTypeId: building.buildingTypeId,
      label: baseLabel,
      displayName: variantName ?? baseLabel,
      variantName,
      zone: definition?.zone ?? input.district.zone,
      role: definition?.role ?? "Fixed building",
      info: definition?.info ?? "Fixed district building.",
      stats: createBuildingStats(definition),
      specialActions: createSpecialActionViews(definition, actions),
      level: building.level,
      status: building.status,
      actionCooldowns: { ...(building.actionCooldowns ?? {}) },
      actions
    };
  });
};

const createBuildingStats = (
  definition: CreateDistrictPanelBuildingViewsInput["buildCatalog"][number] | undefined
) => {
  const stats = definition?.stats;

  return [
    { label: "Clean / h", value: `$${formatNumber(stats?.cleanPerHour ?? 0)}` },
    { label: "Dirty / h", value: `$${formatNumber(stats?.dirtyPerHour ?? 0)}` },
    { label: "Heat / day", value: formatNumber(stats?.heatPerDay ?? 0) },
    { label: "Influence / day", value: formatNumber(stats?.influencePerDay ?? 0) },
    { label: "Max level", value: String(stats?.maxLevel ?? 1) }
  ];
};

const normalizeBuildingDisplayName = (value: string | null | undefined): string | null => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

const resolveCatalogVariantName = (
  definition: CreateDistrictPanelBuildingViewsInput["buildCatalog"][number] | undefined,
  seed: string
): string | null => {
  const variants = definition?.nameVariants ?? [];
  if (variants.length < 1) {
    return null;
  }
  return variants[hashString(seed) % variants.length] ?? null;
};

const hashString = (value: string): number => {
  const text = String(value || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const createSpecialActionViews = (
  definition: CreateDistrictPanelBuildingViewsInput["buildCatalog"][number] | undefined,
  actions: ReturnType<typeof createBuildingActionViews>
) =>
  (definition?.specialActions ?? []).map((specialAction) => {
    const commandAction = actions.find((action) => action.actionId === specialAction.actionId);

    return {
      actionId: specialAction.actionId,
      label: specialAction.label,
      description: specialAction.description,
      effectSummary: specialAction.effectSummary,
      durationMs: specialAction.durationMs,
      cooldownMs: specialAction.cooldownMs,
      cooldownRemainingTicks: commandAction?.cooldownRemainingTicks ?? 0,
      heatGain: specialAction.heatGain,
      enabled: commandAction?.enabled ?? false,
      disabledReason: commandAction?.disabledReason ?? "This special action is not wired to the command dispatcher yet."
    };
  });

const createBuildingActionViews = (input: {
  actionCatalog: Readonly<Record<string, BuildingActionBalanceConfig>>;
  building: CoreGameState["buildingsById"][string];
  district: CoreGameState["districtsById"][string];
  playerId: string;
  playerBalances: Record<string, number>;
  tick: number;
}) =>
  Object.values(input.actionCatalog)
    .filter((action) => action.buildingType === input.building.buildingTypeId)
    .map((action) => {
      const cooldownUntilTick = Math.max(0, Number((input.building.actionCooldowns ?? {})[action.actionId] || 0));
      const cooldownRemainingTicks = Math.max(0, cooldownUntilTick - input.tick);
      const missingCosts = Object.entries(action.inputCost).filter(
        ([resourceKey, requiredAmount]) => Math.max(0, Number(input.playerBalances[resourceKey] || 0)) < requiredAmount
      );
      const ownerBlocked =
        action.requiredOwner &&
        (input.district.ownerPlayerId !== input.playerId || input.building.ownerPlayerId !== input.playerId);
      const disabledReason = ownerBlocked
        ? "Only the district owner can run this building action."
        : input.building.status !== "active"
          ? "Only active fixed buildings can run actions."
          : input.district.status === "contested" && !action.allowedIfContested
            ? "This action is blocked while the district is contested."
            : cooldownRemainingTicks > 0
              ? `Cooldown ${formatTickLabel(cooldownRemainingTicks)}.`
              : missingCosts.length > 0
                ? `Need ${formatInputSummary(Object.fromEntries(missingCosts))}.`
                : null;

      return {
        actionId: action.actionId,
        label: action.label,
        description: action.description,
        durationMs: action.durationMs,
        cooldownMs: action.cooldownMs,
        cooldownRemainingTicks,
        inputCost: { ...action.inputCost },
        outputGain: { ...action.outputGain },
        heatGain: action.heatGain,
        influenceChange: action.influenceChange,
        reportText: action.reportText,
        enabled: disabledReason === null,
        disabledReason
      };
    });

const formatInputSummary = (inputCosts: Record<string, number>): string =>
  Object.entries(inputCosts)
    .map(([resourceKey, amount]) => `${amount} ${formatResourceLabel(resourceKey)}`)
    .join(" + ");

const formatResourceLabel = (resourceKey: string): string =>
  resourceKey
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const formatNumber = (value: number): string => {
  const normalized = Number(value || 0);
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1);
};

const formatTickLabel = (tickCount: number): string => `${tickCount} ${tickCount === 1 ? "tick" : "ticks"}`;
