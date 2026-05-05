function safeFunction(fn, fallback = () => {}) {
  return typeof fn === "function" ? fn : fallback;
}

export function createResultModalQueue(options = {}) {
  const queue = [];
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
      openByKind(root, nextItem.kind, nextItem.payload);
    }
  };

  const queueOrOpen = (root, kind, payload) => {
    if (!root) {
      return;
    }

    if (getVisibleModal(root)) {
      queue.push({ kind, payload });
      return;
    }

    openByKind(root, kind, payload);
  };

  const close = (root, selector) => {
    const modal = root?.querySelector?.(selector);
    if (!modal) {
      return;
    }

    modal.classList?.add?.("hidden");
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
