import type {
  AdminDashboardReadModel,
  AdminFeatureMode,
  AdminInstanceViewModel,
  AdminLockedControl,
  AdminOverviewViewModel
} from "../read-models";
import {
  createAdminDashboardReadModel,
  createAdminOverviewViewModel,
  sanitizeAdminDisplayText
} from "../read-models";
import type { AdminProjectionHealthStatus, AdminProjectionSource } from "@empire/shared-types";

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
] as const;

export const renderInstanceListPage = (
  input: AdminInstanceViewModel[] | AdminOverviewViewModel
): string => {
  const overview = normalizeOverview(input);
  const dashboard = createAdminDashboardReadModel(overview);
  const selectedInstance = overview.instances.find((instance) => instance.instanceId === overview.selectedInstanceId)
    ?? overview.instances[0]
    ?? null;
  const freeServer = overview.serverSummaries.find((server) => server.mode === "free") ?? null;
  const warServer = overview.serverSummaries.find((server) => server.mode === "war") ?? null;
  const latestCommand = overview.selectedLogs.commands.at(-1) ?? null;
  const latestError = overview.selectedLogs.diagnostics
    .filter((diagnostic) => diagnostic.level === "error" || diagnostic.level === "warn")
    .at(-1)
    ?? null;

  return `
    ${renderSidebar(dashboard)}
    <section class="admin-main admin-ops" aria-labelledby="admin-ops-title">
      ${renderTopbar(dashboard, freeServer?.joinable ?? false, warServer?.joinable ?? false)}
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
            latestCommand: latestCommand?.commandType ?? "Neni dostupne",
            latestError: latestError?.message ?? selectedInstance?.lastErrorAt ?? "No recent error",
            healthWarnings: overview.selectedHealth?.warnings ?? []
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

const normalizeOverview = (
  input: AdminInstanceViewModel[] | AdminOverviewViewModel
): AdminOverviewViewModel =>
  Array.isArray(input)
    ? createAdminOverviewViewModel(input, {
        selectedLogs: {
          instanceId: input[0]?.instanceId ?? null,
          commands: [],
          events: [],
          diagnostics: []
        }
      })
    : input;

const renderSidebar = (dashboard: AdminDashboardReadModel): string => `
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

const renderTopbar = (
  dashboard: AdminDashboardReadModel,
  freeJoinable: boolean,
  warJoinable: boolean
): string => `
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

const renderStatusField = (label: string, value: string): string => `
  <div class="admin-profile">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
  </div>
`;

const renderEmptyState = (): string => `
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

const renderOverviewSection = (
  dashboard: AdminDashboardReadModel,
  input: {
    selectedInstance: AdminInstanceViewModel | null;
    latestCommand: string;
    latestError: string;
    healthWarnings: string[];
  }
): string => `
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
          ${renderKv("Selected instance", input.selectedInstance?.instanceId ?? "Neni dostupne")}
          ${renderKv("Health", input.selectedInstance?.healthStatus ?? "Neni dostupne")}
          ${renderKv("Queued events", String(input.selectedInstance?.queuedEventCount ?? 0))}
          ${renderKv("Warnings", String(input.selectedInstance?.warningCount ?? 0))}
        </div>
        ${input.healthWarnings.length > 0
          ? `<ul class="admin-compact-list">${input.healthWarnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`
          : ""}
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

const renderServersSection = (dashboard: AdminDashboardReadModel): string => `
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
    `).join(""), "<tr><td colspan=\"12\">Zadne instance.</td></tr>")}
  </section>
`;

const renderPlayersSection = (dashboard: AdminDashboardReadModel): string => `
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
    `).join(""), "<tr><td colspan=\"12\">Zadne player projection rows.</td></tr>")}
  </section>
