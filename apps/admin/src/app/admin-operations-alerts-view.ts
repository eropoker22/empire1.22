import type {
  AdminControlPlaneAvailabilityView,
  AdminInstanceDetailView,
  AdminOverviewView
} from "@empire/shared-types";
import { badge, escapeHtml } from "./admin-view-helpers";

interface Alert {
  tone: "danger" | "warning" | "info" | "success";
  title: string;
  detail: string;
  href: string;
}

export const renderAdminOperationsAlerts = (input: {
  overview: AdminOverviewView;
  controlPlane: AdminControlPlaneAvailabilityView | null;
  detail: AdminInstanceDetailView | null;
  refreshError?: string | null;
}): string => {
  const alerts = resolveAlerts(input);
  const critical = alerts.filter((entry) => entry.tone === "danger" || entry.tone === "warning").length;
  return `<section id="admin-alerts" class="admin-panel admin-section-anchor${critical ? " admin-panel--critical" : ""}">
    <div class="admin-panel__head"><div><span>Operations</span><h3>Výstrahy a provozní stav</h3></div>
      ${badge(critical ? `${critical} VYŽADUJE POZORNOST` : "BEZ KRITICKÝCH VÝSTRAH", critical ? "warning" : "success")}
    </div>
    <div class="admin-alert-list">
      ${alerts.map((entry) => `<article class="admin-alert admin-alert--${entry.tone}">
        <strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml(entry.detail)}</span>
        <a class="admin-button admin-button--ghost" href="${entry.href}">Otevřít</a>
      </article>`).join("")}
    </div>
  </section>`;
};

const resolveAlerts = (input: {
  overview: AdminOverviewView;
  controlPlane: AdminControlPlaneAvailabilityView | null;
  detail: AdminInstanceDetailView | null;
  refreshError?: string | null;
}): Alert[] => {
  const alerts: Alert[] = [];
  if (input.refreshError) alerts.push({
    tone: "danger", title: "Obnova dat selhala",
    detail: `Zobrazuji poslední potvrzená data. Zkontrolujte API a zkuste ruční refresh. ${input.refreshError}`, href: "#admin-overview"
  });
  if (!input.controlPlane) alerts.push({
    tone: "warning", title: "Control plane se nenačetl",
    detail: "Lifecycle nelze ověřit. Zkontrolujte API a databázové připojení.", href: "#admin-control-plane"
  });
  if (input.controlPlane?.unavailableCode) alerts.push({
    tone: "warning", title: "Admin writes jsou blokované",
    detail: `${input.controlPlane.unavailableCode}. Ověřte bezpečnostní preflight a environment flags.`, href: "#admin-control-plane"
  });
  if (input.controlPlane && input.controlPlane.workerStatus !== "online") alerts.push({
    tone: "danger", title: "Hosted worker není online",
    detail: `Worker hlásí ${input.controlPlane.workerStatus}. Zkontrolujte heartbeat a deployment workeru.`, href: "#admin-control-plane"
  });
  if (input.controlPlane && input.controlPlane.buildCompatibility !== "current") alerts.push({
    tone: "danger", title: "Build parity není potvrzená",
    detail: `Build parity: ${input.controlPlane.buildCompatibility ?? "missing"}. Nasaďte shodný release SHA.`,
    href: "#admin-control-plane"
  });
  if (input.overview.counts.failed > 0) alerts.push({
    tone: "danger", title: "Instance s chybou",
    detail: `${input.overview.counts.failed} instancí hlásí chybu. Vyberte server a otevřete diagnostiku.`, href: "#admin-servers"
  });
  const unhealthyWorkers = input.overview.counts.stale + input.overview.counts.offline + input.overview.counts.noWorker;
  if (unhealthyWorkers > 0) alerts.push({
    tone: "warning", title: "Instance bez čerstvého workeru",
    detail: `${unhealthyWorkers} instancí je stale, offline nebo bez workeru. Ověřte heartbeat a lease.`, href: "#admin-servers"
  });
  if (input.detail?.freshness.stale) alerts.push({
    tone: "warning", title: "Vybraný detail je stale",
    detail: input.detail.freshness.staleReason ?? "Důvod není dostupný.", href: "#admin-snapshots"
  });
  if (input.detail?.snapshot.storageHealth && input.detail.snapshot.storageHealth !== "healthy") alerts.push({
    tone: "danger", title: "Snapshot storage není healthy",
    detail: `Storage health: ${input.detail.snapshot.storageHealth}.`, href: "#admin-snapshots"
  });
  if ((input.detail?.liveness.invalidSoftlocks ?? 0) > 0) alerts.push({
    tone: "danger", title: "Detekované invalid softlocky",
    detail: `${input.detail!.liveness.invalidSoftlocks} hráčů vyžaduje diagnostiku.`, href: "#admin-liveness"
  });
  const diagnosticErrors = input.detail?.diagnostics.filter((entry) => entry.level === "error").length ?? 0;
  if (diagnosticErrors > 0) alerts.push({
    tone: "danger", title: "Runtime diagnostické chyby",
    detail: `${diagnosticErrors} nedávných error záznamů.`, href: "#admin-diagnostics"
  });
  if (alerts.length === 0) alerts.push({
    tone: "success", title: "Systém bez kritické výstrahy",
    detail: "Databáze, worker, build parity a vybraný runtime nehlásí známý problém.", href: "#admin-overview"
  });
  return alerts;
};
