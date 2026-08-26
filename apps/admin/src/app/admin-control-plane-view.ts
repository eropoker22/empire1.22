import type {
  AdminControlPlaneAvailabilityView,
  AdminHostedServerView,
  AdminSessionView
} from "@empire/shared-types";
import { FREE_HOSTED_STARTING_MATERIAL_GROUPS } from "@empire/game-config";
import { renderAdminCreateWizard } from "./admin-create-wizard-view";
import { renderAdminRegistration, renderAdminStartReadiness } from "./admin-registration-view";
import {
  attribute,
  badge,
  codeValue,
  escapeHtml,
  formatTime,
  keyValue,
  pill
} from "./admin-view-helpers";

export const renderAdminControlPlane = (input: {
  control: AdminControlPlaneAvailabilityView | null;
  session: AdminSessionView;
  wizardOpen: boolean;
  wizardStep: number;
  selectedInstanceId: string | null;
  frontendBuildSha: string | null;
  localDevelopment: boolean;
}): string => {
  const { control } = input;
  if (!control) {
    return `<section id="admin-control-plane" class="admin-panel admin-section-anchor" role="status"><h3>Načítám control plane...</h3></section>`;
  }
  const frontendCompatible = Boolean(input.frontendBuildSha)
    && input.frontendBuildSha === control.apiBuildSha
    && control.buildCompatibility === "current"
    || input.localDevelopment && control.buildCompatibility === "current";
  const accountPlatformReady = control.databaseAvailable && control.migrationsCurrent
    && control.sessionSecurity === "current" && control.originPolicy === "current" && frontendCompatible;
  const gameHostingDeployed = control.writesEnabled && control.provisioningEnabled
    && control.workerStatus === "online" && Boolean(control.workerBuildSha);
  const gameHostingDisabled = !control.writesEnabled && !control.provisioningEnabled;
  const hostingLabel = gameHostingDeployed ? "DEPLOYED" : gameHostingDisabled ? "DISABLED" : "NEEDS ATTENTION";
  const hostingTone = gameHostingDeployed ? "success" : gameHostingDisabled ? "neutral" : "danger";
  const ready = !control.unavailableCode && frontendCompatible;
  const canWrite = ready && input.session.role !== "viewer";
  const selected = control.servers.find((entry) => entry.serverInstanceId === input.selectedInstanceId) ?? null;
  return `<section id="admin-control-plane" class="admin-panel admin-control-plane admin-section-anchor">
    <div class="admin-panel__head">
      <div><span>Control plane</span><h3>Systém a bezpečné operace</h3>
        <p>Stav platformy, provisioning a lifecycle vybraného serveru.</p></div>
      <div class="admin-panel__actions">
        ${badge(control.unavailableCode ?? (canWrite ? "OPERACE POVOLENY" : "POUZE ČTENÍ"), ready ? "success" : "warning")}
        ${canWrite && !input.wizardOpen ? `<button class="admin-button admin-button--primary" type="button" data-admin-create-open>Nový server</button>` : ""}
      </div>
    </div>
    <div class="admin-health-grid">
      ${healthCard("Databáze", control.databaseAvailable ? "AVAILABLE" : "UNAVAILABLE",
        control.databaseAvailable ? "success" : "danger", control.migrationsCurrent ? "Migrace jsou aktuální." : "Čekají databázové migrace.")}
      ${healthCard("Account platform", accountPlatformReady ? "READY" : "BLOCKED",
        accountPlatformReady ? "success" : "danger", "Session security, origin policy a frontend/API build.")}
      ${healthCard("Game hosting", hostingLabel, hostingTone,
        gameHostingDisabled ? "Hosting je konfigurací úmyslně vypnutý." : `Worker ${control.workerStatus}; provisioning ${control.provisioningEnabled ? "enabled" : "disabled"}.`)}
      ${healthCard("Global worker", control.workerStatus.toUpperCase(),
        control.workerStatus === "online" ? "success" : control.workerStatus === "stale" ? "warning" : "danger",
        "Platform heartbeat; nenahrazuje health konkrétní instance.")}
      ${healthCard("Build parity", frontendCompatible ? "CURRENT" : "BLOCKED",
        frontendCompatible ? "success" : "danger", "Frontend, API a worker musí být kompatibilní.")}
      ${healthCard("Registrace", control.registrationEnabled ? "ENABLED" : "DISABLED",
        control.registrationEnabled ? "success" : "neutral", "Serverová account registration policy.")}
    </div>
    <details id="admin-builds" class="admin-disclosure admin-disclosure--technical admin-section-anchor">
      <summary><span>Technické informace</span><small>SHA, schema a security kontrakty</small></summary>
      <div class="admin-kv-grid">
        ${keyValue("Account platform", accountPlatformReady ? "READY" : "BLOCKED")}
        ${keyValue("Game hosting", hostingLabel)}
        ${keyValue("Database", control.databaseAvailable ? "AVAILABLE" : "UNAVAILABLE")}
        ${keyValue("Migrace", control.migrationsCurrent ? "CURRENT" : "PENDING")}
        ${keyValue("Global worker", control.workerStatus.toUpperCase())}
        ${keyValue("Provisioning", control.provisioningEnabled ? "ENABLED" : "DISABLED")}
        ${keyValue("Build parity", frontendCompatible ? "CURRENT" : "BLOCKED")}
        ${keyValue("Session security", (control.sessionSecurity ?? "blocked").toUpperCase())}
        ${keyValue("Origin policy", (control.originPolicy ?? "blocked").toUpperCase())}
        ${keyValue("Registrace účtů", control.registrationEnabled ? "ENABLED" : "DISABLED")}
        ${codeValue("Frontend SHA", input.frontendBuildSha ?? (input.localDevelopment ? "LOCAL DEV" : null))}
        ${codeValue("API SHA", control.apiBuildSha)}
        ${codeValue("Worker SHA", control.workerBuildSha)}
        ${keyValue("Schema", control.schemaVersion ?? "NEZNÁMÉ")}
      </div>
      ${renderBuildCompatibility(input.frontendBuildSha, control.apiBuildSha, control.workerBuildSha, gameHostingDeployed, input.localDevelopment)}
    </details>
    ${selected && canWrite ? renderLifecycle(selected, input.session)
      : `<div class="admin-control-plane__empty"><strong>${input.session.role === "viewer" ? "Viewer režim" : "Vyberte server"}</strong>
          <span>${input.session.role === "viewer" ? "Operace jsou záměrně uzamčené." : "Lifecycle akce se zobrazí pro vybranou instanci."}</span></div>`}
    ${input.wizardOpen && canWrite ? renderAdminCreateWizard(input.wizardStep) : ""}
  </section>`;
};