`;

const renderMapSection = (dashboard: AdminDashboardReadModel): string => `
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
      `).join(""), "<tr><td colspan=\"12\">No district projection rows.</td></tr>")}
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

const renderEconomySection = (dashboard: AdminDashboardReadModel): string => `
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
          `).join(""), "<tr><td colspan=\"3\">No positive resource holder rows.</td></tr>")}
        </div>
        <div>
          <h4 class="admin-subhead">Resource totals</h4>
          ${renderTable(["Resource", "Total"], Object.entries(dashboard.economy.totalResources).map(([key, amount]) => `
            <tr><td>${escapeHtml(key)}</td><td>${formatNumber(amount)}</td></tr>
          `).join(""), "<tr><td colspan=\"2\">No resource totals.</td></tr>")}
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

const renderProductionSection = (dashboard: AdminDashboardReadModel): string => `
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
    `).join(""), "<tr><td colspan=\"6\">No production building projection rows.</td></tr>")}
    <h4 class="admin-subhead">Craft processing</h4>
    ${renderTable(["Building", "District", "Recipe", "Ticks", "Remaining"], dashboard.production.activeCraftJobs.map((job) => `
      <tr>
        <td>${escapeHtml(job.buildingTypeId)}<br><small>${escapeHtml(job.buildingId)}</small></td>
        <td>${escapeHtml(job.districtId)}</td>
        <td>${escapeHtml(job.recipeLabel)}<br><small>${escapeHtml(job.recipeId)}</small></td>
        <td>${job.startedTick} → ${job.completesTick}</td>
        <td>${escapeHtml(job.remainingLabel)}</td>
      </tr>
    `).join(""), "<tr><td colspan=\"5\">No active craft processing.</td></tr>")}
    <h4 class="admin-subhead">Cooldowns and bottlenecks</h4>
    ${renderTable(["Owner", "Key", "Remaining"], dashboard.production.cooldowns.map((cooldown) => `
      <tr><td>${escapeHtml(cooldown.ownerType)} · ${escapeHtml(cooldown.ownerId)}</td><td>${escapeHtml(cooldown.key)}</td><td>${escapeHtml(cooldown.remainingLabel)}</td></tr>
    `).join(""), "<tr><td colspan=\"3\">No production/building action cooldowns.</td></tr>")}
    ${renderNotes([...dashboard.production.warnings, ...dashboard.production.bottleneckResources.map((entry) => `${entry.resourceKey}: ${entry.warning}`)])}
  </section>
`;

const renderPoliceSection = (dashboard: AdminDashboardReadModel): string => `
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
        `).join(""), "<tr><td colspan=\"4\">No police player rows.</td></tr>")}
      </div>
      <div>
        <h4 class="admin-subhead">District hotspots</h4>
        ${renderTable(["District", "Heat", "Owner"], dashboard.police.districtHotspots.map((district) => `
          <tr><td>${escapeHtml(district.name)}<br><small>${escapeHtml(district.districtId)}</small></td><td>${formatNumber(district.heat)}</td><td>${escapeHtml(district.ownerPlayerId ?? "none")}</td></tr>
        `).join(""), "<tr><td colspan=\"3\">No district heat hotspots.</td></tr>")}
      </div>
    </div>
    <h4 class="admin-subhead">Pending raids</h4>
    ${renderTable(["Raid", "Player", "District", "Severity", "Status", "Remaining", "Reason"], dashboard.police.pendingRaids.map((raid) => `
      <tr><td>${escapeHtml(raid.raidId)}</td><td>${escapeHtml(raid.playerId)}</td><td>${escapeHtml(raid.targetDistrictId ?? "none")}</td><td>${escapeHtml(raid.severity)}</td><td>${escapeHtml(raid.status)}</td><td>${raid.remainingTicks} ticks</td><td>${escapeHtml(raid.reason)}</td></tr>
    `).join(""), "<tr><td colspan=\"7\">No pending raids.</td></tr>")}
    ${renderNotes(dashboard.police.warnings)}
  </section>
