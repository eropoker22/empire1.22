import type {
  AdminProjectionHealth,
  AdminProjectionSource,
  AdminRuntimeDetailProjection,
  AdminRuntimeDistrictProjection,
  AdminRuntimeEconomyProjection,
  AdminRuntimeEventProjection,
  AdminRuntimeOrderProjection,
  AdminRuntimePlayerProjection,
  AdminRuntimePoliceProjection,
  AdminRuntimeProductionProjection
} from "@empire/shared-types";
import type { AdminOverviewViewModel } from "./admin-overview-view-model";
import { sanitizeAdminDisplayText } from "./admin-display-sanitizer";

export type AdminFeatureMode = "read-only" | "mock" | "locked" | "future-server-only";

export interface AdminDashboardReadModel {
  generatedAt: string;
  environment: {
    label: string;
    runtimeMarker: string;
    authStatus: string;
    staleAfterSeconds: number;
  };
  stale: AdminRuntimeDetailProjection["stale"];
  projectionSource: AdminProjectionSource;
  projectionHealth: AdminProjectionHealth[];
  scope: AdminScopeItem[];
  servers: AdminServerSummary[];
  players: AdminRuntimePlayerProjection[];
  districts: AdminRuntimeDistrictProjection[];
  economy: AdminRuntimeEconomyProjection;
  production: AdminRuntimeProductionProjection;
  police: AdminRuntimePoliceProjection;
  orders: AdminRuntimeOrderProjection[];
  events: AdminRuntimeEventProjection[];
  presetDraft: AdminPresetDraft;
  lockedControls: AdminLockedControl[];
  limitations: string[];
  checklist: string[];
  testGate: {
    status: string;
    notes: string[];
  };
}

export interface AdminScopeItem {
  feature: string;
  mode: AdminFeatureMode;
  status: string;
  risk: string;
}

export interface AdminServerSummary {
  serverInstanceId: string;
  displayName: string;
  mode: string;
  status: string;
  runtimeMarker: string;
  phase: string;
  tick: number;
  stateVersion: string;
  playerCount: number;
  districtCount: number;
  ownedDistrictCount: number;
  activeOrdersCount: number;
  heatPressure: string;
  updatedAt: string;
}

export interface AdminPresetDraft {
  name: string;
  mode: string;
  mapPreset: string;
  startingCash: number;
  startingDirtyCash: number;
  startingPopulation: number;
  startingMaterials: number;
  startingWeapons: number;
  heatStart: number;
  enabledSystems: string[];
  validationStatus: string;
  notes: string;
  draftOnly: true;
}

export interface AdminLockedControl {
  id: string;
  label: string;
  mode: AdminFeatureMode;
  disabledReason: string;
  requirements: string[];
  auditLogRequired: boolean;
  rollbackRequired: boolean;
}