const renderBuildCompatibility = (
  frontend: string | null,
  api?: string | null,
  worker?: string | null,
  gameHostingDeployed = true,
  localDevelopment = false
): string => {
  if (!gameHostingDeployed) {
    if (!frontend || !api) return `<p class="admin-notice">Build účtové platformy nelze potvrdit, protože frontend nebo API SHA chybí.</p>`;
    return frontend === api
      ? `<p class="admin-copy">Frontend a API běží ze stejného buildu. Herní worker není nasazený.</p>`
      : `<p class="admin-notice">POZOR: Frontend a API neběží ze stejného SHA. Herní worker není nasazený.</p>`;
  }
  if (localDevelopment && !frontend) {
    return `<p class="admin-copy">Lokální frontend běží na loopbacku; API a worker build parity je potvrzena serverem.</p>`;
  }
  const values = [frontend, api ?? null, worker ?? null];
  if (values.some((value) => !value)) return `<p class="admin-notice">Kompatibilitu buildů nelze potvrdit, protože alespoň jedno SHA chybí.</p>`;
  return new Set(values).size === 1
    ? `<p class="admin-copy">Frontend, API a worker běží ze stejného buildu.</p>`
    : `<p class="admin-notice">POZOR: Frontend, API a worker neběží ze stejného SHA.</p>`;
};

const renderLifecycle = (server: AdminHostedServerView, session: AdminSessionView): string => `
  <div class="admin-lifecycle">
    <div class="admin-lifecycle__head"><div><span>Vybraný server</span><h4>Lifecycle: ${escapeHtml(server.displayName)}</h4>
      <small>${escapeHtml(server.serverInstanceId)} · version ${server.version}</small></div><div>${pill(server.status)} ${pill(server.provisioningState)}</div></div>
    <div class="admin-lifecycle__summary">
      ${keyValue("Hráči", `${server.committedPlayers ?? 0} / ${server.capacity}`)}
      ${keyValue("Registrace", server.registrationState ?? "unknown")}
      ${keyValue("Join policy", server.joinPolicy)}
      ${keyValue("Instance heartbeat", server.lastWorkerHeartbeatAt ? "HEARTBEAT" : "BEZ HEARTBEATU")}
    </div>
    ${renderAdminRegistration(server, session)}
    ${renderAdminStartReadiness(server)}
    ${renderStartingPlayerState(server)}
    <div class="admin-lifecycle__actions">
      ${lifecycleButton(server, "start", "Start")}${lifecycleButton(server, "pause", "Pause")}
      ${lifecycleButton(server, "resume", "Resume")}${lifecycleButton(server, "restart", "Safe restart")}
      ${session.role === "owner" ? `${lifecycleButton(server, "stop", "Stop")}${lifecycleButton(server, "delete", "Smazat server")}` : ""}
    </div><p class="admin-copy admin-lifecycle__hint">Vyberte akci. Důvod a potvrzení zadáte v bezpečném dialogu pro tento server.</p>
    <details class="admin-disclosure admin-disclosure--technical">
      <summary><span>Serverová diagnostika</span><small>Lease, lifecycle marker a canonical timing</small></summary>
      <div class="admin-kv-grid">
        ${keyValue("Šablona", server.serverTemplate === "full" ? "Plnohodnotný server" : "Flexibilní server")}
        ${keyValue("Server version", server.version)}
        ${keyValue("Committed players", server.committedPlayers ?? 0)}
        ${keyValue("Reserved slots", server.reservedSlots ?? 0)}${keyValue("Capacity", server.capacity)}
        ${keyValue("Join policy", server.joinPolicy)}${keyValue("Joinable", server.joinable ? "ANO" : "NE")}
        ${keyValue("Registration state", server.registrationState ?? "unknown")}
        ${keyValue("Schedule version", server.registrationScheduleVersion)}
        ${keyValue("Tick rate", server.canonicalTickRateMs ? `${server.canonicalTickRateMs} ms` : "–")}
        ${keyValue("Final Lockdown tick", server.effectiveFinalLockdownTrigger ?? server.canonicalFinalLockdownTrigger)}
        ${keyValue("První eliminace tick", server.effectiveFirstEliminationTick ?? server.canonicalFirstEliminationTick)}
        ${keyValue("Heartbeat", formatTime(server.lastWorkerHeartbeatAt))}
        ${keyValue("Lease owner", server.runtimeLeaseOwnerId)}${keyValue("Lease expires", formatTime(server.runtimeLeaseExpiresAt))}
        ${keyValue("Lifecycle snapshot marker", server.currentSnapshotId)}${keyValue("Last error", server.lastErrorCode)}
        ${keyValue("Updated", formatTime(server.updatedAt))}
      </div>
    </details>
  </div>`;

