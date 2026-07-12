import {
  SPY_WARNING_MODAL_BADGE_SELECTOR,
  SPY_WARNING_MODAL_CONTENT_SELECTOR,
  SPY_WARNING_MODAL_DETAILS_SELECTOR,
  SPY_WARNING_MODAL_SELECTOR,
  SPY_WARNING_MODAL_SUMMARY_SELECTOR,
  SPY_WARNING_MODAL_TITLE_SELECTOR
} from "../runtime/constants.js";
import {
  closeOverlay,
  openOverlay
} from "./legacyOverlayCoordinator.js";
import {
  escapeModalHtml,
  renderActionResultRows,
  safeResultModalQuery
} from "./resultModalPanel.js";

function setText(element, value) {
  if (element) {
    element.textContent = String(value ?? "");
  }
}

function setDisabled(element, disabled) {
  if (element && "disabled" in element) {
    element.disabled = Boolean(disabled);
  }
}

function applyPanelAtmosphere(elements = {}, atmosphereMeta = {}) {
  const { card, imageElement, labelElement } = elements;
  const isAtmosphereLocked = atmosphereMeta.typeKey === "unknown";

  if (card?.dataset) {
    card.dataset.districtType = atmosphereMeta.typeKey || "unknown";
  }

  if (imageElement && "src" in imageElement) {
    const imagePath = atmosphereMeta.imagePath || "";
    imageElement.src = imagePath;
    imageElement.alt = `${atmosphereMeta.label || "Neznámá"} – atmosféra města`;
    if (imageElement.dataset) {
      imageElement.dataset.atmosphereImagePath = imagePath;
    }
  }

  setText(labelElement, isAtmosphereLocked ? "" : (atmosphereMeta.label || ""));
}

function bindButtonCallback(button, callbackKey, callback, payloadResolver) {
  if (!button || typeof callback !== "function" || typeof button.addEventListener !== "function") {
    return;
  }

  const callbackProp = `__empire${callbackKey}Callback`;
  const boundProp = `__empire${callbackKey}Bound`;
  button[callbackProp] = callback;

  if (button[boundProp]) {
    return;
  }

  button[boundProp] = true;
  button.addEventListener("click", (event) => {
    const currentCallback = button[callbackProp];
    if (typeof currentCallback === "function") {
      currentCallback(typeof payloadResolver === "function" ? payloadResolver() : undefined, event);
    }
  });
}

export function renderSpyPanel(spyViewModel = {}, callbacks = {}, options = {}) {
  const elements = options.elements || {};

  applyPanelAtmosphere(elements, spyViewModel.atmosphereMeta || {});
  setText(elements.title, spyViewModel.targetLabel || `District ${spyViewModel.targetDistrictId ?? ""}`.trim());
  setText(elements.source, spyViewModel.sourceLabel || "Žádný soused");
  setText(elements.available, spyViewModel.availableSpies ?? 0);
  setText(elements.duration, spyViewModel.durationLabel || "");
  setText(elements.note, spyViewModel.note || "");

  if (elements.confirmButton) {
    elements.confirmButton.textContent = spyViewModel.confirmLabel || "Vyslat špeha";
    setDisabled(elements.confirmButton, !spyViewModel.canConfirm);
  }

  bindButtonCallback(elements.confirmButton, "SpyPanelConfirm", callbacks.onConfirmSpy, () => spyViewModel);
  return Boolean(Object.keys(elements).length);
}

export function openSpyPanel(targetDistrict = null, options = {}) {
  const popup = options.popup || options.elements?.popup || targetDistrict?.popup || null;
  if (!popup) {
    return false;
  }

  openOverlay(popup, { type: "modal", ariaModal: true });
  popup.hidden = false;
  return true;
}

export function closeSpyPanel(options = {}) {
  const popup = options.popup || options.elements?.popup || null;
  if (!popup) {
    return false;
  }

  popup.hidden = true;
  closeOverlay(popup, { restoreFocus: false });
  return true;
}

