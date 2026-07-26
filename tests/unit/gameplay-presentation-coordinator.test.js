import { describe, expect, it, vi } from "vitest";
import { createGameplayPresentationCoordinator } from "../../page-assets/js/app/presentation/gameplayPresentationCoordinator.js";

const createEventTarget = () => {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    dispatch(type) {
      listeners.get(type)?.();
    },
    listenerCount: () => listeners.size
  };
};

describe("gameplay presentation coordinator", () => {
  it("mounts once, updates all controllers, and destroys once", () => {
    const windowRef = createEventTarget();
    const root = { dataset: {}, ownerDocument: { defaultView: windowRef } };
    const listeners = new Set();
    const source = {
      getCurrentReadModel: () => ({ server: { stateVersion: 1 } }),
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    };
    const first = { mount: vi.fn(), update: vi.fn(), destroy: vi.fn() };
    const second = { mount: vi.fn(), update: vi.fn(), destroy: vi.fn() };

    const coordinator = createGameplayPresentationCoordinator({
      root,
      source,
      controllers: [first, second],
      windowRef
    });

    expect(coordinator.mount()).toBe(true);
    expect(coordinator.mount()).toBe(true);
    expect(first.mount).toHaveBeenCalledTimes(1);
    expect(second.mount).toHaveBeenCalledTimes(1);
    expect(first.update).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(1);
    expect(windowRef.listenerCount()).toBe(1);

    const nextModel = { server: { stateVersion: 2 } };
    for (const listener of listeners) listener(nextModel);
    expect(first.update).toHaveBeenLastCalledWith(nextModel, "source-update");
    expect(second.update).toHaveBeenLastCalledWith(nextModel, "source-update");

    expect(coordinator.destroy()).toBe(true);
    expect(coordinator.destroy()).toBe(false);
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(second.destroy).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  });

  it("returns the same coordinator for a duplicate root", () => {
    const root = { dataset: {} };
    const source = { subscribe: () => () => {} };
    const first = createGameplayPresentationCoordinator({ root, source, windowRef: null });
    const second = createGameplayPresentationCoordinator({ root, source, windowRef: null });

    expect(second).toBe(first);
    first.destroy();
  });
});
