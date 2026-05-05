function getOwnerDocument(element, options = {}) {
  return element?.ownerDocument || options.document || (typeof document !== "undefined" ? document : null);
}

function createElement(container, tagName, className = "", options = {}) {
  const ownerDocument = getOwnerDocument(container, options);
  if (!ownerDocument?.createElement) {
    return null;
  }
  const element = ownerDocument.createElement(tagName);
  if (className) {
    element.className = className;
  }
  return element;
}

function appendRow(container, label, value, options = {}) {
  const row = createElement(container, "div", "map-status-panel__row", options);
  const labelElement = createElement(container, "span", "map-status-panel__label", options);
  const valueElement = createElement(container, "strong", "map-status-panel__value", options);
  if (!row || !labelElement || !valueElement) {
    return null;
  }
  labelElement.textContent = label;
  valueElement.textContent = String(value ?? "");
  row.append(labelElement, valueElement);
  container.append(row);
  return row;
}

export function clearMapStatusPanel(options = {}) {
  const container = options.container || options.mount || null;
  container?.replaceChildren?.();
  return Boolean(container);
}

export function renderMapStatusPanel(mapStatusViewModel = {}, options = {}) {
  const container = options.container || options.mount || null;
  if (!container) {
    return false;
  }

  container.replaceChildren?.();
  const rows = [
    ["Districty", mapStatusViewModel.districtCount ?? "0"],
    ["Tvoje", mapStatusViewModel.ownedDistrictCount ?? "0"],
    ["Cizí", mapStatusViewModel.enemyDistrictCount ?? "0"],
    ["Vybráno", mapStatusViewModel.selectedDistrictLabel || "Žádný district"],
    ["Overlay", mapStatusViewModel.activeOverlayLabel || "Ownership"]
  ];

  for (const [label, value] of rows) {
    appendRow(container, label, value, options);
  }

  if (mapStatusViewModel.message) {
    const message = createElement(container, "p", "map-status-panel__message", options);
    if (message) {
      message.textContent = mapStatusViewModel.message;
      container.append(message);
    }
  }

  return true;
}

export function renderMapBusyState(message = "Mapa se aktualizuje.", options = {}) {
  const container = options.container || options.mount || null;
  if (!container) {
    return false;
  }
  container.replaceChildren?.();
  const busy = createElement(container, "p", "map-status-panel__message map-status-panel__message--busy", options);
  if (!busy) {
    return false;
  }
  busy.textContent = message;
  container.append(busy);
  return true;
}

export function renderMapErrorState(message = "Mapa není dostupná.", options = {}) {
  const container = options.container || options.mount || null;
  if (!container) {
    return false;
  }
  container.replaceChildren?.();
  const error = createElement(container, "p", "map-status-panel__message map-status-panel__message--error", options);
  if (!error) {
    return false;
  }
  error.textContent = message;
  container.append(error);
  return true;
}
