import { closeOverlay, openOverlay } from "./legacyOverlayCoordinator.js";
import { collectServerGameplayLeaderboardElements, SERVER_LEADERBOARD_SELECTORS as SELECTORS } from "./serverGameplayLeaderboardElements.js";
import {
  createServerGameplayLeaderboardFingerprint,
  createServerGameplayLeaderboardViewModel,
  SERVER_LEADERBOARD_SUPPORTED_TABS
} from "./serverGameplayLeaderboardViewModel.js";
import { isServerLeaderboardTab, renderServerGameplayLeaderboard } from "./serverGameplayLeaderboardView.js";

export function createServerGameplayLeaderboardController(options = {}) {
  const root = options.root || null;
  const documentRef = options.documentRef || root?.ownerDocument || globalThis.document;
  const windowRef = options.windowRef || documentRef?.defaultView || globalThis.window;
  const source = options.source || null;
  const state = {
    activeTab: "overall",
    modeFilter: "current",
    searchQuery: "",
    selectedPlayerId: null
  };
  let mounted = false;
  let destroyed = false;
  let open = false;
  let detailOpen = false;
  let latestReadModel = null;
  let latestFingerprint = "";
  let renderedFingerprint = "";
  let toastTimer = null;
  let unsubscribeSource = () => {};
  let elements = null;
  const listeners = [];
  const diagnostics = { updates: 0, renders: 0, domWrites: 0 };

  const listen = (target, type, listener, listenerOptions) => {
    target?.addEventListener?.(type, listener, listenerOptions);
    listeners.push(() => target?.removeEventListener?.(type, listener, listenerOptions));
  };

  const isWithin = (node, container) => Boolean(node && container?.contains?.(node));
  const targetElement = (event) => (
    event?.target?.nodeType === 1 ? event.target : event?.target?.parentElement
  );

  const clearToast = () => {
    if (toastTimer !== null) windowRef?.clearTimeout?.(toastTimer);
    toastTimer = null;
    if (elements?.toast) elements.toast.hidden = true;
  };

  const showToast = (message) => {
    clearToast();
    if (!elements?.toast) return;
    if (elements.toastTitle) elements.toastTitle.textContent = "TERMINÁL";
    if (elements.toastMessage) elements.toastMessage.textContent = message;
    elements.toast.hidden = false;
    toastTimer = windowRef?.setTimeout?.(clearToast, 2600) ?? null;
  };

  const closePlayerDetail = () => {
    if (!detailOpen || !elements?.playerDetail) return false;
    detailOpen = false;
    elements.playerDetail.hidden = true;
    return true;
  };

  const render = () => {
    if (!mounted || !elements) return 0;
    const nextRenderedFingerprint = JSON.stringify([latestFingerprint, state]);
    if (nextRenderedFingerprint === renderedFingerprint) return 0;
    const model = createServerGameplayLeaderboardViewModel(latestReadModel, state);
    if (
      state.selectedPlayerId
      && !model.allEntries.some((entry) => entry.playerId === state.selectedPlayerId)
    ) {
      state.selectedPlayerId = null;
      closePlayerDetail();
    }
    const writes = renderServerGameplayLeaderboard(elements, model, state);
    renderedFingerprint = JSON.stringify([latestFingerprint, state]);
    diagnostics.renders += 1;
    diagnostics.domWrites += writes;
    return writes;
  };

  const close = () => {
    if (!open || !elements?.popup) return false;
    closePlayerDetail();
    clearToast();
    open = false;
    elements.popup.hidden = true;
    closeOverlay(elements.popup, { restoreFocus: true });
    return true;
  };

  const show = (event) => {
    event?.preventDefault?.();
    if (!mounted || destroyed || open) return false;
    open = true;
    render();
    openOverlay(elements.popup, {
      type: "modal",
      ariaModal: true,
      focusTarget: elements.card,
      restoreFocusTo: event?.currentTarget
    });
    return true;
  };

  const openPlayerDetail = (playerId) => {
    const normalizedPlayerId = String(playerId || "");
    if (!normalizedPlayerId || !elements?.playerDetail) return false;
    state.selectedPlayerId = normalizedPlayerId;
    render();
    detailOpen = true;
    elements.playerDetail.hidden = false;
    elements.playerDetailCard?.focus?.({ preventScroll: true });
    return true;
  };

  const openBounty = (playerId) => {
    const normalizedPlayerId = String(playerId || "");
    if (!normalizedPlayerId) return false;
    close();
    const CustomEventCtor = windowRef?.CustomEvent || globalThis.CustomEvent;
    documentRef?.dispatchEvent?.(new CustomEventCtor("empire:open-bounty-modal", {
      detail: { source: "leaderboard", targetPlayerId: normalizedPlayerId }
    }));
    return true;
  };

  const handleAction = (action, actionElement) => {
    if (action === "view") return openPlayerDetail(actionElement?.dataset?.playerId);
    if (action === "bounty") return openBounty(actionElement?.dataset?.playerId);
    showToast("Tato serverová funkce zatím není dostupná.");
    return false;
  };

  const handlePopupClick = (event) => {
    const target = targetElement(event);
    const detailClose = target?.closest?.(SELECTORS.playerDetailClose);
    if (isWithin(detailClose, elements.playerDetail)) {
      closePlayerDetail();
      return;
    }
    const popupClose = target?.closest?.(SELECTORS.close);
    if (isWithin(popupClose, elements.popup)) {
      close();
      return;
    }
    const tab = target?.closest?.(SELECTORS.tab);
    if (isWithin(tab, elements.popup)) {
      const nextTab = String(tab.dataset.leaderboardTab || "");
      if (
        !tab.disabled
        && isServerLeaderboardTab(nextTab)
        && SERVER_LEADERBOARD_SUPPORTED_TABS.has(nextTab)
        && state.activeTab !== nextTab
      ) {
        state.activeTab = nextTab;
        render();
      }
      return;
    }
    const filter = target?.closest?.(SELECTORS.filter);
    if (isWithin(filter, elements.popup)) {
      state.modeFilter = filter.dataset.leaderboardFilter || "current";
      render();
      return;
    }
    const action = target?.closest?.("[data-leaderboard-action]");
    if (isWithin(action, elements.popup)) {
      event.preventDefault();
      event.stopPropagation();
      handleAction(action.dataset.leaderboardAction, action);
      return;
    }
    const playerRow = target?.closest?.("[data-leaderboard-player-id]");
    if (isWithin(playerRow, elements.list)) {
      state.selectedPlayerId = playerRow.dataset.leaderboardPlayerId || null;
      render();
    }
  };

  const handlePopupInput = (event) => {
    if (!event.target?.matches?.(SELECTORS.search)) return;
    state.searchQuery = String(event.target.value || "").trim();
    render();
  };

  const handleKeydown = (event) => {
    if (event.key === "Escape" && detailOpen) {
      closePlayerDetail();
      return;
    }
    if (event.key === "Escape" && open) {
      close();
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = targetElement(event)?.closest?.("[data-leaderboard-player-id]");
    if (!isWithin(row, elements?.list)) return;
    event.preventDefault();
    state.selectedPlayerId = row.dataset.leaderboardPlayerId || null;
    render();
  };

  const update = (readModel) => {
    if (!mounted || destroyed) return 0;
    diagnostics.updates += 1;
    const fingerprint = createServerGameplayLeaderboardFingerprint(readModel);
    if (fingerprint === latestFingerprint) return 0;
    latestReadModel = readModel || null;
    latestFingerprint = fingerprint;
    return open ? render() : 0;
  };

  const mount = () => {
    if (mounted || destroyed) return false;
    const scope = documentRef || root;
    elements = collectServerGameplayLeaderboardElements(scope);
    if (!elements.popup || elements.openButtons.length === 0 || !elements.list) return false;
    mounted = true;
    elements.openButtons.forEach((button) => listen(button, "click", show));
    listen(elements.popup, "click", handlePopupClick);
    listen(elements.popup, "input", handlePopupInput);
    listen(documentRef, "keydown", handleKeydown);
    if (options.managePageLifecycle !== false) listen(windowRef, "pagehide", destroy, { once: true });
    if (options.manageSourceSubscription !== false && source?.subscribe) {
      unsubscribeSource = source.subscribe(update) || (() => {});
      update(source.getCurrentReadModel?.());
    }
    return true;
  };

  const destroy = () => {
    if (destroyed) return false;
    destroyed = true;
    if (open) close();
    clearToast();
    unsubscribeSource();
    while (listeners.length > 0) listeners.pop()();
    elements = null;
    latestReadModel = null;
    latestFingerprint = "";
    renderedFingerprint = "";
    mounted = false;
    return true;
  };

  return {
    mount,
    update,
    destroy,
    open: show,
    close,
    getDiagnostics: () => ({
      ...diagnostics,
      mounted,
      open,
      detailOpen,
      timerActive: toastTimer !== null
    })
  };
}
