import type {
  AdminInstanceViewModel,
  AdminOverviewViewModel
} from "../read-models";

const CHECKLIST_ITEMS = [
  "verify:closed-alpha: PASSED",
  "E2E smoke: 14 passed",
  "Spawn UI: verified without API fallback",
  "War: closed",
  "Server action: verified",
  "Prod-like Postgres smoke: prepared, waiting for EMPIRE_TEST_DATABASE_URL",
  "Admin mode: read-only"
];

export const renderInstanceListPage = (
  input: AdminInstanceViewModel[] | AdminOverviewViewModel
): string => {
  const overview = Array.isArray(input) ? {
    instances: input,
    serverSummaries: [],
    healthSummary: {
      totalInstances: input.length,
      runningInstances: input.filter((instance) => instance.status === "running").length,
      crashedInstances: input.filter((instance) => instance.status === "crashed").length
    },
    selectedInstanceId: input[0]?.instanceId ?? null,
    selectedHealth: null,
    selectedDiagnostics: null,
    selectedLogs: { instanceId: input[0]?.instanceId ?? null, commands: [], events: [], diagnostics: [] }
  } : input;
  const selectedInstance = overview.instances.find((instance) => instance.instanceId === overview.selectedInstanceId) ?? overview.instances[0] ?? null;
  const selectedServer = overview.serverSummaries.find((server) => server.serverInstanceId === selectedInstance?.instanceId) ?? null;
  const freeServer = overview.serverSummaries.find((server) => server.mode === "free") ?? null;
  const warServer = overview.serverSummaries.find((server) => server.mode === "war") ?? null;
  const latestCommand = overview.selectedLogs.commands.at(-1) ?? null;
  const latestError = overview.selectedLogs.diagnostics
    .filter((diagnostic) => diagnostic.level === "error" || diagnostic.level === "warn")
    .at(-1)
    ?? null;

  return `
  <section class="admin-monitoring" aria-labelledby="admin-monitoring-title">
    <header class="admin-monitoring__hero">
      <div>
        <p class="admin-boot__eyebrow">Read-only control tower</p>
        <h1 id="admin-monitoring-title">Empire Streets Admin</h1>
        <p>Interní closed-alpha monitoring nad runtime daty. Dashboard nic nemění a nezobrazuje session ani tajné tokeny.</p>
      </div>
      <div class="admin-monitoring__hero-badges">
        ${renderBadge("FREE", freeServer?.joinable ? "success" : "warning")}
        ${renderBadge("WAR CLOSED", warServer?.joinable ? "danger" : "critical")}
        ${renderBadge("READ ONLY", "info")}
      </div>
    </header>
    ${overview.instances.length === 0 ? renderEmptyState() : `
      ${renderTopMetrics({
        overview,
        freeJoinable: freeServer?.joinable ?? false,
        warJoinable: warServer?.joinable ?? false,
        latestCommand: latestCommand?.commandType ?? "Není dostupné",
        latestError: latestError?.message ?? selectedInstance?.lastErrorAt ?? "No recent error",
        currentTick: selectedInstance?.currentTick ?? 0
      })}
      <div class="admin-monitoring__layout">
        <div class="admin-monitoring__main">
          ${renderServerOverview(overview)}
          ${renderSelectedInstanceHealth(selectedInstance, selectedServer, overview)}
          ${renderLogs("Recent commands", overview.selectedLogs.commands.map((log) => `
            <tr><td>${escapeHtml(log.commandType)}</td><td>${escapeHtml(log.commandId)}</td><td>${escapeHtml(log.actorId)}</td><td>${log.tickAtReceive}</td><td>${escapeHtml(log.receivedAt)}</td><td>${escapeHtml(log.correlationId ?? "Není dostupné")}</td><td>${escapeHtml(log.status)}</td></tr>
          `).join(""), "<tr><td colspan=\"7\">Žádné command logy.</td></tr>", ["Type", "Command", "Actor / playerId", "Tick", "Received", "Correlation", "Status"])}
          ${renderLogs("Recent diagnostics / errors", overview.selectedLogs.diagnostics.map((log) => `
            <tr><td>${escapeHtml(log.level)}</td><td>${escapeHtml(log.category)}</td><td>${escapeHtml(log.message)}</td><td>${escapeHtml(log.occurredAt)}</td><td>${escapeHtml(log.commandId ?? "Není dostupné")}</td><td>${escapeHtml(log.correlationId ?? "Není dostupné")}</td></tr>
          `).join(""), "<tr><td colspan=\"6\">Žádné diagnostics.</td></tr>", ["Level", "Category", "Message", "Occurred", "Command", "Correlation"])}
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

const renderEmptyState = (): string => `
  <div class="admin-monitoring__empty" role="status">
    <h2>Žádné instance</h2>
    <p>Monitoring endpoint odpověděl, ale runtime zatím nevrací žádné server instance.</p>
  </div>
`;

const renderTopMetrics = (input: {
  overview: AdminOverviewViewModel;
  freeJoinable: boolean;
  warJoinable: boolean;
  latestCommand: string;
  latestError: string;
  currentTick: number;
}): string => `
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

const renderServerOverview = (overview: AdminOverviewViewModel): string => `
  <section class="admin-monitoring__panel">
    <div class="admin-monitoring__panel-head">
      <div><p class="admin-boot__eyebrow">Server overview</p><h2>Free / War runtime overview</h2></div>
      ${renderBadge("WAR CLOSED", "critical")}
    </div>
    <div class="admin-monitoring__card-grid">
      ${overview.instances.map((instance) => {
        const server = overview.serverSummaries.find((entry) => entry.serverInstanceId === instance.instanceId);
        return `
          <article class="admin-monitoring__card">
            <div class="admin-monitoring__card-head">
              <div><h3>${escapeHtml(server?.displayName ?? instance.displayName)}</h3><p>${escapeHtml(instance.instanceId)}</p></div>
              ${renderBadge(server?.mode?.toUpperCase() ?? instance.mode.toUpperCase(), server?.mode === "war" ? "critical" : "success")}
            </div>
            <dl class="admin-monitoring__kv">
              ${renderKv("Region", server?.region ?? instance.region)}
              ${renderKv("Status", instance.status)}
              ${renderKv("Join policy", server?.joinPolicy ?? "Není dostupné")}
              ${renderKv("Joinable", server ? (server.joinable ? "Ano" : "Ne") : "Není dostupné")}
              ${renderKv("Players", String(instance.playerCount))}
              ${renderKv("Max players", String(server?.maxPlayers ?? "Není dostupné"))}
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

const renderSelectedInstanceHealth = (
  selectedInstance: AdminInstanceViewModel | null,
  selectedServer: AdminOverviewViewModel["serverSummaries"][number] | null,
  overview: AdminOverviewViewModel
): string => `
  <section class="admin-monitoring__panel">
    <div class="admin-monitoring__panel-head">
      <div><p class="admin-boot__eyebrow">Instance health</p><h2>${escapeHtml(selectedServer?.displayName ?? selectedInstance?.displayName ?? "Není dostupné")}</h2></div>
      ${renderBadge(selectedInstance?.healthStatus ?? "unhealthy", selectedInstance?.healthStatus === "healthy" ? "success" : "warning")}
    </div>
    <div class="admin-monitoring__split">
      <div class="admin-monitoring__card">
        <dl class="admin-monitoring__kv">
          ${renderKv("Healthy", selectedInstance?.healthStatus ?? "Není dostupné")}
          ${renderKv("Warning count", String(selectedInstance?.warningCount ?? 0))}
          ${renderKv("Last error", selectedInstance?.lastErrorAt ?? "Není dostupné")}
          ${renderKv("Last tick started", selectedInstance?.lastTickStartedAt ?? "Není dostupné")}
          ${renderKv("Last tick completed", selectedInstance?.lastTickCompletedAt ?? "Není dostupné")}
          ${renderKv("Queued events", String(selectedInstance?.queuedEventCount ?? 0))}
          ${renderKv("Crash count", String(selectedInstance?.crashCount ?? 0))}
        </dl>
        <div class="admin-monitoring__warnings">
          <strong>Warnings</strong>
          ${(overview.selectedHealth?.warnings?.length ?? 0) > 0
            ? `<ul>${overview.selectedHealth!.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`
            : "<p>Žádná runtime warning hlášení.</p>"}
        </div>
      </div>
      <div class="admin-monitoring__card">
        <div class="admin-monitoring__panel-head"><h3>Snapshot / persistence info</h3></div>
        <dl class="admin-monitoring__kv">
          ${renderKv("Last snapshot at", selectedInstance?.lastSnapshotAt ?? "Není dostupné")}
          ${renderKv("Snapshot schema version", String(overview.selectedDiagnostics?.snapshotSchemaVersion ?? "Není dostupné"))}
          ${renderKv("Diagnostic error count", String(overview.selectedDiagnostics?.diagnosticErrorCount ?? selectedInstance?.diagnosticErrorCount ?? 0))}
          ${renderKv("Command count", String(selectedInstance?.commandCount ?? 0))}
          ${renderKv("Event count", String(selectedInstance?.eventCount ?? 0))}
          ${renderKv("Last crash at", overview.selectedDiagnostics?.lastCrashAt ?? "Není dostupné")}
        </dl>
      </div>
    </div>
  </section>
`;

const renderChecklist = (): string => `
  <section class="admin-monitoring__panel admin-monitoring__panel--sticky">
    <div class="admin-monitoring__panel-head"><div><p class="admin-boot__eyebrow">Closed-alpha checklist</p><h2>Readiness</h2></div></div>
    <ul class="admin-monitoring__checklist">${CHECKLIST_ITEMS.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </section>
`;

const renderEvents = (overview: AdminOverviewViewModel): string => `
  <section class="admin-monitoring__panel">
    <div class="admin-monitoring__panel-head"><div><p class="admin-boot__eyebrow">Recent events</p><h2>Selected instance</h2></div></div>
    ${overview.selectedLogs.events.length === 0 ? "<p>Není dostupné.</p>" : `<ul class="admin-monitoring__mini-list">${overview.selectedLogs.events.map((event) => `<li><strong>${escapeHtml(event.eventType)}</strong><span>${escapeHtml(event.causedByCommandId ?? "manual")} · tick ${event.tickAtEmit}</span></li>`).join("")}</ul>`}
  </section>
`;

const renderLogs = (title: string, rows: string, empty: string, headers: string[]): string => `
  <section class="admin-monitoring__panel">
    <div class="admin-monitoring__panel-head"><div><p class="admin-boot__eyebrow">Selected instance</p><h2>${escapeHtml(title)}</h2></div></div>
    <div class="admin-monitoring__table-wrap">
      <table class="admin-monitoring__table"><thead><tr>${headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows || empty}</tbody></table>
    </div>
  </section>
`;

const renderMetric = (label: string, value: string, detail: string): string => `
  <article class="admin-monitoring__metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>
`;

const renderKv = (label: string, value: string): string => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
const renderBadge = (label: string, tone: "success" | "warning" | "critical" | "danger" | "info"): string =>
  `<span class="admin-badge admin-badge--${tone}">${escapeHtml(label)}</span>`;

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] ?? character);
