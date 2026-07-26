import { closeOverlay, openOverlay } from "./legacyOverlayCoordinator.js";
import { renderPoliceFeedPanel } from "./policeFeedPanel.js";
import { createServerGameplayPoliceRaidController } from "./serverGameplayPoliceRaidController.js";
import { collectServerWantedPoliceElements } from "./serverGameplayWantedPoliceElements.js";
import { createServerWantedPoliceView } from "./serverGameplayWantedPoliceViewModel.js";
import {
  renderHeatBadge,
  renderWantedFeedback,
  renderWantedPanel
} from "./wantedPanel.js";

export function createServerGameplayWantedPoliceController({
  root,
  source,
  onReadModel,
  documentRef = root?.ownerDocument || globalThis.document
} = {}) {
  let mounted = false;
  let elements = {};
  let raidController = null;
  let latestReadModel = null;
  let latestView = null;
  let latestFingerprint = "";
  let renderedPanelFingerprint = "";
  let renderedHeatFingerprint = "";
  let commandPending = false;
  let unbindCountdown = () => {};
  const diagnostics = { updates: 0, badgeRenders: 0, panelRenders: 0, commands: 0 };

  const isOpen = () => Boolean(elements.popup && !elements.popup.hidden);
  const moveToTopLayer = () => {
    const body = elements.popup?.ownerDocument?.body;
    if (body && elements.popup.parentElement !== body) body.append(elements.popup);
  };
  const renderFeedback = (tone, message) => (
    renderWantedFeedback(elements.popupFeedback, tone, message)
  );
  const renderHeat = () => {
    if (!latestView) return 0;
    const fingerprint = JSON.stringify(latestView.heatBadge);
    if (fingerprint === renderedHeatFingerprint) return 0;
    renderHeatBadge(latestView.heatBadge, {
      heatButton: elements.heatButton,
      starContainer: elements.starContainer,
      stars: elements.stars
    });
    renderedHeatFingerprint = fingerprint;
    diagnostics.badgeRenders += 1;
    return 1;
  };
  const renderPanel = () => {
    if (!latestView || latestFingerprint === renderedPanelFingerprint) return 0;
    renderWantedPanel(latestView.wanted, {
      mounts: {
        popupHeat: elements.popupHeat,
        popupLevel: elements.popupLevel,
        popupTier: elements.popupTier,
        popupDescription: elements.popupDescription,
        popupProtection: elements.popupProtection,
        popupAuditRisk: elements.popupAuditRisk,
        popupLevels: elements.popupLevels,
        popupRiseList: elements.popupRiseList,
        popupFallList: elements.popupFallList,
        dirtyActionButton: elements.dirtyActionButton,
        cleanActionButton: elements.cleanActionButton,
        influenceActionButton: elements.influenceActionButton
      }
    });
    unbindCountdown();
    unbindCountdown = () => {};
    renderPoliceFeedPanel(elements.policeFeed, latestView.policeFeed, {
      onAcknowledge: acknowledgePendingRaid,
      onCountdownBound: (cleanup) => {
        unbindCountdown = typeof cleanup === "function" ? cleanup : () => {};
      }
    });
    renderedPanelFingerprint = latestFingerprint;
    diagnostics.panelRenders += 1;
    return 1;
  };
  const open = () => {
    if (!mounted || !elements.popup || !latestView) return false;
    moveToTopLayer();
    renderFeedback("", "");
    renderPanel();
    if (elements.policeWindow) elements.policeWindow.hidden = false;
    return openOverlay(elements.popup, {
      type: "modal",
      ariaModal: true,
      alwaysOnTop: true,
      restoreFocusOnClose: false,
      focusTarget: elements.popupCard
    });
  };
  const close = () => {
    if (!isOpen()) return false;
    unbindCountdown();
    unbindCountdown = () => {};
    renderedPanelFingerprint = "";
    elements.popup.hidden = true;
    elements.popup.classList?.add?.("hidden");
    if (elements.policeWindow) elements.policeWindow.hidden = true;
    return closeOverlay(elements.popup, { restoreFocus: false });
  };
  const onOpen = () => open();
  const onClose = () => close();
  const onPoliceWindowClose = () => {
    if (elements.policeWindow) elements.policeWindow.hidden = true;
    unbindCountdown();
    unbindCountdown = () => {};
    renderedPanelFingerprint = "";
  };
  const onKeydown = (event) => {
    if (event.key === "Escape" && isOpen()) close();
  };

  async function acknowledgePendingRaid(raidId) {
    const normalizedRaidId = String(raidId || "").trim();
    if (!normalizedRaidId || typeof source?.submitCommand !== "function") {
      renderFeedback("danger", "Potvrzení razie teď není na serveru dostupné.");
      return false;
    }
    if (commandPending) {
      renderFeedback("warning", "Předchozí potvrzení razie se ještě zpracovává.");
      return false;
    }
    commandPending = true;
    diagnostics.commands += 1;
    try {
      const response = await source.submitCommand({
        type: "acknowledge-pending-raid",
        payload: { raidId: normalizedRaidId },
        focusDistrictId: latestReadModel?.district?.districtId
          || latestView?.policeFeed?.pendingRaid?.targetDistrictId
          || latestReadModel?.player?.homeDistrictId
      });
      if (response?.readModel) {
        if (typeof onReadModel === "function") onReadModel(response.readModel);
        else update(response.readModel);
      }
      renderFeedback(
        response?.accepted ? "success" : "danger",
        response?.accepted
          ? "Policejní varování bylo potvrzeno serverem."
          : String(response?.errors?.[0]?.message || "Server potvrzení razie odmítl.")
      );
      return Boolean(response?.accepted);
    } catch {
      renderFeedback("danger", "Spojení se serverem při potvrzení razie selhalo.");
      return false;
    } finally {
      commandPending = false;
    }
  }

  const mount = () => {
    if (mounted) return false;
    elements = collectServerWantedPoliceElements(documentRef || root);
    if (!elements.heatButton || !elements.popup) return false;
    raidController = createServerGameplayPoliceRaidController({ documentRef, elements });
    raidController.mount();
    elements.heatButton.addEventListener("click", onOpen);
    for (const closeElement of elements.popupCloseElements) closeElement.addEventListener("click", onClose);
    elements.policeWindowClose?.addEventListener?.("click", onPoliceWindowClose);
    documentRef?.addEventListener?.("keydown", onKeydown);
    disableUnsupportedActions(elements, "Server-authoritative", latestView?.actionUnavailableReason);
    mounted = true;
    return true;
  };

  function update(readModel) {
    if (!mounted) return 0;
    diagnostics.updates += 1;
    const nextView = createServerWantedPoliceView(readModel);
    if (nextView) raidController?.update(nextView.raidPresentations);
    latestReadModel = readModel || null;
    if (!nextView) {
      const changed = latestView !== null || elements.heatButton?.textContent !== "—";
      latestView = null;
      latestFingerprint = "";
      renderedHeatFingerprint = "";
      renderedPanelFingerprint = "";
      if (elements.heatButton) {
        elements.heatButton.textContent = "—";
        elements.heatButton.title = "Policejní stav zatím není v serverovém read modelu.";
      }
      if (isOpen()) close();
      return Number(changed);
    }
    if (nextView.fingerprint === latestFingerprint) return 0;
    latestView = nextView;
    latestFingerprint = nextView.fingerprint;
    disableUnsupportedActions(elements, "Server-authoritative", nextView.actionUnavailableReason);
    return renderHeat() + (isOpen() ? renderPanel() : 0);
  }

  const destroy = () => {
    if (!mounted) return false;
    elements.heatButton?.removeEventListener?.("click", onOpen);
    for (const closeElement of elements.popupCloseElements || []) closeElement.removeEventListener("click", onClose);
    elements.policeWindowClose?.removeEventListener?.("click", onPoliceWindowClose);
    documentRef?.removeEventListener?.("keydown", onKeydown);
    unbindCountdown();
    if (isOpen()) close();
    raidController?.destroy();
    raidController = null;
    latestReadModel = null;
    latestView = null;
    latestFingerprint = "";
    renderedPanelFingerprint = "";
    renderedHeatFingerprint = "";
    commandPending = false;
    elements = {};
    mounted = false;
    return true;
  };

  return {
    mount,
    update,
    destroy,
    open,
    close,
    getDiagnostics: () => ({
      ...diagnostics,
      mounted,
      commandPending,
      raid: raidController?.getDiagnostics() || null
    })
  };
}

function disableUnsupportedActions(elements, mode, reason = "") {
  const message = reason || `Tato akce není v režimu ${mode} dostupná.`;
  for (const button of [
    elements.dirtyActionButton,
    elements.cleanActionButton,
    elements.influenceActionButton,
    elements.clearLogButton
  ]) {
    if (!button) continue;
    button.disabled = true;
    button.setAttribute?.("aria-disabled", "true");
    button.title = message;
  }
}
