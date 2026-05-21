import type {
  AdminInstanceViewModel,
  AdminOverviewViewModel
} from "../read-models";
import type {
  AdminCommandLogEntry,
  AdminDiagnosticLogEntry,
  AdminEventLogEntry
} from "../services";

/**
 * Responsibility: Page shell for the read-only admin instance monitoring screen.
 * Belongs here: page-level HTML composition over admin view models.
 * Does not belong here: gameplay logic or data source implementation.
 */
export const renderInstanceListPage = (
  input: AdminInstanceViewModel[] | AdminOverviewViewModel
): string => {
  const overview = Array.isArray(input)
    ? {
        instances: input,
        selectedInstanceId: input[0]?.instanceId ?? null,
        selectedLogs: {
          instanceId: input[0]?.instanceId ?? null,
          commands: [],
          events: [],
          diagnostics: []
        }
      }
    : input;

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

const renderEmptyState = (): string => `
  <div class="admin-monitoring__empty" role="status">
    <h2>Žádné instance</h2>
    <p>Monitoring je připojený, ale server runtime zatím nevrací žádné instance.</p>
  </div>
`;

const renderInstanceTable = (instances: AdminInstanceViewModel[]): string => `
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

const renderInstanceRow = (instance: AdminInstanceViewModel): string => `
  <tr>
    <td>
      <strong>${escapeHtml(instance.displayName)}</strong>
      <span>${escapeHtml(instance.instanceId)}</span>
    </td>
    <td>${escapeHtml(instance.mode)}</td>
    <td>${escapeHtml(instance.region)}</td>
    <td>${escapeHtml(instance.status)}</td>
    <td>${instance.currentTick}</td>
    <td>${instance.playerCount}</td>
    <td>${instance.allianceCount}</td>
    <td>
      <span>${escapeHtml(instance.healthStatus)}</span>
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

const renderInstanceLogDetail = (overview: AdminOverviewViewModel): string => `
  <section class="admin-monitoring__detail" aria-label="Instance log detail">
    <h2>Detail instance ${escapeHtml(overview.selectedInstanceId ?? "n/a")}</h2>
    <div class="admin-monitoring__log-grid">
      ${renderCommandLogs(overview.selectedLogs.commands)}
      ${renderEventLogs(overview.selectedLogs.events)}
      ${renderDiagnosticLogs(overview.selectedLogs.diagnostics)}
    </div>
  </section>
`;

const renderCommandLogs = (logs: AdminCommandLogEntry[]): string => `
  <article class="admin-monitoring__log-panel">
    <h3>Recent commands</h3>
    ${logs.length === 0 ? "<p>Žádné command logy.</p>" : `
      <ol>${logs.map((log) => `
        <li>
          <strong>${escapeHtml(log.commandType)}</strong>
          <span>${escapeHtml(log.commandId)} · ${escapeHtml(log.actorId)} · tick ${log.tickAtReceive}</span>
        </li>
      `).join("")}</ol>
    `}
  </article>
`;

const renderEventLogs = (logs: AdminEventLogEntry[]): string => `
  <article class="admin-monitoring__log-panel">
    <h3>Recent events</h3>
    ${logs.length === 0 ? "<p>Žádné event logy.</p>" : `
      <ol>${logs.map((log) => `
        <li>
          <strong>${escapeHtml(log.eventType)}</strong>
          <span>${escapeHtml(log.causedByCommandId ?? "manual")} · tick ${log.tickAtEmit}</span>
        </li>
      `).join("")}</ol>
    `}
  </article>
`;

const renderDiagnosticLogs = (logs: AdminDiagnosticLogEntry[]): string => `
  <article class="admin-monitoring__log-panel">
    <h3>Recent diagnostics</h3>
    ${logs.length === 0 ? "<p>Žádné diagnostic logy.</p>" : `
      <ol>${logs.map((log) => `
        <li>
          <strong>${escapeHtml(log.level)} · ${escapeHtml(log.category)}</strong>
          <span>${escapeHtml(log.message)} · ${formatNullableIso(log.occurredAt)}</span>
        </li>
      `).join("")}</ol>
    `}
  </article>
`;

const formatNullableIso = (value: string | null): string => value ? escapeHtml(value) : "n/a";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character] ?? character);