export const createAdminDashboardReadModel = (
  overview: AdminOverviewViewModel,
  options: {
    generatedAt?: string;
  } = {}
): AdminDashboardReadModel => {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const runtimeProjection = overview.runtimeProjection
    ? sanitizeRuntimeProjection(overview.runtimeProjection)
    : createDemoSampleRuntimeProjection(overview, generatedAt);
  const selectedInstance = overview.instances.find((instance) => instance.instanceId === overview.selectedInstanceId)
    ?? overview.instances[0]
    ?? null;

  return {
    generatedAt,
    environment: {
      label: runtimeProjection.source === "runtime"
        ? "DEMO / STAGING"
        : runtimeProjection.source === "demo-sample"
          ? "DEMO SAMPLE"
          : "STATIC PREVIEW",
      runtimeMarker: runtimeProjection.source === "runtime"
        ? "demo-ready read model v1.1"
        : "projection sample / not live",
      authStatus: "Header guarded endpoint; secret is never persisted by UI",
      staleAfterSeconds: runtimeProjection.stale.thresholdSeconds
    },
    stale: runtimeProjection.stale,
    projectionSource: runtimeProjection.source,
    projectionHealth: runtimeProjection.projectionHealth,
    scope: createScopeItems(runtimeProjection.source),
    servers: overview.instances.map((instance) => {
      const server = overview.serverSummaries.find((entry) => entry.serverInstanceId === instance.instanceId);
      const selectedServerOrders = instance.instanceId === selectedInstance?.instanceId
        ? runtimeProjection.orders.length
        : 0;
      const selectedServerOwnedDistricts = instance.instanceId === selectedInstance?.instanceId
        ? runtimeProjection.districts.filter((district) => district.ownerPlayerId).length
        : 0;

      return {
        serverInstanceId: instance.instanceId,
        displayName: server?.displayName ?? instance.displayName,
        mode: server?.mode ?? instance.mode,
        status: instance.status,
        runtimeMarker: runtimeProjection.source === "runtime" ? "runtime projection" : "sample projection",
        phase: server?.phase ?? "monitoring-only",
        tick: instance.currentTick,
        stateVersion: `tick:${instance.currentTick}`,
        playerCount: instance.playerCount,
        districtCount: server?.map.totalDistricts ?? runtimeProjection.districts.length,
        ownedDistrictCount: selectedServerOwnedDistricts,
        activeOrdersCount: selectedServerOrders,
        heatPressure: runtimeProjection.police.heatPressure,
        updatedAt: instance.lastTickCompletedAt ?? generatedAt
      };
    }),
    players: runtimeProjection.players,
    districts: runtimeProjection.districts,
    economy: runtimeProjection.economy,
    production: runtimeProjection.production,
    police: runtimeProjection.police,
    orders: runtimeProjection.orders,
    events: mergeProjectionEvents(runtimeProjection, overview),
    presetDraft: createDefaultPresetDraft(),
    lockedControls: createLockedControls(),
    limitations: [
      runtimeProjection.source === "runtime"
        ? "Admin v1.1 reads runtime projections only. It still cannot mutate live gameplay state."
        : "This view is using demo/sample projection data because runtime detail projection was not attached.",
      "Browser-local onboarding details are not identity authority; server home district and runtime state are the safe source.",
      "Preset builder is draft-only and exports JSON; it never applies to live gameplay state.",
      "Message sending and moderation controls are locked until an audited server-authoritative admin command endpoint exists.",
      "Strict server smoke remains a future server-authoritative gate, not a demo dashboard blocker."
    ],
    checklist: [
      "Verify /admin loads with the expected admin secret delivery path.",
      "Confirm projection source badge is runtime during tester sessions.",
      "Check stale badge before reading operational state.",
      "Use Players, Map, Police and Orders tabs to watch tester confusion points.",
      "Confirm no write controls are enabled before 5-10 tester sessions.",
      "Keep production fail-closed when EMPIRE_ADMIN_SECRET is missing."
    ],
    testGate: {
      status: "Latest known gate: demo-ready",
      notes: [
        "typecheck PASS expected",
        "unit/integration/server/read-model tests PASS expected",
        "admin page build required after UI changes",
        "E2E smoke is explicit final gate for this sprint"
      ]
    }
  };
};

const createScopeItems = (source: AdminProjectionSource): AdminScopeItem[] => [
  {
    feature: "Runtime/server monitoring",
    mode: "read-only",
    status: "Enabled through admin monitoring endpoint",
    risk: "Low if secret guard remains fail-closed."
  },
  {
    feature: "Players/testers detail",
    mode: "read-only",
    status: source === "runtime" ? "Runtime player projection enabled" : "Demo/sample fallback visible",
    risk: "Medium: playerId is displayed as state reference, never identity proof."
  },
  {
    feature: "Map/district detail",
    mode: "read-only",
    status: source === "runtime" ? "Runtime district projection enabled" : "Demo/sample fallback visible",
    risk: "Medium: district writes require server command/audit."
  },
  {
    feature: "Economy/production/police/orders",
    mode: "read-only",
    status: source === "runtime" ? "Runtime detail rows enabled" : "Sample rows explain expected layout",
    risk: "Low: UI observes only and never resolves gameplay state."
  },
  {
    feature: "Server preset builder",
    mode: "mock",
    status: "Draft JSON export only",
    risk: "Low: no live mutation."
  },
  {
    feature: "Messages and moderation",
    mode: "locked",
    status: "Visible but disabled",
    risk: "High until role guard, audit log, and command endpoint exist."
  },
  {
    feature: "Future gameplay interventions",
    mode: "future-server-only",
    status: "Disabled with requirements",
    risk: "High if implemented before server-authoritative persistence."
  }
];

