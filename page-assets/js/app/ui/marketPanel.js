export function formatMarketPrice(value) {
  return `${Math.max(0, Math.floor(Number(value) || 0)).toLocaleString("cs-CZ")}$`;
}

export function getMarketMoneyLabel(moneyKey) {
  return moneyKey === "dirtyMoney" ? "dirty cash" : "clean cash";
}

export function getListingCurrencyLabel(currency) {
  return currency === "dirtyMoney" ? "dirty cash" : "clean cash";
}

function getOwnerDocument(element, options = {}) {
  if (options.document && typeof options.document.createElement === "function") {
    return options.document;
  }

  if (element?.ownerDocument && typeof element.ownerDocument.createElement === "function") {
    return element.ownerDocument;
  }

  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    return document;
  }

  return null;
}

function createElement(ownerDocument, tagName, className = "") {
  const element = ownerDocument.createElement(tagName);
  if (className) {
    element.className = className;
  }
  return element;
}

function replaceChildrenSafe(element, ...children) {
  if (!element) {
    return;
  }

  if (typeof element.replaceChildren === "function") {
    element.replaceChildren(...children);
    return;
  }

  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  for (const child of children) {
    element.appendChild(child);
  }
}

function appendChildren(element, ...children) {
  if (!element) {
    return;
  }

  if (typeof element.append === "function") {
    element.append(...children);
    return;
  }

  for (const child of children) {
    element.appendChild(child);
  }
}

function setDatasetValue(element, key, value) {
  if (element?.dataset) {
    element.dataset[key] = String(value);
  }
}

export function setMarketFeedback(feedbackElement, tone, message) {
  if (!feedbackElement) {
    return false;
  }

  const safeMessage = String(message || "").trim();
  feedbackElement.hidden = !safeMessage;
  setDatasetValue(feedbackElement, "marketFeedbackTone", tone || "info");
  feedbackElement.textContent = safeMessage;
  return true;
}

function createDashboardChip(ownerDocument, label, value, tone = "neutral") {
  const chip = createElement(ownerDocument, "div", "market-popup-dashboard__chip");
  setDatasetValue(chip, "marketDashboardTone", tone);

  const chipLabel = ownerDocument.createElement("span");
  chipLabel.textContent = label;

  const chipValue = ownerDocument.createElement("strong");
  chipValue.textContent = value;

  appendChildren(chip, chipLabel, chipValue);
  return chip;
}

function formatMarketTransactionLabel(transaction = {}) {
  return `${transaction.type === "buy" ? "Nákup" : "Prodej"} ${transaction.amount}x ${transaction.itemName} · ${formatMarketPrice(transaction.total)}`;
}

