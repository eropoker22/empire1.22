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
      }
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
      return payload.overview;
    }
    return Array.isArray(payload.instances) ? createAdminOverviewViewModel(payload.instances.map(createAdminInstanceViewModelFromMonitoringSummary), {
      serverSummaries: payload.serverSummaries ?? [],
      healthSummary: payload.healthSummary
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
  const CHECKLIST_ITEMS = [
    "verify:closed-alpha: PASSED",
    "E2E smoke: 14 passed",
    "Spawn UI: verified without API fallback",
    "War: closed",
    "Server action: verified",
    "Prod-like Postgres smoke: prepared, waiting for EMPIRE_TEST_DATABASE_URL",
    "Admin mode: read-only"
  ];
  const renderInstanceListPage = (input) => {
    var _a, _b;
    const overview = Array.isArray(input) ? {
      instances: input,
      serverSummaries: [],
      healthSummary: {
        totalInstances: input.length,
        runningInstances: input.filter((instance) => instance.status === "running").length,
        crashedInstances: input.filter((instance) => instance.status === "crashed").length
      },
      selectedInstanceId: ((_a = input[0]) == null ? void 0 : _a.instanceId) ?? null,
      selectedHealth: null,
      selectedDiagnostics: null,
      selectedLogs: { instanceId: ((_b = input[0]) == null ? void 0 : _b.instanceId) ?? null, commands: [], events: [], diagnostics: [] }
    } : input;
    const selectedInstance = overview.instances.find((instance) => instance.instanceId === overview.selectedInstanceId) ?? overview.instances[0] ?? null;
    const selectedServer = overview.serverSummaries.find((server) => server.serverInstanceId === (selectedInstance == null ? void 0 : selectedInstance.instanceId)) ?? null;
    const freeServer = overview.serverSummaries.find((server) => server.mode === "free") ?? null;
    const warServer = overview.serverSummaries.find((server) => server.mode === "war") ?? null;
    const latestCommand = overview.selectedLogs.commands.at(-1) ?? null;
    const latestError = overview.selectedLogs.diagnostics.filter((diagnostic) => diagnostic.level === "error" || diagnostic.level === "warn").at(-1) ?? null;
    return `
  <section class="admin-monitoring" aria-labelledby="admin-monitoring-title">
    <header class="admin-monitoring__hero">
      <div>
        <p class="admin-boot__eyebrow">Read-only control tower</p>
        <h1 id="admin-monitoring-title">Empire Streets Admin</h1>
        <p>Interní closed-alpha monitoring nad runtime daty. Dashboard nic nemění a nezobrazuje session ani tajné tokeny.</p>
      </div>
      <div class="admin-monitoring__hero-badges">
        ${renderBadge("FREE", (freeServer == null ? void 0 : freeServer.joinable) ? "success" : "warning")}
        ${renderBadge("WAR CLOSED", (warServer == null ? void 0 : warServer.joinable) ? "danger" : "critical")}
        ${renderBadge("READ ONLY", "info")}
      </div>
    </header>
    ${overview.instances.length === 0 ? renderEmptyState() : `
      ${renderTopMetrics({
      overview,
      freeJoinable: (freeServer == null ? void 0 : freeServer.joinable) ?? false,
      warJoinable: (warServer == null ? void 0 : warServer.joinable) ?? false,
      latestCommand: (latestCommand == null ? void 0 : latestCommand.commandType) ?? "Není dostupné",
      latestError: (latestError == null ? void 0 : latestError.message) ?? (selectedInstance == null ? void 0 : selectedInstance.lastErrorAt) ?? "No recent error",
      currentTick: (selectedInstance == null ? void 0 : selectedInstance.currentTick) ?? 0
    })}
      <div class="admin-monitoring__layout">
        <div class="admin-monitoring__main">
          ${renderServerOverview(overview)}
          ${renderSelectedInstanceHealth(selectedInstance, selectedServer, overview)}
          ${renderLogs("Recent commands", overview.selectedLogs.commands.map((log) => `
            <tr><td>${escapeHtml(log.commandType)}</td><td>${escapeHtml(log.commandId)}</td><td>${escapeHtml(log.actorId)}</td><td>${log.tickAtReceive}</td><td>${escapeHtml(log.receivedAt)}</td><td>${escapeHtml(log.correlationId ?? "Není dostupné")}</td><td>${escapeHtml(log.status)}</td></tr>
          `).join(""), '<tr><td colspan="7">Žádné command logy.</td></tr>', ["Type", "Command", "Actor / playerId", "Tick", "Received", "Correlation", "Status"])}
          ${renderLogs("Recent diagnostics / errors", overview.selectedLogs.diagnostics.map((log) => `
            <tr><td>${escapeHtml(log.level)}</td><td>${escapeHtml(log.category)}</td><td>${escapeHtml(log.message)}</td><td>${escapeHtml(log.occurredAt)}</td><td>${escapeHtml(log.commandId ?? "Není dostupné")}</td><td>${escapeHtml(log.correlationId ?? "Není dostupné")}</td></tr>
          `).join(""), '<tr><td colspan="6">Žádné diagnostics.</td></tr>', ["Level", "Category", "Message", "Occurred", "Command", "Correlation"])}
        </div>
        <aside class="admin-monitoring__side">
          ${renderChecklist()}
          ${renderEvents(overview)}
        </aside>
      </div>
    `}
  </section>
`;
  };
  const renderEmptyState = () => `
  <div class="admin-monitoring__empty" role="status">
    <h2>Žádné instance</h2>
    <p>Monitoring endpoint odpověděl, ale runtime zatím nevrací žádné server instance.</p>
  </div>
`;
  const renderTopMetrics = (input) => `
  <section class="admin-monitoring__metrics">
    ${renderMetric("Free status", input.freeJoinable ? "Open / joinable" : "Není dostupné", "První viewport signal")}
    ${renderMetric("War status", input.warJoinable ? "Unexpected open" : "Closed / not joinable", "Guard musí zůstat zavřený")}
    ${renderMetric("Players", String(input.overview.instances.reduce((sum, instance) => sum + instance.playerCount, 0)), `${input.overview.healthSummary.runningInstances}/${input.overview.healthSummary.totalInstances} running`)}
    ${renderMetric("Health", input.overview.healthSummary.crashedInstances > 0 ? "Unhealthy" : "Healthy", `${input.overview.healthSummary.crashedInstances} crashed`)}
    ${renderMetric("Last error", input.latestError, "Selected instance")}
    ${renderMetric("Latest command", input.latestCommand, "Selected instance tail")}
    ${renderMetric("Current tick", String(input.currentTick), "Selected instance")}
  </section>
`;
  const renderServerOverview = (overview) => `
  <section class="admin-monitoring__panel">
    <div class="admin-monitoring__panel-head">
      <div><p class="admin-boot__eyebrow">Server overview</p><h2>Free / War runtime overview</h2></div>
      ${renderBadge("WAR CLOSED", "critical")}
    </div>
    <div class="admin-monitoring__card-grid">
      ${overview.instances.map((instance) => {
    var _a;
    const server = overview.serverSummaries.find((entry) => entry.serverInstanceId === instance.instanceId);
    return `
          <article class="admin-monitoring__card">
            <div class="admin-monitoring__card-head">
              <div><h3>${escapeHtml((server == null ? void 0 : server.displayName) ?? instance.displayName)}</h3><p>${escapeHtml(instance.instanceId)}</p></div>
              ${renderBadge(((_a = server == null ? void 0 : server.mode) == null ? void 0 : _a.toUpperCase()) ?? instance.mode.toUpperCase(), (server == null ? void 0 : server.mode) === "war" ? "critical" : "success")}
            </div>
            <dl class="admin-monitoring__kv">
              ${renderKv("Region", (server == null ? void 0 : server.region) ?? instance.region)}
              ${renderKv("Status", instance.status)}
              ${renderKv("Join policy", (server == null ? void 0 : server.joinPolicy) ?? "Není dostupné")}
              ${renderKv("Joinable", server ? server.joinable ? "Ano" : "Ne" : "Není dostupné")}
              ${renderKv("Players", String(instance.playerCount))}
              ${renderKv("Max players", String((server == null ? void 0 : server.maxPlayers) ?? "Není dostupné"))}
              ${renderKv("Current tick", String(instance.currentTick))}
              ${renderKv("Health", instance.healthStatus)}
              ${renderKv("Warnings", String(instance.warningCount))}
            </dl>
          </article>
        `;
  }).join("")}
    </div>
  </section>
`;
  const renderSelectedInstanceHealth = (selectedInstance, selectedServer, overview) => {
    var _a, _b, _c, _d, _e;
    return `
  <section class="admin-monitoring__panel">
    <div class="admin-monitoring__panel-head">
      <div><p class="admin-boot__eyebrow">Instance health</p><h2>${escapeHtml((selectedServer == null ? void 0 : selectedServer.displayName) ?? (selectedInstance == null ? void 0 : selectedInstance.displayName) ?? "Není dostupné")}</h2></div>
      ${renderBadge((selectedInstance == null ? void 0 : selectedInstance.healthStatus) ?? "unhealthy", (selectedInstance == null ? void 0 : selectedInstance.healthStatus) === "healthy" ? "success" : "warning")}
    </div>
    <div class="admin-monitoring__split">
      <div class="admin-monitoring__card">
        <dl class="admin-monitoring__kv">
          ${renderKv("Healthy", (selectedInstance == null ? void 0 : selectedInstance.healthStatus) ?? "Není dostupné")}
          ${renderKv("Warning count", String((selectedInstance == null ? void 0 : selectedInstance.warningCount) ?? 0))}
          ${renderKv("Last error", (selectedInstance == null ? void 0 : selectedInstance.lastErrorAt) ?? "Není dostupné")}
          ${renderKv("Last tick started", (selectedInstance == null ? void 0 : selectedInstance.lastTickStartedAt) ?? "Není dostupné")}
          ${renderKv("Last tick completed", (selectedInstance == null ? void 0 : selectedInstance.lastTickCompletedAt) ?? "Není dostupné")}
          ${renderKv("Queued events", String((selectedInstance == null ? void 0 : selectedInstance.queuedEventCount) ?? 0))}
          ${renderKv("Crash count", String((selectedInstance == null ? void 0 : selectedInstance.crashCount) ?? 0))}
        </dl>
        <div class="admin-monitoring__warnings">
          <strong>Warnings</strong>
          ${(((_b = (_a = overview.selectedHealth) == null ? void 0 : _a.warnings) == null ? void 0 : _b.length) ?? 0) > 0 ? `<ul>${overview.selectedHealth.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>` : "<p>Žádná runtime warning hlášení.</p>"}
        </div>
      </div>
      <div class="admin-monitoring__card">
        <div class="admin-monitoring__panel-head"><h3>Snapshot / persistence info</h3></div>
        <dl class="admin-monitoring__kv">
          ${renderKv("Last snapshot at", (selectedInstance == null ? void 0 : selectedInstance.lastSnapshotAt) ?? "Není dostupné")}
          ${renderKv("Snapshot schema version", String(((_c = overview.selectedDiagnostics) == null ? void 0 : _c.snapshotSchemaVersion) ?? "Není dostupné"))}
          ${renderKv("Diagnostic error count", String(((_d = overview.selectedDiagnostics) == null ? void 0 : _d.diagnosticErrorCount) ?? (selectedInstance == null ? void 0 : selectedInstance.diagnosticErrorCount) ?? 0))}
          ${renderKv("Command count", String((selectedInstance == null ? void 0 : selectedInstance.commandCount) ?? 0))}
          ${renderKv("Event count", String((selectedInstance == null ? void 0 : selectedInstance.eventCount) ?? 0))}
          ${renderKv("Last crash at", ((_e = overview.selectedDiagnostics) == null ? void 0 : _e.lastCrashAt) ?? "Není dostupné")}
        </dl>
      </div>
    </div>
  </section>
`;
  };
  const renderChecklist = () => `
  <section class="admin-monitoring__panel admin-monitoring__panel--sticky">
    <div class="admin-monitoring__panel-head"><div><p class="admin-boot__eyebrow">Closed-alpha checklist</p><h2>Readiness</h2></div></div>
    <ul class="admin-monitoring__checklist">${CHECKLIST_ITEMS.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </section>
`;
  const renderEvents = (overview) => `
  <section class="admin-monitoring__panel">
    <div class="admin-monitoring__panel-head"><div><p class="admin-boot__eyebrow">Recent events</p><h2>Selected instance</h2></div></div>
    ${overview.selectedLogs.events.length === 0 ? "<p>Není dostupné.</p>" : `<ul class="admin-monitoring__mini-list">${overview.selectedLogs.events.map((event) => `<li><strong>${escapeHtml(event.eventType)}</strong><span>${escapeHtml(event.causedByCommandId ?? "manual")} · tick ${event.tickAtEmit}</span></li>`).join("")}</ul>`}
  </section>
`;
  const renderLogs = (title, rows, empty, headers) => `
  <section class="admin-monitoring__panel">
    <div class="admin-monitoring__panel-head"><div><p class="admin-boot__eyebrow">Selected instance</p><h2>${escapeHtml(title)}</h2></div></div>
    <div class="admin-monitoring__table-wrap">
      <table class="admin-monitoring__table"><thead><tr>${headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows || empty}</tbody></table>
    </div>
  </section>
`;
  const renderMetric = (label, value, detail) => `
  <article class="admin-monitoring__metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>
`;
  const renderKv = (label, value) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
  const renderBadge = (label, tone) => `<span class="admin-badge admin-badge--${tone}">${escapeHtml(label)}</span>`;
  const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
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
        try {
          mountTarget.innerHTML = renderInstanceListPage(await loadAdminOverview());
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
  void createAdminApp().mount();
})();
