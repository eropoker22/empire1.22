(function() {
  "use strict";
  const createAdminAppShell = (shell) => shell;
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
  const createAdminOverviewViewModel = (instances, selectedLogs) => {
    var _a;
    const selectedInstanceId = (selectedLogs == null ? void 0 : selectedLogs.instanceId) ?? ((_a = instances[0]) == null ? void 0 : _a.instanceId) ?? null;
    return {
      instances,
      selectedInstanceId,
      selectedLogs: {
        instanceId: selectedInstanceId,
        commands: (selectedLogs == null ? void 0 : selectedLogs.commands) ?? [],
        events: (selectedLogs == null ? void 0 : selectedLogs.events) ?? [],
        diagnostics: (selectedLogs == null ? void 0 : selectedLogs.diagnostics) ?? []
      }
    };
  };
  const renderInstanceListPage = (input) => {
    var _a, _b;
    const overview = Array.isArray(input) ? {
      instances: input,
      selectedInstanceId: ((_a = input[0]) == null ? void 0 : _a.instanceId) ?? null,
      selectedLogs: {
        instanceId: ((_b = input[0]) == null ? void 0 : _b.instanceId) ?? null,
        commands: [],
        events: [],
        diagnostics: []
      }
    } : input;
    return `
  <section class="admin-monitoring" aria-labelledby="admin-monitoring-title">
    <div class="admin-monitoring__header">
      <p class="admin-boot__eyebrow">Runtime monitoring</p>
      <h1 id="admin-monitoring-title">Empire Streets Admin</h1>
      <p>${overview.instances.length === 0 ? "Nejsou spuštěné žádné server instance." : `Běží ${overview.instances.length} server instancí.`}</p>
    </div>
    ${overview.instances.length === 0 ? renderEmptyState() : `${renderInstanceTable(overview.instances)}${renderInstanceLogDetail(overview)}`}
  </section>
`;
  };
  const renderEmptyState = () => `
  <div class="admin-monitoring__empty" role="status">
    <h2>Žádné instance</h2>
    <p>Monitoring je připojený, ale server runtime zatím nevrací žádné instance.</p>
  </div>
`;
  const renderInstanceTable = (instances) => `
  <div class="admin-monitoring__table-wrap">
    <table class="admin-monitoring__table">
      <thead>
        <tr>
          <th scope="col">Instance</th>
          <th scope="col">Mode</th>
          <th scope="col">Region</th>
          <th scope="col">Status</th>
          <th scope="col">Tick</th>
          <th scope="col">Players</th>
          <th scope="col">Alliances</th>
          <th scope="col">Health</th>
          <th scope="col">Crashes</th>
          <th scope="col">Queue</th>
          <th scope="col">Snapshot</th>
          <th scope="col">Last tick</th>
          <th scope="col">Logs</th>
        </tr>
      </thead>
      <tbody>
        ${instances.map(renderInstanceRow).join("")}
      </tbody>
    </table>
  </div>
`;
  const renderInstanceRow = (instance) => `
  <tr>
    <td>
      <strong>${escapeHtml$1(instance.displayName)}</strong>
      <span>${escapeHtml$1(instance.instanceId)}</span>
    </td>
    <td>${escapeHtml$1(instance.mode)}</td>
    <td>${escapeHtml$1(instance.region)}</td>
    <td>${escapeHtml$1(instance.status)}</td>
    <td>${instance.currentTick}</td>
    <td>${instance.playerCount}</td>
    <td>${instance.allianceCount}</td>
    <td>
      <span>${escapeHtml$1(instance.healthStatus)}</span>
      <span>warn ${instance.warningCount}</span>
    </td>
    <td>${instance.crashCount}</td>
    <td>${instance.queuedEventCount}</td>
    <td>${formatNullableIso(instance.lastSnapshotAt)}</td>
    <td>
      <span>start ${formatNullableIso(instance.lastTickStartedAt)}</span>
      <span>end ${formatNullableIso(instance.lastTickCompletedAt)}</span>
    </td>
    <td>
      <span>cmd ${instance.commandCount}</span>
      <span>evt ${instance.eventCount}</span>
      <span>err ${instance.diagnosticErrorCount}</span>
    </td>
  </tr>
`;
  const renderInstanceLogDetail = (overview) => `
  <section class="admin-monitoring__detail" aria-label="Instance log detail">
    <h2>Detail instance ${escapeHtml$1(overview.selectedInstanceId ?? "n/a")}</h2>
    <div class="admin-monitoring__log-grid">
      ${renderCommandLogs(overview.selectedLogs.commands)}
      ${renderEventLogs(overview.selectedLogs.events)}
      ${renderDiagnosticLogs(overview.selectedLogs.diagnostics)}
    </div>
  </section>
`;
  const renderCommandLogs = (logs) => `
  <article class="admin-monitoring__log-panel">
    <h3>Recent commands</h3>
    ${logs.length === 0 ? "<p>Žádné command logy.</p>" : `
      <ol>${logs.map((log) => `
        <li>
          <strong>${escapeHtml$1(log.commandType)}</strong>
          <span>${escapeHtml$1(log.commandId)} · ${escapeHtml$1(log.actorId)} · tick ${log.tickAtReceive}</span>
        </li>
      `).join("")}</ol>
    `}
  </article>
`;
  const renderEventLogs = (logs) => `
  <article class="admin-monitoring__log-panel">
    <h3>Recent events</h3>
    ${logs.length === 0 ? "<p>Žádné event logy.</p>" : `
      <ol>${logs.map((log) => `
        <li>
          <strong>${escapeHtml$1(log.eventType)}</strong>
          <span>${escapeHtml$1(log.causedByCommandId ?? "manual")} · tick ${log.tickAtEmit}</span>
        </li>
      `).join("")}</ol>
    `}
  </article>
`;
  const renderDiagnosticLogs = (logs) => `
  <article class="admin-monitoring__log-panel">
    <h3>Recent diagnostics</h3>
    ${logs.length === 0 ? "<p>Žádné diagnostic logy.</p>" : `
      <ol>${logs.map((log) => `
        <li>
          <strong>${escapeHtml$1(log.level)} · ${escapeHtml$1(log.category)}</strong>
          <span>${escapeHtml$1(log.message)} · ${formatNullableIso(log.occurredAt)}</span>
        </li>
      `).join("")}</ol>
    `}
  </article>
`;
  const formatNullableIso = (value) => value ? escapeHtml$1(value) : "n/a";
  const escapeHtml$1 = (value) => value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character] ?? character);
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
        occurredAt: record.occurredAt
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
        receivedAt: record.receivedAt,
        tickAtReceive: record.tickAtReceive
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
        }
      }
    });
    async function loadAdminOverview() {
      var _a2, _b2;
      if (options.fetchAdminOverview) {
        return options.fetchAdminOverview();
      }
      if (!options.fetchMonitoringSummaries && !((_a2 = options.facades) == null ? void 0 : _a2.instance)) {
        const endpointOverview = await fetchAdminOverviewFromEndpoint(options.monitoringEndpoint ?? "/api/admin/monitoring");
        if (endpointOverview) {
          return endpointOverview;
        }
      }
      const monitoringSummaries = await loadMonitoringSummaries(options);
      const viewModels = monitoringSummaries.length > 0 ? monitoringSummaries.map(createAdminInstanceViewModelFromMonitoringSummary) : await loadLegacyInstanceViewModels();
      const selectedInstanceId = ((_b2 = viewModels[0]) == null ? void 0 : _b2.instanceId) ?? null;
      return createAdminOverviewViewModel(
        viewModels,
        selectedInstanceId ? await loadSelectedLogs(selectedInstanceId) : void 0
      );
    }
    async function loadSelectedLogs(instanceId) {
      const [commands, events, diagnostics] = await Promise.all([
        logReadService.listRecentCommandLogs(instanceId, 5),
        logReadService.listRecentEventLogs(instanceId, 5),
        diagnosticsReadService.listRecentDiagnosticLogs(instanceId, 5)
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
    return ((_d = await fetchAdminOverviewFromEndpoint(options.monitoringEndpoint ?? "/api/admin/monitoring")) == null ? void 0 : _d.instances.map((instance) => ({
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
  const fetchAdminOverviewFromEndpoint = async (endpoint) => {
    var _a;
    if (typeof fetch === "undefined") {
      return null;
    }
    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json"
      }
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    if ((_a = payload.overview) == null ? void 0 : _a.instances) {
      return payload.overview;
    }
    return Array.isArray(payload.instances) ? createAdminOverviewViewModel(payload.instances.map(createAdminInstanceViewModelFromMonitoringSummary)) : null;
  };
  const resolveDefaultMountTarget = () => typeof document === "undefined" ? null : document.getElementById("admin-dashboard-root");
  const renderAdminError = (error) => `
  <section class="admin-monitoring" role="alert">
    <p class="admin-boot__eyebrow">Runtime monitoring</p>
    <h1>Empire Streets Admin</h1>
    <p>Admin monitoring se nepodařilo načíst.</p>
    <pre>${escapeHtml(error instanceof Error ? error.message : String(error))}</pre>
  </section>
`;
  const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character] ?? character);
  void createAdminApp().mount();
})();