`;

const renderOrdersSection = (dashboard: AdminDashboardReadModel): string => `
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
    `).join(""), "<tr><td colspan=\"10\">No active order/cooldown projection rows.</td></tr>")}
  </section>
`;

const renderEventsLogsSection = (
  dashboard: AdminDashboardReadModel,
  overview: AdminOverviewViewModel
): string => `
  <section id="admin-events" class="admin-section-anchor">
    <div class="admin-grid admin-grid--overview">
      <article class="admin-panel">
        <div class="admin-panel__head"><div><span>Events/Logs</span><h3>Sanitized event projection</h3></div>${renderBadge("SANITIZED", "info")}</div>
        ${renderFilterChips(["notice", "warning", "error", "runtime", "diagnostic"])}
        ${renderTable(["Severity", "Type", "Summary", "Player", "District", "Payload", "Created"], dashboard.events.map((event) => `
          <tr><td>${renderSeverity(event.severity)}</td><td>${escapeHtml(event.type)}</td><td>${escapeHtml(event.summary)}</td><td>${escapeHtml(event.playerId ?? "")}</td><td>${escapeHtml(event.districtId ?? "")}</td><td><code>${escapeHtml(event.payloadPreview)}</code></td><td>${escapeHtml(event.createdAt)}</td></tr>
        `).join(""), "<tr><td colspan=\"7\">Zadne recent events.</td></tr>")}
      </article>
      <article class="admin-panel">
        <div class="admin-panel__head"><div><span>Selected instance</span><h3>Recent commands</h3></div></div>
        ${renderTable(["Type", "Command", "Actor / playerId", "Tick", "Received", "Correlation", "Status"], overview.selectedLogs.commands.map((log) => `
          <tr><td>${escapeHtml(log.commandType)}</td><td>${escapeHtml(log.commandId)}</td><td>${escapeHtml(log.actorId)}</td><td>${log.tickAtReceive}</td><td>${escapeHtml(log.receivedAt)}</td><td>${escapeHtml(log.correlationId ?? "Neni dostupne")}</td><td>${escapeHtml(log.status)}</td></tr>
        `).join(""), "<tr><td colspan=\"7\">Zadne command logy.</td></tr>")}
      </article>
    </div>
    <article class="admin-panel">
      <div class="admin-panel__head"><div><span>Selected instance</span><h3>Recent diagnostics / errors</h3></div></div>
      ${renderTable(["Level", "Category", "Message", "Occurred", "Command", "Correlation"], overview.selectedLogs.diagnostics.map((log) => `
        <tr><td>${escapeHtml(log.level)}</td><td>${escapeHtml(log.category)}</td><td>${escapeHtml(log.message)}</td><td>${escapeHtml(log.occurredAt)}</td><td>${escapeHtml(log.commandId ?? "Neni dostupne")}</td><td>${escapeHtml(log.correlationId ?? "Neni dostupne")}</td></tr>
      `).join(""), "<tr><td colspan=\"6\">Zadne diagnostics.</td></tr>")}
    </article>
  </section>
`;

