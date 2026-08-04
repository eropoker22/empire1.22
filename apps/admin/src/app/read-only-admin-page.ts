import type {
  AdminAuditEntryView,
  AdminControlPlaneAvailabilityView,
  AdminInstanceDetailView,
  AdminOverviewView,
  AdminSessionView
} from "@empire/shared-types";
import { renderAdminAudit } from "./admin-audit-view";
import { renderAdminCommandCenter } from "./admin-command-center-view";
import { renderAdminControlPlane } from "./admin-control-plane-view";
import { renderAdminInstanceDetail } from "./admin-instance-detail-view";
import { renderAdminOperationsAlerts } from "./admin-operations-alerts-view";
import { renderAdminServers } from "./admin-server-registry-view";
import {
  adminIcon,
  attribute,
  escapeHtml,
  formatTime
} from "./admin-view-helpers";
import type { AdminServerFilterState } from "./admin-app-dom";

export type AdminRefreshStatus = "loading" | "current" | "backoff" | "paused";

export interface AdminDashboardNotice {
  tone: "success" | "warning" | "danger";
  title: string;
  message: string;
}

export const renderLogin = (message = "Přihlaste se do admin konzole."): string => `
  <section class="admin-login" aria-labelledby="admin-login-title">
    <p class="admin-boot__eyebrow">Empire Streets</p>
    <h1 id="admin-login-title">Admin konzole</h1>
    <p>${escapeHtml(message)}</p>
    <form data-admin-login>
      <label><span>Uživatelské jméno</span><input data-admin-username type="text" autocomplete="username" required></label>
      <label><span>Heslo</span><input data-admin-password type="password" autocomplete="current-password" required></label>
      <button class="admin-button admin-button--primary" type="submit">Přihlásit</button>
      <p data-admin-login-error role="alert"></p>
    </form>
  </section>`;

export const renderLoading = (): string => `
  <section class="admin-login admin-loading" role="status" aria-live="polite">
    <p class="admin-boot__eyebrow">Empire Streets</p><h1>Načítám Control Center</h1>
    <div class="admin-loading__skeleton" aria-hidden="true"><span></span><span></span><span></span></div>
    <p>Ověřuji session a serverové read modely.</p>
  </section>`;

export const renderUnavailable = (detail: string): string => `
  <section class="admin-login" role="alert"><p class="admin-boot__eyebrow">Empire Streets</p>
    <h1>Admin server nedostupný</h1><p>Control Center se právě nemůže bezpečně připojit.</p>
    <button class="admin-button admin-button--primary" type="button" data-admin-refresh>${adminIcon("refresh")}<span data-admin-refresh-label>Obnovit</span></button>
    <details class="admin-disclosure admin-disclosure--technical"><summary><span>Technický detail</span><small>Bez citlivých údajů</small></summary>
      <p class="admin-copy">${escapeHtml(detail)}</p></details>
  </section>`;

export const renderDashboard = (input: {
  session: AdminSessionView;
  overview: AdminOverviewView;
  selectedInstanceId: string | null;
  detail: AdminInstanceDetailView | null;
  controlPlane: AdminControlPlaneAvailabilityView | null;
  wizardOpen: boolean;
  wizardStep: number;
  frontendBuildSha?: string | null;
  localDevelopment?: boolean;
  auditEntries?: AdminAuditEntryView[] | null;
  auditError?: string | null;
  refreshStatus?: AdminRefreshStatus;
  lastSuccessfulRefreshAt?: string | null;
  refreshError?: string | null;
  serverFilters?: AdminServerFilterState;
  mobileNavOpen?: boolean;
  notice?: AdminDashboardNotice | null;
}): string => `
  ${renderSidebar(input)}
  <section class="admin-main">
    ${input.wizardOpen ? "" : renderTopbar(input)}
    <div class="admin-content">
      ${renderNotice(input.notice)}
      ${renderAdminCommandCenter({
        overview: input.overview,
        controlPlane: input.controlPlane,
        detail: input.detail,
        selectedInstanceId: input.selectedInstanceId
      })}
      ${renderAdminOperationsAlerts({
        overview: input.overview,
        controlPlane: input.controlPlane,
        detail: input.detail,
        refreshError: input.refreshError
      })}
      <div class="admin-operations-workspace">
        <div class="admin-operations-workspace__registry">
          ${renderAdminServers(input.overview.instances, input.selectedInstanceId, input.serverFilters ?? {
            query: "", status: "all", mode: "all", worker: "all", visibility: "active"
          })}
        </div>
        <div class="admin-operations-workspace__control">
          ${renderAdminControlPlane({
            control: input.controlPlane,
            session: input.session,
            wizardOpen: input.wizardOpen,
            wizardStep: input.wizardStep,
            selectedInstanceId: input.selectedInstanceId,
            frontendBuildSha: input.frontendBuildSha ?? null,
            localDevelopment: input.localDevelopment === true
          })}
        </div>
      </div>
      ${input.selectedInstanceId ? renderAdminInstanceDetail(input.detail) : renderNoSelection()}
      ${renderAdminAudit({ role: input.session.role, entries: input.auditEntries ?? null, error: input.auditError })}
    </div>
  </section>`;

