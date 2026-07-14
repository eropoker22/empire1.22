import { PLAYER_BOOST_CONFIG } from "../../../packages/game-config/src/legacy-page/gameplay-config.generated.js";
import {
  activatePlayerBoost,
  getPlayerBoostViewModel,
  setBuildingActionFeedback
} from "./runtime.js";
import { bindSharedCountdown } from "./ui/sharedCountdownTicker.js";
import { closeOverlay, openOverlay } from "./ui/legacyOverlayCoordinator.js";

const PAGE_SELECTOR = 'main[data-page="game"]';
const CATEGORY_LABELS = Object.freeze({ intel: "INTEL", production: "VÝROBA", combat: "COMBAT" });
const ERROR_MESSAGES = Object.freeze({
  boost_unknown: "Tento boost není dostupný.",
  boost_already_active: "Jiný boost je právě aktivní.",
  boost_on_cooldown: "Tento boost je ještě v cooldownu.",
  boost_missing_clean_cash: "Nemáš dost čistých peněz.",
  boost_missing_resources: "Ve SKLADU chybí potřebné komponenty.",
  boost_unavailable: "Boosty nejsou v tomto režimu dostupné.",
  boost_duplicate_activation: "Tento požadavek už byl zpracován.",
  boost_state_conflict: "Aktivaci se nepodařilo dokončit."
});

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const formatCountdown = (deadlineMs, now = Date.now()) => {
  const seconds = Math.max(0, Math.ceil((Number(deadlineMs || 0) - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

const formatMinutes = (durationMs) => `${Math.max(1, Math.round(Number(durationMs || 0) / 60_000))} min`;
const formatMoney = (amount) => `$${new Intl.NumberFormat("cs-CZ").format(Math.max(0, Number(amount || 0)))}`;

function renderIcon(iconKey) {
  if (iconKey === "industrial-gear") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.6 3.4h4.8l.7 2.2 2 .9 2.1-1 2.4 4.1-1.7 1.5.2 2.2 1.8 1.4-2.4 4.1-2.1-.9-1.8 1.3-.4 2.3H9.6l-.7-2.2-2-.9-2.1 1-2.4-4.1 1.7-1.5-.2-2.2-1.8-1.4 2.4-4.1 2.1.9 1.8-1.3.4-2.3Z"></path><circle cx="12" cy="12" r="3.1"></circle></svg>';
  }
  if (iconKey === "tactical-grid") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.5"></circle><circle cx="12" cy="12" r="2.8"></circle><path d="M12 1.8v5M12 17.2v5M1.8 12h5M17.2 12h5"></path></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 12s3.5-5.6 9.2-5.6 9.2 5.6 9.2 5.6-3.5 5.6-9.2 5.6S2.8 12 2.8 12Z"></path><circle cx="12" cy="12" r="2.7"></circle><path d="M4.4 5.2 7 7.5M19.6 5.2 17 7.5"></path></svg>';
}

function buildEffectLines(definition) {
  const effect = definition?.effect || {};
  const lines = [];
  if (Number(effect.spyDurationMultiplier) > 0) {
    lines.push(`−${Math.round((1 - effect.spyDurationMultiplier) * 100)} % čas špehování`);
  }
  if (Number(effect.extraIntelBlocksOnSuccess) > 0) {
    lines.push(`+${Math.floor(effect.extraIntelBlocksOnSuccess)} informační blok při úspěchu`);
  }
  if (Number(effect.criticalFailureChanceMultiplier) > 0) {
    lines.push(`−${Math.round((1 - effect.criticalFailureChanceMultiplier) * 100)} % relativní critical failure`);
  }
  if (Number(effect.productionSpeedMultiplier) > 1) {
    lines.push(`+${Math.round((effect.productionSpeedMultiplier - 1) * 100)} % rychlost všech výrobních linek`);
  }
  if (Number(effect.combatPowerMultiplier) > 1) {
    lines.push(`+${Math.round((effect.combatPowerMultiplier - 1) * 100)} % síla příštího útoku nebo obrany`);
  }
  return lines;
}

function resolveButtonState(card, view, pendingBoostId, now) {
  if (pendingBoostId === card.boostId) return { label: "AKTIVUJI…", deadline: null };
  if (card.isActive) {
    return {
      label: `${card.isArmed ? "NABITO" : "AKTIVNÍ"} · ${formatCountdown(card.activeEndsAtMs, now)}`,
      deadline: card.activeEndsAtMs
    };
  }
  if (card.disabledReason === "boost_on_cooldown") {
    return { label: `COOLDOWN · ${formatCountdown(card.cooldownEndsAtMs, now)}`, deadline: card.cooldownEndsAtMs };
  }
  if (card.disabledReason === "boost_already_active") {
    return { label: `BLOKOVÁNO · ${formatCountdown(view.active?.expiresAtMs, now)}`, deadline: view.active?.expiresAtMs };
  }
  if (card.disabledReason === "boost_missing_resources") return { label: "CHYBÍ SUROVINY", deadline: null };
  if (card.disabledReason === "boost_missing_clean_cash") return { label: "CHYBÍ CASH", deadline: null };
  if (card.disabledReason === "boost_unavailable") return { label: "NEDOSTUPNÉ", deadline: null };
  return { label: "AKTIVOVAT", deadline: null };
}

function createCardMarkup(card, view, pendingBoostId) {
  const definition = PLAYER_BOOST_CONFIG[card.boostId] || {};
  const buttonState = resolveButtonState(card, view, pendingBoostId, Date.now());
  const materialChips = card.costs.map((cost) => `
    <span class="boost-cost-chip ${cost.enough ? "" : "is-missing"}" title="${cost.enough ? "Dostatek" : `Chybí ${cost.missingAmount} ks`}">
      <span>${escapeHtml(cost.label)}</span><strong>${cost.required} / ${cost.stored}</strong>
    </span>
  `).join("");
  const cashEnough = card.hasEnoughCleanCash;
  return `
    <article class="boost-card boost-card--${card.uiAccent} ${card.isActive ? "is-active" : ""}" data-boost-card="${card.boostId}">
      <div class="boost-card__topline"><span>${escapeHtml(CATEGORY_LABELS[card.category] || card.category)}</span><i></i></div>
      <div class="boost-card__heading">
        <span class="boost-card__icon">${renderIcon(card.iconKey)}</span>
        <div><h4>${escapeHtml(card.label)}</h4><p>${escapeHtml(card.description)}</p></div>
      </div>
      <ul class="boost-card__effects">${buildEffectLines(definition).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
      <div class="boost-card__timing">
        <span><small>${definition.consumptionMode === "next-valid-pvp-combat" ? "NABITÍ EXPIRUJE" : "TRVÁNÍ"}</small><strong>${formatMinutes(card.durationMs)}</strong></span>
        <span><small>COOLDOWN</small><strong>${formatMinutes(card.cooldownMs)}</strong></span>
      </div>
      <div class="boost-card__costs">${materialChips}
        <span class="boost-cost-chip boost-cost-chip--cash ${cashEnough ? "" : "is-missing"}" title="${cashEnough ? "Dostatek clean cash" : `Chybí ${formatMoney(card.cleanCashCost - card.playerCleanCash)}`}">
          <span>Clean Cash</span><strong>${formatMoney(card.cleanCashCost)} / ${formatMoney(card.playerCleanCash)}</strong>
        </span>
      </div>
      <button class="button boost-card__activate" type="button" data-boost-activate="${card.boostId}" ${card.canActivate && !pendingBoostId ? "" : "disabled"}>
        <span data-boost-button-label>${escapeHtml(buttonState.label)}</span>
      </button>
    </article>
  `;
}

function initBoostRuntime() {
  const root = document.querySelector(PAGE_SELECTOR);
  const modal = document.getElementById("boost-modal");
  const content = document.getElementById("boost-modal-content");
  if (!root || !modal || !content) return;

  const openButtons = [...new Set(document.querySelectorAll("[data-boost-open-trigger]"))];
  const backdrop = document.getElementById("boost-modal-backdrop");
  const closeButton = document.getElementById("boost-modal-close");
  const confirmationModal = document.getElementById("boost-confirmation-modal");
  const confirmationBackdrop = document.getElementById("boost-confirmation-backdrop");
  const confirmationContent = document.getElementById("boost-modal-confirmation-content");
  const confirmationBack = confirmationModal?.querySelector("[data-boost-confirm-back]");
  const confirmationSubmit = confirmationModal?.querySelector("[data-boost-confirm-submit]");
  const confirmationClose = confirmationModal?.querySelector("[data-boost-confirm-close]");
  const feedback = modal.querySelector("[data-boost-feedback]");
  const pinned = document.querySelector("[data-player-boost-pinned]");
  let confirmationBoostId = null;
  let pendingBoostId = null;
  let restoreFocusElement = null;
  let confirmationTrigger = null;
  let lastStateFingerprint = "";

  const isOpen = () => !modal.hidden && !modal.classList.contains("hidden");
  const getView = () => getPlayerBoostViewModel(Date.now());

  const updateActiveSurfaces = (view, now = Date.now()) => {
    const active = view.active;
    const definition = active ? PLAYER_BOOST_CONFIG[active.boostId] : null;
    const countdown = active ? formatCountdown(active.expiresAtMs, now) : "";
    const panel = modal.querySelector("[data-boost-active-panel]");
    if (panel) {
      panel.dataset.accent = active?.uiAccent || "idle";
      panel.querySelector("[data-boost-active-badge]").textContent = active
        ? `${active.label.toUpperCase()} ${active.status === "armed" ? "NABITÝ" : "AKTIVNÍ"}`
        : "SYSTÉM PŘIPRAVEN";
      panel.querySelector("[data-boost-active-title]").textContent = active
        ? (active.status === "armed" ? "Čeká na příští PvP boj" : active.effectSummary)
        : "Žádný aktivní protokol";
      panel.querySelector("[data-boost-active-effect]").textContent = active
        ? active.effectSummary
        : "Komponenty jsou připravené k aktivaci.";
      panel.querySelector("[data-boost-active-time]").textContent = countdown;
      const progress = panel.querySelector("[data-boost-active-progress]");
      if (progress) {
        const durationMs = Number(definition?.durationMs || 1);
        const remainingMs = active ? Math.max(0, Number(active.expiresAtMs || 0) - now) : 0;
        progress.style.width = `${active ? Math.max(0, Math.min(100, remainingMs / durationMs * 100)) : 0}%`;
      }
    }
    openButtons.forEach((button) => {
      const label = button.querySelector("[data-boost-map-label]");
      const time = button.querySelector("[data-boost-map-time]");
      button.classList.toggle("is-active", Boolean(active));
      button.dataset.accent = active?.uiAccent || "";
      if (label) label.textContent = active?.status === "armed" ? "BOOST · NABITO" : "BOOST";
      if (time) {
        time.hidden = !active;
        time.textContent = countdown;
      }
    });
    if (pinned) {
      pinned.hidden = !active;
      pinned.dataset.accent = active?.uiAccent || "";
      if (active) {
        pinned.querySelector("[data-player-boost-pinned-badge]").textContent = active.status === "armed" ? "NABITÝ" : "AKTIVNÍ";
        pinned.querySelector("[data-player-boost-pinned-title]").textContent = active.label.toUpperCase();
        pinned.querySelector("[data-player-boost-pinned-effect]").textContent = active.effectSummary;
        pinned.querySelector("[data-player-boost-pinned-time]").textContent = `Zbývá ${countdown}`;
      }
    }
  };

  const updateButtonCountdowns = (view, now = Date.now()) => {
    for (const card of view.cards) {
      const button = content.querySelector(`[data-boost-card="${card.boostId}"] [data-boost-button-label]`);
      if (button) button.textContent = resolveButtonState(card, view, pendingBoostId, now).label;
    }
  };

  const stateFingerprint = (view) => JSON.stringify({
    active: view.active?.boostId || null,
    status: view.active?.status || null,
    cards: view.cards.map((card) => [card.boostId, card.disabledReason, card.canActivate])
  });

  const renderCards = (view = getView()) => {
    content.innerHTML = view.cards.map((card) => createCardMarkup(card, view, pendingBoostId)).join("");
    lastStateFingerprint = stateFingerprint(view);
    updateActiveSurfaces(view);
    updateButtonCountdowns(view);
  };

  const tickUi = () => {
    const view = getView();
    const fingerprint = stateFingerprint(view);
    if (isOpen() && fingerprint !== lastStateFingerprint) renderCards(view);
    updateActiveSurfaces(view);
    if (isOpen()) updateButtonCountdowns(view);
  };

  const closeConfirmation = () => {
    confirmationBoostId = null;
    if (!confirmationModal || confirmationModal.hidden) return;
    confirmationModal.classList.add("hidden");
    confirmationModal.hidden = true;
    closeOverlay(confirmationModal, { restoreFocus: true });
    confirmationTrigger = null;
  };

  const showConfirmation = (boostId) => {
    const view = getView();
    const card = view.cards.find((entry) => entry.boostId === boostId);
    const definition = PLAYER_BOOST_CONFIG[boostId];
    if (!card?.canActivate || !definition) return;
    confirmationBoostId = boostId;
    confirmationContent.innerHTML = `
      <span class="boost-modal__eyebrow">POTVRZENÍ PROTOKOLU</span>
      <h4 id="boost-confirm-title">${escapeHtml(card.label)}</h4>
      <p>${escapeHtml(card.shortEffect)}</p>
      <div class="boost-modal__confirm-summary">
        <span>Efekt <strong>${formatMinutes(card.durationMs)}</strong></span>
        <span>Cooldown <strong>${formatMinutes(card.cooldownMs)}</strong></span>
        <span>Clean Cash <strong>${formatMoney(card.cleanCashCost)}</strong></span>
        ${card.costs.map((cost) => `<span>${escapeHtml(cost.label)} <strong>${cost.required} ks</strong></span>`).join("")}
      </div>
      <p class="boost-modal__confirm-warning">Aktivaci nelze zrušit ani refundovat.</p>`;
    if (!confirmationModal) return;
    confirmationTrigger = document.activeElement;
    confirmationModal.hidden = false;
    confirmationModal.classList.remove("hidden");
    openOverlay(confirmationModal, {
      type: "modal",
      ariaModal: true,
      restoreFocusTo: confirmationTrigger,
      restoreFocusOnClose: true,
      focusTarget: confirmationBack
    });
  };

  const open = (event) => {
    restoreFocusElement = event?.currentTarget || document.activeElement;
    closeConfirmation();
    if (feedback) feedback.textContent = "";
    modal.hidden = false;
    modal.classList.remove("hidden");
    openOverlay(modal, { type: "modal", ariaModal: true, restoreFocusOnClose: false });
    renderCards();
    closeButton?.focus();
  };

  const close = () => {
    closeConfirmation();
    modal.classList.add("hidden");
    modal.hidden = true;
    closeOverlay(modal, { restoreFocus: false });
    restoreFocusElement?.focus?.();
  };

  const confirmActivation = async () => {
    if (!confirmationBoostId || pendingBoostId) return;
    const boostId = confirmationBoostId;
    pendingBoostId = boostId;
    confirmationSubmit.disabled = true;
    confirmationSubmit.textContent = "AKTIVUJI…";
    renderCards();
    const result = await activatePlayerBoost(boostId, {
      commandId: `boost:${boostId}:${Date.now()}`
    });
    pendingBoostId = null;
    confirmationSubmit.disabled = false;
    confirmationSubmit.textContent = "POTVRDIT AKTIVACI";
    if (!result?.ok) {
      const message = ERROR_MESSAGES[result?.code] || "Aktivaci se nepodařilo dokončit.";
      if (feedback) feedback.textContent = message;
      setBuildingActionFeedback(root, "warning", "Strategické boosty", message);
      closeConfirmation();
      renderCards();
      return;
    }
    if (feedback) feedback.textContent = "Boost byl úspěšně aktivován.";
    closeConfirmation();
    renderCards();
  };

  openButtons.forEach((button) => button.addEventListener("click", open));
  closeButton?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);
  confirmationBackdrop?.addEventListener("click", closeConfirmation);
  confirmationBack?.addEventListener("click", closeConfirmation);
  confirmationClose?.addEventListener("click", closeConfirmation);
  confirmationSubmit?.addEventListener("click", confirmActivation);
  modal.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-boost-activate]") : null;
    if (button instanceof HTMLButtonElement && !button.disabled) showConfirmation(button.dataset.boostActivate);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (confirmationModal && !confirmationModal.hidden) {
      closeConfirmation();
      return;
    }
    if (isOpen()) close();
  });
  document.addEventListener("empire:player-boost-state-change", () => renderCards());
  document.addEventListener("empire:runtime-mode-changed", () => renderCards());

  const tickerHost = openButtons[0] || root;
  bindSharedCountdown(tickerHost, () => Date.now(), { render: tickUi });
  tickUi();
}

if (typeof document !== "undefined") initBoostRuntime();
