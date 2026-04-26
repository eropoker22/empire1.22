export interface DistrictPanelBuildingCatalogEntry {
  buildingTypeId: string;
  label: string;
  nameVariants?: readonly string[];
  zone?: string;
  role?: string;
  info?: string;
  stats?: {
    cleanPerHour: number;
    dirtyPerHour: number;
    heatPerDay: number;
    influencePerDay: number;
    maxLevel: number;
  };
  specialActions?: ReadonlyArray<{
    actionId: string;
    label: string;
    description: string;
    effectSummary: string;
    durationMs: number;
    cooldownMs: number;
    heatGain: number;
  }>;
}
