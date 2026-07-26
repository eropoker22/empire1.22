const mountedCoordinatorsByRoot = new WeakMap();

export function createGameplayPresentationCoordinator({
  root,
  source,
  controllers = [],
  managePageLifecycle = true,
  documentRef = root?.ownerDocument || globalThis.document,
  windowRef = documentRef?.defaultView || globalThis.window
} = {}) {
  if (!root || !source || typeof source.subscribe !== "function") {
    throw new Error("Gameplay presentation requires a root and a subscribable source.");
  }

  const existing = mountedCoordinatorsByRoot.get(root);
  if (existing) {
    return existing;
  }

  const activeControllers = controllers.filter(Boolean);
  let unsubscribe = null;
  let destroyed = false;
  let mounted = false;
  let lastModel = null;

  const update = (model, reason = "source-update") => {
    if (destroyed || !model || typeof model !== "object") {
      return false;
    }
    lastModel = model;
    for (const controller of activeControllers) {
      controller.update?.(model, reason);
    }
    root.dataset.presentationState = "ready";
    return true;
  };

  const destroy = () => {
    if (destroyed) {
      return false;
    }
    destroyed = true;
    unsubscribe?.();
    unsubscribe = null;
    for (const controller of [...activeControllers].reverse()) {
      controller.destroy?.();
    }
    if (managePageLifecycle) {
      windowRef?.removeEventListener?.("pagehide", handlePageHide);
    }
    delete root.dataset.presentationState;
    mountedCoordinatorsByRoot.delete(root);
    return true;
  };

  const handlePageHide = () => destroy();

  const api = Object.freeze({
    destroy,
    getCurrentModel: () => lastModel,
    mount: () => {
      if (destroyed || mounted) {
        return !destroyed;
      }
      mounted = true;
      root.dataset.presentationState = "mounting";
      for (const controller of activeControllers) {
        controller.mount?.();
      }
      unsubscribe = source.subscribe((model) => update(model, "source-update"));
      const current = source.getCurrentReadModel?.();
      if (current && current !== lastModel) {
        update(current, "initial-model");
      }
      if (managePageLifecycle) {
        windowRef?.addEventListener?.("pagehide", handlePageHide, { once: true });
      }
      return true;
    },
    update
  });

  mountedCoordinatorsByRoot.set(root, api);
  return api;
}