export function renderSpyResult(result = {}, options = {}) {
  const elements = options.elements || {};

  if (!elements.modal && !elements.title && !elements.summary && !elements.details) {
    return false;
  }

  setText(elements.title, result.title || "Výsledek špehování");
  setText(elements.summary, result.summary || "");
  renderActionResultRows(elements.details, result.rows || []);

  if (elements.content && Array.isArray(options.toneClasses)) {
    elements.content.classList?.remove?.(...options.toneClasses);
  }

  if (elements.content && result.tone) {
    elements.content.classList?.add?.(result.tone);
  }

  if (elements.modal) {
    elements.modal.classList?.remove?.("hidden");
    if ("hidden" in elements.modal) {
      elements.modal.hidden = false;
    }
    openOverlay(elements.modal, { type: "modal", ariaModal: true });
  }

  return true;
}

export function renderSpyWarningPanel(root, payload = {}, options = {}) {
  const elements = {
    modal: safeResultModalQuery(root, options.modalSelector || SPY_WARNING_MODAL_SELECTOR),
    content: safeResultModalQuery(root, options.contentSelector || SPY_WARNING_MODAL_CONTENT_SELECTOR),
    title: safeResultModalQuery(root, options.titleSelector || SPY_WARNING_MODAL_TITLE_SELECTOR),
    badge: safeResultModalQuery(root, options.badgeSelector || SPY_WARNING_MODAL_BADGE_SELECTOR),
    summary: safeResultModalQuery(root, options.summarySelector || SPY_WARNING_MODAL_SUMMARY_SELECTOR),
    details: safeResultModalQuery(root, options.detailsSelector || SPY_WARNING_MODAL_DETAILS_SELECTOR)
  };

  const missingKeys = Object.entries(elements)
    .filter(([, element]) => !element)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    const logger = options.console || (typeof console !== "undefined" ? console : null);
    if (logger && typeof logger.warn === "function") {
      logger.warn(`Spy warning modal is missing required elements: ${missingKeys.join(", ")}`);
    }
    return false;
  }

  const districtName = String(payload.districtName || payload.district || payload.districtId || "District");
  const detectedAtLabel = String(payload.detectedAtLabel || payload.detectedAt || "");
  const attackerNick = String(payload.attackerNick || "Neznámý hráč");
  const attackerGang = String(payload.attackerGang || "Neznámý gang");
  const attackerAlliance = String(payload.attackerAlliance || "Bez aliance");

  elements.content.classList.remove("is-success", "is-medium-fail", "is-major-fail", "is-player-alert", "is-alliance-alert");
  elements.content.classList.add(payload.alertKind === "alliance" ? "is-alliance-alert" : "is-player-alert");
  elements.title.textContent = payload.title || "Upozornění: Neúspěšné špehování";
  elements.badge.textContent = payload.badge || "Vlastní district pod tlakem";
  elements.summary.textContent = payload.summary || "";
  elements.details.innerHTML = `
    <div class="modal__row">
      <span>Cíl</span>
      <strong>${escapeModalHtml(districtName)}</strong>
    </div>
    <div class="modal__row">
      <span>Odeslal špeha</span>
      <strong class="spy-warning-modal__identity spy-warning-modal__identity--nick">${escapeModalHtml(attackerNick)}</strong>
    </div>
    <div class="modal__row">
      <span>Gang útočníka</span>
      <strong class="spy-warning-modal__identity spy-warning-modal__identity--gang">${escapeModalHtml(attackerGang)}</strong>
    </div>
    <div class="modal__row">
      <span>Aliance útočníka</span>
      <strong class="spy-warning-modal__identity spy-warning-modal__identity--alliance">${escapeModalHtml(attackerAlliance)}</strong>
    </div>
    <div class="modal__row">
      <span>Čas zachycení</span>
      <strong class="modal__nowrap-value">${escapeModalHtml(detectedAtLabel)}</strong>
    </div>
    <div class="modal__row">
      <span>Stav districtu</span>
      <strong>Špeh byl odhalen</strong>
    </div>
  `;
  elements.modal.classList.remove("hidden");
  elements.modal.removeAttribute("aria-hidden");
  openOverlay(elements.modal, { type: "modal", ariaModal: true });
  return true;
}
