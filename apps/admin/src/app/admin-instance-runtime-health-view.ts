import type {
  AdminInstanceDetailView,
  AdminRuntimeHealthCheckView
} from "@empire/shared-types";
import { attribute, escapeHtml, formatTime } from "./admin-view-helpers";

export const renderAdminInstanceRuntimeHealth = (detail: AdminInstanceDetailView): string => {
  const health = detail.runtimeHealth;
  if (!health) {
    return `<section class="admin-notice" data-admin-runtime-health>
      Per-server runtime health read model není pro tuto instanci dostupný.
    </section>`;
  }
  return `<section class="admin-health-grid" data-admin-runtime-health data-lifecycle="${attribute(health.lifecycleStatus)}">
    ${runtimeHealthCard("Server runtime active", "runtime-active", health.runtimeActive, health)}
    ${runtimeHealthCard("Server tick advancing", "tick-advancing", health.tickAdvancing, health)}
    ${runtimeHealthCard("Server snapshot current", "snapshot-current", health.snapshotCurrent, health)}
    ${runtimeHealthCard("Recent server command accepted", "commands-accepted", health.commandsAccepted, health)}
  </section>`;
};

export const shouldWarnAboutRuntime = (detail: AdminInstanceDetailView): boolean =>
  detail.runtimeHealth
    ? detail.runtimeHealth.runtimeActive.status === "fail"
    : ["running", "restarting"].includes(detail.summary.status.toLowerCase()) && !detail.runtimeAvailable;

const runtimeHealthCard = (
  label: string,
  key: string,
  check: AdminRuntimeHealthCheckView,
  health: NonNullable<AdminInstanceDetailView["runtimeHealth"]>
): string => {
  const presentation = runtimeCheckPresentation(check);
  return `<article class="admin-health-card admin-health-card--${attribute(presentation.tone)}"
      data-admin-runtime-check="${attribute(key)}" data-status="${attribute(check.status)}">
    <span>${escapeHtml(label)}</span><strong>${escapeHtml(presentation.label)}</strong>
    <p>${escapeHtml(runtimeCheckDetail(check, health))}</p>
  </article>`;
};

const runtimeCheckPresentation = (
  check: AdminRuntimeHealthCheckView
): { label: string; tone: string } => ({
  pass: { label: "PASS", tone: "success" },
  fail: { label: "FAIL", tone: "danger" },
  pending: { label: "PENDING", tone: "warning" },
  "not-applicable": { label: "N/A", tone: "neutral" }
})[check.status];

const runtimeCheckDetail = (
  check: AdminRuntimeHealthCheckView,
  health: NonNullable<AdminInstanceDetailView["runtimeHealth"]>
): string => {
  const detail = RUNTIME_REASON_LABELS[check.reasonCode] ?? check.reasonCode;
  const threshold = ["recovery-head-current", "recovery-head-stale"].includes(check.reasonCode)
    ? ` Hranice ${health.freshnessThresholdMs ?? "–"} ms.`
    : "";
  const commandWindow = [
    "recent-applied-command-observed",
    "applied-command-observation-stale"
  ].includes(check.reasonCode)
    ? ` Pozorovací okno ${health.commandObservationWindowMs ?? "–"} ms.`
    : "";
  const observed = check.observedAt ? ` Pozorováno ${formatTime(check.observedAt)}.` : "";
  return `${detail}${threshold}${commandWindow}${observed}`;
};