const renderSidebar = (input: Parameters<typeof renderDashboard>[0]): string => {
  const control = input.controlPlane;
  const healthy = control?.databaseAvailable && control.workerStatus === "online" && !control.unavailableCode;
  const hasDetail = Boolean(input.detail);
  const selectedHosted = control?.servers.find((server) => server.serverInstanceId === input.selectedInstanceId);
  const mobileOpen = input.mobileNavOpen === true;
  return `<aside class="admin-sidebar">
    <div class="admin-brand">
      <span class="admin-brand__mark">ES</span><div><p>Empire Streets</p><strong>Admin</strong></div>
    </div>
    <button class="admin-button admin-button--ghost admin-nav-toggle" type="button" data-admin-nav-toggle
      aria-expanded="${mobileOpen}" aria-controls="admin-primary-nav">${adminIcon("menu")}<span>Navigace</span></button>
    <div class="admin-brand__statusline" data-state="${healthy ? "healthy" : "warning"}"><span></span><div><strong>${healthy ? "SYSTEM ONLINE" : "VYŽADUJE KONTROLU"}</strong>
      <small>${control ? `DB ${control.databaseAvailable ? "available" : "unavailable"} · worker ${control.workerStatus}` : "Načítám control plane"}</small></div>
    </div>
    <nav id="admin-primary-nav" class="admin-nav" data-open="${mobileOpen}" aria-label="Sekce admin konzole">
      <div class="admin-nav__group"><span>Hlavní</span>
        ${nav("overview", "Přehled", "overview")}${nav("servers", "Servery", "server")}
        ${input.detail?.players.length ? nav("players", "Hráči", "players") : ""}
      </div>
      <details class="admin-nav__disclosure" open>
        <summary>Provoz</summary>
        ${control ? nav("control-plane", "Control plane", "control") : ""}
        ${selectedHosted ? nav("registration", "Registrace", "registration") : ""}
        ${hasDetail ? nav("instance-detail", "Herní stav", "game") : ""}
      </details>
      <details class="admin-nav__disclosure">
        <summary>Systém</summary>
        ${control ? nav("builds", "Buildy", "build") : ""}
        ${input.detail?.diagnostics.length ? nav("diagnostics", "Diagnostika", "diagnostics") : ""}
        ${input.detail ? nav("snapshots", "Snapshoty", "snapshot") : ""}
        ${input.session.role === "owner" ? nav("audit", "Audit trail", "diagnostics") : ""}
      </details>
    </nav>
    <div class="admin-sidebar-card"><span>Oprávnění</span><strong>${escapeHtml(roleLabel(input.session.role))}</strong>
      <p>${escapeHtml(input.session.displayName)}<br>Session do ${formatTime(input.session.expiresAt)}</p></div>
  </aside>`;
};

const renderTopbar = (input: Parameters<typeof renderDashboard>[0]): string => {
  const status = input.refreshStatus ?? "current";
  const statusLabel = {
    loading: "OBNOVUJI DATA",
    current: "DATA AKTUÁLNÍ",
    backoff: "OBNOVA OMEZENA",
    paused: "POLLING POZASTAVEN"
  }[status];
  const environment = input.localDevelopment ? "LOCAL" : "HOSTED";
  return `<header class="admin-topbar">
    <div class="admin-topbar__title"><p>${environment} · Provozní přehled</p><h1>Empire Streets Control Center</h1></div>
    <div class="admin-topbar__controls">
      <div class="admin-refresh-state" data-admin-refresh-state data-state="${attribute(status)}" aria-live="polite">
        <span>${statusLabel}</span><small>${input.lastSuccessfulRefreshAt ? `naposledy ${formatTime(input.lastSuccessfulRefreshAt)}` : "čekám na první read model"}</small>
      </div>
      <div class="admin-profile"><span>${escapeHtml(environment)}</span><strong>${escapeHtml(input.session.displayName)}</strong><small>${escapeHtml(input.session.role)}</small></div>
      <button class="admin-button admin-button--icon" type="button" data-admin-refresh aria-label="Ručně obnovit data"
        ${status === "loading" ? "disabled aria-busy=\"true\"" : "aria-busy=\"false\""}>
        ${adminIcon("refresh")}<span data-admin-refresh-label>${status === "loading" ? "Obnovuji…" : "Obnovit"}</span>
      </button>
      <button class="admin-button admin-button--ghost admin-button--icon" type="button" data-admin-logout>
        ${adminIcon("logout")}<span>Odhlásit</span>
      </button>
    </div>
  </header>`;
};

const renderNotice = (notice: AdminDashboardNotice | null | undefined): string => notice ? `
  <aside class="admin-action-notice admin-action-notice--${attribute(notice.tone)}" role="status">
    <div><strong>${escapeHtml(notice.title)}</strong><span>${escapeHtml(notice.message)}</span></div>
    <button class="admin-button admin-button--ghost" type="button" data-admin-notice-dismiss>Zavřít</button>
  </aside>` : "";

const renderNoSelection = (): string => `
  <section class="admin-empty-state" role="status"><span aria-hidden="true">◇</span><div><h3>Vyberte instanci</h3>
    <p>Detailní data se načtou až po explicitním výběru serveru.</p></div></section>`;

const nav = (id: string, label: string, icon: Parameters<typeof adminIcon>[0]): string =>
  `<a class="admin-nav__item" href="#admin-${attribute(id)}">${adminIcon(icon)}<strong>${escapeHtml(label)}</strong></a>`;

const roleLabel = (role: AdminSessionView["role"]): string => ({
  viewer: "Pouze čtení",
  operator: "Operátor",
  owner: "Owner"
})[role];
