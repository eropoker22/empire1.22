import type {
  AdminControlPlaneAvailabilityView,
  AdminInstanceDetailView,
  AdminOverviewView
} from "@empire/shared-types";
import { attribute, escapeHtml, formatNumber, formatTime } from "./admin-view-helpers";

export const renderAdminCommandCenter = (input: {
  overview: AdminOverviewView;
  controlPlane: AdminControlPlaneAvailabilityView | null;
  detail: AdminInstanceDetailView | null;
  selectedInstanceId: string | null;
}): string => {
  const health = resolveHealth(input.controlPlane);
  const attentionCount = input.overview.counts.failed
    + input.overview.counts.stale
    + input.overview.counts.offline
    + input.overview.counts.noWorker;

  return `<section id="admin-overview" class="admin-command-center admin-section-anchor" aria-labelledby="admin-command-center-title">
    <div class="admin-command-center__primary">
      <div class="admin-command-center__status" data-tone="${health.tone}" data-admin-system-health>
        <span class="admin-command-center__pulse" aria-hidden="true"></span>
        <div>
          <p>Empire Streets Control Center</p>
          <h2 id="admin-command-center-title">${escapeHtml(health.title)}</h2>
          <span>${escapeHtml(health.detail)}</span>
        </div>
      </div>
      <div class="admin-service-grid" aria-label="Stav služeb">
        ${service("API", input.controlPlane ? "Online" : "Nedostupné",
          input.controlPlane ? "success" : "danger")}
        ${service("Databáze", input.controlPlane?.databaseAvailable ? "Online" : "Nedostupná",
          input.controlPlane?.databaseAvailable ? "success" : "danger")}
        ${service("Hosted worker", input.controlPlane?.workerStatus ?? "Ověřuji",
          input.controlPlane?.workerStatus === "online" ? "success"
            : input.controlPlane?.workerStatus === "stale" ? "warning" : "danger")}
        ${service("DB schéma", input.controlPlane?.migrationsCurrent ? "Aktuální" : "Vyžaduje migraci",
          input.controlPlane?.migrationsCurrent ? "success" : "danger")}
        ${service("Buildy", buildLabel(input.controlPlane), buildTone(input.controlPlane))}
        ${service("Registrace", input.controlPlane?.registrationEnabled ? "Zapnutá" : "Vypnutá",
          input.controlPlane?.registrationEnabled ? "success" : "neutral")}
      </div>
    </div>
    <div class="admin-command-metrics">
      ${metric("Běžící servery", input.overview.counts.running, "cyan", "Autoritativně running")}
      ${metric("Aktivní hráči", input.overview.counts.players, "neutral", "Napříč instancemi")}
      ${metric("Lobby", input.overview.counts.lobby, "gold", "Čekají na start")}
      ${metric("Stav serverů", attentionCount, attentionCount ? "warning" : "success",
        `stale ${input.overview.counts.stale} · offline ${input.overview.counts.offline} · failed ${input.overview.counts.failed}`)}
      ${metric("Worker", input.controlPlane?.workerStatus ?? "Neznámý",
        input.controlPlane?.workerStatus === "online" ? "success" : "warning", "Hosted runtime")}
      ${metric("Registrace", input.controlPlane?.registrationEnabled ? "Zapnutá" : "Vypnutá",
        input.controlPlane?.registrationEnabled ? "success" : "neutral", "Účtová policy")}
    </div>
    <div class="admin-command-center__foot">
      <span>Read model ${formatTime(input.overview.generatedAt)}</span>
      <span>${input.detail?.freshness.stale ? "Vybraný detail je stale" : "Data detailu bez známé freshness výstrahy"}</span>
    </div>
  </section>`;
};

const resolveHealth = (control: AdminControlPlaneAvailabilityView | null) => {
  if (!control) return {
    tone: "warning",
    title: "Ověřuji stav systému",
    detail: "Čekám na control-plane read model."
  };
  const blocked = !control.databaseAvailable || !control.migrationsCurrent
    || control.workerStatus === "offline" || control.buildCompatibility === "mismatch"
    || Boolean(control.unavailableCode);
  if (blocked) return {
    tone: "danger",
    title: "Systém vyžaduje zásah",
    detail: control.unavailableCode ?? "Alespoň jedna kritická služba není v bezpečném stavu."
  };
  if (control.workerStatus === "stale" || control.buildCompatibility !== "current") return {
    tone: "warning",
    title: "Systém běží omezeně",
    detail: "Provoz pokračuje, ale worker nebo build kompatibilita vyžaduje kontrolu."
  };
  return {
    tone: "success",
    title: "Systém je připraven",
    detail: "Databáze, migrace, worker a build compatibility jsou potvrzené."
  };
};

const service = (label: string, value: string, tone: string): string => `
  <article class="admin-service admin-service--${attribute(tone)}">
    <span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>
  </article>`;

const metric = (
  label: string,
  value: number | string,
  tone: string,
  detail: string
): string => `<article class="admin-command-metric admin-command-metric--${attribute(tone)}">
  <span>${escapeHtml(label)}</span>
  <strong>${typeof value === "number" ? formatNumber(value) : escapeHtml(value)}</strong>
  <small>${escapeHtml(detail)}</small>
</article>`;

const buildLabel = (control: AdminControlPlaneAvailabilityView | null): string => ({
  current: "Kompatibilní",
  mismatch: "Neshoda SHA",
  missing: "Chybí metadata"
})[control?.buildCompatibility ?? "missing"] ?? "Neznámý stav";

const buildTone = (control: AdminControlPlaneAvailabilityView | null): string =>
  control?.buildCompatibility === "current" ? "success"
    : control?.buildCompatibility === "mismatch" ? "danger" : "warning";
