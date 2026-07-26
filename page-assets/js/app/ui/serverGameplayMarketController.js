import {
  MARKET_COPY_SELECTOR,
  MARKET_DASHBOARD_SELECTOR,
  MARKET_FEEDBACK_SELECTOR,
  MARKET_LIST_SELECTOR,
  MARKET_POPUP_CLOSE_SELECTOR,
  MARKET_POPUP_OPEN_SELECTOR,
  MARKET_POPUP_SELECTOR,
  MARKET_TAB_SELECTOR
} from "../runtime/constants.js";
import {
  createServerPlayerMarketCallbacks,
  createServerPlayerMarketPanelPayload
} from "../runtime/marketServerPlayerViewModel.js";
import {
  closeMarketPanel,
  formatMarketPrice,
  openMarketPanel,
  renderBlackMarketPanel,
  renderMarketDashboard,
  renderMarketPanel,
  renderPlayerMarketPanel,
  setMarketFeedback,
  syncMarketTabs
} from "./marketPanel.js";
import { createServerMarketCatalogCallbacks } from "./serverGameplayMarketCallbacks.js";
import {
  createServerMarketCommand,
  createServerMarketFingerprint,
  createServerMarketTabView
} from "./serverGameplayMarketViewModel.js";
export function createServerGameplayMarketController({
  root,
  source,
  onReadModel,
  documentRef = root?.ownerDocument || globalThis.document,
  windowRef = documentRef?.defaultView || globalThis.window
} = {}) {
  let mounted = false;
  let eventScope = null;
  let elements = {};
  let closeElements = [];
  let tabs = [];
  let activeTab = "market";
  let latestReadModel = null;
  let latestFingerprint = "";
  let renderedFingerprint = "";
  let commandPending = false;
  const diagnostics = { updates: 0, renders: 0, commands: 0, acceptedCommands: 0 };
  const isOpen = () => Boolean(elements.popup && !elements.popup.hidden);
  const feedback = (tone, message) => setMarketFeedback(elements.feedback, tone, message);
  const acceptResponseReadModel = (readModel) => {
    if (!readModel) return false;
    if (typeof onReadModel === "function") onReadModel(readModel);
    else update(readModel);
    return true;
  };
  const submitMarketAction = async (action) => {
    const command = createServerMarketCommand(action);
    if (!command || typeof source?.submitCommand !== "function") {
      return { accepted: false, errors: [{ message: "Serverový market teď není dostupný." }] };
    }
    if (commandPending) {
      return { accepted: false, errors: [{ message: "Předchozí market operace se ještě potvrzuje." }] };
    }
    commandPending = true;
    diagnostics.commands += 1;
    try {
      const response = await source.submitCommand(command);
      if (response?.readModel) acceptResponseReadModel(response.readModel);
      if (response?.accepted) diagnostics.acceptedCommands += 1;
      return response || { accepted: false, errors: [{ message: "Server nevrátil výsledek obchodu." }] };
    } catch (_error) {
      return { accepted: false, errors: [{ message: "Spojení se serverovým marketem selhalo." }] };
    } finally {
      commandPending = false;
    }
  };
  const render = () => {
    if (!latestReadModel || !elements.popup || !elements.list) return 0;
    const nextRenderedFingerprint = `${activeTab}:${latestFingerprint}`;
    if (nextRenderedFingerprint === renderedFingerprint) return 0;
    const view = createServerMarketTabView(latestReadModel, activeTab, formatMarketPrice);
    let writes = 0;
    writes += setDataset(elements.popup, "marketMode", activeTab);
    writes += setDataset(elements.popup, "marketSource", "server");
    writes += setDataset(elements.popup, "marketStatus", "ready");
    writes += setDataset(elements.popup, "marketPreview", "false");
    writes += setDataset(elements.popup, "marketAuthoritative", "true");
    writes += setText(elements.title, view.title);
    writes += setDataset(elements.title, "mobileTitle", view.mobileTitle);
    writes += setText(elements.copy, view.copy);
    if (elements.dashboard) {
      renderMarketDashboard(elements.dashboard, view.dashboard, { document: documentRef });
      writes += 1;
    }
    if (activeTab === "player-market") {
      renderPlayerMarketPanel(
        elements.list,
        createServerPlayerMarketPanelPayload({
          serverMarket: latestReadModel.market,
          playerView: latestReadModel.player,
          formatPrice: formatMarketPrice
        }),
        createServerPlayerMarketCallbacks({
          submitServerMarketCommand: submitMarketAction,
          setMarketFeedback: feedback,
          refreshMarketTab: render
        }),
        { document: documentRef }
      );
    } else {
      const callbacks = createServerMarketCatalogCallbacks({
        activeTab,
        feedback,
        submitMarketAction,
        windowRef
      });
      const renderCatalog = activeTab === "black-market" ? renderBlackMarketPanel : renderMarketPanel;
      renderCatalog(elements.list, view.catalog, callbacks, { document: documentRef });
    }
    syncMarketTabs(tabs, activeTab);
    renderedFingerprint = nextRenderedFingerprint;
    diagnostics.renders += 1;
    return writes + 1;
  };
  const open = () => {
    if (!elements.popup) return false;
    feedback("", "");
    render();
    return openMarketPanel(elements.popup);
  };
  const close = () => closeMarketPanel(elements.popup);
  const onOpenClick = () => open();
  const onCloseClick = () => close();
  const onTabClick = (event) => {
    const nextTab = String(event.currentTarget?.dataset?.marketTab || "");
    if (!nextTab || nextTab === activeTab) return;
    activeTab = nextTab;
    feedback("", "");
    render();
  };
  const onKeydown = (event) => {
    if (event.key === "Escape" && isOpen()) close();
  };
  const mount = () => {
    if (mounted) return false;
    eventScope = documentRef || root;
    elements = collectElements(eventScope);
    closeElements = Array.from(elements.popup?.querySelectorAll?.(MARKET_POPUP_CLOSE_SELECTOR) || []);
    tabs = Array.from(elements.popup?.querySelectorAll?.(MARKET_TAB_SELECTOR) || []);
    elements.openButton?.addEventListener?.("click", onOpenClick);
    for (const element of closeElements) element.addEventListener("click", onCloseClick);
    for (const tab of tabs) tab.addEventListener("click", onTabClick);
    eventScope?.addEventListener?.("keydown", onKeydown);
    mounted = true;
    return true;
  };

  function update(readModel) {
    if (!mounted) return 0;
    diagnostics.updates += 1;
    const nextFingerprint = createServerMarketFingerprint(readModel);
    if (nextFingerprint === latestFingerprint) return 0;
    latestReadModel = readModel || null;
    latestFingerprint = nextFingerprint;
    return isOpen() ? render() : 0;
  }

  const destroy = () => {
    if (!mounted) return false;
    elements.openButton?.removeEventListener?.("click", onOpenClick);
    for (const element of closeElements) element.removeEventListener("click", onCloseClick);
    for (const tab of tabs) tab.removeEventListener("click", onTabClick);
    eventScope?.removeEventListener?.("keydown", onKeydown);
    if (isOpen()) close();
    elements = {};
    closeElements = [];
    tabs = [];
    eventScope = null;
    latestReadModel = null;
    latestFingerprint = "";
    renderedFingerprint = "";
    commandPending = false;
    mounted = false;
    return true;
  };

  return {
    mount,
    update,
    destroy,
    open,
    close,
    getDiagnostics: () => ({ ...diagnostics, mounted, commandPending, activeTab })
  };
}

function collectElements(scope) {
  const popup = scope?.querySelector?.(MARKET_POPUP_SELECTOR) || null;
  return {
    openButton: scope?.querySelector?.(MARKET_POPUP_OPEN_SELECTOR) || null,
    popup,
    title: popup?.querySelector?.("[data-market-title]") || null,
    copy: popup?.querySelector?.(MARKET_COPY_SELECTOR) || null,
    list: popup?.querySelector?.(MARKET_LIST_SELECTOR) || null,
    dashboard: popup?.querySelector?.(MARKET_DASHBOARD_SELECTOR) || null,
    feedback: popup?.querySelector?.(MARKET_FEEDBACK_SELECTOR) || null
  };
}

function setText(element, value) {
  if (!element || element.textContent === value) return 0;
  element.textContent = value;
  return 1;
}

function setDataset(element, key, value) {
  if (!element?.dataset || element.dataset[key] === value) return 0;
  element.dataset[key] = value;
  return 1;
}