export function renderMarketDashboard(dashboardElement, viewModel = {}, options = {}) {
  if (!dashboardElement) {
    return false;
  }

  const ownerDocument = getOwnerDocument(dashboardElement, options);
  if (!ownerDocument) {
    return false;
  }

  const recentTransactions = Array.isArray(viewModel.recentTransactions)
    ? viewModel.recentTransactions
    : [];
  const allRecentTransactions = Array.isArray(viewModel.allRecentTransactions)
    ? viewModel.allRecentTransactions
    : recentTransactions;
  const recentList = createElement(ownerDocument, "div", "market-popup-dashboard__recent");
  if (allRecentTransactions.length > 0) {
    recentList.tabIndex = 0;
    recentList.title = "Zobrazit všechny poslední obchody";
    recentList.setAttribute("role", "button");
    recentList.setAttribute("aria-label", "Zobrazit všechny poslední obchody");
  }
  const recentHeader = createElement(ownerDocument, "div", "market-popup-dashboard__recent-header");
  const recentTitle = createElement(ownerDocument, "span", "market-popup-dashboard__recent-title");
  recentTitle.textContent = "Poslední obchody";
  appendChildren(recentHeader, recentTitle);

  if (typeof options.onClearRecentTransactions === "function") {
    const clearButton = createElement(ownerDocument, "button", "market-popup-dashboard__recent-clear");
    clearButton.type = "button";
    clearButton.title = "Vymazat poslední obchody";
    clearButton.setAttribute("aria-label", "Vymazat poslední obchody");
    const clearIcon = createElement(ownerDocument, "span", "market-popup-dashboard__recent-clear-icon");
    clearIcon.setAttribute("aria-hidden", "true");
    clearIcon.textContent = "🗑";
    appendChildren(clearButton, clearIcon);
    clearButton.addEventListener("click", (event) => {
      event?.stopPropagation?.();
      options.onClearRecentTransactions();
    });
    appendChildren(recentHeader, clearButton);
  }

  appendChildren(recentList, recentHeader);

  if (recentTransactions.length <= 0) {
    const empty = createElement(ownerDocument, "span", "market-popup-dashboard__recent-empty");
    empty.textContent = "Zatím žádný trade.";
    appendChildren(recentList, empty);
  } else {
    for (const transaction of recentTransactions) {
      const entry = createElement(ownerDocument, "span", "market-popup-dashboard__recent-entry");
      setDatasetValue(entry, "marketTradeType", transaction.type);
      entry.textContent = formatMarketTransactionLabel(transaction);
      appendChildren(recentList, entry);
    }
  }

  if (allRecentTransactions.length > 0) {
    const detailPanel = createElement(ownerDocument, "div", "market-popup-dashboard__recent-detail");
    detailPanel.hidden = true;
    detailPanel.setAttribute("role", "dialog");
    detailPanel.setAttribute("aria-label", "Všechny poslední obchody");

    const detailHeader = createElement(ownerDocument, "div", "market-popup-dashboard__recent-detail-header");
    const detailTitle = createElement(ownerDocument, "strong", "market-popup-dashboard__recent-detail-title");
    detailTitle.textContent = "Všechny poslední obchody";
    const detailClose = createElement(ownerDocument, "button", "market-popup-dashboard__recent-detail-close");
    detailClose.type = "button";
    detailClose.title = "Zavřít seznam obchodů";
    detailClose.setAttribute("aria-label", "Zavřít seznam obchodů");
    detailClose.textContent = "×";
    appendChildren(detailHeader, detailTitle, detailClose);

    const detailBody = createElement(ownerDocument, "div", "market-popup-dashboard__recent-detail-body");
    for (const transaction of allRecentTransactions) {
      const detailEntry = createElement(ownerDocument, "span", "market-popup-dashboard__recent-detail-entry");
      setDatasetValue(detailEntry, "marketTradeType", transaction.type);
      detailEntry.textContent = formatMarketTransactionLabel(transaction);
      appendChildren(detailBody, detailEntry);
    }

    const openDetailPanel = () => {
      detailPanel.hidden = false;
    };
    const closeDetailPanel = (event) => {
      event?.stopPropagation?.();
      detailPanel.hidden = true;
    };

    recentList.addEventListener("click", openDetailPanel);
    recentList.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault?.();
        openDetailPanel();
      }
    });
    detailClose.addEventListener("click", closeDetailPanel);

    appendChildren(detailPanel, detailHeader, detailBody);
    appendChildren(recentList, detailPanel);
  }

  const chips = Array.isArray(viewModel.chips) ? viewModel.chips : [];
  replaceChildrenSafe(
    dashboardElement,
    ...chips.map((chip) => createDashboardChip(ownerDocument, chip.label, chip.value, chip.tone)),
    recentList
  );
  return true;
}

export function syncMarketTabs(tabs = [], activeTab = "market") {
  for (const tab of tabs) {
    tab?.classList?.toggle?.("is-active", tab.dataset?.marketTab === activeTab);
  }
}

export function renderMarketEmptyState(container, message = "Market je prázdný.", options = {}) {
  if (!container) {
    return false;
  }

  const ownerDocument = getOwnerDocument(container, options);
  if (!ownerDocument) {
    return false;
  }

  const empty = createElement(ownerDocument, "p", "market-player-empty");
  empty.textContent = message;
  replaceChildrenSafe(container, empty);
  return true;
}

