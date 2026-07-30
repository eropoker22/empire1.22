import {
  getServerGameplaySliceReadModel,
  retryPendingServerGameplayCommands,
  submitServerGameplayCommand,
  submitServerEmergencyRecoveryCommand
} from "./runtime/serverGameplaySource.js";
import { GAMEPLAY_EXECUTION_MODES, getGameplayExecutionMode } from "./runtime/gameplayExecutionMode.js";
import { bindSharedModal, closeSharedModal, openSharedModal } from "./ui/sharedModalStack.js";

const CONNECTION_LABELS = Object.freeze({
  connected: "PŘIPOJENO",
  reconnecting: "OBNOVUJI SPOJENÍ",
  stale: "STAV JE ZASTARALÝ",
  session_expired: "RELACE VYPRŠELA",
  server_unavailable: "SERVER NEDOSTUPNÝ",
  conflict: "KONFLIKT STAVU",
  offline: "OFFLINE"
});

let latestSlice = null;
let connectionState = "reconnecting";
let shownEncirclementToken = null;
let shownConnectionNotice = null;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[character]);

const ensureShell = () => {
  const root = document.querySelector("main[data-page='game']");
  if (!root || root.dataset.closedAlphaUxReady === "true") return;
  root.dataset.closedAlphaUxReady = "true";
  const connection = document.createElement("div");
  connection.className = "closed-alpha-connection";
  connection.dataset.connectionStatus = "reconnecting";
  connection.setAttribute("role", "status");
  connection.setAttribute("aria-live", "polite");
  document.body.append(connection);

  const recovery = document.createElement("section");
  recovery.className = "operational-liveness-panel";
  recovery.dataset.operationalRecovery = "true";
  recovery.hidden = true;
  root.prepend(recovery);

  const confirmation = document.createElement("div");
  confirmation.className = "operations-center-modal shared-confirmation-modal";
  confirmation.dataset.sharedConfirmation = "true";
  confirmation.hidden = true;
  confirmation.innerHTML = `
    <div class="operations-center-modal__backdrop" data-shared-modal-close></div>
    <section class="operations-center-modal__card shared-confirmation-modal__card" role="dialog" aria-modal="false" aria-labelledby="shared-confirmation-title">
      <header><div><span data-shared-confirmation-kicker>POTVRZENÍ</span><h2 id="shared-confirmation-title" data-shared-confirmation-title></h2></div><button type="button" class="button" data-shared-modal-close aria-label="Zavřít">×</button></header>
      <div class="operations-center-modal__body shared-confirmation-modal__body"><p data-shared-confirmation-body></p><div class="shared-confirmation-modal__actions"><button type="button" class="button" data-shared-confirmation-cancel data-shared-modal-close>Zrušit</button><button type="button" class="button button--primary" data-shared-confirmation-submit>Potvrdit</button></div></div>
    </section>`;
  document.body.append(confirmation);
  bindSharedModal(confirmation);
  setupStreetNewsFilters();
};

const showConfirmation = ({
  kicker = "POTVRZENÍ",
  title,
  body,
  confirmLabel = "Potvrdit",
  cancelVisible = true,
  trigger,
  onConfirm,
  kind = "action"
}) => {
  const modal = document.querySelector("[data-shared-confirmation]");
  if (!modal) return;
  modal.dataset.sharedConfirmationKind = kind;
  modal.querySelector("[data-shared-confirmation-kicker]").textContent = kicker;
  modal.querySelector("[data-shared-confirmation-title]").textContent = title;
  modal.querySelector("[data-shared-confirmation-body]").textContent = body;
  modal.querySelector("[data-shared-confirmation-cancel]").hidden = !cancelVisible;
  const submit = modal.querySelector("[data-shared-confirmation-submit]");
  submit.textContent = confirmLabel;
  submit.disabled = false;
  submit.onclick = async () => {
    submit.disabled = true;
    try {
      await onConfirm?.();
      closeSharedModal(modal, "confirmed");
    } catch {
      submit.disabled = false;
    }
  };
  openSharedModal(modal, { trigger });
};

const renderConnection = () => {
  const element = document.querySelector(".closed-alpha-connection");
  if (!element) return;
  const mode = getGameplayExecutionMode();
  element.hidden = mode !== GAMEPLAY_EXECUTION_MODES.serverAuthoritative;
  element.dataset.connectionStatus = connectionState;
  element.textContent = CONNECTION_LABELS[connectionState] || CONNECTION_LABELS.server_unavailable;
  window.empireStreetsGameplayConnectionState = connectionState;
  if (connectionState === "connected") {
    const modal = document.querySelector("[data-shared-confirmation]");
    if (modal?.dataset.sharedConfirmationKind === "connection") {
      closeSharedModal(modal, "connection-restored");
      delete modal.dataset.sharedConfirmationKind;
    }
    shownConnectionNotice = null;
  }
  if (["session_expired", "server_unavailable"].includes(connectionState) && shownConnectionNotice !== connectionState) {
    const noticeState = connectionState;
    shownConnectionNotice = noticeState;
    queueMicrotask(() => {
      if (connectionState !== noticeState) return;
      showConfirmation({
        kicker: "PŘIPOJENÍ",
        title: CONNECTION_LABELS[noticeState],
        body: noticeState === "session_expired"
          ? "Relace vypršela. Obnov přihlášení."
          : "Server teď není dostupný. Herní akce zůstávají uzamčené.",
        confirmLabel: "Zavřít",
        cancelVisible: false,
        onConfirm: () => {},
        kind: "connection"
      });
    });
  }
};

