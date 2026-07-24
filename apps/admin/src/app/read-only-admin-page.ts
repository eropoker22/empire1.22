import type {
  AdminControlPlaneAvailabilityView,
  AdminHostedServerView,
  AdminInstanceDetailView,
  AdminInstanceSummaryView,
  AdminOverviewView,
  AdminSessionView
} from "@empire/shared-types";
import { renderAdminCreateWizard } from "./admin-create-wizard-view";
import { renderAdminRegistration, renderAdminStartReadiness } from "./admin-registration-view";

export const renderLogin = (message = "Přihlaste se do admin konzole."): string => `
  <section class="admin-login" aria-labelledby="admin-login-title">
    <p class="admin-boot__eyebrow">Empire Streets</p>
    <h1 id="admin-login-title">Admin konzole</h1>
    <p>${escape(message)}</p>
    <form data-admin-login>
      <label><span>Uživatelské jméno</span><input data-admin-username type="text" autocomplete="username" required></label>
      <label><span>Heslo</span><input data-admin-password type="password" autocomplete="current-password" required></label>
      <button class="admin-button admin-button--primary" type="submit">Přihlásit</button>
      <p data-admin-login-error role="alert"></p>
    </form>
  </section>`;

export const renderLoading = (): string => `
  <section class="admin-login" role="status"><p class="admin-boot__eyebrow">Read-only monitoring</p><h1>Načítám admin konzoli...</h1></section>`;