export function renderPlayerMarketPanel(listElement, viewModel = {}, callbacks = {}, options = {}) {
  if (!listElement) {
    return false;
  }

  const ownerDocument = getOwnerDocument(listElement, options);
  if (!ownerDocument) {
    return false;
  }

  const listings = Array.isArray(viewModel.listings) ? viewModel.listings : [];
  const sellableItems = Array.isArray(viewModel.sellableItems) ? viewModel.sellableItems : [];
  const ownListingCount = Math.max(0, Number(viewModel.ownListingCount || 0) || 0);
  const ownListingLimit = Math.max(0, Number(viewModel.ownListingLimit || 0) || 0);
  const shell = createElement(ownerDocument, "div", "market-player");

  const sellPanel = createElement(ownerDocument, "section", "market-player-sell-panel");
  const sellHeader = createElement(ownerDocument, "div", "market-player-sell-panel__header");
  const sellTitle = ownerDocument.createElement("strong");
  sellTitle.textContent = "Vystavit nabídku";
  const sellMeta = ownerDocument.createElement("span");
  sellMeta.textContent = `${ownListingCount}/${ownListingLimit} aktivní nabídky`;
  appendChildren(sellHeader, sellTitle, sellMeta);

  const form = createElement(ownerDocument, "div", "market-player-form");
  const itemField = createElement(ownerDocument, "label", "market-player-field");
  const itemFieldLabel = ownerDocument.createElement("span");
  itemFieldLabel.textContent = "Položka";
  const itemSelect = createElement(ownerDocument, "select", "market-player-input");
  itemSelect.disabled = sellableItems.length <= 0;

  if (sellableItems.length <= 0) {
    const option = ownerDocument.createElement("option");
    option.textContent = "Nemáš nic k prodeji";
    option.value = "";
    itemSelect.append(option);
  } else {
    for (const item of sellableItems) {
      const option = ownerDocument.createElement("option");
      option.value = `${item.inventory}|${item.itemId}`;
      option.textContent = `${item.name} · ${item.amount} ks`;
      itemSelect.append(option);
    }
  }
  appendChildren(itemField, itemFieldLabel, itemSelect);

  const amountField = createElement(ownerDocument, "label", "market-player-field");
  const amountLabel = ownerDocument.createElement("span");
  amountLabel.textContent = "Množství";
  const amountInput = createElement(ownerDocument, "input", "market-player-input");
  amountInput.type = "number";
  amountInput.min = "1";
  amountInput.step = "1";
  amountInput.value = "1";
  amountInput.inputMode = "numeric";
  appendChildren(amountField, amountLabel, amountInput);

  const priceField = createElement(ownerDocument, "label", "market-player-field");
  const priceLabel = ownerDocument.createElement("span");
  priceLabel.textContent = "Cena / kus";
  const unitPriceInput = createElement(ownerDocument, "input", "market-player-input");
  unitPriceInput.type = "number";
  unitPriceInput.min = "1";
  unitPriceInput.step = "1";
  unitPriceInput.value = "1";
  unitPriceInput.inputMode = "numeric";
  appendChildren(priceField, priceLabel, unitPriceInput);

  const currencyField = createElement(ownerDocument, "label", "market-player-field");
  const currencyLabel = ownerDocument.createElement("span");
  currencyLabel.textContent = "Měna";
  const currencySelect = createElement(ownerDocument, "select", "market-player-input");
  for (const [value, label] of [["cleanMoney", "Clean cash"], ["dirtyMoney", "Dirty cash"]]) {
    const option = ownerDocument.createElement("option");
    option.value = value;
    option.textContent = label;
    currencySelect.append(option);
  }
  appendChildren(currencyField, currencyLabel, currencySelect);

  const submit = createElement(ownerDocument, "button", "button market-player-sell-button");
  submit.type = "button";
  submit.textContent = "Vystavit";

  const getSelectedSellItem = () => {
    const [inventory, itemId] = String(itemSelect.value || "").split("|");
    return sellableItems.find((item) => item.inventory === inventory && item.itemId === itemId) || null;
  };
  const syncSellForm = () => {
    const item = getSelectedSellItem();
    const maxAmount = Math.max(0, Number(item?.amount || 0));
    amountInput.disabled = !item;
    unitPriceInput.disabled = !item;
    currencySelect.disabled = !item;
    submit.disabled = !item || ownListingCount >= ownListingLimit;

    if (!item) {
      amountInput.value = "1";
      unitPriceInput.value = "1";
      return;
    }

    amountInput.max = String(Math.max(1, maxAmount));
    amountInput.value = String(Math.min(Math.max(Number.parseInt(String(amountInput.value || "1"), 10) || 1, 1), Math.max(1, maxAmount)));
    unitPriceInput.value = String(Math.max(1, Math.floor(Number(unitPriceInput.value || callbacks.getSuggestedUnitPrice?.(item) || 1))));
    currencySelect.value = item.inventory === "drugs" ? "dirtyMoney" : currencySelect.value;
    submit.title = ownListingCount >= ownListingLimit
      ? "Máš plný limit aktivních nabídek."
      : "Vystavit nabídku na serverový hráčský bazar.";
  };

  itemSelect.addEventListener("change", () => {
    const item = getSelectedSellItem();
    if (item) {
      unitPriceInput.value = String(callbacks.getSuggestedUnitPrice?.(item) || 1);
      currencySelect.value = item.inventory === "drugs" ? "dirtyMoney" : "cleanMoney";
    }
    syncSellForm();
  });
  amountInput.addEventListener("input", syncSellForm);
  unitPriceInput.addEventListener("input", syncSellForm);

  if (sellableItems[0]) {
    unitPriceInput.value = String(callbacks.getSuggestedUnitPrice?.(sellableItems[0]) || 1);
    currencySelect.value = sellableItems[0].inventory === "drugs" ? "dirtyMoney" : "cleanMoney";
  }

  submit.addEventListener("click", () => {
    const item = getSelectedSellItem();
    callbacks.onCreateListing?.({
      item,
      requestedAmount: Math.min(Math.max(Number.parseInt(String(amountInput.value || "1"), 10) || 1, 1), Math.max(1, Number(item?.amount || 1))),
      unitPrice: Math.max(1, Math.floor(Number(unitPriceInput.value || 1))),
      currency: currencySelect.value === "dirtyMoney" ? "dirtyMoney" : "cleanMoney"
    });
  });

  syncSellForm();
  appendChildren(form, itemField, amountField, priceField, currencyField, submit);
  appendChildren(sellPanel, sellHeader, form);

  const listingsWrap = createElement(ownerDocument, "section", "market-player-listings");

  if (listings.length <= 0) {
    const empty = createElement(ownerDocument, "p", "market-player-empty");
    empty.textContent = "Na serveru teď nejsou aktivní hráčské nabídky.";
    appendChildren(listingsWrap, empty);
  } else {
    for (const listing of listings) {
      const isOwn = Boolean(listing.isOwn);
      const card = createElement(ownerDocument, "article", "market-player-listing");
      setDatasetValue(card, "listingOwner", isOwn ? "self" : "peer");
      setDatasetValue(card, "listingCurrency", listing.currency);

      const head = createElement(ownerDocument, "div", "market-player-listing__head");
      const title = ownerDocument.createElement("strong");
      title.textContent = listing.itemName;
      const seller = ownerDocument.createElement("span");
      seller.textContent = isOwn ? "Tvoje nabídka" : listing.sellerName;
      appendChildren(head, title, seller);

      const meta = createElement(ownerDocument, "div", "market-player-listing__meta");
      const amount = ownerDocument.createElement("span");
      amount.textContent = `${listing.amount} ks`;
      const price = ownerDocument.createElement("span");
      price.textContent = `${formatMarketPrice(listing.unitPrice)} / kus`;
      const currency = ownerDocument.createElement("span");
      currency.textContent = getListingCurrencyLabel(listing.currency);
      const expires = ownerDocument.createElement("span");
      expires.textContent = `expirace ${Math.max(1, Math.ceil((listing.expiresAt - Date.now()) / 60000))} min`;
      appendChildren(meta, amount, price, currency, expires);

      const footer = createElement(ownerDocument, "div", "market-player-listing__footer");
      const totalLabel = ownerDocument.createElement("strong");
      totalLabel.textContent = `Celkem ${formatMarketPrice(listing.total)}`;

      const action = createElement(
        ownerDocument,
        "button",
        isOwn ? "button market-player-listing__cancel" : "button market-player-listing__buy"
      );
      action.type = "button";
      action.textContent = isOwn ? "Stáhnout" : "Koupit";
      action.disabled = !isOwn && Boolean(listing.disabled);
      action.title = listing.title || "";
      action.addEventListener("click", () => {
        if (isOwn) {
          callbacks.onCancelListing?.(listing);
          return;
        }

        callbacks.onBuyListing?.(listing);
      });

      appendChildren(footer, totalLabel, action);
      appendChildren(card, head, meta, footer);
      appendChildren(listingsWrap, card);
    }
  }

  appendChildren(shell, sellPanel, listingsWrap);
  listElement.append(shell);
  return true;
}

