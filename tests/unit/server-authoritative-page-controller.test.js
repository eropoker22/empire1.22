import { describe, expect, it, vi } from "vitest";
import { createServerAuthoritativePageController } from "../../page-assets/js/app/presentation/serverAuthoritativePageController.js";

const createEventScope = () => {
  const listeners = new Map();
  return {
    documentElement: { dataset: {} },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    dispatch(type, event = {}) {
      listeners.get(type)?.(event);
    },
    listenerCount(type) {
      return Number(listeners.has(type));
    }
  };
};

describe("server authoritative page controller", () => {
  it("mounts presentation controllers once without legacy gameplay mutation", () => {
    const documentRef = createEventScope();
    const windowRef = createEventScope();
    const root = { dataset: { page: "game" }, ownerDocument: documentRef };
    const listeners = new Set();
    const source = {
      getCurrentReadModel: () => ({ server: { stateVersion: 1 } }),
      handleSurfaceAction: vi.fn(),
      selectDistrict: vi.fn(),
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    };
    const map = { mount: vi.fn(), update: vi.fn(), destroy: vi.fn() };
    const ui = { mount: vi.fn(), update: vi.fn(), destroy: vi.fn() };
    const controller = createServerAuthoritativePageController({
      root,
      documentRef,
      windowRef,
      source,
      createMapController: () => map,
      createUiController: () => ui
    });

    expect(controller.mount()).toBe(true);
    expect(controller.mount()).toBe(true);
    expect(map.mount).toHaveBeenCalledTimes(1);
    expect(ui.mount).toHaveBeenCalledTimes(1);
    expect(map.update).toHaveBeenCalledTimes(1);
    expect(root.dataset.runtimeInit).toBe("server-authoritative");
    expect(root.dataset.gameplayAuthority).toBe("server-authoritative");
    expect(listeners.size).toBe(1);

    expect(controller.destroy()).toBe(true);
    expect(controller.destroy()).toBe(false);
    expect(map.destroy).toHaveBeenCalledTimes(1);
    expect(ui.destroy).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  });

  it("fully tears down the source and root registry on pagehide", () => {
    const documentRef = createEventScope();
    const windowRef = createEventScope();
    const root = { dataset: { page: "game" }, ownerDocument: documentRef };
    const source = {
      getCurrentReadModel: () => null,
      subscribe: () => () => {},
      mount: vi.fn(),
      destroy: vi.fn()
    };
    const map = { mount: vi.fn(), update: vi.fn(), destroy: vi.fn() };
    const ui = {
      mount: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn(),
      handleDistrictSelected: vi.fn()
    };
    const controller = createServerAuthoritativePageController({
      root,
      documentRef,
      windowRef,
      source,
      createMapController: () => map,
      createUiController: () => ui
    });

    controller.mount();
    expect(windowRef.listenerCount("pagehide")).toBe(1);

    windowRef.dispatch("pagehide");

    expect(source.destroy).toHaveBeenCalledTimes(1);
    expect(map.destroy).toHaveBeenCalledTimes(1);
    expect(ui.destroy).toHaveBeenCalledTimes(1);
    expect(windowRef.listenerCount("pagehide")).toBe(0);
    expect(controller.destroy()).toBe(false);
  });

  it("fully suspends for BFCache and recreates presentation on pageshow", () => {
    const documentRef = createEventScope();
    const windowRef = createEventScope();
    const root = { dataset: { page: "game" }, ownerDocument: documentRef };
    const source = {
      getCurrentReadModel: () => null,
      subscribe: () => () => {},
      mount: vi.fn(),
      destroy: vi.fn()
    };
    const maps = [];
    const uis = [];
    const createMapController = vi.fn(() => {
      const controller = { mount: vi.fn(), update: vi.fn(), destroy: vi.fn() };
      maps.push(controller);
      return controller;
    });
    const createUiController = vi.fn(() => {
      const controller = {
        mount: vi.fn(),
        update: vi.fn(),
        destroy: vi.fn(),
        handleDistrictSelected: vi.fn()
      };
      uis.push(controller);
      return controller;
    });
    const controller = createServerAuthoritativePageController({
      root,
      documentRef,
      windowRef,
      source,
      createMapController,
      createUiController
    });

    controller.mount();
    windowRef.dispatch("pagehide", { persisted: true });

    expect(source.destroy).toHaveBeenCalledTimes(1);
    expect(maps[0].destroy).toHaveBeenCalledTimes(1);
    expect(uis[0].destroy).toHaveBeenCalledTimes(1);
    expect(root.dataset.runtimeInit).toBeUndefined();
    expect(root.dataset.gameplayAuthority).toBeUndefined();
    expect(windowRef.listenerCount("pagehide")).toBe(0);
    expect(windowRef.listenerCount("pageshow")).toBe(1);

    windowRef.dispatch("pageshow", { persisted: true });

    expect(source.mount).toHaveBeenCalledTimes(2);
    expect(createMapController).toHaveBeenCalledTimes(2);
    expect(createUiController).toHaveBeenCalledTimes(2);
    expect(maps[1].mount).toHaveBeenCalledTimes(1);
    expect(uis[1].mount).toHaveBeenCalledTimes(1);
    expect(root.dataset.runtimeInit).toBe("server-authoritative");
    expect(root.dataset.gameplayAuthority).toBe("server-authoritative");
    expect(windowRef.listenerCount("pagehide")).toBe(1);
    expect(windowRef.listenerCount("pageshow")).toBe(0);
  });

  it("fails closed when local-demo is already mounted", () => {
    const documentRef = createEventScope();
    const windowRef = {
      ...createEventScope(),
      __EMPIRE_GAMEPLAY_EXECUTION_MODE__: "local-demo"
    };
    const root = {
      dataset: {
        gameplayAuthority: "local-demo",
        page: "game",
        runtimeInit: "ready"
      },
      ownerDocument: documentRef
    };
    const createMapController = vi.fn();
    const createUiController = vi.fn();
    const controller = createServerAuthoritativePageController({
      root,
      documentRef,
      windowRef,
      source: {
        getCurrentReadModel: () => null,
        subscribe: () => () => {}
      },
      createMapController,
      createUiController
    });

    expect(() => controller.mount()).toThrow(/cannot mount beside an active local-demo runtime/i);
    expect(createMapController).not.toHaveBeenCalled();
    expect(createUiController).not.toHaveBeenCalled();
    expect(root.dataset.gameplayAuthority).toBe("local-demo");
  });
});