const mergeProjectionEvents = (
  projection: AdminRuntimeDetailProjection,
  overview: AdminOverviewViewModel
): AdminRuntimeEventProjection[] => [
  ...projection.events,
  ...overview.selectedLogs.diagnostics.map((diagnostic) => ({
    id: sanitizeAdminDisplayText(diagnostic.id),
    type: sanitizeAdminDisplayText(diagnostic.category),
    severity: diagnostic.level === "error" ? "error" as const : diagnostic.level === "warn" ? "warning" as const : "notice" as const,
    playerId: null,
    districtId: null,
    createdAt: diagnostic.occurredAt,
    tick: null,
    summary: sanitizeAdminDisplayText(diagnostic.message),
    payloadPreview: "",
    source: "runtime" as const
  })),
  ...overview.selectedLogs.events.map((event) => ({
    id: sanitizeAdminDisplayText(event.id),
    type: sanitizeAdminDisplayText(event.eventType),
    severity: "notice" as const,
    playerId: null,
    districtId: null,
    createdAt: event.recordedAt,
    tick: event.tickAtEmit,
    summary: event.causedByCommandId
      ? sanitizeAdminDisplayText(`Caused by ${event.causedByCommandId}`)
      : "Runtime event",
    payloadPreview: "",
    source: "runtime" as const
  }))
].slice(-60);

const createDefaultPresetDraft = (): AdminPresetDraft => ({
  name: "Free demo staging preset",
  mode: "free",
  mapPreset: "empire-streets-city",
  startingCash: 1200,
  startingDirtyCash: 0,
  startingPopulation: 250,
  startingMaterials: 120,
  startingWeapons: 0,
  heatStart: 50,
  enabledSystems: [
    "onboarding",
    "production",
    "police-heat",
    "spy-orders"
  ],
  validationStatus: "Draft shape valid; not applied to live runtime.",
  notes: "Draft only. Export JSON for review; do not apply to live state from admin UI v1.1.",
  draftOnly: true
});

const createLockedControls = (): AdminLockedControl[] => [
  lockedControl("grant-resources", "Grant resources / money", "Resource grants require server-side command validation and audit trail."),
  lockedControl("set-district-owner", "Set district owner", "District ownership is gameplay authority and cannot be edited from UI."),
  lockedControl("reset-server", "Reset server instance", "Reset needs transaction boundary, confirmation, and rollback notes."),
  lockedControl("start-war-season", "Start War season", "Season phase changes need role guard and expected state version."),
  lockedControl("broadcast-live-message", "Broadcast live message", "Live broadcast needs safe server command endpoint and audit record."),
  lockedControl("kick-ban-player", "Kick / ban player", "Moderation needs production identity, role guard, and appeal/audit model."),
  lockedControl("force-cooldown-resolve", "Force cooldown resolve", "Cooldown manipulation is gameplay power and must stay server-only."),
  lockedControl("trigger-city-event", "Trigger city event", "City events need dry-run, idempotency, and rollback/compensation plan.")
];

const lockedControl = (
  id: string,
  label: string,
  disabledReason: string
): AdminLockedControl => ({
  id,
  label,
  mode: "future-server-only",
  disabledReason,
  requirements: [
    "server-authoritative admin command endpoint",
    "role guard",
    "audit log",
    "expected state version",
    "dry-run",
    "confirmation modal",
    "transaction boundary"
  ],
  auditLogRequired: true,
  rollbackRequired: true
});

