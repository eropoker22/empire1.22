import { FREE_HOSTED_SERVER_LIFECYCLE_POLICY } from "@empire/game-config";
import type { AdminHostedServerView, AdminSessionView } from "@empire/shared-types";

const registrationMinutes = FREE_HOSTED_SERVER_LIFECYCLE_POLICY.registrationWindowMs / 60_000;

export const renderAdminRegistration = (server: AdminHostedServerView, session: AdminSessionView): string => {
  const state = String(server.registrationState || "not_scheduled");
  const canSchedule = server.provisioningState === "ready" && server.status === "lobby"
    && (state === "not_scheduled" || state === "closed" || state === "closed_early");
  const canCancel = server.provisioningState === "ready" && server.status === "lobby" && state === "scheduled";
  const canClose = session.role === "owner" && state === "open";
  return `<section class="admin-registration" aria-labelledby="admin-registration-${attr(server.serverInstanceId)}">
    <div class="admin-registration__head">
      <div><span>REGISTRACE HRÁČŮ</span><h5 id="admin-registration-${attr(server.serverInstanceId)}">${escape(stateLabel(state))}</h5></div>
      <strong data-admin-registration-countdown data-registration-state="${attr(state)}"
        data-registration-opens-at="${attr(server.registrationOpensAt ?? "")}" data-registration-closes-at="${attr(server.registrationClosesAt ?? "")}">
        ${escape(countdown(server))}
      </strong>
    </div>
    <div class="admin-kv-grid">
      ${kv("Otevření", timeWithZone(server.registrationOpensAt))}${kv("Automatické zavření", timeWithZone(server.registrationClosesAt))}
      ${kv("Délka", `${server.registrationWindowMinutes ?? registrationMinutes} minut`)}
      ${kv("Připravení hráči", `${numberOrDash(server.readyPlayers)} / ${numberOrDash(server.minimumReadyPlayersToStart)}`)}
    </div>
    <label class="admin-registration__schedule"><span>Plánované otevření · ${escape(browserTimeZone())}</span>
      <input type="datetime-local" data-admin-registration-opens-at ${canSchedule ? "" : "disabled"}>
    </label>
    <div class="admin-registration__actions">
      ${button(server, "schedule-registration", "Naplánovat registraci", canSchedule)}
      ${button(server, "open-registration-now", "Otevřít nyní na 60 minut", canSchedule)}
      ${button(server, "cancel-registration", "Zrušit plán", canCancel)}
      ${session.role === "owner" ? button(server, "close-registration-now", "Uzavřít registraci nyní", canClose, true) : ""}
    </div>
  </section>`;
};

export const renderAdminStartReadiness = (server: AdminHostedServerView): string => {
  const canStart = server.canStart === true;
  return `<section class="admin-start-readiness ${canStart ? "is-ready" : "is-blocked"}">
    <span>PŘIPRAVENÍ HRÁČI <strong>${escape(numberOrDash(server.readyPlayers))} / ${escape(numberOrDash(server.minimumReadyPlayersToStart))}</strong></span>
    <span>START SERVERU <strong>${canStart ? "PŘIPRAVENO" : "BLOKOVÁNO"}</strong></span>
    ${canStart ? "" : `<p>${escape(server.startDisabledReason || "Čekám na autoritativní stav serveru.")}</p>`}
  </section>`;
};

const button = (server: AdminHostedServerView, action: string, label: string, enabled: boolean, dangerous = false) =>
  `<button class="admin-button${dangerous ? " admin-button--danger" : ""}" type="button"
    data-admin-registration-action="${attr(action)}" data-admin-server-id="${attr(server.serverInstanceId)}"
    ${enabled ? "" : "disabled aria-disabled=\"true\""}>${escape(label)}</button>`;
const stateLabel = (state: string): string => ({ not_scheduled: "NENAPLÁNOVÁNO", scheduled: "NAPLÁNOVÁNO",
  open: "REGISTRACE OTEVŘENA", closed: "REGISTRACE UKONČENA", closed_early: "NOUZOVĚ UKONČENO" })[state] || "NENAPLÁNOVÁNO";
const countdown = (server: AdminHostedServerView): string => server.registrationState === "open"
  ? `zbývá ${duration(server.registrationRemainingMs)}`
  : server.registrationState === "scheduled" ? `začne za ${duration(server.registrationRemainingMs)}` : "";
const duration = (value: number | undefined): string => {
  const seconds = Math.max(0, Math.floor(Number(value ?? 0) / 1_000));
  return [Math.floor(seconds / 3_600), Math.floor((seconds % 3_600) / 60), seconds % 60]
    .map((part) => String(part).padStart(2, "0")).join(":");
};
const numberOrDash = (value: number | undefined): number | string => Number.isFinite(value) ? Number(value) : "–";
const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || "místní čas";
const timeWithZone = (value: string | null | undefined): string => value
  ? `${new Date(value).toLocaleString("cs-CZ")} · ${browserTimeZone()}` : "–";
const kv = (label: string, value: unknown): string => `<span><small>${escape(label)}</small><strong>${escape(value)}</strong></span>`;
const attr = (value: unknown): string => escape(value);
const escape = (value: unknown): string => String(value).replace(/[&<>"']/gu, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]!);
