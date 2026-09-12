import { closeOverlay } from "./legacyOverlayCoordinator.js";

function safeFunction(fn, fallback = () => {}) {
  return typeof fn === "function" ? fn : fallback;
}

export function createResultModalQueue(options = {}) {
  const queue = [];
  let current = null;
  const getVisibleModal = safeFunction(options.getVisibleModal, () => null);
  const openByKind = safeFunction(options.openByKind);
  const timerSource = options.timerApi || (typeof window !== "undefined" ? window : globalThis);
  const setTimeoutFn = typeof options.setTimeout === "function"
    ? options.setTimeout
    : (typeof timerSource?.setTimeout === "function" ? timerSource.setTimeout.bind(timerSource) : null);

  const renderNext = (root) => {
    if (!root || getVisibleModal(root) || queue.length <= 0) {
      return;
    }

    const nextItem = queue.shift();
    if (nextItem) {
      current = nextItem;
      openByKind(root, nextItem.kind, nextItem.payload);
    }
  };

  const queueOrOpen = (root, kind, payload) => {
    if (!root) {
      return;
    }

    const visible = getVisibleModal(root);
    if (visible) {
      if (current) queue.unshift(current);
      visible.classList?.add?.("hidden");
      closeOverlay(visible, { restoreFocus: false });
    }
    current = { kind, payload };
    openByKind(root, kind, payload);
  };

  const close = (root, selector) => {
    const modal = root?.querySelector?.(selector);
    if (!modal) {
      return;
    }

    current = null;
    modal.classList?.add?.("hidden");
    closeOverlay(modal);
    if (setTimeoutFn) {
      setTimeoutFn(() => renderNext(root), 80);
    } else {
      renderNext(root);
    }
  };

  return {
    close,
    getQueueSize: () => queue.length,
    queueOrOpen,
    renderNext
  };
}

if (typeof window !== "undefined") {
  window.EmpireResultModalQueue = {
    createResultModalQueue
  };
}