const RUNTIME_REASON_LABELS: Record<string, string> = {
  "instance-runtime-active": "Per-instance heartbeat je fresh a runtime lease je platný.",
  "instance-runtime-error": "Instance heartbeat hlásí poslední runtime chybu.",
  "instance-heartbeat-not-live": "Per-instance heartbeat není fresh; globální worker tento stav nenahrazuje.",
  "runtime-lease-missing": "Běžící instance nemá vlastníka runtime lease.",
  "runtime-lease-heartbeat-owner-mismatch": "Per-instance heartbeat nepatří aktuálnímu workeru a inkarnaci runtime lease.",
  "runtime-lease-expired": "Runtime lease této instance vypršel.",
  "tick-advance-two-sample": "Dvě procesní pozorování potvrzují růst snapshot ticku, root ticku a stateVersion.",
  "tick-runtime-inactive": "Tick nelze potvrdit, protože runtime instance není aktivní.",
  "tick-recovery-head-not-current": "Tick nelze potvrdit bez aktuálního recovery headu.",
  "tick-observation-missing": "Chybí per-instance tick pozorování.",
  "tick-observation-first-sample": "První vzorek je uložený; PASS vyžaduje další pozorování.",
  "tick-observation-awaiting-next-sample": "Další časově odlišný vzorek zatím není dostupný.",
  "tick-observation-window-open": "Pozorovací okno ještě běží a posun zatím nebyl prokázán.",
  "tick-observation-gap-too-large": "Vzorky jsou příliš vzdálené; pro aktuální PASS je potřeba nový pár.",
  "tick-observation-reset": "Tick nebo stateVersion se vrátily zpět; baseline byl bezpečně obnoven.",
  "tick-observation-inconsistent": "Snapshot tick, root tick a stateVersion se neposunuly společně.",
  "tick-not-advancing": "V celém pozorovacím okně se snapshot tick, root tick ani stateVersion neposunuly.",
  "recovery-head-current": "Recovery head odpovídá běžícímu lifecycle.",
  "recovery-head-stale": "Recovery head překročil lifecycle freshness hranici.",
  "recovery-head-missing": "Durable recovery head není dostupný.",
  "snapshot-awaiting-provisioning": "Snapshot vznikne během provisioningu.",
  "snapshot-retained-lobby": "Lobby nemusí periodicky tickovat; uložený snapshot je platný.",
  "snapshot-retained-paused": "Pozastavený server nemusí tickovat; uložený snapshot je platný.",
  "terminal-checkpoint-present": "Stopped server má terminal checkpoint.",
  "terminal-checkpoint-missing": "Stopped server nemá potvrzený terminal checkpoint.",
  "snapshot-historical-archive": "Archivovaný server uchovává historická data bez freshness požadavku.",
  "snapshot-last-known-after-failure": "Snapshot je poslední známý stav po selhání.",
  "snapshot-lifecycle-unknown": "Snapshot nelze pro neznámý lifecycle klasifikovat.",
  "recent-applied-command-observed": "Čerstvý durable command result potvrzuje nedávno aplikovaný gameplay příkaz.",
  "applied-command-observation-stale": "Poslední aplikovaný příkaz je mimo čerstvé pozorovací okno; příjem příkazů proto není potvrzen.",
  "commands-not-yet-observed": "Zatím nebyl pozorován aplikovaný gameplay příkaz.",
  "commands-not-observed-since-start": "Od posledního startu nebyl pozorován aplikovaný příkaz.",
  "commands-start-time-unavailable": "Chybí lifecycle čas posledního startu; starší příkaz nelze připsat aktuálnímu běhu.",
  "commands-observation-time-invalid": "Čas command evidence nelze bezpečně porovnat s aktuálním pozorováním.",
  "commands-runtime-inactive": "Příjem příkazů nelze potvrdit bez aktivního runtime.",
  "commands-restarting": "Server se restartuje; příjem gameplay příkazů se v přechodovém stavu nepotvrzuje.",
  "commands-lifecycle-unknown": "Lifecycle nepovoluje bezpečně potvrdit příjem gameplay příkazů.",
  "commands-awaiting-provisioning": "Příkazy čekají na dokončení provisioningu.",
  "commands-server-failed": "Server je ve failed lifecycle.",
  "runtime-not-required-requested": "Runtime ještě není pro requested server vyžadován.",
  "runtime-not-required-provisioning": "Runtime health se během provisioningu neposuzuje jako running.",
  "runtime-not-required-lobby": "Lobby bez aktivní práce nemusí držet runtime lease.",
  "runtime-not-required-paused": "Pozastavený server nemusí držet aktivní runtime.",
  "runtime-not-required-stopped": "Stopped server nesmí běžet.",
  "runtime-not-required-archived": "Archivovaný server nesmí běžet.",
  "runtime-not-required-failed": "Failed server nemá aktivní runtime.",
  "tick-not-required-requested": "Tick ještě není vyžadován.",
  "tick-not-required-provisioning": "Tick se během provisioningu neposuzuje jako running.",
  "tick-not-required-lobby": "Lobby nemusí periodicky tickovat.",
  "tick-not-required-paused": "Pozastavený server se nesmí posouvat.",
  "tick-not-required-stopped": "Stopped server se nesmí posouvat.",
  "tick-not-required-archived": "Archivovaný server se nesmí posouvat.",
  "tick-not-required-failed": "Failed server se neposuzuje jako běžící.",
  "commands-not-accepted-paused": "Pozastavený server gameplay příkazy nepřijímá.",
  "commands-not-accepted-lobby": "Lobby ještě nepřijímá gameplay příkazy.",
  "commands-not-accepted-stopped": "Stopped server gameplay příkazy nepřijímá.",
  "commands-not-accepted-archived": "Archivovaný server gameplay příkazy nepřijímá."
};
