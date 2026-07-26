import { renderPoliceRaidImpactDetails } from "../police-raid-modal.js";
import {
  POLICE_ACTION_RESULT_MODAL_BADGE_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_CONTENT_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_DETAILS_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_SUMMARY_SELECTOR,
  POLICE_ACTION_RESULT_MODAL_TITLE_SELECTOR
} from "../runtime/constants.js";
import { closeOverlay, openOverlay } from "./legacyOverlayCoordinator.js";
import { renderPoliceActionResultPanel } from "./policeActionResultPanel.js";

export function createServerGameplayPoliceRaidController({
  documentRef = globalThis.document,
  elements = {}
} = {}) {
  let mounted = false;
  let initialized = false;
  const seenKeys = new Set();
  const queue = [];
  const diagnostics = { updates: 0, modalOpens: 0, queued: 0 };

  const isOpen = () => Boolean(
    elements.policeModal
    && !elements.policeModal.hidden
    && !elements.policeModal.classList?.contains?.("hidden")
  );
  const moveToTopLayer = () => {
    const body = elements.policeModal?.ownerDocument?.body;
    if (body && elements.policeModal.parentElement !== body) body.append(elements.policeModal);
  };
  const open = (presentation) => {
    if (!mounted || !presentation?.payload || isOpen()) return false;
    moveToTopLayer();
    const result = renderPoliceActionResultPanel(documentRef, presentation.payload, {
      selectors: {
        modal: POLICE_ACTION_RESULT_MODAL_SELECTOR,
        content: POLICE_ACTION_RESULT_MODAL_CONTENT_SELECTOR,
        title: POLICE_ACTION_RESULT_MODAL_TITLE_SELECTOR,
        badge: POLICE_ACTION_RESULT_MODAL_BADGE_SELECTOR,
        summary: POLICE_ACTION_RESULT_MODAL_SUMMARY_SELECTOR,
        details: POLICE_ACTION_RESULT_MODAL_DETAILS_SELECTOR
      },
      renderPoliceRaidImpactDetails
    });
    if (!result.ok) return false;
    openOverlay(result.modal, {
      type: "modal",
      ariaModal: true,
      alwaysOnTop: true,
      restoreFocusOnClose: false,
      focusTarget: elements.policeModalClose
    });
    diagnostics.modalOpens += 1;
    return true;
  };
  const openNext = () => {
    if (!mounted || isOpen()) return false;
    const presentation = queue.shift();
    return presentation ? open(presentation) : false;
  };
  const close = () => {
    if (!isOpen()) return false;
    elements.policeModal.hidden = true;
    elements.policeModal.classList?.add?.("hidden");
    closeOverlay(elements.policeModal, { restoreFocus: false });
    openNext();
    return true;
  };
  const onClose = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    close();
  };
  const onKeydown = (event) => {
    if (event.key !== "Escape" || !isOpen()) return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    close();
  };

  const mount = () => {
    if (mounted || !elements.policeModal) return false;
    elements.policeModalBackdrop?.addEventListener?.("click", onClose);
    elements.policeModalClose?.addEventListener?.("click", onClose);
    documentRef?.addEventListener?.("keydown", onKeydown);
    mounted = true;
    return true;
  };

  const update = (presentations = []) => {
    if (!mounted) return 0;
    diagnostics.updates += 1;
    const safePresentations = Array.isArray(presentations) ? presentations : [];
    if (!initialized) {
      for (const presentation of safePresentations) {
        if (presentation?.key) seenKeys.add(String(presentation.key));
      }
      initialized = true;
      return 0;
    }
    const newPresentations = safePresentations.filter((presentation) => (
      presentation?.key && !seenKeys.has(String(presentation.key))
    ));
    for (const presentation of safePresentations) {
      if (presentation?.key) seenKeys.add(String(presentation.key));
    }
    trimSeenKeys(seenKeys);
    for (const presentation of [...newPresentations].reverse()) {
      if (!open(presentation)) {
        queue.push(presentation);
        diagnostics.queued += 1;
      }
    }
    return newPresentations.length;
  };

  const destroy = () => {
    if (!mounted) return false;
    elements.policeModalBackdrop?.removeEventListener?.("click", onClose);
    elements.policeModalClose?.removeEventListener?.("click", onClose);
    documentRef?.removeEventListener?.("keydown", onKeydown);
    queue.length = 0;
    if (isOpen()) close();
    elements.policeModalDetails?.replaceChildren?.();
    seenKeys.clear();
    initialized = false;
    mounted = false;
    return true;
  };

  return {
    mount,
    update,
    destroy,
    close,
    getDiagnostics: () => ({ ...diagnostics, mounted, pending: queue.length })
  };
}

function trimSeenKeys(seenKeys, limit = 128) {
  while (seenKeys.size > limit) {
    seenKeys.delete(seenKeys.values().next().value);
  }
}