export function renderMarketItem(itemViewModel = {}, callbacks = {}, options = {}) {
  const ownerDocument = options.document || (typeof document !== "undefined" ? document : null);
  if (!ownerDocument) {
    return null;
  }

  return createMarketItemRow(ownerDocument, itemViewModel, callbacks);
}

function createMarketItemRow(ownerDocument, item, callbacks = {}) {
  const row = createElement(ownerDocument, "div", "market-popup-row");
  setDatasetValue(row, "marketInventory", item.inventory);
  setDatasetValue(row, "marketRowMode", item.rowMode);
  setDatasetValue(row, "resourceColor", item.resourceColor || item.itemId);

  const info = createElement(ownerDocument, "div", "market-popup-row__info");
  const name = createElement(ownerDocument, "strong", "market-popup-row__name");
  name.textContent = item.name;
  const meta = createElement(ownerDocument, "span", "market-popup-row__meta");
  meta.textContent = item.metaLabel;
  const price = createElement(ownerDocument, "span", "market-popup-row__price");
  price.textContent = item.priceLabel;
  const trend = createElement(ownerDocument, "span", "market-popup-row__trend");
  setDatasetValue(trend, "marketTrend", item.trendDirection || "flat");
  trend.textContent = item.trendLabel || "• beze změny";
  const stockBar = createElement(ownerDocument, "span", "market-popup-row__stock");
  stockBar.style?.setProperty?.("--market-stock", `${Number.isFinite(item.stockPercent) ? item.stockPercent : 100}%`);
  stockBar.setAttribute("aria-label", item.stockLabel || "Stock bez limitu");
  appendChildren(info, name, meta, price, trend, stockBar);

  const trade = createElement(ownerDocument, "div", "market-popup-row__trade");
  const quantityWrap = createElement(ownerDocument, "label", "market-popup-row__quantity-wrap");
  const quantityLabel = ownerDocument.createElement("span");
  quantityLabel.textContent = "Množství";
  const quantityInput = createElement(ownerDocument, "input", "market-popup-row__quantity");
  quantityInput.type = "number";
  quantityInput.min = "1";
  quantityInput.max = "999";
  quantityInput.step = "1";
  quantityInput.value = "1";
  quantityInput.inputMode = "numeric";
  quantityInput.setAttribute("aria-label", `Množství pro ${item.name}`);
  appendChildren(quantityWrap, quantityLabel, quantityInput);

  const totals = createElement(ownerDocument, "span", "market-popup-row__total");
  const actions = createElement(ownerDocument, "div", "market-popup-row__actions");
  const buyAction = createElement(ownerDocument, "button", "button market-popup-row__buy");
  buyAction.type = "button";
  buyAction.textContent = "Koupit";
  const sellAction = createElement(ownerDocument, "button", "button market-popup-row__sell");
  sellAction.type = "button";
  sellAction.textContent = "Prodat";

  const getRequestedQuantity = () => Math.min(Math.max(Number.parseInt(String(quantityInput.value || "1"), 10) || 1, 1), 999);
  const updateRowTradeState = () => {
    const requestedQuantity = getRequestedQuantity();
    quantityInput.value = String(requestedQuantity);
    const state = callbacks.getTradeState?.(item, requestedQuantity) || {};
    buyAction.disabled = Boolean(state.buyDisabled);
    sellAction.disabled = Boolean(state.sellDisabled);
    buyAction.title = state.buyTitle || "";
    sellAction.title = state.sellTitle || "";
    totals.textContent = state.totalLabel || "";
  };

  quantityInput.addEventListener("input", updateRowTradeState);
  quantityInput.addEventListener("change", updateRowTradeState);
  buyAction.addEventListener("click", () => callbacks.onBuyItem?.(item, getRequestedQuantity(), updateRowTradeState));
  sellAction.addEventListener("click", () => callbacks.onSellItem?.(item, getRequestedQuantity(), updateRowTradeState));
  updateRowTradeState();

  appendChildren(actions, buyAction, sellAction);
  appendChildren(trade, quantityWrap, totals, actions);
  appendChildren(row, info, trade);
  return row;
}

export function renderMarketPanel(listElement, viewModel = {}, callbacks = {}, options = {}) {
  if (!listElement) {
    return false;
  }

  const ownerDocument = getOwnerDocument(listElement, options);
  if (!ownerDocument) {
    return false;
  }

  replaceChildrenSafe(listElement);
  const items = Array.isArray(viewModel.items) ? viewModel.items : [];

  if (items.length <= 0) {
    return renderMarketEmptyState(listElement, viewModel.emptyMessage || "Market je prázdný.", options);
  }

  for (const item of items) {
    appendChildren(listElement, createMarketItemRow(ownerDocument, item, callbacks));
  }

  return true;
}

export function renderBlackMarketPanel(listElement, viewModel = {}, callbacks = {}, options = {}) {
  return renderMarketPanel(listElement, viewModel, callbacks, options);
}

export function openMarketPanel(popup) {
  if (!popup) {
    return false;
  }

  popup.hidden = false;
  return true;
}

export function closeMarketPanel(popup) {
  if (!popup) {
    return false;
  }

  popup.hidden = true;
  return true;
}

export function initMarketPanel() {
  return true;
}
