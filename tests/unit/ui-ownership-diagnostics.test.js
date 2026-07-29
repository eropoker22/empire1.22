/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createUiOwnershipDiagnostics,
  isUiOwnershipDebugEnabled
} from "../../page-assets/js/app/dev/uiOwnershipDiagnostics.js";

function createWindowFixture(search = "?uiOwnershipDebug=1") {
  return {
    CustomEvent,
    Element,
    HTMLElement,
    MutationObserver,
    console: { warn: vi.fn() },
    document,
    getComputedStyle: window.getComputedStyle.bind(window),
    location: {
      hostname: "127.0.0.1",
      protocol: "http:",
      search
    },
    queueMicrotask,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };
}

afterEach(() => {
  document.body.replaceChildren();
  document.body.className = "";
  document.body.removeAttribute("data-overlay-scroll-locked");
});

describe("UI ownership diagnostics", () => {
  it("is explicit and loopback-only", () => {
    expect(isUiOwnershipDebugEnabled(createWindowFixture())).toBe(true);
    expect(isUiOwnershipDebugEnabled(createWindowFixture(""))).toBe(false);

    const publicWindow = createWindowFixture();
    publicWindow.location.hostname = "empirestreets.cz";
    publicWindow.__EMPIRE_E2E__ = true;
    expect(isUiOwnershipDebugEnabled(publicWindow)).toBe(false);
  });

  it("reports duplicate visible renderer ownership and modal ids", () => {
    const windowRef = createWindowFixture();
    windowRef.empireStreetsGameplaySliceReadModel = {
      server: { stateVersion: 19 },
      district: {
        districtId: "district:9",
        buildings: [{ buildingId: "building:9:pharmacy" }]
      }
    };
    document.body.innerHTML = `
      <div data-district-popup data-ui-owner="legacy-shared" data-district-id="9" role="dialog"></div>
      <div data-district-popup data-ui-owner="server-slice" role="dialog"></div>
      <div id="duplicate" class="modal" data-ui-owner="legacy-shared"></div>
      <div id="duplicate" class="modal" data-ui-owner="server-slice"></div>
    `;
    const diagnostics = createUiOwnershipDiagnostics({
      documentRef: document,
      enabled: true,
      windowRef
    });
    diagnostics.recordSelection({
      requestedBuildingId: "building:9:pharmacy",
      requestedDistrictId: "district:9",
      status: "ready"
    });
    const summary = diagnostics.audit("test");

    expect(summary).toMatchObject({
      executionMode: "unknown",
      legacySelectedDistrictId: "9",
      requestedBuildingId: "building:9:pharmacy",
      requestedDistrictId: "district:9",
      serverBuildingId: "building:9:pharmacy",
      serverSelectedDistrictId: "district:9",
      stateVersion: 19,
      visibleDistrictPopupCount: 2
    });
    expect(summary.violations).toEqual(expect.arrayContaining([
      "duplicate-visible-modal-ids",
      "multiple-visible-district-popups"
    ]));
    expect(windowRef.console.warn).toHaveBeenCalled();
    diagnostics.destroy();
  });

  it("detects a hidden renderer holding the scroll lock", () => {
    const windowRef = createWindowFixture();
    windowRef.EmpireModalScrollLock = {
      debugState: () => ({
        bodyLocked: true,
        stack: []
      })
    };
    document.body.classList.add("game-modal-scroll-locked");
    const diagnostics = createUiOwnershipDiagnostics({
      documentRef: document,
      enabled: true,
      windowRef
    });

    expect(diagnostics.audit("scroll-lock").violations).toContain("hidden-renderer-holds-scroll-lock");
    diagnostics.destroy();
  });

  it("stays completely dormant when disabled", () => {
    const windowRef = createWindowFixture("");
    const diagnostics = createUiOwnershipDiagnostics({
      documentRef: document,
      enabled: false,
      windowRef
    });

    expect(diagnostics.enabled).toBe(false);
    expect(diagnostics.audit("disabled")).toBeNull();
    expect(diagnostics.getSummary()).toBeNull();
    expect(windowRef.addEventListener).not.toHaveBeenCalled();
  });
});
