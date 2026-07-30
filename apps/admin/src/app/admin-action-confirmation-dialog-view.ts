import type { AdminHostedServerView, HostedLifecycleAction } from "@empire/shared-types";
import { attribute, escapeHtml, pill } from "./admin-view-helpers";

interface ActionPresentation {
  label: string;
  confirmLabel: string;
  title: string;
  detail: string;
  tone: "primary" | "neutral" | "danger";
}

export const adminActionLabel = (action: HostedLifecycleAction): string => actionPresentation(action).label;

export const renderLifecycleConfirmationDialog = (input: {
  server: AdminHostedServerView;
  action: HostedLifecycleAction;
  reason: string;
}): string => {
  const presentation = actionPresentation(input.action);
  const dangerClass = presentation.tone === "danger" ? " admin-modal--danger" : "";
  const confirmClass = presentation.tone === "danger" ? " admin-button--danger"
    : presentation.tone === "primary" ? " admin-button--primary" : "";
  return `<div class="admin-modal-backdrop" data-admin-lifecycle-backdrop>
    <section class="admin-modal admin-action-dialog${dangerClass}" role="dialog" aria-modal="true"
      aria-labelledby="admin-lifecycle-dialog-title" data-admin-lifecycle-dialog
      data-admin-lifecycle-action="${attribute(input.action)}" data-admin-server-id="${attribute(input.server.serverInstanceId)}">
      <header class="admin-modal__head"><div><span>Lifecycle akce</span>
        <h2 id="admin-lifecycle-dialog-title">${escapeHtml(presentation.title)}</h2>
        <p>${escapeHtml(presentation.detail)}</p></div>
        <button class="admin-button admin-button--ghost admin-button--close" type="button"
          data-admin-lifecycle-cancel aria-label="Zavřít dialog">×</button>
      </header>
      <div class="admin-action-dialog__body">
        <div class="admin-action-dialog__target">
          <div><span>Cílový server</span><strong>${escapeHtml(input.server.displayName)}</strong>
            <small title="${attribute(input.server.serverInstanceId)}">${escapeHtml(input.server.serverInstanceId)}</small></div>
          <div>${pill(input.server.status)}<small>version ${input.server.version}</small></div>
        </div>
        ${input.action === "stop" ? `<p class="admin-danger-copy"><strong>Zastavení přeruší běžící instanci.</strong>
          Existující serverová autorizace a durable stav zůstávají canonical autoritou.</p>` : ""}
        ${input.action === "delete" ? `<p class="admin-danger-copy"><strong>Server bude archivován a zmizí z aktivních serverů.</strong>
          Hráči se vrátí do lobby, jejich gameplay session budou zneplatněny a technická historie zůstane v záložce neaktivních serverů.</p>
        <label><span>Potvrďte názvem serveru</span>
          <input data-admin-delete-confirmation autocomplete="off"
            placeholder="${attribute(input.server.displayName)}">
          <small>Zadejte přesně: ${escapeHtml(input.server.displayName)}</small>
        </label>` : ""}
        <label><span>Důvod akce</span>
          <textarea data-admin-action-reason minlength="3" maxlength="240" required
            placeholder="Povinný auditní důvod">${escapeHtml(input.reason)}</textarea>
          <small>Důvod bude uložen s lifecycle požadavkem.</small>
        </label>
        <div class="admin-action-dialog__actions">
          <button class="admin-button admin-button--ghost" type="button" data-admin-lifecycle-cancel>Zrušit</button>
          <button class="admin-button${confirmClass}" type="button" data-admin-lifecycle-confirm>
            ${escapeHtml(presentation.confirmLabel)}</button>
        </div>
        <p class="admin-form-error" data-admin-action-error role="alert" aria-live="polite"></p>
      </div>
    </section>
  </div>`;
};