const sanitizeRuntimeProjection = (
  projection: AdminRuntimeDetailProjection
): AdminRuntimeDetailProjection => ({
  ...projection,
  players: projection.players.map((player) => ({
    ...player,
    playerId: sanitizeAdminDisplayText(player.playerId),
    displayName: sanitizeAdminDisplayText(player.displayName),
    factionId: sanitizeAdminDisplayText(player.factionId),
    factionName: sanitizeAdminDisplayText(player.factionName),
    ownedDistrictIds: player.ownedDistrictIds.map(sanitizeAdminDisplayText),
    warnings: player.warnings.map(sanitizeAdminDisplayText)
  })),
  districts: projection.districts.map((district) => ({
    ...district,
    districtId: sanitizeAdminDisplayText(district.districtId),
    name: sanitizeAdminDisplayText(district.name),
    zone: sanitizeAdminDisplayText(district.zone),
    ownerPlayerId: district.ownerPlayerId ? sanitizeAdminDisplayText(district.ownerPlayerId) : null,
    ownerName: district.ownerName ? sanitizeAdminDisplayText(district.ownerName) : null,
    warnings: district.warnings.map(sanitizeAdminDisplayText)
  })),
  events: projection.events.map((event) => ({
    ...event,
    id: sanitizeAdminDisplayText(event.id),
    type: sanitizeAdminDisplayText(event.type),
    playerId: event.playerId ? sanitizeAdminDisplayText(event.playerId) : null,
    districtId: event.districtId ? sanitizeAdminDisplayText(event.districtId) : null,
    summary: sanitizeAdminDisplayText(event.summary),
    payloadPreview: sanitizeAdminDisplayText(event.payloadPreview)
  }))
});

