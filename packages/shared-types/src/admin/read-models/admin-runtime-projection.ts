export type AdminProjectionSource = "runtime" | "snapshot" | "config" | "demo-sample" | "pending";

export type AdminProjectionHealthStatus = "ok" | "warning" | "pending" | "error";

export interface AdminProjectionHealth {
  name: string;
  status: AdminProjectionHealthStatus;
  lastUpdatedAt: string | null;
  missingFields: string[];
  source: AdminProjectionSource;
  message: string;
}

export interface AdminProjectionStaleState {
  isStale: boolean;
  thresholdSeconds: number;
  ageSeconds: number;
  checkedAt: string;
  source: AdminProjectionSource;
  reason: string;
}

export interface AdminRuntimeDetailProjection {
  generatedAt: string;
  selectedInstanceId: string | null;
  source: AdminProjectionSource;
  stale: AdminProjectionStaleState;
  projectionHealth: AdminProjectionHealth[];
  players: AdminRuntimePlayerProjection[];
  districts: AdminRuntimeDistrictProjection[];
  economy: AdminRuntimeEconomyProjection;
  production: AdminRuntimeProductionProjection;
  police: AdminRuntimePoliceProjection;
  orders: AdminRuntimeOrderProjection[];
  events: AdminRuntimeEventProjection[];
}

export interface AdminRuntimePlayerProjection {
  playerId: string;
  displayName: string;
  factionId: string;
  factionName: string;
  status: string;
  homeDistrictId: string | null;
  ownedDistrictCount: number;
  ownedDistrictIds: string[];
  resources: Record<string, number>;
  keyResources: Record<string, number>;
  cash: number;
  dirtyCash: number;
  population: number;
  influence: number;
  heat: number;
  wantedLevel: number;
  onboarding: {
    status: string;
    progressLabel: string;
    source: AdminProjectionSource;
    note: string;
  };
  activeOrdersCount: number;
  activeMissionsCount: number;
  lastActionAt: string | null;
  warnings: string[];
  source: AdminProjectionSource;
}

export interface AdminRuntimeDistrictProjection {
  districtId: string;
  name: string;
  zone: string;
  ownerPlayerId: string | null;
  ownerName: string | null;
  status: string;
  population: number | null;
  influence: number;
  heat: number;
  buildingCount: number;
  activeBuildingActionsCount: number;
  productionStatus: string;
  activeOrderCount: number;
  isSpawnCandidate: boolean;
  isDowntown: boolean;
  warnings: string[];
  source: AdminProjectionSource;
}

export interface AdminRuntimeEconomyProjection {
  source: AdminProjectionSource;
  totalCleanCash: number;
  totalDirtyCash: number;
  totalResources: Record<string, number>;
  topResourceHolders: AdminRuntimeResourceHolderProjection[];
  productionOutputSummary: Record<string, number>;
  marketRiskNotes: string[];
  warnings: string[];
}

export interface AdminRuntimeResourceHolderProjection {
  playerId: string;
  displayName: string;
  resourceKey: string;
  amount: number;
}

export interface AdminRuntimeProductionProjection {
  source: AdminProjectionSource;
  activeProductionBuildings: AdminRuntimeProductionBuildingProjection[];
  readyCollectCount: number;
  storageFullCount: number;
  activeCraftJobs: AdminRuntimeCraftJobProjection[];
  bottleneckResources: AdminRuntimeBottleneckResourceProjection[];
  cooldowns: AdminRuntimeCooldownProjection[];
  warnings: string[];
}

export interface AdminRuntimeProductionBuildingProjection {
  buildingId: string;
  buildingTypeId: string;
  displayName: string;
  districtId: string;
  ownerPlayerId: string;
  resourceKey: string;
  resourceLabel: string;
  stored: number;
  storageCap: number;
  readyToCollect: boolean;
  storageFull: boolean;
  source: AdminProjectionSource;
}

export interface AdminRuntimeCraftJobProjection {
  buildingId: string;
  buildingTypeId: string;
  districtId: string;
  ownerPlayerId: string;
  recipeId: string;
  recipeLabel: string;
  startedTick: number;
  completesTick: number;
  remainingTicks: number;
  remainingLabel: string;
  source: AdminProjectionSource;
}

export interface AdminRuntimeBottleneckResourceProjection {
  resourceKey: string;
  total: number;
  warning: string;
}

export interface AdminRuntimeCooldownProjection {
  ownerType: "player" | "district" | "alliance" | "building";
  ownerId: string;
  key: string;
  remainingTicks: number;
  remainingLabel: string;
  source: AdminProjectionSource;
}

export interface AdminRuntimePoliceProjection {
  source: AdminProjectionSource;
  heatPressure: string;
  wantedPlayers: AdminRuntimePlayerHeatProjection[];
  districtHotspots: AdminRuntimeDistrictHeatProjection[];
  pendingRaids: AdminRuntimePendingRaidProjection[];
  pendingRaidCount: number;
  resolvedRecentEvents: AdminRuntimeEventProjection[];
  warnings: string[];
}

export interface AdminRuntimePlayerHeatProjection {
  playerId: string;
  displayName: string;
  heat: number;
  wantedLevel: number;
  activeFlags: string[];
}

export interface AdminRuntimeDistrictHeatProjection {
  districtId: string;
  name: string;
  heat: number;
  ownerPlayerId: string | null;
}

export interface AdminRuntimePendingRaidProjection {
  raidId: string;
  playerId: string;
  targetDistrictId: string | null;
  severity: string;
  status: string;
  reason: string;
  createdAtTick: number;
  expiresAtTick: number;
  remainingTicks: number;
  sourcePressure: number;
}

export interface AdminRuntimeOrderProjection {
  id: string;
  type: "spy" | "attack" | "occupy" | "rob" | "heist" | "building-action" | "cooldown";
  playerId: string;
  playerName: string;
  sourceDistrictId: string | null;
  targetDistrictId: string | null;
  status: string;
  startedAtTick: number | null;
  resolvesAtTick: number | null;
  remainingTicks: number;
  remainingLabel: string;
  result: "pending" | "known" | "unknown";
  warnings: string[];
  source: AdminProjectionSource;
}

export interface AdminRuntimeEventProjection {
  id: string;
  type: string;
  severity: "notice" | "warning" | "error";
  createdAt: string;
  tick: number | null;
  playerId: string | null;
  districtId: string | null;
  summary: string;
  payloadPreview: string;
  source: AdminProjectionSource;
}
