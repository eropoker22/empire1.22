(function() {
  "use strict";
  const createAdminAppShell = (shell) => shell;
  let runtimeAdminMonitoringSecret = null;
  const resolveAdminMonitoringSecret = (configuredSecret) => {
    const explicitSecret = configuredSecret == null ? void 0 : configuredSecret.trim();
    if (explicitSecret) {
      return explicitSecret;
    }
    const runtimeSecret = readRuntimeAdminMonitoringSecret();
    if (runtimeSecret) {
      return runtimeSecret;
    }
    return runtimeAdminMonitoringSecret;
  };
  const setRuntimeAdminMonitoringSecret = (secret) => {
    const normalizedSecret = String(secret ?? "").trim();
    runtimeAdminMonitoringSecret = normalizedSecret || null;
  };
  const readRuntimeAdminMonitoringSecret = () => {
    var _a;
    const secret = (_a = globalThis.__EMPIRE_ADMIN_SECRET__) == null ? void 0 : _a.trim();
    return secret || null;
  };
  const SECRET_ASSIGNMENT_PATTERN = /\b(sessionToken|snapshotToken|adminToken|authorization|cookie|set-cookie|password|secret|databaseUrl|database_url|dbUrl|db_url|EMPIRE_ADMIN_SECRET|DATABASE_URL|SESSION_TOKEN|GAMEPLAY_SESSION_TOKEN)\b\s*[:=]\s*("[^"]+"|'[^']+'|[^\s,;]+)/gi;
  const SECRET_QUERY_PATTERN = /([?&](?:secret|token|password|sessionToken|snapshotToken|key)=)[^&#\s]+/gi;
  const SUSPICIOUS_KEY_QUERY_PATTERN = /([?&][a-z0-9_-]*key=)(?:eyJ[a-zA-Z0-9_-]+|\w{24,})[^&#\s]*/gi;
  const POSTGRES_URL_PATTERN = /postgres(?:ql)?:\/\/[^\s<>"']+/gi;
  const BEARER_PATTERN = /\bbearer\s+[a-z0-9._~+/=-]{16,}/gi;
  const COOKIE_HEADER_PATTERN = /\b(set-cookie|cookie|authorization)\b\s*:\s*[^\r\n]+/gi;
  const JWT_LIKE_PATTERN = /\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\b/g;
  const sanitizeAdminDisplayText = (value) => value.replace(POSTGRES_URL_PATTERN, "postgres://[redacted]").replace(SECRET_ASSIGNMENT_PATTERN, "$1=[redacted]").replace(SECRET_QUERY_PATTERN, "$1[redacted]").replace(SUSPICIOUS_KEY_QUERY_PATTERN, "$1[redacted]").replace(BEARER_PATTERN, "Bearer [redacted]").replace(COOKIE_HEADER_PATTERN, "$1: [redacted]").replace(JWT_LIKE_PATTERN, "[redacted-jwt]");
  const createAdminInstanceViewModel = (summary, health, diagnostics, activity = {
    commandCount: 0,
    eventCount: 0,
    diagnosticWarningCount: 0
  }) => ({
    instanceId: summary.instanceId,
    mode: summary.mode,
    status: summary.status,
    displayName: summary.instanceId,
    region: "unknown",
    tick: summary.tick,
    currentTick: summary.tick,
    playerCount: summary.playerCount,
    allianceCount: summary.allianceCount,
    crashCount: 0,
    healthStatus: health.status,
    warningCount: health.warnings.length,
    lastSnapshotAt: diagnostics.lastSnapshotAt,
    lastTickStartedAt: null,
    lastTickCompletedAt: null,
    totalCommands: activity.commandCount,
    commandCount: activity.commandCount,
    eventCount: activity.eventCount,
    diagnosticErrorCount: diagnostics.diagnosticErrorCount,
    diagnosticWarningCount: activity.diagnosticWarningCount,
    lastErrorAt: health.lastErrorAt ?? diagnostics.lastCrashAt,
    queuedEvents: 0,
    queuedEventCount: 0
  });
  const createAdminInstanceViewModelFromMonitoringSummary = (summary) => ({
    instanceId: summary.instanceId,
    mode: summary.mode,
    status: summary.status,
    displayName: summary.displayName,
    region: summary.region,
    tick: summary.currentTick,
    currentTick: summary.currentTick,
    playerCount: summary.playerCount,
    allianceCount: summary.allianceCount,
    crashCount: summary.crashCount,
    healthStatus: summary.healthStatus,
    warningCount: summary.warningCount,
    lastSnapshotAt: summary.lastSnapshotAt,
    lastTickStartedAt: summary.lastTickStartedAt,
    lastTickCompletedAt: summary.lastTickCompletedAt,
    totalCommands: summary.commandCount,
    commandCount: summary.commandCount,
    eventCount: summary.eventCount,
    diagnosticErrorCount: summary.diagnosticErrorCount,
    diagnosticWarningCount: 0,
    lastErrorAt: summary.lastErrorAt,
    queuedEvents: summary.queuedEventCount,
    queuedEventCount: summary.queuedEventCount
  });
  const createAdminDashboardReadModel = (overview, options = {}) => {
    const generatedAt = options.generatedAt ?? (/* @__PURE__ */ new Date()).toISOString();
    const runtimeProjection = overview.runtimeProjection ? sanitizeRuntimeProjection(overview.runtimeProjection) : createDemoSampleRuntimeProjection(overview, generatedAt);
    const selectedInstance = overview.instances.find((instance) => instance.instanceId === overview.selectedInstanceId) ?? overview.instances[0] ?? null;
    return {
      generatedAt,
      environment: {
        label: runtimeProjection.source === "runtime" ? "DEMO / STAGING" : runtimeProjection.source === "demo-sample" ? "DEMO SAMPLE" : "STATIC PREVIEW",
        runtimeMarker: runtimeProjection.source === "runtime" ? "demo-ready read model v1.1" : "projection sample / not live",
        authStatus: "Header guarded endpoint; secret is never persisted by UI",
        staleAfterSeconds: runtimeProjection.stale.thresholdSeconds
      },
      stale: runtimeProjection.stale,
      projectionSource: runtimeProjection.source,
      projectionHealth: runtimeProjection.projectionHealth,
      scope: createScopeItems(runtimeProjection.source),
      servers: overview.instances.map((instance) => {
        const server = overview.serverSummaries.find((entry) => entry.serverInstanceId === instance.instanceId);
        const selectedServerOrders = instance.instanceId === (selectedInstance == null ? void 0 : selectedInstance.instanceId) ? runtimeProjection.orders.length : 0;
        const selectedServerOwnedDistricts = instance.instanceId === (selectedInstance == null ? void 0 : selectedInstance.instanceId) ? runtimeProjection.districts.filter((district) => district.ownerPlayerId).length : 0;
        return {
          serverInstanceId: instance.instanceId,
          displayName: (server == null ? void 0 : server.displayName) ?? instance.displayName,
          mode: (server == null ? void 0 : server.mode) ?? instance.mode,
          status: instance.status,
          runtimeMarker: runtimeProjection.source === "runtime" ? "runtime projection" : "sample projection",
          phase: (server == null ? void 0 : server.phase) ?? "monitoring-only",
          tick: instance.currentTick,
          stateVersion: `tick:${instance.currentTick}`,
          playerCount: instance.playerCount,
          districtCount: (server == null ? void 0 : server.map.totalDistricts) ?? runtimeProjection.districts.length,
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
        runtimeProjection.source === "runtime" ? "Admin v1.1 reads runtime projections only. It still cannot mutate live gameplay state." : "This view is using demo/sample projection data because runtime detail projection was not attached.",
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
  const createScopeItems = (source) => [
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
  const mergeProjectionEvents = (projection, overview) => [
    ...projection.events,
    ...overview.selectedLogs.diagnostics.map((diagnostic) => ({
      id: sanitizeAdminDisplayText(diagnostic.id),
      type: sanitizeAdminDisplayText(diagnostic.category),
      severity: diagnostic.level === "error" ? "error" : diagnostic.level === "warn" ? "warning" : "notice",
      playerId: null,
      districtId: null,
      createdAt: diagnostic.occurredAt,
      tick: null,
      summary: sanitizeAdminDisplayText(diagnostic.message),
      payloadPreview: "",
      source: "runtime"
    })),
    ...overview.selectedLogs.events.map((event) => ({
      id: sanitizeAdminDisplayText(event.id),
      type: sanitizeAdminDisplayText(event.eventType),
      severity: "notice",
      playerId: null,
      districtId: null,
      createdAt: event.recordedAt,
      tick: event.tickAtEmit,
      summary: event.causedByCommandId ? sanitizeAdminDisplayText(`Caused by ${event.causedByCommandId}`) : "Runtime event",
      payloadPreview: "",
      source: "runtime"
    }))
  ].slice(-60);
  const createDefaultPresetDraft = () => ({
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
  const createLockedControls = () => [
    lockedControl("grant-resources", "Grant resources / money", "Resource grants require server-side command validation and audit trail."),
    lockedControl("set-district-owner", "Set district owner", "District ownership is gameplay authority and cannot be edited from UI."),
    lockedControl("reset-server", "Reset server instance", "Reset needs transaction boundary, confirmation, and rollback notes."),
    lockedControl("start-war-season", "Start War season", "Season phase changes need role guard and expected state version."),
    lockedControl("broadcast-live-message", "Broadcast live message", "Live broadcast needs safe server command endpoint and audit record."),
    lockedControl("kick-ban-player", "Kick / ban player", "Moderation needs production identity, role guard, and appeal/audit model."),
    lockedControl("force-cooldown-resolve", "Force cooldown resolve", "Cooldown manipulation is gameplay power and must stay server-only."),
    lockedControl("trigger-city-event", "Trigger city event", "City events need dry-run, idempotency, and rollback/compensation plan.")
  ];
  const lockedControl = (id, label, disabledReason) => ({
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
  const sanitizeRuntimeProjection = (projection) => ({
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
  const createDemoSampleRuntimeProjection = (overview, generatedAt) => {
    var _a;
    const selectedInstanceId = ((_a = overview.instances[0]) == null ? void 0 : _a.instanceId) ?? null;
    const players = [
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
    const districts = [
      districtSample("1", "District 1", "commercial", "sample:player:neon-boss", "Neon Boss", "claimed", 250, 5, 50, 2, 1, "1 production / 0 craft", 2, true, false, []),
      districtSample("2", "District 2", "residential", null, null, "neutral", null, 0, 12, 1, 0, "no owner", 1, true, false, []),
      districtSample("3", "District 3", "industrial", null, null, "neutral", null, 0, 118, 2, 0, "loot available", 1, false, false, ["High district heat sample."]),
      districtSample("4", "Downtown 4", "downtown", null, null, "locked", null, 0, 22, 3, 0, "downtown closed", 0, false, true, ["Downtown district closed until final lockdown."]),
      districtSample("6", "District 6", "commercial", "sample:player:chrome-saint", "Chrome Saint", "claimed", 310, 7, 44, 2, 0, "cashflow active", 0, true, false, [])
    ];
    const events = [
      {
        id: "sample:event:spy",
        type: "spy-mission-started",
        severity: "notice",
        createdAt: generatedAt,
        tick: 1842,
        playerId: "sample:player:neon-boss",
        districtId: "2",
        summary: "Sample spy mission running against District 2.",
        payloadPreview: '{"sample":true}',
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
        payloadPreview: '{"sample":true}',
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
  const districtSample = (districtId, name, zone, ownerPlayerId, ownerName, status, population, influence, heat, buildingCount, activeBuildingActionsCount, productionStatus, activeOrderCount, isSpawnCandidate, isDowntown, warnings) => ({
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
  const sampleHealth = (name, status, generatedAt, message) => ({
    name,
    status,
    lastUpdatedAt: generatedAt,
    missingFields: ["runtimeProjection"],
    source: "demo-sample",
    message
  });
  const createAdminOverviewViewModel = (instances, options = {}) => {
    var _a, _b, _c, _d, _e;
    const selectedInstanceId = ((_a = options.selectedLogs) == null ? void 0 : _a.instanceId) ?? ((_b = instances[0]) == null ? void 0 : _b.instanceId) ?? null;
    return {
      instances,
      serverSummaries: options.serverSummaries ?? [],
      healthSummary: options.healthSummary ?? {
        totalInstances: instances.length,
        runningInstances: instances.filter((instance) => instance.status === "running").length,
        crashedInstances: instances.filter((instance) => instance.status === "crashed").length
      },
      selectedInstanceId,
      selectedHealth: options.selectedHealth ?? null,
      selectedDiagnostics: options.selectedDiagnostics ?? null,
      selectedLogs: {
        instanceId: selectedInstanceId,
        commands: ((_c = options.selectedLogs) == null ? void 0 : _c.commands) ?? [],
        events: ((_d = options.selectedLogs) == null ? void 0 : _d.events) ?? [],
        diagnostics: ((_e = options.selectedLogs) == null ? void 0 : _e.diagnostics) ?? []
      },
      runtimeProjection: options.runtimeProjection ?? null
    };
  };
  const fetchAdminOverviewFromEndpoint = async (endpoint, configuredSecret) => {
    var _a;
    if (typeof fetch === "undefined") {
      return null;
    }
    const secret = resolveAdminMonitoringSecret(configuredSecret);
    const headers = {
      accept: "application/json"
    };
    if (secret) {
      headers["x-empire-admin-secret"] = secret;
    }
    const response = await fetch(endpoint, { headers });
    if (!response.ok) {
      throw await createAdminMonitoringError(response);
    }
    const payload = await response.json();
    if ((_a = payload.overview) == null ? void 0 : _a.instances) {
      return {
        ...payload.overview,
        runtimeProjection: payload.overview.runtimeProjection ?? payload.runtimeProjection ?? null
      };
    }
    return Array.isArray(payload.instances) ? createAdminOverviewViewModel(payload.instances.map(createAdminInstanceViewModelFromMonitoringSummary), {
      serverSummaries: payload.serverSummaries ?? [],
      healthSummary: payload.healthSummary,
      runtimeProjection: payload.runtimeProjection ?? null
    }) : null;
  };
  const renderAdminError = (error) => `
  <section class="admin-monitoring" role="alert">
    <p class="admin-boot__eyebrow">Runtime monitoring</p>
    <h1>Empire Streets Admin</h1>
    <p>Admin monitoring se nepodařilo načíst.</p>
    ${isAdminUnauthorizedError(error) ? `
      <form class="admin-monitoring__secret-form" data-admin-secret-form>
        <label class="admin-monitoring__secret-field">
          <span>Admin secret</span>
          <input data-admin-secret-input type="password" autocomplete="off" placeholder="Zadej EMPIRE_ADMIN_SECRET">
        </label>
        <button type="submit">Retry with secret</button>
        <p>Secret se drží jen v paměti stránky a posílá se pouze v headeru <code>x-empire-admin-secret</code>.</p>
      </form>
    ` : ""}
    <pre>${escapeHtml$1(error instanceof Error ? error.message : String(error))}</pre>
  </section>
`;
  const bindAdminSecretForm = (target, retry) => {
    if (typeof target.querySelector !== "function") {
      return;
    }
    const form = target.querySelector("[data-admin-secret-form]");
    const input = target.querySelector("[data-admin-secret-input]");
    if (!form || !input) {
      return;
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      setRuntimeAdminMonitoringSecret(input.value);
      void retry();
    });
  };
  const createAdminMonitoringError = async (response) => {
    var _a, _b;
    const payload = await response.json().catch(() => null);
    const message = ((_b = (_a = payload == null ? void 0 : payload.errors) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) ?? `Admin monitoring request failed with HTTP ${response.status}.`;
    const error = new Error(message);
    error.statusCode = response.status;
    return error;
  };
  const isAdminUnauthorizedError = (error) => error instanceof Error && typeof error.statusCode === "number" && error.statusCode === 403;
  const escapeHtml$1 = (value) => value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character] ?? character);
  const NAV_ITEMS = [
    ["overview", "Overview", "runtime"],
    ["servers", "Servers", "instances"],
    ["players", "Players", "testers"],
    ["map", "Map", "districts"],
    ["economy", "Economy", "resources"],
    ["production", "Production", "craft"],
    ["police", "Police/Heat", "risk"],
    ["orders", "Orders/Missions", "async"],
    ["events", "Events/Logs", "diagnostics"],
    ["presets", "Presets", "draft"],
    ["messages", "Messages", "locked"],
    ["future-controls", "Future Controls", "locked"],
    ["checklist", "Checklist", "ops"]
  ];
  const renderInstanceListPage = (input) => {
    var _a;
    const overview = normalizeOverview(input);
    const dashboard = createAdminDashboardReadModel(overview);
    const selectedInstance = overview.instances.find((instance) => instance.instanceId === overview.selectedInstanceId) ?? overview.instances[0] ?? null;
    const freeServer = overview.serverSummaries.find((server) => server.mode === "free") ?? null;
    const warServer = overview.serverSummaries.find((server) => server.mode === "war") ?? null;
    const latestCommand = overview.selectedLogs.commands.at(-1) ?? null;
    const latestError = overview.selectedLogs.diagnostics.filter((diagnostic) => diagnostic.level === "error" || diagnostic.level === "warn").at(-1) ?? null;
    return `
    ${renderSidebar(dashboard)}
    <section class="admin-main admin-ops" aria-labelledby="admin-ops-title">
      ${renderTopbar(dashboard, (freeServer == null ? void 0 : freeServer.joinable) ?? false, (warServer == null ? void 0 : warServer.joinable) ?? false)}
      <div class="admin-content">
        <section class="admin-section">
          <div class="admin-section__head">
            <div>
              <p>Operations Console v1.1</p>
              <h2 id="admin-ops-title">Read-only DEMO/STAGING observability</h2>
            </div>
            <div class="admin-actions--top">
              ${renderBadge("READ ONLY", "info")}
              ${renderBadge("NO LIVE WRITES", "critical")}
              ${renderSourceBadge(dashboard.projectionSource)}
            </div>
          </div>
          ${overview.instances.length === 0 ? renderEmptyState() : ""}
          ${renderOverviewSection(dashboard, {
      selectedInstance,
      latestCommand: (latestCommand == null ? void 0 : latestCommand.commandType) ?? "Neni dostupne",
      latestError: (latestError == null ? void 0 : latestError.message) ?? (selectedInstance == null ? void 0 : selectedInstance.lastErrorAt) ?? "No recent error",
      healthWarnings: ((_a = overview.selectedHealth) == null ? void 0 : _a.warnings) ?? []
    })}
          ${renderServersSection(dashboard)}
          ${renderPlayersSection(dashboard)}
          ${renderMapSection(dashboard)}
          ${renderEconomySection(dashboard)}
          ${renderProductionSection(dashboard)}
          ${renderPoliceSection(dashboard)}
          ${renderOrdersSection(dashboard)}
          ${renderEventsLogsSection(dashboard, overview)}
          ${renderPresetsSection(dashboard)}
          ${renderMessagesSection()}
          ${renderFutureControlsSection(dashboard)}
          ${renderChecklistSection(dashboard)}
        </section>
      </div>
    </section>
  `;
  };
  const normalizeOverview = (input) => {
    var _a;
    return Array.isArray(input) ? createAdminOverviewViewModel(input, {
      selectedLogs: {
        instanceId: ((_a = input[0]) == null ? void 0 : _a.instanceId) ?? null,
        commands: [],
        events: [],
        diagnostics: []
      }
    }) : input;
  };
  const renderSidebar = (dashboard) => `
  <aside class="admin-sidebar" aria-label="Admin sections">
    <div class="admin-brand">
      <span class="admin-brand__mark">ES</span>
      <div>
        <p>Empire Streets</p>
        <strong>Admin Ops</strong>
      </div>
      ${renderBadge("v1.1", "info")}
    </div>
    <nav class="admin-nav" aria-label="Operations Console navigation">
      ${NAV_ITEMS.map(([id, label, description], index) => `
        <a class="admin-nav__item ${index === 0 ? "is-active" : ""}" href="#admin-${id}">
          <span class="admin-nav__dot"></span>
          <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></span>
        </a>
      `).join("")}
    </nav>
    <div class="admin-sidebar-card">
      <span>Projection source</span>
      <strong data-admin-projection-source>${escapeHtml(dashboard.projectionSource)}</strong>
      <p>${escapeHtml(dashboard.stale.reason)} Write controls stay locked.</p>
    </div>
  </aside>
`;
  const renderTopbar = (dashboard, freeJoinable, warJoinable) => `
  <header class="admin-topbar">
    <div class="admin-topbar__title">
      <p>Manual refresh / read model</p>
      <h1>Empire Streets Admin Dashboard</h1>
    </div>
    <div class="admin-topbar__controls">
      ${renderStatusField("Environment", dashboard.environment.label)}
      ${renderStatusField("Auth", "Header guard")}
      ${renderStatusField("Last refresh", dashboard.generatedAt)}
      ${renderStatusField("Stale", dashboard.stale.isStale ? "stale" : "fresh")}
      ${renderBadge(freeJoinable ? "FREE OPEN" : "FREE", freeJoinable ? "success" : "warning")}
      ${renderBadge(warJoinable ? "WAR OPEN" : "WAR CLOSED", warJoinable ? "danger" : "critical")}
      <button class="admin-button admin-button--primary" type="button" data-admin-refresh>Refresh</button>
    </div>
  </header>
`;
  const renderStatusField = (label, value) => `
  <div class="admin-profile">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
  </div>
`;
  const renderEmptyState = () => `
  <section class="admin-panel" role="status">
    <div class="admin-panel__head">
      <div>
        <span>Runtime monitoring</span>
        <h3>Žádné instance</h3>
      </div>
      ${renderBadge("STATIC PREVIEW", "warning")}
    </div>
    <p class="admin-copy">Monitoring endpoint odpověděl, ale runtime zatím nevrací žádné server instance. Konzole zobrazuje demo/sample projekci, locked controls, preset draft a operační checklist.</p>
  </section>
`;
  const renderOverviewSection = (dashboard, input) => {
    var _a, _b, _c, _d;
    return `
  <section id="admin-overview" class="admin-section-anchor">
    <div class="admin-metrics">
      ${renderMetric("Servers", String(dashboard.servers.length), `${dashboard.servers.filter((server) => server.status === "running").length} running`)}
      ${renderMetric("Players", String(dashboard.players.length), "detail projection")}
      ${renderMetric("Districts", String(dashboard.districts.length), `${dashboard.districts.filter((district) => district.ownerPlayerId).length} owned`)}
      ${renderMetric("Active orders", String(dashboard.orders.length), "cooldown/order projection")}
      ${renderMetric("Pending raids", String(dashboard.police.pendingRaidCount), dashboard.police.heatPressure)}
      ${renderMetric("Production ready", String(dashboard.production.readyCollectCount), `${dashboard.production.storageFullCount} storage full`)}
      ${renderMetric("Latest command", input.latestCommand, "Recent commands")}
      ${renderMetric("Last error", input.latestError, "Selected instance")}
    </div>
    <div class="admin-grid admin-grid--overview">
      <article class="admin-panel">
        <div class="admin-panel__head">
          <div><span>Overview</span><h3>Runtime and projection status</h3></div>
          ${renderBadge(dashboard.testGate.status, "success")}
        </div>
        <div class="admin-kv-grid">
          ${renderKv("Runtime marker", dashboard.environment.runtimeMarker)}
          ${renderKv("Projection source", dashboard.projectionSource)}
          ${renderKv("Auth status", dashboard.environment.authStatus)}
          ${renderKv("Stale warning", `${dashboard.stale.thresholdSeconds}s threshold`)}
          ${renderKv("Stale state", dashboard.stale.isStale ? "stale" : "fresh")}
          ${renderKv("Selected instance", ((_a = input.selectedInstance) == null ? void 0 : _a.instanceId) ?? "Neni dostupne")}
          ${renderKv("Health", ((_b = input.selectedInstance) == null ? void 0 : _b.healthStatus) ?? "Neni dostupne")}
          ${renderKv("Queued events", String(((_c = input.selectedInstance) == null ? void 0 : _c.queuedEventCount) ?? 0))}
          ${renderKv("Warnings", String(((_d = input.selectedInstance) == null ? void 0 : _d.warningCount) ?? 0))}
        </div>
        ${input.healthWarnings.length > 0 ? `<ul class="admin-compact-list">${input.healthWarnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>` : ""}
        <ul class="admin-compact-list">${dashboard.testGate.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
      </article>
      <article class="admin-panel">
        <div class="admin-panel__head">
          <div><span>Projection health</span><h3>Read-model coverage</h3></div>
          ${renderSourceBadge(dashboard.projectionSource)}
        </div>
        <div class="admin-health-grid">
          ${dashboard.projectionHealth.map((entry) => `
            <div class="admin-health-card" data-admin-projection-health="${escapeAttribute(entry.name)}">
              ${renderHealthBadge(entry.status)}
              <strong>${escapeHtml(entry.name)}</strong>
              <p>${escapeHtml(entry.message)}</p>
              <small>${escapeHtml(entry.source)}${entry.missingFields.length > 0 ? ` · missing: ${escapeHtml(entry.missingFields.join(", "))}` : ""}</small>
            </div>
          `).join("")}
        </div>
      </article>
    </div>
    ${renderScopeTable(dashboard)}
  </section>
`;
  };
  const renderServersSection = (dashboard) => `
  <section id="admin-servers" class="admin-panel admin-section-anchor">
    <div class="admin-panel__head">
      <div><span>Servers</span><h3>Instance/server overview</h3></div>
      ${renderBadge("READ ONLY", "info")}
    </div>
    ${renderTable(["Server", "Mode", "Status", "Phase", "Tick", "State version", "Players", "Districts", "Owned", "Orders", "Heat", "Updated"], dashboard.servers.map((server) => `
      <tr>
        <td><strong>${escapeHtml(server.displayName)}</strong><br><small>${escapeHtml(server.serverInstanceId)}</small></td>
        <td>${escapeHtml(server.mode)}<br><small>${escapeHtml(server.runtimeMarker)}</small></td>
        <td>${renderStatusPill(server.status)}</td>
        <td>${escapeHtml(server.phase)}</td>
        <td>${server.tick}</td>
        <td>${escapeHtml(server.stateVersion)}</td>
        <td>${server.playerCount}</td>
        <td>${server.districtCount}</td>
        <td>${server.ownedDistrictCount}</td>
        <td>${server.activeOrdersCount}</td>
        <td>${escapeHtml(server.heatPressure)}</td>
        <td>${escapeHtml(server.updatedAt)}</td>
      </tr>
    `).join(""), '<tr><td colspan="12">Zadne instance.</td></tr>')}
  </section>
`;
  const renderPlayersSection = (dashboard) => `
  <section id="admin-players" class="admin-panel admin-section-anchor">
    <div class="admin-panel__head">
      <div><span>Players</span><h3>Players/testers detail</h3></div>
      ${renderSourceBadge(dashboard.projectionSource)}
    </div>
    ${renderFilterChips(["active", "defeated", "high heat", "onboarding incomplete"])}
    ${renderTable(["Player", "Faction", "Status", "Home", "Districts", "Cash / Dirty", "Population", "Heat", "Onboarding", "Orders", "Last action", "Warnings"], dashboard.players.map((player) => `
      <tr data-admin-player-row="${escapeAttribute(player.playerId)}">
        <td><strong>${escapeHtml(player.displayName)}</strong><br><small>${escapeHtml(player.playerId)}</small></td>
        <td>${escapeHtml(player.factionName)}</td>
        <td>${renderStatusPill(player.status)}</td>
        <td>${escapeHtml(player.homeDistrictId ?? "none")}</td>
        <td>${player.ownedDistrictCount}<br><small>${escapeHtml(player.ownedDistrictIds.join(", ") || "none")}</small></td>
        <td>${formatMoney(player.cash)} / ${formatMoney(player.dirtyCash)}</td>
        <td>${formatNumber(player.population)}</td>
        <td>${player.heat} · wanted ${player.wantedLevel}/6</td>
        <td>${escapeHtml(player.onboarding.progressLabel)}<br><small>${escapeHtml(player.onboarding.note)}</small></td>
        <td>${player.activeOrdersCount}</td>
        <td>${escapeHtml(player.lastActionAt ?? "Neni dostupne")}</td>
        <td>${renderWarnings(player.warnings)}</td>
      </tr>
    `).join(""), '<tr><td colspan="12">Zadne player projection rows.</td></tr>')}
  </section>
`;
  const renderMapSection = (dashboard) => `
  <section id="admin-map" class="admin-grid admin-grid--map admin-section-anchor">
    <article class="admin-panel admin-panel--wide">
      <div class="admin-panel__head">
        <div><span>Map</span><h3>District/map detail</h3></div>
        ${renderSourceBadge(dashboard.projectionSource)}
      </div>
      ${renderFilterChips(["owned", "unowned", "high heat", "active order", "downtown", "spawn candidate"])}
      ${renderTable(["District", "Owner", "Status", "Zone", "Population", "Influence", "Heat", "Buildings", "Production", "Orders", "Flags", "Warnings"], dashboard.districts.map((district) => `
        <tr data-admin-district-row="${escapeAttribute(district.districtId)}">
          <td><strong>${escapeHtml(district.name)}</strong><br><small>${escapeHtml(district.districtId)}</small></td>
          <td>${escapeHtml(district.ownerName ?? "Neobsazeno")}<br><small>${escapeHtml(district.ownerPlayerId ?? "")}</small></td>
          <td>${renderStatusPill(district.status)}</td>
          <td>${escapeHtml(district.zone)}</td>
          <td>${district.population === null ? "n/a" : formatNumber(district.population)}</td>
          <td>${formatNumber(district.influence)}</td>
          <td>${formatNumber(district.heat)}</td>
          <td>${district.buildingCount} · ${district.activeBuildingActionsCount} cd</td>
          <td>${escapeHtml(district.productionStatus)}</td>
          <td>${district.activeOrderCount}</td>
          <td>${district.isSpawnCandidate ? "spawn" : ""}${district.isDowntown ? " downtown" : ""}</td>
          <td>${renderWarnings(district.warnings)}</td>
        </tr>
      `).join(""), '<tr><td colspan="12">No district projection rows.</td></tr>')}
    </article>
    <article class="admin-panel admin-panel--critical">
      <div class="admin-panel__head">
        <div><span>Map edit controls</span><h3>Locked</h3></div>
        ${renderBadge("NO LIVE MAP EDIT", "critical")}
      </div>
      ${renderLockedControlCard(requireLockedControl(dashboard, "set-district-owner"))}
    </article>
  </section>
`;
  const renderEconomySection = (dashboard) => `
  <section id="admin-economy" class="admin-grid admin-section-anchor">
    <article class="admin-panel admin-panel--wide">
      <div class="admin-panel__head">
        <div><span>Economy</span><h3>Resources/economy detail</h3></div>
        ${renderSourceBadge(dashboard.economy.source)}
      </div>
      <div class="admin-kv-grid">
        ${renderKv("Clean cash total", formatMoney(dashboard.economy.totalCleanCash))}
        ${renderKv("Dirty cash total", formatMoney(dashboard.economy.totalDirtyCash))}
        ${renderKv("Resource keys", String(Object.keys(dashboard.economy.totalResources).length))}
        ${renderKv("Production outputs", String(Object.keys(dashboard.economy.productionOutputSummary).length))}
        ${renderKv("Warnings", String(dashboard.economy.warnings.length))}
        ${renderKv("Source", dashboard.economy.source)}
      </div>
      <div class="admin-grid admin-grid--overview">
        <div>
          <h4 class="admin-subhead">Top resource holders</h4>
          ${renderTable(["Player", "Resource", "Amount"], dashboard.economy.topResourceHolders.map((holder) => `
            <tr><td>${escapeHtml(holder.displayName)}<br><small>${escapeHtml(holder.playerId)}</small></td><td>${escapeHtml(holder.resourceKey)}</td><td>${formatNumber(holder.amount)}</td></tr>
          `).join(""), '<tr><td colspan="3">No positive resource holder rows.</td></tr>')}
        </div>
        <div>
          <h4 class="admin-subhead">Resource totals</h4>
          ${renderTable(["Resource", "Total"], Object.entries(dashboard.economy.totalResources).map(([key, amount]) => `
            <tr><td>${escapeHtml(key)}</td><td>${formatNumber(amount)}</td></tr>
          `).join(""), '<tr><td colspan="2">No resource totals.</td></tr>')}
        </div>
      </div>
      ${renderNotes([...dashboard.economy.marketRiskNotes, ...dashboard.economy.warnings])}
    </article>
    <article class="admin-panel admin-panel--critical">
      <div class="admin-panel__head"><div><span>Locked</span><h3>Resource grants</h3></div>${renderBadge("DISABLED", "critical")}</div>
      ${renderLockedControlCard(requireLockedControl(dashboard, "grant-resources"))}
    </article>
  </section>
`;
  const renderProductionSection = (dashboard) => `
  <section id="admin-production" class="admin-panel admin-section-anchor">
    <div class="admin-panel__head">
      <div><span>Production</span><h3>Production/craft detail</h3></div>
      ${renderSourceBadge(dashboard.production.source)}
    </div>
    <div class="admin-kv-grid">
      ${renderKv("Active production buildings", String(dashboard.production.activeProductionBuildings.length))}
      ${renderKv("Ready collect", String(dashboard.production.readyCollectCount))}
      ${renderKv("Storage full", String(dashboard.production.storageFullCount))}
      ${renderKv("Active craft jobs", String(dashboard.production.activeCraftJobs.length))}
      ${renderKv("Cooldowns", String(dashboard.production.cooldowns.length))}
      ${renderKv("Bottleneck rows", String(dashboard.production.bottleneckResources.length))}
    </div>
    <h4 class="admin-subhead">Production storage</h4>
    ${renderTable(["Building", "District", "Owner", "Resource", "Stored", "State"], dashboard.production.activeProductionBuildings.map((building) => `
      <tr>
        <td><strong>${escapeHtml(building.displayName)}</strong><br><small>${escapeHtml(building.buildingId)}</small></td>
        <td>${escapeHtml(building.districtId)}</td>
        <td>${escapeHtml(building.ownerPlayerId)}</td>
        <td>${escapeHtml(building.resourceLabel)}<br><small>${escapeHtml(building.resourceKey)}</small></td>
        <td>${formatNumber(building.stored)} / ${formatNumber(building.storageCap)}</td>
        <td>${building.storageFull ? renderStatusPill("storage full") : building.readyToCollect ? renderStatusPill("ready") : renderStatusPill("filling")}</td>
      </tr>
    `).join(""), '<tr><td colspan="6">No production building projection rows.</td></tr>')}
    <h4 class="admin-subhead">Craft processing</h4>
    ${renderTable(["Building", "District", "Recipe", "Ticks", "Remaining"], dashboard.production.activeCraftJobs.map((job) => `
      <tr>
        <td>${escapeHtml(job.buildingTypeId)}<br><small>${escapeHtml(job.buildingId)}</small></td>
        <td>${escapeHtml(job.districtId)}</td>
        <td>${escapeHtml(job.recipeLabel)}<br><small>${escapeHtml(job.recipeId)}</small></td>
        <td>${job.startedTick} → ${job.completesTick}</td>
        <td>${escapeHtml(job.remainingLabel)}</td>
      </tr>
    `).join(""), '<tr><td colspan="5">No active craft processing.</td></tr>')}
    <h4 class="admin-subhead">Cooldowns and bottlenecks</h4>
    ${renderTable(["Owner", "Key", "Remaining"], dashboard.production.cooldowns.map((cooldown) => `
      <tr><td>${escapeHtml(cooldown.ownerType)} · ${escapeHtml(cooldown.ownerId)}</td><td>${escapeHtml(cooldown.key)}</td><td>${escapeHtml(cooldown.remainingLabel)}</td></tr>
    `).join(""), '<tr><td colspan="3">No production/building action cooldowns.</td></tr>')}
    ${renderNotes([...dashboard.production.warnings, ...dashboard.production.bottleneckResources.map((entry) => `${entry.resourceKey}: ${entry.warning}`)])}
  </section>
`;
  const renderPoliceSection = (dashboard) => `
  <section id="admin-police" class="admin-panel admin-section-anchor">
    <div class="admin-panel__head">
      <div><span>Police/Heat</span><h3>Heat, wanted and raid detail</h3></div>
      ${renderSourceBadge(dashboard.police.source)}
    </div>
    <div class="admin-kv-grid">
      ${renderKv("Heat pressure", dashboard.police.heatPressure)}
      ${renderKv("Wanted player rows", String(dashboard.police.wantedPlayers.length))}
      ${renderKv("Pending raids", String(dashboard.police.pendingRaidCount))}
      ${renderKv("Hotspots", String(dashboard.police.districtHotspots.length))}
      ${renderKv("Warnings", String(dashboard.police.warnings.length))}
    </div>
    <div class="admin-grid admin-grid--overview">
      <div>
        <h4 class="admin-subhead">Player heat</h4>
        ${renderTable(["Player", "Heat", "Wanted", "Flags"], dashboard.police.wantedPlayers.map((player) => `
          <tr><td>${escapeHtml(player.displayName)}<br><small>${escapeHtml(player.playerId)}</small></td><td>${formatNumber(player.heat)}</td><td>${player.wantedLevel}/6</td><td>${escapeHtml(player.activeFlags.join(", ") || "none")}</td></tr>
        `).join(""), '<tr><td colspan="4">No police player rows.</td></tr>')}
      </div>
      <div>
        <h4 class="admin-subhead">District hotspots</h4>
        ${renderTable(["District", "Heat", "Owner"], dashboard.police.districtHotspots.map((district) => `
          <tr><td>${escapeHtml(district.name)}<br><small>${escapeHtml(district.districtId)}</small></td><td>${formatNumber(district.heat)}</td><td>${escapeHtml(district.ownerPlayerId ?? "none")}</td></tr>
        `).join(""), '<tr><td colspan="3">No district heat hotspots.</td></tr>')}
      </div>
    </div>
    <h4 class="admin-subhead">Pending raids</h4>
    ${renderTable(["Raid", "Player", "District", "Severity", "Status", "Remaining", "Reason"], dashboard.police.pendingRaids.map((raid) => `
      <tr><td>${escapeHtml(raid.raidId)}</td><td>${escapeHtml(raid.playerId)}</td><td>${escapeHtml(raid.targetDistrictId ?? "none")}</td><td>${escapeHtml(raid.severity)}</td><td>${escapeHtml(raid.status)}</td><td>${raid.remainingTicks} ticks</td><td>${escapeHtml(raid.reason)}</td></tr>
    `).join(""), '<tr><td colspan="7">No pending raids.</td></tr>')}
    ${renderNotes(dashboard.police.warnings)}
  </section>
`;
  const renderOrdersSection = (dashboard) => `
  <section id="admin-orders" class="admin-panel admin-section-anchor">
    <div class="admin-panel__head">
      <div><span>Orders/Missions</span><h3>Active orders and cooldowns</h3></div>
      ${renderBadge("NO MUTATION", "info")}
    </div>
    <p class="admin-copy">Rows are read-only. Admin cannot force resolve, shorten cooldowns, or replay outcomes.</p>
    ${renderTable(["Order", "Type", "Player", "Source", "Target", "Status", "Resolves", "Remaining", "Result", "Warnings"], dashboard.orders.map((order) => `
      <tr>
        <td>${escapeHtml(order.id)}</td>
        <td>${escapeHtml(order.type)}</td>
        <td>${escapeHtml(order.playerName)}<br><small>${escapeHtml(order.playerId)}</small></td>
        <td>${escapeHtml(order.sourceDistrictId ?? "unknown")}</td>
        <td>${escapeHtml(order.targetDistrictId ?? "unknown")}</td>
        <td>${escapeHtml(order.status)}</td>
        <td>${order.resolvesAtTick ?? "n/a"}</td>
        <td>${escapeHtml(order.remainingLabel)}</td>
        <td>${escapeHtml(order.result)}</td>
        <td>${renderWarnings(order.warnings)}</td>
      </tr>
    `).join(""), '<tr><td colspan="10">No active order/cooldown projection rows.</td></tr>')}
  </section>
`;
  const renderEventsLogsSection = (dashboard, overview) => `
  <section id="admin-events" class="admin-section-anchor">
    <div class="admin-grid admin-grid--overview">
      <article class="admin-panel">
        <div class="admin-panel__head"><div><span>Events/Logs</span><h3>Sanitized event projection</h3></div>${renderBadge("SANITIZED", "info")}</div>
        ${renderFilterChips(["notice", "warning", "error", "runtime", "diagnostic"])}
        ${renderTable(["Severity", "Type", "Summary", "Player", "District", "Payload", "Created"], dashboard.events.map((event) => `
          <tr><td>${renderSeverity(event.severity)}</td><td>${escapeHtml(event.type)}</td><td>${escapeHtml(event.summary)}</td><td>${escapeHtml(event.playerId ?? "")}</td><td>${escapeHtml(event.districtId ?? "")}</td><td><code>${escapeHtml(event.payloadPreview)}</code></td><td>${escapeHtml(event.createdAt)}</td></tr>
        `).join(""), '<tr><td colspan="7">Zadne recent events.</td></tr>')}
      </article>
      <article class="admin-panel">
        <div class="admin-panel__head"><div><span>Selected instance</span><h3>Recent commands</h3></div></div>
        ${renderTable(["Type", "Command", "Actor / playerId", "Tick", "Received", "Correlation", "Status"], overview.selectedLogs.commands.map((log) => `
          <tr><td>${escapeHtml(log.commandType)}</td><td>${escapeHtml(log.commandId)}</td><td>${escapeHtml(log.actorId)}</td><td>${log.tickAtReceive}</td><td>${escapeHtml(log.receivedAt)}</td><td>${escapeHtml(log.correlationId ?? "Neni dostupne")}</td><td>${escapeHtml(log.status)}</td></tr>
        `).join(""), '<tr><td colspan="7">Zadne command logy.</td></tr>')}
      </article>
    </div>
    <article class="admin-panel">
      <div class="admin-panel__head"><div><span>Selected instance</span><h3>Recent diagnostics / errors</h3></div></div>
      ${renderTable(["Level", "Category", "Message", "Occurred", "Command", "Correlation"], overview.selectedLogs.diagnostics.map((log) => `
        <tr><td>${escapeHtml(log.level)}</td><td>${escapeHtml(log.category)}</td><td>${escapeHtml(log.message)}</td><td>${escapeHtml(log.occurredAt)}</td><td>${escapeHtml(log.commandId ?? "Neni dostupne")}</td><td>${escapeHtml(log.correlationId ?? "Neni dostupne")}</td></tr>
      `).join(""), '<tr><td colspan="6">Zadne diagnostics.</td></tr>')}
    </article>
  </section>
`;
  const renderPresetsSection = (dashboard) => {
    const presetJson = JSON.stringify(dashboard.presetDraft, null, 2);
    const downloadHref = `data:application/json;charset=utf-8,${encodeURIComponent(presetJson)}`;
    return `
    <section id="admin-presets" class="admin-grid admin-section-anchor">
      <article class="admin-panel admin-panel--wide">
        <div class="admin-panel__head">
          <div><span>Presets</span><h3>Safe staging preset builder</h3></div>
          ${renderBadge("DRAFT ONLY", "warning")}
        </div>
        <p class="admin-copy">This draft does not apply to a live server. It is a review artifact for future server preset commands.</p>
        <div class="admin-settings-grid">
          ${renderReadonlySetting("Name", dashboard.presetDraft.name)}
          ${renderReadonlySetting("Mode", dashboard.presetDraft.mode)}
          ${renderReadonlySetting("Map preset", dashboard.presetDraft.mapPreset)}
          ${renderReadonlySetting("Starting cash", String(dashboard.presetDraft.startingCash))}
          ${renderReadonlySetting("Dirty cash", String(dashboard.presetDraft.startingDirtyCash))}
          ${renderReadonlySetting("Population", String(dashboard.presetDraft.startingPopulation))}
          ${renderReadonlySetting("Materials", String(dashboard.presetDraft.startingMaterials))}
          ${renderReadonlySetting("Weapons", String(dashboard.presetDraft.startingWeapons))}
          ${renderReadonlySetting("Heat start", String(dashboard.presetDraft.heatStart))}
          ${renderReadonlySetting("Validation", dashboard.presetDraft.validationStatus)}
        </div>
        <pre class="admin-code" data-admin-preset-json>${escapeHtml(presetJson)}</pre>
        <div class="admin-actions">
          <a class="admin-button admin-button--primary" download="empire-server-preset-draft.json" href="${downloadHref}">Export JSON</a>
          <button class="admin-button" type="button" disabled aria-disabled="true">Apply to live server locked</button>
        </div>
      </article>
      <article class="admin-panel admin-panel--critical">
        <div class="admin-panel__head"><div><span>Future apply</span><h3>Requirements</h3></div>${renderBadge("SERVER ONLY", "critical")}</div>
        <ul class="admin-compact-list">
          <li>create-server-preset admin command</li>
          <li>apply-server-preset admin command</li>
          <li>audit log, dry-run and expected state version</li>
          <li>transaction boundary and rollback notes</li>
        </ul>
      </article>
    </section>
  `;
  };
  const renderMessagesSection = () => `
  <section id="admin-messages" class="admin-grid admin-section-anchor">
    <article class="admin-panel admin-panel--wide">
      <div class="admin-panel__head">
        <div><span>Messages</span><h3>Server message composer</h3></div>
        ${renderBadge("MOCK PREVIEW", "warning")}
      </div>
      <p class="admin-copy">Send is disabled. Live broadcast requires a server-authoritative admin command endpoint and audit log.</p>
      <div class="admin-settings-grid">
        ${renderReadonlySetting("Target server", "selected demo/staging server")}
        ${renderReadonlySetting("Severity", "notice")}
        ${renderReadonlySetting("Title", "Operator message preview")}
      </div>
      <div class="admin-message-preview">
        <span>Preview</span>
        <strong>Operator message preview</strong>
        <p>Ukazka zpravy pro budouci broadcast. V admin v1.1 se nic neposila.</p>
      </div>
      <div class="admin-actions">
        <button class="admin-button" type="button" disabled aria-disabled="true" data-admin-message-send>Send locked</button>
        <span class="admin-lock-reason">Requires server-authoritative admin command endpoint + audit log.</span>
      </div>
    </article>
    <article class="admin-panel admin-panel--critical">
      <div class="admin-panel__head"><div><span>Broadcast</span><h3>Locked live send</h3></div>${renderBadge("DISABLED", "critical")}</div>
      <p class="admin-copy">No fake success is rendered. This UI never claims a message was sent.</p>
    </article>
  </section>
`;
  const renderFutureControlsSection = (dashboard) => `
  <section id="admin-future-controls" class="admin-panel admin-section-anchor">
    <div class="admin-panel__head">
      <div><span>Future Controls / Locked</span><h3>Server-only write operations</h3></div>
      ${renderBadge("ALL DISABLED", "critical")}
    </div>
    <div class="admin-lock-grid">
      ${dashboard.lockedControls.map(renderLockedControlCard).join("")}
    </div>
  </section>
`;
  const renderChecklistSection = (dashboard) => `
  <section id="admin-checklist" class="admin-grid admin-section-anchor">
    <article class="admin-panel">
      <div class="admin-panel__head"><div><span>Checklist</span><h3>Pre-test ops checklist</h3></div>${renderBadge("MANUAL QA", "info")}</div>
      <ul class="admin-compact-list">${dashboard.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </article>
    <article class="admin-panel">
      <div class="admin-panel__head"><div><span>Admin v1.1 checks</span><h3>Projection checks</h3></div></div>
      <ul class="admin-compact-list">
        <li>Projection source is visible in sidebar and top sections.</li>
        <li>Stale badge is visible before reading ops state.</li>
        <li>Events/logs are sanitized and payload preview is limited.</li>
        <li>Preset export remains draft-only.</li>
        <li>Message send and future controls remain disabled.</li>
      </ul>
    </article>
    <article class="admin-panel admin-panel--critical">
      <div class="admin-panel__head"><div><span>Do not enable</span><h3>Before server authority</h3></div>${renderBadge("GUARDRAIL", "critical")}</div>
      <ul class="admin-compact-list">
        <li>No direct resource grants.</li>
        <li>No direct map ownership edits.</li>
        <li>No cooldown manipulation.</li>
        <li>No player/session authority bypass.</li>
        <li>No secrets or raw tokens in payloads.</li>
      </ul>
    </article>
  </section>
`;
  const renderScopeTable = (dashboard) => `
  <article class="admin-panel">
    <div class="admin-panel__head"><div><span>Admin scope</span><h3>Read-only / mock / locked split</h3></div></div>
    ${renderTable(["Feature", "Mode", "Status", "Risk"], dashboard.scope.map((item) => `
      <tr><td>${escapeHtml(item.feature)}</td><td>${renderModeBadge(item.mode)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.risk)}</td></tr>
    `).join(""))}
  </article>
`;
  const renderLockedControlCard = (control) => `
  <article class="admin-locked-control" data-admin-locked-control="${escapeAttribute(control.id)}">
    <div>
      <strong>${escapeHtml(control.label)}</strong>
      <p>${escapeHtml(control.disabledReason)}</p>
    </div>
    <button class="admin-button" type="button" disabled aria-disabled="true">Locked</button>
    <small>Requires: ${escapeHtml(control.requirements.join(", "))}</small>
  </article>
`;
  const renderReadonlySetting = (label, value) => `
  <label class="admin-setting">
    <span>${escapeHtml(label)}</span>
    <input type="text" value="${escapeAttribute(value)}" readonly>
  </label>
`;
  const renderTable = (headers, rows, empty = "") => `
  <div class="admin-table-wrap">
    <table class="admin-table">
      <thead><tr>${headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>${rows || empty}</tbody>
    </table>
  </div>
`;
  const renderMetric = (label, value, detail) => `
  <article class="admin-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>
`;
  const renderKv = (label, value) => `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span>`;
  const renderBadge = (label, tone) => `<span class="admin-badge admin-badge--${tone}">${escapeHtml(label)}</span>`;
  const renderSourceBadge = (source) => {
    const tone = source === "runtime" ? "success" : source === "demo-sample" || source === "config" ? "warning" : "critical";
    return renderBadge(source.toUpperCase(), tone);
  };
  const renderModeBadge = (mode) => {
    const tone = mode === "read-only" ? "success" : mode === "mock" ? "warning" : "critical";
    return renderBadge(mode.toUpperCase(), tone);
  };
  const renderHealthBadge = (status) => {
    const tone = status === "ok" ? "success" : status === "warning" ? "warning" : "critical";
    return renderBadge(status.toUpperCase(), tone);
  };
  const renderSeverity = (severity) => `<span class="admin-severity admin-severity--${severity === "error" ? "error" : severity}">${escapeHtml(severity)}</span>`;
  const renderStatusPill = (status) => {
    const normalized = status.toLowerCase();
    const tone = normalized.includes("running") || normalized.includes("active") || normalized.includes("ready") || normalized.includes("fresh") || normalized.includes("claimed") ? "green" : normalized.includes("warn") || normalized.includes("medium") || normalized.includes("cooldown") || normalized.includes("locked") ? "orange" : normalized.includes("error") || normalized.includes("destroyed") || normalized.includes("banned") || normalized.includes("full") ? "red" : "cyan";
    return `<span class="admin-table-status admin-table-status--${tone}">${escapeHtml(status)}</span>`;
  };
  const renderWarnings = (warnings) => warnings.length > 0 ? `<ul class="admin-mini-list">${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>` : `<small>none</small>`;
  const renderNotes = (notes) => notes.length > 0 ? `<ul class="admin-compact-list">${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>` : "";
  const renderFilterChips = (filters) => `
  <div class="admin-filter-row" aria-label="Read-only filters">
    ${filters.map((filter) => `<span class="admin-filter-chip">${escapeHtml(filter)}</span>`).join("")}
  </div>
`;
  const requireLockedControl = (dashboard, id) => dashboard.lockedControls.find((control) => control.id === id) ?? dashboard.lockedControls[0];
  const formatMoney = (amount) => `$${formatNumber(amount)}`;
  const formatNumber = (amount) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.max(0, Number(amount || 0)));
  const escapeHtml = (value) => sanitizeAdminDisplayText(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character] ?? character);
  const escapeAttribute = (value) => escapeHtml(value);
  const createAdminDiagnosticsReadService = (options = {}) => ({
    getDiagnosticsSummary: async (instanceId) => {
      var _a;
      return ((_a = options.facade) == null ? void 0 : _a.getDiagnosticsSummary(instanceId)) ?? {
        instanceId,
        lastSnapshotAt: null,
        snapshotSchemaVersion: null,
        lastCrashAt: null,
        diagnosticErrorCount: 0
      };
    },
    getQueueSummary: async (instanceId) => {
      var _a;
      return ((_a = options.facade) == null ? void 0 : _a.getQueueSummary(instanceId)) ?? {
        instanceId,
        queuedEvents: 0,
        queuedCommands: 0
      };
    },
    listRecentDiagnosticLogs: async (instanceId, limit) => {
      var _a;
      return (await ((_a = options.facade) == null ? void 0 : _a.listRecentDiagnosticRecords(instanceId, limit)) ?? []).map((record) => ({
        id: record.id,
        instanceId: record.instanceId,
        level: record.level,
        category: record.category,
        message: record.message,
        occurredAt: record.occurredAt,
        commandId: record.commandId ?? null,
        correlationId: record.correlationId ?? null
      }));
    }
  });
  const createAdminInstanceReadService = (options = {}) => ({
    listInstances: async () => {
      var _a;
      return ((_a = options.facade) == null ? void 0 : _a.listInstances()) ?? [];
    },
    listInstanceMonitoringSummaries: async () => {
      var _a, _b;
      return ((_b = (_a = options.facade) == null ? void 0 : _a.listInstanceMonitoringSummaries) == null ? void 0 : _b.call(_a)) ?? [];
    },
    getModeSummary: async (instanceId) => {
      var _a;
      return ((_a = options.facade) == null ? void 0 : _a.getModeSummary(instanceId)) ?? {
        instanceId,
        mode: "unknown",
        configKey: "unknown"
      };
    },
    getPlayerPopulationSummary: async (instanceId) => {
      var _a;
      return ((_a = options.facade) == null ? void 0 : _a.getPlayerPopulationSummary(instanceId)) ?? {
        instanceId,
        totalPlayers: 0,
        connectedPlayers: 0
      };
    },
    getAlliancePopulationSummary: async (instanceId) => {
      var _a;
      return ((_a = options.facade) == null ? void 0 : _a.getAlliancePopulationSummary(instanceId)) ?? {
        instanceId,
        totalAlliances: 0
      };
    },
    getHealthSummary: async (instanceId) => {
      var _a;
      return ((_a = options.facade) == null ? void 0 : _a.getInstanceHealthSummary(instanceId)) ?? {
        instanceId,
        status: "healthy",
        warnings: [],
        lastErrorAt: null
      };
    }
  });
  const createAdminLogReadService = (options = {}) => ({
    getCommandVolumeSummary: async (instanceId) => {
      var _a;
      return ((_a = options.facade) == null ? void 0 : _a.getCommandVolumeSummary(instanceId)) ?? {
        instanceId,
        totalCommands: 0
      };
    },
    getErrorSummary: async (instanceId) => {
      var _a;
      return ((_a = options.facade) == null ? void 0 : _a.getErrorSummary(instanceId)) ?? {
        instanceId,
        errorCount: 0,
        lastErrorAt: null
      };
    },
    listRecentCommandLogs: async (instanceId, limit) => {
      var _a;
      return (await ((_a = options.facade) == null ? void 0 : _a.listRecentCommandRecords(instanceId, limit)) ?? []).map((record) => ({
        id: record.id,
        instanceId: record.instanceId,
        commandId: record.command.id,
        commandType: record.command.type,
        actorId: record.actorId,
        correlationId: record.correlationId,
        receivedAt: record.receivedAt,
        tickAtReceive: record.tickAtReceive,
        status: "recorded"
      }));
    },
    listRecentEventLogs: async (instanceId, limit) => {
      var _a;
      return (await ((_a = options.facade) == null ? void 0 : _a.listRecentEventRecords(instanceId, limit)) ?? []).map((record) => ({
        id: record.id,
        instanceId: record.instanceId,
        eventType: record.event.type,
        causedByCommandId: record.causedByCommandId,
        recordedAt: record.recordedAt,
        tickAtEmit: record.tickAtEmit
      }));
    }
  });
  const createAdminApp = (options = {}) => {
    var _a, _b, _c;
    const instanceReadService = createAdminInstanceReadService({
      facade: (_a = options.facades) == null ? void 0 : _a.instance
    });
    const logReadService = createAdminLogReadService({
      facade: (_b = options.facades) == null ? void 0 : _b.log
    });
    const diagnosticsReadService = createAdminDiagnosticsReadService({
      facade: (_c = options.facades) == null ? void 0 : _c.diagnostics
    });
    return createAdminAppShell({
      mount: async (target) => {
        const mountTarget = target ?? resolveDefaultMountTarget();
        if (!mountTarget) {
          return;
        }
        mountTarget.innerHTML = renderInstanceListPage(createAdminOverviewViewModel([]));
        bindAdminRefresh(mountTarget, () => createAdminApp(options).mount(mountTarget));
        try {
          mountTarget.innerHTML = renderInstanceListPage(await loadAdminOverview());
          bindAdminRefresh(mountTarget, () => createAdminApp(options).mount(mountTarget));
        } catch (error) {
          mountTarget.innerHTML = renderAdminError(error);
          bindAdminSecretForm(mountTarget, () => createAdminApp(options).mount(mountTarget));
        }
      }
    });
    async function loadAdminOverview() {
      var _a2, _b2;
      if (options.fetchAdminOverview) {
        return options.fetchAdminOverview();
      }
      if (!options.fetchMonitoringSummaries && !((_a2 = options.facades) == null ? void 0 : _a2.instance)) {
        const endpointOverview = await fetchAdminOverviewFromEndpoint(
          options.monitoringEndpoint ?? "/api/admin/monitoring",
          options.adminMonitoringSecret ?? options.adminMonitoringToken
        );
        if (endpointOverview) {
          return endpointOverview;
        }
      }
      const monitoringSummaries = await loadMonitoringSummaries(options);
      const viewModels = monitoringSummaries.length > 0 ? monitoringSummaries.map(createAdminInstanceViewModelFromMonitoringSummary) : await loadLegacyInstanceViewModels();
      const selectedInstanceId = ((_b2 = viewModels[0]) == null ? void 0 : _b2.instanceId) ?? null;
      return createAdminOverviewViewModel(
        viewModels,
        {
          selectedLogs: selectedInstanceId ? await loadSelectedLogs(selectedInstanceId) : void 0
        }
      );
    }
    async function loadSelectedLogs(instanceId) {
      const [commands, events, diagnostics] = await Promise.all([
        logReadService.listRecentCommandLogs(instanceId, 20),
        logReadService.listRecentEventLogs(instanceId, 20),
        diagnosticsReadService.listRecentDiagnosticLogs(instanceId, 20)
      ]);
      return {
        instanceId,
        commands,
        events,
        diagnostics
      };
    }
    async function loadLegacyInstanceViewModels() {
      const summaries = await instanceReadService.listInstances();
      return Promise.all(summaries.map(async (summary) => {
        const [health, diagnostics, commandVolume, events, diagnosticLogs] = await Promise.all([
          instanceReadService.getHealthSummary(summary.instanceId),
          diagnosticsReadService.getDiagnosticsSummary(summary.instanceId),
          logReadService.getCommandVolumeSummary(summary.instanceId),
          logReadService.listRecentEventLogs(summary.instanceId, 100),
          diagnosticsReadService.listRecentDiagnosticLogs(summary.instanceId, 100)
        ]);
        return createAdminInstanceViewModel(summary, health, diagnostics, {
          commandCount: commandVolume.totalCommands,
          eventCount: events.length,
          diagnosticWarningCount: diagnosticLogs.filter((record) => record.level === "warn").length
        });
      }));
    }
  };
  const loadMonitoringSummaries = async (options) => {
    var _a, _b, _c, _d;
    if (options.fetchMonitoringSummaries) {
      return options.fetchMonitoringSummaries();
    }
    const facadeSummaries = await createAdminInstanceReadService({
      facade: (_a = options.facades) == null ? void 0 : _a.instance
    }).listInstanceMonitoringSummaries();
    if (facadeSummaries.length > 0 || ((_c = (_b = options.facades) == null ? void 0 : _b.instance) == null ? void 0 : _c.listInstanceMonitoringSummaries)) {
      return facadeSummaries;
    }
    return ((_d = await fetchAdminOverviewFromEndpoint(
      options.monitoringEndpoint ?? "/api/admin/monitoring",
      options.adminMonitoringSecret ?? options.adminMonitoringToken
    )) == null ? void 0 : _d.instances.map((instance) => ({
      instanceId: instance.instanceId,
      mode: instance.mode,
      status: instance.status,
      displayName: instance.displayName,
      region: instance.region,
      currentTick: instance.currentTick,
      playerCount: instance.playerCount,
      allianceCount: instance.allianceCount,
      crashCount: instance.crashCount,
      healthStatus: instance.healthStatus,
      warningCount: instance.warningCount,
      lastTickStartedAt: instance.lastTickStartedAt,
      lastTickCompletedAt: instance.lastTickCompletedAt,
      lastErrorAt: instance.lastErrorAt,
      queuedEventCount: instance.queuedEventCount,
      commandCount: instance.commandCount,
      eventCount: instance.eventCount,
      diagnosticErrorCount: instance.diagnosticErrorCount,
      lastSnapshotAt: instance.lastSnapshotAt
    }))) ?? [];
  };
  const resolveDefaultMountTarget = () => typeof document === "undefined" ? null : document.getElementById("admin-dashboard-root");
  const bindAdminRefresh = (target, refresh) => {
    if (typeof target.querySelector !== "function") {
      return;
    }
    const button = target.querySelector("[data-admin-refresh]");
    if (!button) {
      return;
    }
    button.addEventListener("click", (event) => {
      event.preventDefault();
      void refresh();
    });
  };
  void createAdminApp().mount();
})();
