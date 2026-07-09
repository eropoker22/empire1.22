import type { BuildingActionBalanceConfig } from "../contracts/game-mode-config";
import type { DistrictPanelBuildingCatalogEntry } from "./district-building-catalog-types";

export const normalizeBuildingDisplayName = (value: string | null | undefined): string | null => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

export const resolveCatalogVariantName = (
  definition: DistrictPanelBuildingCatalogEntry | undefined,
  seed: string
): string | null => {
  const variants = definition?.nameVariants ?? [];
  if (variants.length < 1) {
    return null;
  }
  return variants[hashString(seed) % variants.length] ?? null;
};

export const createBaseBuildingActionPreview = (action: BuildingActionBalanceConfig) => ({
  baseInputCost: { ...action.inputCost },
  effectiveInputCost: { ...action.inputCost },
  baseOutputGain: { ...action.outputGain },
  effectiveOutputGain: { ...action.outputGain },
  baseHeatGain: action.heatGain,
  effectiveHeatGain: action.heatGain,
  baseCooldownMs: action.cooldownMs,
  effectiveCooldownMs: action.cooldownMs,
  baseDurationMs: action.durationMs,
  effectiveDurationMs: action.durationMs,
  phaseAvailability: "neutral" as const,
  phaseBadgeLabel: null,
  phaseTooltip: null,
  blockedReason: null,
  preferredPhase: null,
  currentPhase: "day" as const,
  phaseEffectSummary: []
});

const hashString = (value: string): number => {
  const text = String(value || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
};
