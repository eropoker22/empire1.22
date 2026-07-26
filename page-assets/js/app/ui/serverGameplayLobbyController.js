import { NAV_LOGOUT_SELECTOR } from "../runtime/constants.js";
import {
  leaveMembership,
  loadLobbyOverview,
  logoutAccount
} from "../player-entry-client.js";
import { closeOverlay, openOverlay } from "./legacyOverlayCoordinator.js";
import {
  formatGameplayLobbyCooldown,
  resolveGameplayLobbyLeaveAvailability,
  resolveGameplayPageHref,
  revokeGameplaySession as revokeGameplaySessionRequest
} from "./serverGameplayLobbySession.js";

const MODAL_SELECTOR = "[data-game-lobby-modal]";
const ACTION_SELECTOR = "[data-game-lobby-action]";
const CLOSE_SELECTOR = "[data-game-lobby-close]";
const COOLDOWN_SELECTOR = "[data-game-leave-cooldown]";
const ERROR_SELECTOR = "[data-game-lobby-error]";

export function createServerGameplayLobbyController(options = {}) {
  const root = options.root || null;
  const documentRef = options.documentRef || root?.ownerDocument || globalThis.document;
  const windowRef = options.windowRef || documentRef?.defaultView || globalThis.window;
  const source = options.source || null;
  const now = options.now || (() => Date.now());
  let mounted = false;
  let destroyed = false;
  let open = false;
  let busy = false;
  let latestReadModel = null;
  let activeMembership = null;
  let membershipObservedAt = 0;
  let membershipRequestSequence = 0;
  let updateTimer = null;
  let unsubscribeSource = () => {};
  let elements = null;
  const listeners = [];
  const diagnostics = { membershipLoads: 0, revocations: 0, leaveRequests: 0 };

  const listen = (target, type, listener, listenerOptions) => {
    target?.addEventListener?.(type, listener, listenerOptions);
    listeners.push(() => target?.removeEventListener?.(type, listener, listenerOptions));
  };

  const navigate = (nextHref) => {
    if (typeof options.navigate === "function") options.navigate(nextHref);
    else if (windowRef?.location) windowRef.location.href = nextHref;
  };

  const href = (page) => resolveGameplayPageHref(latestReadModel, root, page);
  const leaveAvailability = () => resolveGameplayLobbyLeaveAvailability(
    activeMembership,
    membershipObservedAt,
    now()
  );

  const updateLeaveButton = () => {
    const availability = leaveAvailability();
    if (elements?.leaveButton) elements.leaveButton.disabled = busy || !availability.allowed;
    if (elements?.cooldown) {
      elements.cooldown.textContent = availability.allowed
        ? availability.preStart
          ? "Dostupné před startem serveru"
          : `Dostupné ještě ${formatGameplayLobbyCooldown(availability.remainingMs)}`
        : "Možnost odhlášení ze serveru vypršela";
    }
  };

  const setError = (message = "") => {
    if (elements?.error) elements.error.textContent = String(message || "");
  };

  const setBusy = (nextBusy) => {
    busy = Boolean(nextBusy);
    elements?.actionButtons?.forEach((button) => {
      button.disabled = busy;
    });
    updateLeaveButton();
  };

  const clearUpdateTimer = () => {
    if (updateTimer !== null) windowRef?.clearInterval?.(updateTimer);
    updateTimer = null;
  };

  const hide = ({ force = false } = {}) => {
    if (!open || (busy && !force)) return false;
    open = false;
    membershipRequestSequence += 1;
    clearUpdateTimer();
    elements.modal.hidden = true;
    documentRef?.body?.classList?.remove?.("is-game-lobby-modal-open");
    closeOverlay(elements.modal, { restoreFocus: !force, suppressMapInput: !force });
    return true;
  };

  const refreshMembership = async () => {
    const requestSequence = ++membershipRequestSequence;
    diagnostics.membershipLoads += 1;
    const overview = await (options.loadLobbyOverview || loadLobbyOverview)();
    if (destroyed || !open || requestSequence !== membershipRequestSequence) return false;
    activeMembership = overview?.activeBlockingMembership || null;
    membershipObservedAt = now();
    updateLeaveButton();
    return true;
  };

  const show = (event) => {
    event?.preventDefault?.();
    if (!mounted || destroyed || open) return false;
    open = true;
    setError();
    elements.modal.hidden = false;
    documentRef?.body?.classList?.add?.("is-game-lobby-modal-open");
    openOverlay(elements.modal, {
      type: "modal",
      ariaModal: true,
      alwaysOnTop: true,
      restoreFocusTo: event?.currentTarget
    });
    updateLeaveButton();
    void refreshMembership().catch(() => {
      if (!destroyed && open) {
        activeMembership = null;
        updateLeaveButton();
      }
    });
    if (updateTimer === null) {
      updateTimer = windowRef?.setInterval?.(updateLeaveButton, 1000) ?? null;
    }
    return true;
  };

  const revokeGameplaySession = async () => {
    const result = await (
      options.revokeGameplaySession
      || (() => revokeGameplaySessionRequest({
        fetchImpl: windowRef?.fetch?.bind?.(windowRef),
        endpoint: options.gameplayLogoutEndpoint
      }))
    )();
    diagnostics.revocations += 1;
    options.onGameplaySessionRevoked?.(result);
    return result;
  };

  const runAction = async (action) => {
    if (busy || destroyed) return false;
    if (action === "lobby") {
      clearUpdateTimer();
      navigate(href("lobby"));
      return true;
    }
    if (action === "leave-server" && !leaveAvailability().allowed) {
      updateLeaveButton();
      return false;
    }
    setBusy(true);
    setError();
    try {
      if (action === "leave-server") {
        if (!activeMembership?.membershipId) throw new Error("Aktivní membership se nepodařilo načíst.");
        diagnostics.leaveRequests += 1;
        await (options.leaveMembership || leaveMembership)(activeMembership.membershipId);
        await revokeGameplaySession();
        clearUpdateTimer();
        navigate(href("lobby"));
      } else if (action === "logout") {
        await revokeGameplaySession();
        await (options.logoutAccount || logoutAccount)();
        clearUpdateTimer();
        navigate(href("login"));
      } else {
        setBusy(false);
        return false;
      }
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Akci se nepodařilo dokončit.");
      setBusy(false);
      return false;
    }
  };

  const handleAction = (event) => {
    const button = event.currentTarget;
    void runAction(button?.dataset?.gameLobbyAction);
  };
  const handleEscape = (event) => {
    if (event.key === "Escape") hide();
  };
  const update = (readModel) => {
    if (readModel && typeof readModel === "object") latestReadModel = readModel;
    return 0;
  };

  const mount = () => {
    if (destroyed || mounted) return false;
    const scope = documentRef || root;
    const modal = scope?.querySelector?.(MODAL_SELECTOR);
    const openButtons = Array.from(scope?.querySelectorAll?.(NAV_LOGOUT_SELECTOR) || []);
    if (!modal || openButtons.length === 0) return false;
    documentRef?.body?.append?.(modal);
    const actionButtons = Array.from(modal.querySelectorAll?.(ACTION_SELECTOR) || []);
    elements = {
      modal,
      openButtons,
      actionButtons,
      closeNodes: Array.from(modal.querySelectorAll?.(CLOSE_SELECTOR) || []),
      leaveButton: modal.querySelector?.('[data-game-lobby-action="leave-server"]'),
      cooldown: modal.querySelector?.(COOLDOWN_SELECTOR),
      error: modal.querySelector?.(ERROR_SELECTOR)
    };
    mounted = true;
    openButtons.forEach((button) => listen(button, "click", show));
    elements.actionButtons.forEach((button) => listen(button, "click", handleAction));
    elements.closeNodes.forEach((node) => listen(node, "click", hide));
    listen(documentRef, "keydown", handleEscape);
    if (options.managePageLifecycle !== false) listen(windowRef, "pagehide", destroy, { once: true });
    if (options.manageSourceSubscription !== false && source?.subscribe) {
      unsubscribeSource = source.subscribe(update) || (() => {});
      update(source.getCurrentReadModel?.());
    }
    updateLeaveButton();
    return true;
  };

  const destroy = () => {
    if (destroyed) return false;
    destroyed = true;
    membershipRequestSequence += 1;
    hide({ force: true });
    clearUpdateTimer();
    unsubscribeSource();
    while (listeners.length > 0) listeners.pop()();
    mounted = false;
    elements = null;
    return true;
  };

  return {
    mount,
    update,
    destroy,
    open: show,
    close: hide,
    runAction,
    getDiagnostics: () => ({
      ...diagnostics,
      mounted,
      open,
      busy,
      timerActive: updateTimer !== null
    })
  };
}
