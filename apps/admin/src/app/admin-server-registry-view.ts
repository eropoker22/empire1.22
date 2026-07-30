import type { AdminInstanceSummaryView } from "@empire/shared-types";
import type { AdminServerFilterState } from "./admin-app-dom";
import {
  attribute,
  badge,
  escapeHtml,
  formatTime,
  pill,
  statusLabel,
  table
} from "./admin-view-helpers";

export const renderAdminServers = (
  instances: AdminInstanceSummaryView[],
  selected: string | null,
  filters: AdminServerFilterState
): string => {
  const activeCount = instances.filter((item) => serverVisibility(item.status) === "active").length;
  const inactiveCount = instances.length - activeCount;
  return `
  <section id="admin-servers" class="admin-panel admin-server-registry admin-section-anchor">
    <div class="admin-panel__head"><div><span>Server registry</span><h3>Herní instance</h3>
      <p>Vyberte server pro detail a bezpečné operace.</p></div>${badge(`${instances.length} INSTANCÍ`, "info")}</div>
    <div class="admin-server-scope-tabs" role="tablist" aria-label="Dostupnost serverů">
      ${serverScopeTab("active", "Aktivní", activeCount, filters.visibility)}
      ${serverScopeTab("inactive", "Neaktivní a historie", inactiveCount, filters.visibility)}
    </div>
    ${renderServerFilters(instances, filters)}
    ${instances.length === 0 ? `<p class="admin-copy">Žádné instance.</p>` : table(
      ["Server", "Režim", "Status", "Worker", "Hráči", "Heartbeat", "Akce"],
      instances.map((item) => `<tr data-admin-search-row data-admin-server-item
        data-admin-server-status="${attribute(item.status)}" data-admin-server-mode="${attribute(item.mode)}"
        data-admin-server-worker="${attribute(item.workerStatus)}"
        data-admin-server-visibility="${serverVisibility(item.status)}" class="${item.serverInstanceId === selected ? "is-selected" : ""}">
        <td><a class="admin-server-name-link" href="?instance=${encodeURIComponent(item.serverInstanceId)}">
          <strong>${escapeHtml(item.displayName)}</strong><small title="${attribute(item.serverInstanceId)}">${escapeHtml(shortId(item.serverInstanceId))}</small></a></td>
        <td>${escapeHtml(item.mode)}</td><td>${pill(item.status)}</td><td>${pill(item.workerStatus)}</td>
        <td><strong>${item.playerCount} / ${item.capacity}</strong></td><td>${formatTime(item.lastHeartbeatAt)}</td>
        <td><a class="admin-button admin-button--ghost admin-button--compact" href="?instance=${encodeURIComponent(item.serverInstanceId)}"
          data-admin-instance="${attribute(item.serverInstanceId)}">Detail</a></td></tr>`).join("")
    )}
    <div class="admin-server-cards" aria-label="Herní instance">
      ${instances.map((item) => `<article data-admin-server-item
        data-admin-server-status="${attribute(item.status)}" data-admin-server-mode="${attribute(item.mode)}"
        data-admin-server-worker="${attribute(item.workerStatus)}"
        data-admin-server-visibility="${serverVisibility(item.status)}" class="admin-server-card${item.serverInstanceId === selected ? " is-selected" : ""}">
        <div class="admin-server-card__head"><div><strong>${escapeHtml(item.displayName)}</strong>
          <small title="${attribute(item.serverInstanceId)}">${escapeHtml(shortId(item.serverInstanceId))}</small></div>${pill(item.status)}</div>
        <dl><div><dt>Režim</dt><dd>${escapeHtml(item.mode)}</dd></div><div><dt>Hráči</dt><dd>${item.playerCount} / ${item.capacity}</dd></div>
          <div><dt>Worker</dt><dd>${pill(item.workerStatus)}</dd></div><div><dt>Heartbeat</dt><dd>${formatTime(item.lastHeartbeatAt)}</dd></div></dl>
        <a class="admin-button admin-button--primary" href="?instance=${encodeURIComponent(item.serverInstanceId)}"
          data-admin-mobile-instance="${attribute(item.serverInstanceId)}">Detail serveru</a>
      </article>`).join("")}
    </div>
  </section>`;
};

const renderServerFilters = (
  instances: AdminInstanceSummaryView[],
  filters: AdminServerFilterState
): string => `<div class="admin-server-filters" aria-label="Filtry serverů">
  <label class="admin-server-filter-search"><span>Hledat server</span>
    <input type="search" data-admin-search value="${attribute(filters.query)}" placeholder="Název nebo ID" autocomplete="off">
  </label>
  ${filterSelect("status", "Status", filters.status, unique(instances.map((item) => item.status)))}
  ${filterSelect("mode", "Režim", filters.mode, unique(instances.map((item) => item.mode)))}
  ${filterSelect("worker", "Worker", filters.worker, unique(instances.map((item) => item.workerStatus)))}
  <button class="admin-button admin-button--ghost admin-button--compact" type="button" data-admin-filter-reset>Reset</button>
  <span class="admin-server-filter-count">Zobrazeno <strong data-admin-server-visible-count>${instances.length}</strong> / ${instances.length}</span>
</div>`;

const filterSelect = (key: string, label: string, selected: string, values: string[]): string => `
  <label><span>${escapeHtml(label)}</span><select data-admin-server-filter="${attribute(key)}">
    <option value="all">Vše</option>${values.map((value) =>
      `<option value="${attribute(value)}"${value === selected ? " selected" : ""}>${escapeHtml(statusLabel(value))}</option>`).join("")}
  </select></label>`;

const INACTIVE_SERVER_STATUSES = new Set(["stopped", "failed", "crashed", "archived"]);
const serverVisibility = (status: string): "active" | "inactive" =>
  INACTIVE_SERVER_STATUSES.has(status.toLowerCase()) ? "inactive" : "active";
const serverScopeTab = (
  value: AdminServerFilterState["visibility"],
  label: string,
  count: number,
  selected: AdminServerFilterState["visibility"]
): string => `<button class="admin-server-scope-tab${value === selected ? " is-active" : ""}" type="button"
  role="tab" aria-selected="${value === selected}" data-admin-server-scope="${value}">
  ${escapeHtml(label)} <strong>${count}</strong></button>`;
const unique = (values: string[]): string[] => [...new Set(values)].sort((left, right) => left.localeCompare(right));
const shortId = (value: string): string => value.length > 24 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