export const renderUnavailable = (detail: string): string => `
  <section class="admin-login" role="alert"><p class="admin-boot__eyebrow">Read-only monitoring</p>
    <h1>ADMIN SERVER NEDOSTUPNÝ</h1><p>${escape(detail)}</p>
    <button class="admin-button admin-button--primary" type="button" data-admin-refresh>Obnovit</button>
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
}): string => `
  <aside class="admin-sidebar">
    <div class="admin-brand"><span class="admin-brand__mark">ES</span><div><p>Empire Streets</p><strong>Admin</strong></div></div>
    <nav class="admin-nav" aria-label="Sekce admin konzole">
      ${nav("overview", "Overview")}${nav("servers", "Servery")}${nav("players", "Hráči")}${nav("map", "Mapa")}
      ${nav("economy", "Ekonomika")}${nav("production", "Výroba")}${nav("police", "Police")}${nav("liveness", "Liveness")}
      ${nav("commands", "Commands")}${nav("events", "Events")}${nav("diagnostics", "Diagnostics")}
    </nav>
  </aside>
  <section class="admin-main">
    <header class="admin-topbar">
      <div class="admin-topbar__title"><p>Durable control plane</p><h1>Read-only admin</h1></div>
      <div class="admin-topbar__controls">
        <div class="admin-profile"><span>Operátor</span><strong>${escape(input.session.displayName)} · ${escape(input.session.role)}</strong></div>
        <button class="admin-button" type="button" data-admin-refresh>Obnovit</button>
        <button class="admin-button" type="button" data-admin-logout>Odhlásit</button>
      </div>
    </header>
    <div class="admin-content">
      ${renderOverview(input.overview)}
      ${renderControlPlane(input.controlPlane, input.session, input.wizardOpen, input.wizardStep, input.selectedInstanceId,
        input.frontendBuildSha ?? null)}
      ${renderServers(input.overview.instances, input.selectedInstanceId)}
      ${input.selectedInstanceId ? renderDetail(input.detail) : renderNoSelection()}
    </div>
  </section>`;

const renderOverview = (overview: AdminOverviewView): string => `
  <section id="admin-overview" class="admin-section-anchor">
    <div class="admin-section__head"><div><p>Overview</p><h2>Autoritativní stav instancí</h2></div>${badge("DB AVAILABLE", "success")}</div>
    <div class="admin-metrics">
      ${metric("Známé servery", overview.counts.known)}${metric("Live", overview.counts.live)}${metric("Stale", overview.counts.stale)}
      ${metric("Offline", overview.counts.offline)}${metric("No worker", overview.counts.noWorker)}${metric("Failed", overview.counts.failed)}
      ${metric("Running", overview.counts.running)}${metric("Lobby", overview.counts.lobby)}${metric("Paused", overview.counts.paused)}
      ${metric("Hráči", overview.counts.players)}
    </div>
    <p class="admin-copy">Data vygenerována ${time(overview.generatedAt)}. Stav LIVE určuje durable heartbeat, ne úspěch HTTP requestu.</p>
  </section>`;

const renderControlPlane = (control: AdminControlPlaneAvailabilityView | null, session: AdminSessionView,
  wizardOpen: boolean, wizardStep: number, selectedInstanceId: string | null, frontendBuildSha: string | null): string => {
  if (!control) return `<section class="admin-panel" role="status"><h3>Načítám control plane...</h3></section>`;
  const frontendCompatible = Boolean(frontendBuildSha)
    && frontendBuildSha === control.apiBuildSha
    && control.buildCompatibility === "current";
  const accountPlatformReady = control.databaseAvailable && control.migrationsCurrent
    && control.sessionSecurity === "current" && control.originPolicy === "current" && frontendCompatible;
  const gameHostingDeployed = control.writesEnabled && control.provisioningEnabled
    && control.workerStatus === "online" && Boolean(control.workerBuildSha);
  const ready = !control.unavailableCode && frontendCompatible && session.role !== "viewer";
  const selected = control.servers.find((entry) => entry.serverInstanceId === selectedInstanceId) ?? null;
  return `<section id="admin-control-plane" class="admin-panel admin-section-anchor">
    <div class="admin-panel__head"><div><span>Hosted control plane</span><h3>Provisioning a lifecycle</h3></div>
      ${badge(control.unavailableCode ?? "WRITES ENABLED", ready ? "success" : "warning")}</div>
    <div class="admin-kv-grid">${kv("Account platform", accountPlatformReady ? "READY" : "BLOCKED")}
      ${kv("Game hosting", gameHostingDeployed ? "DEPLOYED" : "NOT DEPLOYED")}
      ${kv("Database", control.databaseAvailable ? "AVAILABLE" : "UNAVAILABLE")}
      ${kv("Migrace", control.migrationsCurrent ? "CURRENT" : "PENDING")}${kv("Worker", control.workerStatus.toUpperCase())}
      ${kv("Provisioning", control.provisioningEnabled ? "ENABLED" : "DISABLED")}
      ${kv("Build parity", frontendCompatible ? "CURRENT" : "BLOCKED")}
      ${kv("Session security", (control.sessionSecurity ?? "blocked").toUpperCase())}
      ${kv("Origin policy", (control.originPolicy ?? "blocked").toUpperCase())}
      ${kv("Registrace", control.registrationEnabled ? "ENABLED" : "DISABLED")}
      ${kv("Frontend SHA", frontendBuildSha ?? "NEZNÁMÉ")}${kv("API SHA", control.apiBuildSha ?? "NEZNÁMÉ")}
      ${kv("Worker SHA", control.workerBuildSha ?? "NEZNÁMÉ")}${kv("Schema", control.schemaVersion ?? "NEZNÁMÉ")}</div>
    ${renderBuildCompatibility(frontendBuildSha, control.apiBuildSha, control.workerBuildSha, gameHostingDeployed)}
    ${ready && !wizardOpen ? `<button class="admin-button admin-button--primary" type="button" data-admin-create-open>Vytvořit server</button>` : ""}
    ${wizardOpen && ready ? renderAdminCreateWizard(wizardStep) : ""}
    ${selected && ready ? renderLifecycle(selected, session) : ""}
  </section>`;
};

const renderBuildCompatibility = (
  frontend: string | null,
  api?: string | null,
  worker?: string | null,
  gameHostingDeployed = true
): string => {
  if (!gameHostingDeployed) {
    if (!frontend || !api) {
      return `<p class="admin-notice">Build účtové platformy nelze potvrdit, protože frontend nebo API SHA chybí.</p>`;
    }
    return frontend === api
      ? `<p class="admin-copy">Frontend a API běží ze stejného buildu. Herní worker není nasazený.</p>`
      : `<p class="admin-notice">POZOR: Frontend a API neběží ze stejného SHA. Herní worker není nasazený.</p>`;
  }
  const values = [frontend, api ?? null, worker ?? null];
  if (values.some((value) => !value)) {
    return `<p class="admin-notice">Kompatibilitu buildů nelze potvrdit, protože alespoň jedno SHA chybí.</p>`;
  }
  return new Set(values).size === 1
    ? `<p class="admin-copy">Frontend, API a worker běží ze stejného buildu.</p>`
    : `<p class="admin-notice">POZOR: Frontend, API a worker neběží ze stejného SHA.</p>`;
};

const renderLifecycle = (server: AdminHostedServerView, session: AdminSessionView): string => `
  <div class="admin-lifecycle"><h4>Lifecycle: ${escape(server.displayName)}</h4>
    <p>${pill(server.status)} ${pill(server.provisioningState)} · version ${server.version}</p>
    <div class="admin-kv-grid">${kv("Šablona", server.serverTemplate === "full" ? "Plnohodnotný server" : "Kontrolní test")}
      ${kv("Committed players", server.committedPlayers ?? 0)}
      ${kv("Reserved slots", server.reservedSlots ?? 0)}${kv("Capacity", server.capacity)}
      ${kv("Join policy", server.joinPolicy)}${kv("Lease owner", server.runtimeLeaseOwnerId)}
      ${kv("Last error", server.lastErrorCode)}</div>
    ${renderAdminRegistration(server, session)}
    ${renderAdminStartReadiness(server)}
    <label><span>Důvod akce</span><input data-admin-action-reason minlength="3" maxlength="240" required></label>
    <div class="admin-lifecycle__actions">
      ${lifecycleButton(server, "start", "Start")}${lifecycleButton(server, "pause", "Pause")}
      ${lifecycleButton(server, "resume", "Resume")}${lifecycleButton(server, "restart", "Safe restart")}
      ${session.role === "owner" ? lifecycleButton(server, "stop", "Stop") : ""}
    </div><p data-admin-action-error role="alert"></p>
  </div>`;
const lifecycleButton = (server: AdminHostedServerView, action: string, label: string) => {
  const unavailableReason = lifecycleUnavailableReason(server, action);
  const disabled = unavailableReason
    ? ` disabled aria-disabled="true" title="${attr(unavailableReason)}"`
    : "";
  return `<button class="admin-button" type="button" data-admin-lifecycle="${attr(action)}" data-admin-server-id="${attr(server.serverInstanceId)}"${disabled}>${escape(label)}</button>`;
};

const lifecycleUnavailableReason = (server: AdminHostedServerView, action: string): string | null => {
  if (server.provisioningState !== "ready") return "Počkejte na dokončení provisioningu.";
  if (action === "start") {
    if (server.status !== "lobby") return "Spustit lze pouze server v lobby.";
    if (server.canStart !== true) return server.startDisabledReason || "Čekám na autoritativní stav připravených hráčů.";
    return null;
  }
  if (action === "pause") return server.status === "running" ? null : "Pozastavit lze pouze běžící server.";
  if (action === "resume") return server.status === "paused" ? null : "Pokračovat lze pouze u pozastaveného serveru.";
  if (action === "restart") return server.status === "running" ? null : "Restartovat lze pouze běžící server.";
  if (action === "stop") return ["lobby", "running", "paused", "restarting"].includes(server.status)
    ? null
    : "Server už nelze zastavit.";
  return "Akce není dostupná.";
};

const renderServers = (instances: AdminInstanceSummaryView[], selected: string | null): string => `
  <section id="admin-servers" class="admin-panel admin-section-anchor">
    <div class="admin-panel__head"><div><span>Servery</span><h3>Durable instance registry</h3></div>${badge(`${instances.length} INSTANCÍ`, "info")}</div>
    ${instances.length === 0 ? `<p class="admin-copy">Žádné instance.</p>` : table(
      ["Instance", "Mode / region", "Status", "Worker", "Hráči", "Snapshot", "Heartbeat"],
      instances.map((item) => `<tr class="${item.serverInstanceId === selected ? "is-selected" : ""}">
        <td><a href="?instance=${encodeURIComponent(item.serverInstanceId)}" data-admin-instance="${attr(item.serverInstanceId)}"><strong>${escape(item.displayName)}</strong><br><small>${escape(item.serverInstanceId)}</small></a></td>
        <td>${escape(item.mode)} / ${escape(item.region)}</td><td>${pill(item.status)}</td><td>${pill(item.workerStatus)}</td>
        <td>${item.playerCount} / ${item.capacity}</td><td>${time(item.lastSnapshotAt)}</td><td>${time(item.lastHeartbeatAt)}</td></tr>`).join(""))}
  </section>`;

const renderNoSelection = (): string => `
  <section class="admin-panel" role="status"><div class="admin-panel__head"><div><span>Detail</span><h3>Vyberte instanci</h3></div></div>
    <p class="admin-copy">Bez explicitně vybrané instance se detailní data nenačítají.</p></section>`;

const renderDetail = (detail: AdminInstanceDetailView | null): string => detail ? `
  <section class="admin-section-anchor">
    <div class="admin-section__head"><div><p>Instance detail</p><h2>${escape(detail.summary.displayName)}</h2><small>${escape(detail.serverInstanceId)}</small></div>
      ${badge(detail.summary.workerStatus.toUpperCase(), detail.summary.workerStatus === "live" ? "success" : "warning")}</div>
    <div class="admin-kv-grid">${kv("Mode", detail.summary.mode)}${kv("Region", detail.summary.region)}${kv("Status", detail.summary.status)}
      ${kv("Join policy", detail.summary.joinPolicy)}${kv("Tick", detail.summary.currentTick)}${kv("State version", detail.summary.stateVersion)}
      ${kv("Snapshot", time(detail.summary.lastSnapshotAt))}${kv("Heartbeat", time(detail.summary.lastHeartbeatAt))}${kv("Lease owner", detail.summary.leaseOwner)}</div>
    ${detail.runtimeAvailable ? "" : `<p class="admin-notice">Live runtime není dostupný. Zobrazená data pocházejí z durable snapshotu a mohou být stale.</p>`}
  </section>
  ${section("players", "Hráči", table(["Hráč", "Stav", "Districty", "Cash", "Heat"], detail.players.map((row) => `<tr><td>${escape(row.displayName)}<br><small>${escape(row.playerId)}</small></td><td>${escape(row.status)}</td><td>${row.ownedDistrictCount}</td><td>${row.cash}</td><td>${row.heat}</td></tr>`).join("")))}
  ${section("map", "Mapa", table(["District", "Zone", "Owner", "Heat", "Buildings"], detail.districts.map((row) => `<tr><td>${escape(row.name)}<br><small>${escape(row.districtId)}</small></td><td>${escape(row.zone)}</td><td>${escape(row.ownerPlayerId ?? "-")}</td><td>${row.heat}</td><td>${row.buildingCount}</td></tr>`).join("")))}
  ${section("economy", "Ekonomika", `<div class="admin-kv-grid">${kv("Clean cash", detail.economy.totalCleanCash)}${kv("Dirty cash", detail.economy.totalDirtyCash)}${kv("Resources", Object.values(detail.economy.totalResources).reduce((sum, value) => sum + value, 0))}</div>`)}
  ${section("production", "Výroba", `<div class="admin-kv-grid">${kv("Buildings", detail.production.productionBuildingCount)}${kv("Ready", detail.production.readyToCollectCount)}${kv("Crafts", detail.production.activeCraftCount)}${kv("Storage full", detail.production.storageFullCount)}</div>`)}
  ${section("police", "Police", `<div class="admin-kv-grid">${kv("Pressure", detail.police.heatPressure)}${kv("Max heat", detail.police.maxPlayerHeat)}${kv("Wanted", detail.police.wantedPlayerCount)}${kv("Raids", detail.police.pendingRaidCount)}</div>`)}
  ${section("liveness", "Liveness", `<div class="admin-kv-grid">${kv("Active", detail.liveness.activePlayers)}${kv("Playable", detail.liveness.playablePlayers)}${kv("Sealed", detail.liveness.temporarilySealedPlayers)}${kv("Softlocks", detail.liveness.invalidSoftlocks)}</div>`)}
  ${section("commands", "Commands", table(["Type", "Command", "Actor", "Tick", "Received"], detail.commands.map((row) => `<tr><td>${escape(row.commandType)}</td><td>${escape(row.commandId)}</td><td>${escape(row.actorId)}</td><td>${row.tickAtReceive}</td><td>${time(row.receivedAt)}</td></tr>`).join("")))}
  ${section("events", "Events", table(["Type", "Event", "Command", "Tick", "Occurred"], detail.events.map((row) => `<tr><td>${escape(row.eventType)}</td><td>${escape(row.eventId)}</td><td>${escape(row.causedByCommandId ?? "-")}</td><td>${row.tick}</td><td>${time(row.occurredAt)}</td></tr>`).join("")))}
  ${section("diagnostics", "Diagnostics", table(["Level", "Category", "Code", "Command", "Occurred"], detail.diagnostics.map((row) => `<tr><td>${pill(row.level)}</td><td>${escape(row.category)}</td><td>${escape(row.messageCode)}</td><td>${escape(row.commandId ?? "-")}</td><td>${time(row.occurredAt)}</td></tr>`).join("")))}