const renderStartingPlayerState = (server: AdminHostedServerView): string => {
  const startingState = server.startingPlayerState;
  if (!startingState) {
    return `<section class="admin-notice" data-admin-starting-state>
      <strong>Starting state uložený na serveru není dostupný.</strong>
      <span>Instance vznikla bez současného read-only kontraktu a vyžaduje compatibility kontrolu.</span>
    </section>`;
  }
  return `<details class="admin-disclosure" data-admin-starting-state open>
    <summary><span>Starting state uložený na serveru</span><small>Autoritativní hodnoty z databázové projekce</small></summary>
    <div class="admin-kv-grid">
      ${keyValue("Clean cash", startingState.cleanCash)}
      ${keyValue("Dirty cash", startingState.dirtyCash)}
      ${keyValue("Populace", startingState.population)}
      ${keyValue("Vliv", startingState.influence)}
      ${keyValue("Špehové", startingState.spySlots)}
      ${FREE_HOSTED_STARTING_MATERIAL_GROUPS.map((group) => keyValue(
        `Materiály · ${group.label}`,
        group.materials.map((material) => (
          `${material.label}: ${startingState.materials[material.id]}`
        )).join(", ")
      )).join("")}
    </div>
  </details>`;
};

const healthCard = (label: string, value: string, tone: string, detail: string): string => `
  <article class="admin-health-card admin-health-card--${attribute(tone)}">
    <span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><p>${escapeHtml(detail)}</p>
  </article>`;

const lifecycleButton = (server: AdminHostedServerView, action: string, label: string): string => {
  const reason = lifecycleUnavailableReason(server, action);
  const reasonId = `admin-lifecycle-reason-${action}`;
  const disabled = reason ? ` disabled aria-disabled="true" aria-describedby="${attribute(reasonId)}"` : "";
  const tone = action === "stop" || action === "delete" ? " admin-button--danger"
    : action === "start" || action === "resume" ? " admin-button--primary" : "";
  return `<span class="admin-action-control${reason ? " is-disabled" : ""}"${reason ? " tabindex=\"0\"" : ""}>
    <button class="admin-button${tone}" type="button"
    data-admin-lifecycle="${attribute(action)}" data-admin-server-id="${attribute(server.serverInstanceId)}"${disabled}>
    ${escapeHtml(label)}</button>${reason ? `<small id="${attribute(reasonId)}">${escapeHtml(reason)}</small>` : ""}</span>`;
};

const lifecycleUnavailableReason = (server: AdminHostedServerView, action: string): string | null => {
  if (action === "delete") return server.status === "archived" ? "Server už je archivovaný." : null;
  if (server.provisioningState !== "ready") return "Počkejte na dokončení provisioningu.";
  if (action === "start") {
    if (server.status !== "lobby") return "Spustit lze pouze server v lobby.";
    return server.canStart === true ? null : server.startDisabledReason || "Čekám na autoritativní stav připravených hráčů.";
  }
  if (action === "pause") return server.status === "running" ? null : "Pozastavit lze pouze běžící server.";
  if (action === "resume") return server.status === "paused" ? null : "Pokračovat lze pouze u pozastaveného serveru.";
  if (action === "restart") return server.status === "running" ? null : "Restartovat lze pouze běžící server.";
  if (action === "stop") return ["lobby", "running", "paused", "restarting"].includes(server.status) ? null : "Server už nelze zastavit.";
  return "Akce není dostupná.";
};