export const renderRegistrationConfirmationDialog = (input: {
  server: AdminHostedServerView;
  action: HostedLifecycleAction;
  reason: string;
  registrationOpensAt?: string;
}): string => {
  const presentation = actionPresentation(input.action);
  const dangerClass = presentation.tone === "danger" ? " admin-modal--danger" : "";
  const confirmClass = presentation.tone === "danger" ? " admin-button--danger" : " admin-button--primary";
  return `<div class="admin-modal-backdrop" data-admin-registration-backdrop>
    <section class="admin-modal admin-action-dialog${dangerClass}" role="dialog" aria-modal="true"
      aria-labelledby="admin-registration-dialog-title" data-admin-registration-dialog
      data-admin-registration-action="${attribute(input.action)}" data-admin-server-id="${attribute(input.server.serverInstanceId)}">
      <header class="admin-modal__head"><div><span>Registrace serveru</span>
        <h2 id="admin-registration-dialog-title">${escapeHtml(presentation.title)}</h2>
        <p>${escapeHtml(presentation.detail)}</p></div>
        <button class="admin-button admin-button--ghost admin-button--close" type="button"
          data-admin-registration-cancel aria-label="Zavřít dialog">×</button>
      </header>
      <div class="admin-action-dialog__body">
        <div class="admin-action-dialog__target">
          <div><span>Cílový server</span><strong>${escapeHtml(input.server.displayName)}</strong>
            <small title="${attribute(input.server.serverInstanceId)}">${escapeHtml(input.server.serverInstanceId)}</small></div>
          <div>${pill(input.server.registrationState ?? "not_scheduled")}<small>${input.server.committedPlayers ?? 0} committed · ${input.server.reservedSlots ?? 0} reserved</small></div>
        </div>
        <div class="admin-kv-grid">
          <span><small>Časové okno</small><strong>${input.server.registrationWindowMinutes ?? 60} minut</strong></span>
          <span><small>Kapacita</small><strong>${input.server.committedPlayers ?? 0} + ${input.server.reservedSlots ?? 0} / ${input.server.capacity}</strong></span>
          <span><small>Plánované otevření</small><strong>${escapeHtml(input.registrationOpensAt
            ? new Date(input.registrationOpensAt).toLocaleString("cs-CZ") : input.action === "open-registration-now" ? "Ihned" : "—")}</strong></span>
        </div>
        <label><span>Důvod změny registrace</span>
          <textarea data-admin-registration-reason minlength="3" maxlength="240" required
            placeholder="Povinný auditní důvod">${escapeHtml(input.reason)}</textarea>
        </label>
        <div class="admin-action-dialog__actions">
          <button class="admin-button admin-button--ghost" type="button" data-admin-registration-cancel>Zrušit</button>
          <button class="admin-button ${confirmClass}" type="button" data-admin-registration-confirm>
            ${escapeHtml(presentation.confirmLabel)}</button>
        </div>
        <p class="admin-form-error" data-admin-registration-error role="alert" aria-live="polite"></p>
      </div>
    </section>
  </div>`;
};

const ACTION_PRESENTATIONS: Record<HostedLifecycleAction, ActionPresentation> = {
  "open-joins": {
    label: "Joiny otevřeny", confirmLabel: "Otevřít joiny", title: "Otevřít joiny",
    detail: "Povolí serverem řízený vstup hráčů.", tone: "primary"
  },
  "close-joins": {
    label: "Joiny uzavřeny", confirmLabel: "Uzavřít joiny", title: "Uzavřít joiny",
    detail: "Nové vstupy budou serverově odmítnuty.", tone: "neutral"
  },
  "schedule-registration": {
    label: "Registrace naplánována", confirmLabel: "Naplánovat", title: "Naplánovat registraci",
    detail: "Potvrdí plánované registrační okno.", tone: "primary"
  },
  "open-registration-now": {
    label: "Registrace otevřena", confirmLabel: "Otevřít registraci", title: "Otevřít registraci",
    detail: "Registrace se otevře okamžitě podle canonical okna.", tone: "primary"
  },
  "cancel-registration": {
    label: "Plán registrace zrušen", confirmLabel: "Zrušit plán", title: "Zrušit plán registrace",
    detail: "Naplánované otevření se neprovede.", tone: "neutral"
  },
  "close-registration-now": {
    label: "Registrace nouzově uzavřena", confirmLabel: "Uzavřít registraci",
    title: "Nouzově uzavřít registraci", detail: "Nové registrace budou okamžitě zastaveny.", tone: "danger"
  },
  start: {
    label: "Start serveru", confirmLabel: "Spustit server", title: "Spustit server",
    detail: "Server přejde z lobby do aktivního gameplay runtime.", tone: "primary"
  },
  pause: {
    label: "Pozastavení serveru", confirmLabel: "Pozastavit server", title: "Pozastavit server",
    detail: "Autoritativní runtime bude bezpečně pozastaven.", tone: "neutral"
  },
  resume: {
    label: "Obnovení serveru", confirmLabel: "Obnovit server", title: "Obnovit server",
    detail: "Pozastavený runtime bude znovu spuštěn.", tone: "primary"
  },
  restart: {
    label: "Bezpečný restart", confirmLabel: "Bezpečně restartovat", title: "Bezpečný restart",
    detail: "Worker obnoví instanci z posledního potvrzeného recovery stavu.", tone: "neutral"
  },
  stop: {
    label: "Zastavení serveru", confirmLabel: "Zastavit server", title: "Zastavit server",
    detail: "Destruktivní lifecycle akce dostupná pouze ownerovi.", tone: "danger"
  },
  delete: {
    label: "Server archivován", confirmLabel: "Smazat a vrátit hráče", title: "Smazat server",
    detail: "Owner-only archivace serveru s okamžitým návratem hráčů do lobby.", tone: "danger"
  }
};

const actionPresentation = (action: HostedLifecycleAction): ActionPresentation => ACTION_PRESENTATIONS[action];