const renderPresetsSection = (dashboard: AdminDashboardReadModel): string => {
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

const renderMessagesSection = (): string => `
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

const renderFutureControlsSection = (dashboard: AdminDashboardReadModel): string => `
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

const renderChecklistSection = (dashboard: AdminDashboardReadModel): string => `
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

const renderScopeTable = (dashboard: AdminDashboardReadModel): string => `
  <article class="admin-panel">
    <div class="admin-panel__head"><div><span>Admin scope</span><h3>Read-only / mock / locked split</h3></div></div>
    ${renderTable(["Feature", "Mode", "Status", "Risk"], dashboard.scope.map((item) => `
      <tr><td>${escapeHtml(item.feature)}</td><td>${renderModeBadge(item.mode)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.risk)}</td></tr>
    `).join(""))}
  </article>
`;

const renderLockedControlCard = (control: AdminLockedControl): string => `
  <article class="admin-locked-control" data-admin-locked-control="${escapeAttribute(control.id)}">
    <div>
      <strong>${escapeHtml(control.label)}</strong>
      <p>${escapeHtml(control.disabledReason)}</p>
    </div>
    <button class="admin-button" type="button" disabled aria-disabled="true">Locked</button>
    <small>Requires: ${escapeHtml(control.requirements.join(", "))}</small>
  </article>
`;

const renderReadonlySetting = (label: string, value: string): string => `
  <label class="admin-setting">
    <span>${escapeHtml(label)}</span>
    <input type="text" value="${escapeAttribute(value)}" readonly>
  </label>
`;

const renderTable = (
  headers: string[],
  rows: string,
  empty = ""
): string => `
  <div class="admin-table-wrap">
    <table class="admin-table">
      <thead><tr>${headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>${rows || empty}</tbody>
    </table>
  </div>
`;

const renderMetric = (label: string, value: string, detail: string): string => `
  <article class="admin-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>
`;

const renderKv = (label: string, value: string): string => `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span>`;

const renderBadge = (
  label: string,
  tone: "success" | "warning" | "critical" | "danger" | "info"
): string =>
  `<span class="admin-badge admin-badge--${tone}">${escapeHtml(label)}</span>`;

const renderSourceBadge = (source: AdminProjectionSource): string => {
  const tone = source === "runtime"
    ? "success"
    : source === "demo-sample" || source === "config"
      ? "warning"
      : "critical";
  return renderBadge(source.toUpperCase(), tone);
};

const renderModeBadge = (mode: AdminFeatureMode): string => {
  const tone = mode === "read-only"
    ? "success"
    : mode === "mock"
      ? "warning"
      : "critical";

  return renderBadge(mode.toUpperCase(), tone);
};

const renderHealthBadge = (status: AdminProjectionHealthStatus): string => {
  const tone = status === "ok"
    ? "success"
    : status === "warning"
      ? "warning"
      : "critical";
  return renderBadge(status.toUpperCase(), tone);
};

const renderSeverity = (severity: "notice" | "warning" | "error"): string =>
  `<span class="admin-severity admin-severity--${severity === "error" ? "error" : severity}">${escapeHtml(severity)}</span>`;

const renderStatusPill = (status: string): string => {
  const normalized = status.toLowerCase();
  const tone = normalized.includes("running") || normalized.includes("active") || normalized.includes("ready") || normalized.includes("fresh") || normalized.includes("claimed")
    ? "green"
    : normalized.includes("warn") || normalized.includes("medium") || normalized.includes("cooldown") || normalized.includes("locked")
      ? "orange"
      : normalized.includes("error") || normalized.includes("destroyed") || normalized.includes("banned") || normalized.includes("full")
        ? "red"
        : "cyan";
  return `<span class="admin-table-status admin-table-status--${tone}">${escapeHtml(status)}</span>`;
};

const renderWarnings = (warnings: string[]): string =>
  warnings.length > 0
    ? `<ul class="admin-mini-list">${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`
    : `<small>none</small>`;

const renderNotes = (notes: string[]): string =>
  notes.length > 0
    ? `<ul class="admin-compact-list">${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>`
    : "";

const renderFilterChips = (filters: string[]): string => `
  <div class="admin-filter-row" aria-label="Read-only filters">
    ${filters.map((filter) => `<span class="admin-filter-chip">${escapeHtml(filter)}</span>`).join("")}
  </div>
`;

const requireLockedControl = (
  dashboard: AdminDashboardReadModel,
  id: string
): AdminLockedControl =>
  dashboard.lockedControls.find((control) => control.id === id)
    ?? dashboard.lockedControls[0]!;

const formatMoney = (amount: number): string => `$${formatNumber(amount)}`;

const formatNumber = (amount: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.max(0, Number(amount || 0)));

const escapeHtml = (value: string): string =>
  sanitizeAdminDisplayText(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character] ?? character);

const escapeAttribute = (value: string): string => escapeHtml(value);
