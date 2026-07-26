import {
  STORAGE_POPUP_CLOSE_SELECTOR,
  STORAGE_POPUP_OPEN_SELECTOR,
  STORAGE_POPUP_SELECTOR
} from "../runtime/constants.js";
import { closeOverlay, openOverlay } from "./legacyOverlayCoordinator.js";

export function createServerGameplayStorageController({
  root,
  documentRef = root?.ownerDocument || globalThis.document
} = {}) {
  let mounted = false;
  let eventScope = null;
  let openButton = null;
  let popup = null;
  let card = null;
  let closeElements = [];
  let rows = [];
  let latestRows = new Map();
  let latestFingerprint = "";
  let renderedFingerprint = "";
  const diagnostics = { updates: 0, renders: 0, domWrites: 0 };

  const isOpen = () => Boolean(popup && !popup.hidden);
  const moveToTopLayer = () => {
    const body = popup?.ownerDocument?.body;
    if (body && popup.parentElement !== body) body.append(popup);
  };
  const render = () => {
    if (latestFingerprint === renderedFingerprint) return 0;
    let writes = 0;
    for (const rowRef of rows) {
      const view = latestRows.get(rowRef.key) || unavailableRowView();
      writes += setText(rowRef.value, view.text);
      writes += setDataset(rowRef.row, "storageState", view.state);
      writes += setProperty(rowRef.row, "title", view.title);
    }
    renderedFingerprint = latestFingerprint;
    diagnostics.renders += 1;
    diagnostics.domWrites += writes;
    return writes;
  };
  const open = () => {
    if (!popup) return false;
    moveToTopLayer();
    render();
    return openOverlay(popup, {
      type: "modal",
      ariaModal: true,
      focusTarget: card,
      restoreFocusOnClose: false,
      alwaysOnTop: true
    });
  };
  const close = () => {
    if (!popup) return false;
    popup.hidden = true;
    popup.classList?.add("hidden");
    return closeOverlay(popup, { restoreFocus: false });
  };
  const stopCardEvent = (event) => event.stopPropagation();
  const onOpenClick = () => open();
  const onCloseClick = () => close();
  const onKeydown = (event) => {
    if (event.key === "Escape" && isOpen()) close();
  };

  const mount = () => {
    if (mounted) return false;
    const scope = documentRef || root;
    eventScope = scope;
    openButton = scope?.querySelector?.(STORAGE_POPUP_OPEN_SELECTOR) || null;
    popup = scope?.querySelector?.(STORAGE_POPUP_SELECTOR) || null;
    card = popup?.querySelector?.(".storage-popup-card") || null;
    closeElements = Array.from(popup?.querySelectorAll?.(STORAGE_POPUP_CLOSE_SELECTOR) || []);
    rows = Array.from(popup?.querySelectorAll?.("[data-storage-resource]") || []).map((row) => ({
      key: String(row.dataset?.storageResource || ""),
      row,
      value: row.querySelector?.("[data-storage-value]") || null
    })).filter((entry) => entry.key && entry.value);
    openButton?.addEventListener?.("click", onOpenClick);
    card?.addEventListener?.("pointerdown", stopCardEvent);
    card?.addEventListener?.("click", stopCardEvent);
    for (const element of closeElements) element.addEventListener("click", onCloseClick);
    scope?.addEventListener?.("keydown", onKeydown);
    mounted = true;
    return true;
  };

  const update = (readModel) => {
    if (!mounted || !readModel?.player) return 0;
    diagnostics.updates += 1;
    const nextRows = createStorageRowViews(readModel, rows.map((row) => row.key));
    const nextFingerprint = JSON.stringify([...nextRows]);
    if (nextFingerprint === latestFingerprint) return 0;
    latestRows = nextRows;
    latestFingerprint = nextFingerprint;
    return isOpen() ? render() : 0;
  };

  const destroy = () => {
    if (!mounted) return false;
    openButton?.removeEventListener?.("click", onOpenClick);
    card?.removeEventListener?.("pointerdown", stopCardEvent);
    card?.removeEventListener?.("click", stopCardEvent);
    for (const element of closeElements) element.removeEventListener("click", onCloseClick);
    eventScope?.removeEventListener?.("keydown", onKeydown);
    if (isOpen()) close();
    openButton = null;
    eventScope = null;
    popup = null;
    card = null;
    closeElements = [];
    rows = [];
    latestRows.clear();
    latestFingerprint = "";
    renderedFingerprint = "";
    mounted = false;
    return true;
  };

  return {
    mount,
    update,
    destroy,
    open,
    close,
    getDiagnostics: () => ({ ...diagnostics, mounted })
  };
}

export function createStorageRowViews(readModel, resourceKeys = []) {
  const player = readModel?.player || {};
  const storage = player.storage;
  const authoritativeItems = new Map();
  for (const group of Array.isArray(storage?.groups) ? storage.groups : []) {
    for (const item of Array.isArray(group?.items) ? group.items : []) {
      if (item?.resourceKey) authoritativeItems.set(String(item.resourceKey), item);
    }
  }
  const fallback = {
    ...(player.resourceBalances || {}),
    ...(player.economy?.resources || {}),
    ...(player.economy?.materials || {}),
    ...(player.economy?.drugs || {}),
    ...(player.economy?.weapons || {})
  };

  return new Map(resourceKeys.map((key) => {
    const item = authoritativeItems.get(key);
    if (!storage) return [key, unavailableRowView()];
    if (!item) {
      return [key, {
        text: `${normalizeCount(fallback[key])} / -`,
        state: "normal",
        title: ""
      }];
    }
    const current = normalizeCount(item.currentAmount);
    const maximum = normalizeCount(item.maxAmount);
    return [key, {
      text: `${current} / ${maximum}`,
      state: item.isOverCapacity ? "over" : item.isFull ? "full" : item.isNearCapacity ? "near" : "normal",
      title: item.isOverCapacity
        ? "Zásoba překračuje aktuální maximum. Další kusy nelze přijmout."
        : item.isFull ? "Kapacita je plná" : ""
    }];
  }));
}

function unavailableRowView() {
  return {
    text: "— / —",
    state: "unavailable",
    title: "Autoritativní stav skladu zatím není dostupný."
  };
}

function normalizeCount(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
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

function setProperty(element, key, value) {
  if (!element || element[key] === value) return 0;
  element[key] = value;
  return 1;
}
