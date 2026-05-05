import { describe, expect, it, vi } from "vitest";
import {
  assertPublicHandlersExist,
  createSafePublicHandler,
  getRegisteredPublicHandlers,
  initRuntimeCompatibilityGlobals,
  registerRuntimePublicHandlers,
  unregisterRuntimePublicHandlers
} from "../../page-assets/js/app/runtime/compatibility.js";

describe("runtime compatibility globals", () => {
  it("exposes the runtime namespace, module namespace, and legacy aliases", () => {
    const api = {
      bootstrapPage: vi.fn(() => "boot"),
      initRuntime: vi.fn(() => "init"),
      refreshAllUi: vi.fn(() => "refresh"),
      handleActionResult: vi.fn(() => true),
      selectDistrict: vi.fn(() => true),
      openDistrict: vi.fn(() => true),
      openBuildingDetail: vi.fn(() => true),
      collectProduction: vi.fn(() => true),
      runBuildingAction: vi.fn(() => true),
      craftItem: vi.fn(() => true),
      openMarket: vi.fn(() => true),
      buyMarketItem: vi.fn(() => true),
      sellMarketItem: vi.fn(() => true),
      openAttackPanel: vi.fn(() => true),
      startAttack: vi.fn(() => true),
      openSpyPanel: vi.fn(() => true),
      startSpy: vi.fn(() => true),
      openPlayerProfile: vi.fn(() => true),
      showToast: vi.fn(() => "toast"),
      showSuccess: vi.fn(() => "success"),
      showError: vi.fn(() => "error"),
      showWarning: vi.fn(() => "warning"),
      showInfo: vi.fn(() => "info"),
      clearNotifications: vi.fn(() => 0)
    };
    const windowRef = {};

    const namespace = initRuntimeCompatibilityGlobals(api, {
      notifications: { showToast: api.showToast }
    }, { windowRef });

    expect(namespace).toBe(windowRef.EmpireRuntime);
    expect(windowRef.EmpireRuntime.initRuntime()).toBe("init");
    expect(windowRef.EmpireRuntimeModules.notifications.showToast).toBe(api.showToast);
    expect(windowRef.showToast("A")).toBe("toast");
    expect(windowRef.showNotification("B")).toBe("toast");
    expect(windowRef.clearNotifications()).toBe(0);
    expect(windowRef.openDistrict(12)).toBe(true);
    expect(windowRef.openSpyPanel(13)).toBe(true);
    expect(assertPublicHandlersExist([
      "selectDistrict",
      "openDistrict",
      "openBuildingDetail",
      "collectProduction",
      "runBuildingAction",
      "craftItem",
      "openMarket",
      "buyMarketItem",
      "sellMarketItem",
      "openAttackPanel",
      "startAttack",
      "openSpyPanel",
      "startSpy",
      "showToast",
      "showNotification",
      "openPlayerProfile"
    ], { windowRef })).toBe(true);
  });

  it("registers, reports and unregisters safe public handlers", () => {
    const windowRef = {};
    const onMissing = vi.fn(() => "fallback");
    const registered = registerRuntimePublicHandlers({
      openMarket: vi.fn(() => "market"),
      missing: null
    }, { windowRef, fallback: onMissing });

    expect(registered).toEqual(["openMarket"]);
    expect(getRegisteredPublicHandlers()).toContain("openMarket");
    expect(windowRef.openMarket()).toBe("market");
    expect(assertPublicHandlersExist(["openMarket"], { windowRef })).toBe(true);
    expect(unregisterRuntimePublicHandlers({ windowRef })).toBe(true);
    expect(windowRef.openMarket).toBeUndefined();
  });

  it("wraps unavailable and throwing public handlers without crashing", () => {
    const warn = vi.fn();
    const fallback = vi.fn(() => false);
    const missing = createSafePublicHandler("missing", null, fallback, { console: { warn } });
    const throwing = createSafePublicHandler("throwing", () => {
      throw new Error("boom");
    }, fallback, { console: { warn } });

    expect(missing()).toBe(false);
    expect(throwing()).toBe(false);
    expect(fallback).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
