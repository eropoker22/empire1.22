import {
  GANG_HEAT_SELECTOR,
  GANG_STAR_SELECTOR,
  GANG_STARS_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_BACKDROP_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_BADGE_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_CLOSE_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_CONTENT_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_DETAILS_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_SUMMARY_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_TITLE_SELECTOR,
  WANTED_POPUP_CLEAN_ACTION_SELECTOR,
  WANTED_POPUP_CLEAR_LOG_SELECTOR,
  WANTED_POPUP_CLOSE_SELECTOR,
  WANTED_POPUP_DESCRIPTION_SELECTOR,
  WANTED_POPUP_DIRTY_ACTION_SELECTOR,
  WANTED_POPUP_FALL_LIST_SELECTOR,
  WANTED_POPUP_FEEDBACK_SELECTOR,
  WANTED_POPUP_HEAT_SELECTOR,
  WANTED_POPUP_INFLUENCE_ACTION_SELECTOR,
  WANTED_POPUP_LEVEL_SELECTOR,
  WANTED_POPUP_LEVELS_SELECTOR,
  WANTED_POPUP_PROTECTION_SELECTOR,
  WANTED_POPUP_RISE_LIST_SELECTOR,
  WANTED_POPUP_SELECTOR,
  WANTED_POPUP_TIER_SELECTOR
} from "../runtime/constants.js";

export function collectServerWantedPoliceElements(scope) {
  const query = (selector) => scope?.querySelector?.(selector) || null;
  const popup = query(WANTED_POPUP_SELECTOR);
  const policeModal = query(POLICE_ACTION_RESULT_MODAL_SELECTOR);
  return {
    heatButton: query(GANG_HEAT_SELECTOR),
    starContainer: query(GANG_STARS_SELECTOR),
    stars: Array.from(scope?.querySelectorAll?.(GANG_STAR_SELECTOR) || []),
    popup,
    popupCard: popup?.querySelector?.(".wanted-popup-card") || null,
    popupCloseElements: Array.from(popup?.querySelectorAll?.(WANTED_POPUP_CLOSE_SELECTOR) || []),
    popupHeat: createTextMirror(popup, WANTED_POPUP_HEAT_SELECTOR),
    popupLevel: createTextMirror(popup, WANTED_POPUP_LEVEL_SELECTOR),
    popupTier: createTextMirror(popup, WANTED_POPUP_TIER_SELECTOR),
    popupDescription: createTextMirror(popup, WANTED_POPUP_DESCRIPTION_SELECTOR),
    popupProtection: createTextMirror(popup, WANTED_POPUP_PROTECTION_SELECTOR),
    popupAuditRisk: createTextMirror(popup, "[data-wanted-popup-audit-risk]"),
    popupLevels: popup?.querySelector?.(WANTED_POPUP_LEVELS_SELECTOR) || null,
    popupRiseList: popup?.querySelector?.(WANTED_POPUP_RISE_LIST_SELECTOR) || null,
    popupFallList: popup?.querySelector?.(WANTED_POPUP_FALL_LIST_SELECTOR) || null,
    popupFeedback: popup?.querySelector?.(WANTED_POPUP_FEEDBACK_SELECTOR) || null,
    dirtyActionButton: popup?.querySelector?.(WANTED_POPUP_DIRTY_ACTION_SELECTOR) || null,
    cleanActionButton: popup?.querySelector?.(WANTED_POPUP_CLEAN_ACTION_SELECTOR) || null,
    influenceActionButton: popup?.querySelector?.(WANTED_POPUP_INFLUENCE_ACTION_SELECTOR) || null,
    clearLogButton: popup?.querySelector?.(WANTED_POPUP_CLEAR_LOG_SELECTOR) || null,
    policeWindow: popup?.querySelector?.("[data-wanted-popup-police-window]") || null,
    policeFeed: popup?.querySelector?.("[data-wanted-popup-police-feed]") || null,
    policeWindowClose: popup?.querySelector?.("[data-wanted-popup-police-close]") || null,
    policeModal,
    policeModalBackdrop: query(POLICE_ACTION_RESULT_MODAL_BACKDROP_SELECTOR),
    policeModalClose: query(POLICE_ACTION_RESULT_MODAL_CLOSE_SELECTOR),
    policeModalContent: query(POLICE_ACTION_RESULT_MODAL_CONTENT_SELECTOR),
    policeModalTitle: query(POLICE_ACTION_RESULT_MODAL_TITLE_SELECTOR),
    policeModalBadge: query(POLICE_ACTION_RESULT_MODAL_BADGE_SELECTOR),
    policeModalSummary: query(POLICE_ACTION_RESULT_MODAL_SUMMARY_SELECTOR),
    policeModalDetails: query(POLICE_ACTION_RESULT_MODAL_DETAILS_SELECTOR)
  };
}

function createTextMirror(scope, selector) {
  const elements = Array.from(scope?.querySelectorAll?.(selector) || []);
  if (elements.length <= 1) return elements[0] || null;
  return {
    get textContent() {
      return elements[0]?.textContent || "";
    },
    set textContent(value) {
      for (const element of elements) element.textContent = value;
    },
    classList: elements[0]?.classList,
    setAttribute: (...args) => elements.forEach((element) => element.setAttribute?.(...args)),
    replaceChildren: (...children) => elements[0]?.replaceChildren?.(...children)
  };
}
