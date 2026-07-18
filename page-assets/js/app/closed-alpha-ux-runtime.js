import {
  getServerGameplaySliceReadModel,
  retryPendingServerGameplayCommands,
  submitServerDistrictActionCommand,
  submitServerEmergencyRecoveryCommand
} from "./runtime.js";
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

const LIVENESS_LABELS = Object.freeze({
  playable: ["HRANICE OTEVŘENÁ", "Vyber dostupnou akci na mapě."],
  open_frontier: ["HRANICE OTEVŘENÁ", "Prozkoumej nebo obsaď sousední neutral district."],
  hostile_encircled: ["OBKLÍČEN NEPŘÁTELI", "Vyšpehuj sousední enemy district a připrav průlom."],
  allied_encircled: ["OBKLÍČEN SPOJENCI", "Použij dostupný alianční koridor."],
  mixed_encircled: ["SMÍŠENÉ OBKLÍČENÍ", "Použij přímý cíl nebo alianční koridor."],
  temporarily_sealed: ["DOČASNĚ UZAVŘEN", "Další postup se odemkne po nejbližším cooldownu."],
  economy_recovery: ["OBNOVA PROVOZU", "Použij dostupnou ekonomickou cestu obnovy."],
  last_stand: ["POSLEDNÍ BAŠTA", "Poslední district je krátce chráněný před útokem."],
  no_territory: ["PORAŽEN", "Nemáš žádný aktivní district."],
  defeated: ["PORAŽEN", "Hra pokračuje v režimu výsledků a sledování."],
  invalid_softlock: ["NOUZOVÝ STAV", "Server ověřuje jednorázovou cestu obnovy."]
});

let latestSlice = null;
let connectionState = "reconnecting";
let shownEncirclementToken = null;
let shownConnectionNotice = null;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[character]);

const formatTicks = (ticks, tickRateMs = 5000) => {
  const seconds = Math.max(0, Math.ceil(Number(ticks || 0) * tickRateMs / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

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

  const liveness = document.createElement("section");
  liveness.className = "operational-liveness-panel";
  liveness.dataset.operationalLiveness = "true";
  liveness.hidden = true;
  root.prepend(liveness);

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

const showConfirmation = ({ kicker = "POTVRZENÍ", title, body, confirmLabel = "Potvrdit", cancelVisible = true, trigger, onConfirm }) => {
  const modal = document.querySelector("[data-shared-confirmation]");
  if (!modal) return;
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
  if (["session_expired", "server_unavailable"].includes(connectionState) && shownConnectionNotice !== connectionState) {
    shownConnectionNotice = connectionState;
    queueMicrotask(() => showConfirmation({
      kicker: "PŘIPOJENÍ",
      title: CONNECTION_LABELS[connectionState],
      body: connectionState === "session_expired"
        ? "Relace vypršela. Obnov přihlášení."
        : "Server teď není dostupný. Herní akce zůstávají uzamčené.",
      confirmLabel: "Zavřít",
      cancelVisible: false,
      onConfirm: () => {}
    }));
  }
};

const renderLiveness = () => {
  const element = document.querySelector("[data-operational-liveness]");
  const view = latestSlice?.player?.operationalLiveness;
  if (!element || !view) return;
  const [title, fallback] = LIVENESS_LABELS[view.state] || LIVENESS_LABELS.invalid_softlock;
  const next = view.nextProgressAtTick !== null
    ? `${fallback} Další možnost za ${formatTicks(view.remainingTicks, latestSlice?.mode?.tickRateMs || 5000)}.`
    : fallback;
  const corridor = view.corridorAvailable && view.corridorTargets?.[0]
    ? `<span>ALIANČNÍ KORIDOR → ${escapeHtml(view.corridorTargets[0])}</span>` : "";
  const recovery = view.emergencyRecovery?.canClaim
    ? `<button type="button" class="button operational-liveness-panel__recovery" data-emergency-recovery>Nouzová zakázka · $${view.emergencyRecovery.cleanCash} + ${view.emergencyRecovery.population} populace</button>` : "";
  element.hidden = false;
  element.dataset.state = view.state;
  element.innerHTML = `<div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(next)}</p></div>${corridor}${recovery}`;
  element.querySelector("[data-emergency-recovery]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    showConfirmation({
      kicker: "NOUZOVÁ ZAKÁZKA",
      title: "Jednorázová obnova provozu",
      body: `Server znovu ověří softlock a při splnění podmínek připíše $${view.emergencyRecovery.cleanCash} a ${view.emergencyRecovery.population} populace.`,
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
      const response = await submitServerDistrictActionCommand({
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
  if (detail.status === "ready") return "connected";
  if (detail.status === "loading" || detail.status === "idle") return "reconnecting";
  if (detail.status === "stale" || detail.staleData) return latestSlice ? "stale" : "server_unavailable";
  if (detail.status === "offline") return "offline";
  return "server_unavailable";
};

document.addEventListener("DOMContentLoaded", () => {
  ensureShell();
  latestSlice = getServerGameplaySliceReadModel();
  renderConnection();
  renderLiveness();
  renderEncirclementConfirmation();
});

document.addEventListener("empire:gameplay-slice-rendered", (event) => {
  latestSlice = event.detail?.gameplaySlice || getServerGameplaySliceReadModel();
  connectionState = "connected";
  ensureShell();
  renderConnection();
  renderLiveness();
  renderEncirclementConfirmation();
  void retryPendingServerGameplayCommands();
});

document.addEventListener("empire:gameplay-connection-state", (event) => {
  connectionState = normalizeConnection(event.detail);
  renderConnection();
});