const createDemoSampleRuntimeProjection = (
  overview: AdminOverviewViewModel,
  generatedAt: string
): AdminRuntimeDetailProjection => {
  const selectedInstanceId = overview.instances[0]?.instanceId ?? null;
  const players: AdminRuntimePlayerProjection[] = [
    {
      playerId: "sample:player:neon-boss",
      displayName: "Neon Boss",
      factionId: "mafian",
      factionName: "Mafian",
      status: "active",
      homeDistrictId: "1",
      ownedDistrictCount: 1,
      ownedDistrictIds: ["1"],
      resources: { cash: 5160, "dirty-cash": 540, chemicals: 5, "combat-module": 2 },
      keyResources: { cash: 5160, "dirty-cash": 540, chemicals: 5, "combat-module": 2 },
      cash: 5160,
      dirtyCash: 540,
      population: 250,
      influence: 5,
      heat: 50,
      wantedLevel: 2,
      onboarding: {
        status: "completed",
        progressLabel: "7 / 7",
        source: "demo-sample",
        note: "Sample row; runtime player projection not attached."
      },
      activeOrdersCount: 2,
      activeMissionsCount: 2,
      lastActionAt: generatedAt,
      warnings: ["Sample data; verify runtime source before ops decisions."],
      source: "demo-sample"
    },
    {
      playerId: "sample:player:chrome-saint",
      displayName: "Chrome Saint",
      factionId: "cartel",
      factionName: "Cartel",
      status: "active",
      homeDistrictId: "6",
      ownedDistrictCount: 2,
      ownedDistrictIds: ["6", "7"],
      resources: { cash: 3880, "dirty-cash": 1120, "metal-parts": 9, weapons: 4 },
      keyResources: { cash: 3880, "dirty-cash": 1120, "metal-parts": 9, weapons: 4 },
      cash: 3880,
      dirtyCash: 1120,
      population: 310,
      influence: 12,
      heat: 88,
      wantedLevel: 3,
      onboarding: {
        status: "completed",
        progressLabel: "7 / 7",
        source: "demo-sample",
        note: "Sample row; runtime player projection not attached."
      },
      activeOrdersCount: 1,
      activeMissionsCount: 1,
      lastActionAt: generatedAt,
      warnings: ["Medium heat sample."],
      source: "demo-sample"
    }
  ];
  const districts: AdminRuntimeDistrictProjection[] = [
    districtSample("1", "District 1", "commercial", "sample:player:neon-boss", "Neon Boss", "claimed", 250, 5, 50, 2, 1, "1 production / 0 craft", 2, true, false, []),
    districtSample("2", "District 2", "residential", null, null, "neutral", null, 0, 12, 1, 0, "no owner", 1, true, false, []),
    districtSample("3", "District 3", "industrial", null, null, "neutral", null, 0, 118, 2, 0, "loot available", 1, false, false, ["High district heat sample."]),
    districtSample("4", "Downtown 4", "downtown", null, null, "locked", null, 0, 22, 3, 0, "downtown closed", 0, false, true, ["Downtown district closed until final lockdown."]),
    districtSample("6", "District 6", "commercial", "sample:player:chrome-saint", "Chrome Saint", "claimed", 310, 7, 44, 2, 0, "cashflow active", 0, true, false, [])
  ];
  const events: AdminRuntimeEventProjection[] = [
    {
      id: "sample:event:spy",
      type: "spy-mission-started",
      severity: "notice",
      createdAt: generatedAt,
      tick: 1842,
      playerId: "sample:player:neon-boss",
      districtId: "2",
      summary: "Sample spy mission running against District 2.",
      payloadPreview: "{\"sample\":true}",
      source: "demo-sample"
    },
    {
      id: "sample:event:police",
      type: "police-heat-warning",
      severity: "warning",
      createdAt: generatedAt,
      tick: 1842,
      playerId: "sample:player:chrome-saint",
      districtId: "3",
      summary: "Sample district heat crossed medium pressure.",
      payloadPreview: "{\"sample\":true}",
      source: "demo-sample"
    }
  ];

  return {
    generatedAt,
    selectedInstanceId,
    source: "demo-sample",
    stale: {
      isStale: false,
      thresholdSeconds: 30,
      ageSeconds: 0,
      checkedAt: generatedAt,
      source: "demo-sample",
      reason: "Static demo/sample projection; not a live runtime age."
    },
    projectionHealth: [
      sampleHealth("servers", "warning", generatedAt, "Runtime endpoint did not attach detail projection; showing sample layout."),
      sampleHealth("players", "warning", generatedAt, "Player rows are sample data."),
      sampleHealth("districts", "warning", generatedAt, "District rows are sample data."),
      sampleHealth("economy", "warning", generatedAt, "Economy totals are sample data."),
      sampleHealth("production", "warning", generatedAt, "Production rows are sample data."),
      sampleHealth("police", "warning", generatedAt, "Police/heat rows are sample data."),
      sampleHealth("orders", "warning", generatedAt, "Order rows are sample data."),
      sampleHealth("events", "warning", generatedAt, "Events are sample data.")
    ],
    liveness: {
      activePlayers: players.filter((player) => player.status === "active").length,
      playablePlayers: 0,
      temporarilySealedPlayers: 0,
      encircledPlayers: 0,
      lastStandPlayers: 0,
      emergencyRecoveryEligiblePlayers: 0,
      invalidSoftlocks: 0,
      stateCounts: {},
      blockingReasonCounts: {},
      invalidPlayerIds: []
    },
    players,
    districts,
    economy: {
      source: "demo-sample",
      totalCleanCash: 9040,
      totalDirtyCash: 1660,
      totalResources: { cash: 9040, "dirty-cash": 1660, chemicals: 5, "metal-parts": 9, weapons: 4, "combat-module": 2 },
      topResourceHolders: [
        { playerId: "sample:player:neon-boss", displayName: "Neon Boss", resourceKey: "cash", amount: 5160 },
        { playerId: "sample:player:chrome-saint", displayName: "Chrome Saint", resourceKey: "cash", amount: 3880 },
        { playerId: "sample:player:chrome-saint", displayName: "Chrome Saint", resourceKey: "dirty-cash", amount: 1120 }
      ],
      productionOutputSummary: { chemicals: 2, "combat-module": 1 },
      marketRiskNotes: ["Sample only. No grants or live price changes enabled."],
      warnings: ["Projection source is demo/sample, not runtime."]
    },
    production: {
      source: "demo-sample",
      activeProductionBuildings: [
        {
          buildingId: "sample:building:restaurant",
          buildingTypeId: "restaurant",
          displayName: "Restaurace",
          districtId: "1",
          ownerPlayerId: "sample:player:neon-boss",
          resourceKey: "cash",
          resourceLabel: "Clean cash",
          stored: 180,
          storageCap: 360,
          readyToCollect: true,
          storageFull: false,
          source: "demo-sample"
        }
      ],
      readyCollectCount: 1,
      storageFullCount: 0,
      activeCraftJobs: [
        {
          buildingId: "sample:building:clinic",
          buildingTypeId: "clinic",
          districtId: "6",
          ownerPlayerId: "sample:player:chrome-saint",
          recipeId: "stim-pack",
          recipeLabel: "Stim Pack",
          startedTick: 1838,
          completesTick: 1844,
          remainingTicks: 2,
          remainingLabel: "0:10",
          source: "demo-sample"
        }
      ],
      bottleneckResources: [{ resourceKey: "tech-core", total: 0, warning: "No stock visible." }],
      cooldowns: [
        { ownerType: "building", ownerId: "sample:building:restaurant", key: "restaurant_collect_revenue", remainingTicks: 360, remainingLabel: "30:00", source: "demo-sample" }
      ],
      warnings: ["Production projection is sample fallback."]
    },
    police: {
      source: "demo-sample",
      heatPressure: "medium",
      wantedPlayers: [
        { playerId: "sample:player:chrome-saint", displayName: "Chrome Saint", heat: 88, wantedLevel: 3, activeFlags: ["watched"] },
        { playerId: "sample:player:neon-boss", displayName: "Neon Boss", heat: 50, wantedLevel: 2, activeFlags: [] }
      ],
      districtHotspots: [
        { districtId: "3", name: "District 3", heat: 118, ownerPlayerId: null },
        { districtId: "1", name: "District 1", heat: 50, ownerPlayerId: "sample:player:neon-boss" }
      ],
      pendingRaids: [
        {
          raidId: "sample:raid:1",
          playerId: "sample:player:chrome-saint",
          targetDistrictId: "3",
          severity: "medium",
          status: "pending",
          reason: "Sample pending raid pressure.",
          createdAtTick: 1830,
          expiresAtTick: 1860,
          remainingTicks: 18,
          sourcePressure: 88
        }
      ],
      pendingRaidCount: 1,
      resolvedRecentEvents: [],
      warnings: ["Police data is sample fallback."]
    },
    orders: [
      {
        id: "sample:order:spy",
        type: "spy",
        playerId: "sample:player:neon-boss",
        playerName: "Neon Boss",
        sourceDistrictId: "1",
        targetDistrictId: "2",
        status: "cooldown / action running",
        startedAtTick: 1838,
        resolvesAtTick: 1848,
        remainingTicks: 6,
        remainingLabel: "0:30",
        result: "pending",
        warnings: [],
        source: "demo-sample"
      },
      {
        id: "sample:order:attack",
        type: "attack",
        playerId: "sample:player:chrome-saint",
        playerName: "Chrome Saint",
        sourceDistrictId: "6",
        targetDistrictId: "3",
        status: "cooldown / action running",
        startedAtTick: 1830,
        resolvesAtTick: 2100,
        remainingTicks: 258,
        remainingLabel: "21:30",
        result: "pending",
        warnings: ["Long attack/order wait sample."],
        source: "demo-sample"
      }
    ],
    events
  };
};

const districtSample = (
  districtId: string,
  name: string,
  zone: string,
  ownerPlayerId: string | null,
  ownerName: string | null,
  status: string,
  population: number | null,
  influence: number,
  heat: number,
  buildingCount: number,
  activeBuildingActionsCount: number,
  productionStatus: string,
  activeOrderCount: number,
  isSpawnCandidate: boolean,
  isDowntown: boolean,
  warnings: string[]
): AdminRuntimeDistrictProjection => ({
  districtId,
  name,
  zone,
  ownerPlayerId,
  ownerName,
  status,
  population,
  influence,
  heat,
  buildingCount,
  activeBuildingActionsCount,
  productionStatus,
  activeOrderCount,
  isSpawnCandidate,
  isDowntown,
  warnings,
  source: "demo-sample"
});

const sampleHealth = (
  name: string,
  status: AdminProjectionHealth["status"],
  generatedAt: string,
  message: string
): AdminProjectionHealth => ({
  name,
  status,
  lastUpdatedAt: generatedAt,
  missingFields: ["runtimeProjection"],
  source: "demo-sample",
  message
});