const renderEmergencyRecovery = () => {
  const element = document.querySelector("[data-operational-recovery]");
  const recovery = latestSlice?.player?.operationalLiveness?.emergencyRecovery;
  if (!element) return;
  if (!recovery?.canClaim) {
    element.hidden = true;
    element.replaceChildren();
    return;
  }
  element.hidden = false;
  element.dataset.state = "emergency-recovery";
  element.innerHTML = `
    <div>
      <strong>NOUZOVÁ OBNOVA</strong>
      <p>Server potvrdil, že nemáš dostupnou cestu pokračování.</p>
    </div>
    <button type="button" class="button operational-liveness-panel__recovery" data-emergency-recovery>
      Obnovit provoz · $${escapeHtml(recovery.cleanCash)} + ${escapeHtml(recovery.population)} populace
    </button>`;
  element.querySelector("[data-emergency-recovery]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    showConfirmation({
      kicker: "NOUZOVÁ ZAKÁZKA",
      title: "Jednorázová obnova provozu",
      body: `Server znovu ověří softlock a při splnění podmínek připíše $${recovery.cleanCash} a ${recovery.population} populace.`,
      trigger: button,
      onConfirm: async () => {
        const result = await submitServerEmergencyRecoveryCommand();
        if (result?.errors?.length) throw new Error(result.errors[0]?.message || "Recovery rejected");
      }
    });
  }, { once: true });
};

const renderEncirclementConfirmation = () => {
  const pending = latestSlice?.player?.pendingEncirclementConfirmations?.[0];
  if (!pending || pending.token === shownEncirclementToken) return;
  shownEncirclementToken = pending.token;
  showConfirmation({
    kicker: "ALIANČNÍ KORIDOR",
    title: "Uzavření přímé expanze",
    body: `Obsazením ${pending.targetDistrictId} uzavřeš přímou expanzi spojence ${pending.affectedPlayerIds.join(", ")}. Spojenec však získá alianční koridor přes tvoje území.`,
    onConfirm: async () => {
      const response = await submitServerGameplayCommand({
        type: "occupy-district",
        payload: {
          districtId: pending.targetDistrictId,
          sourceDistrictId: pending.sourceDistrictId,
          encirclementConfirmationToken: pending.token
        },
        focusDistrictId: pending.targetDistrictId
      });
      if (!response?.accepted) throw new Error(response?.errors?.[0]?.message || "Confirmation rejected");
    }
  });
};

const setupStreetNewsFilters = () => {
  const feed = document.querySelector("[data-building-action-feed]");
  document.querySelectorAll("[data-street-news-filters]").forEach((filters) => filters.remove());
  feed?.querySelectorAll(".building-action-status__item[hidden]").forEach((item) => {
    item.hidden = false;
  });
};

const normalizeConnection = (detail = {}) => {
  const message = String(detail.lastErrorMessage || "").toLowerCase();
  if (/session|relace|401|unauthorized/.test(message)) return "session_expired";
  if (/conflict|version/.test(message)) return "conflict";
  if (detail.status === "ready" || detail.status === "connected") return "connected";
  if (detail.status === "loading" || detail.status === "idle") return "reconnecting";
  if (detail.status === "stale" || detail.staleData) return latestSlice ? "stale" : "server_unavailable";
  if (detail.status === "offline") return "offline";
  return "server_unavailable";
};

document.addEventListener("DOMContentLoaded", () => {
  ensureShell();
  latestSlice = getServerGameplaySliceReadModel();
  renderConnection();
  renderEmergencyRecovery();
  renderEncirclementConfirmation();
});

document.addEventListener("empire:gameplay-slice-rendered", (event) => {
  latestSlice = event.detail?.gameplaySlice || getServerGameplaySliceReadModel();
  connectionState = "connected";
  ensureShell();
  renderConnection();
  renderEmergencyRecovery();
  renderEncirclementConfirmation();
  void retryPendingServerGameplayCommands();
});

document.addEventListener("empire:gameplay-connection-state", (event) => {
  connectionState = normalizeConnection(event.detail);
  renderConnection();
});