` : `<section class="admin-panel" role="status"><h3>Načítám detail instance...</h3></section>`;

const nav = (id: string, label: string) => `<a class="admin-nav__item" href="#admin-${id}"><span class="admin-nav__dot"></span><strong>${escape(label)}</strong></a>`;
const section = (id: string, title: string, body: string) => `<section id="admin-${id}" class="admin-panel admin-section-anchor"><div class="admin-panel__head"><div><span>Instance</span><h3>${escape(title)}</h3></div></div>${body}</section>`;
const metric = (label: string, value: number) => `<article class="admin-metric"><span>${escape(label)}</span><strong>${value}</strong></article>`;
const kv = (label: string, value: unknown) => `<span><small>${escape(label)}</small><strong>${escape(value ?? "-")}</strong></span>`;
const badge = (label: string, tone: string) => `<span class="admin-badge admin-badge--${tone}">${escape(label)}</span>`;
const pill = (value: string) => `<span class="admin-table-status">${escape(value)}</span>`;
const table = (headers: string[], rows: string) => `<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${headers.map((head) => `<th>${escape(head)}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}">Žádná data.</td></tr>`}</tbody></table></div>`;
const time = (value: string | null) => value ? escape(new Date(value).toLocaleString("cs-CZ")) : "-";
const escape = (value: unknown) => String(value).replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]!);
const attr = escape;
