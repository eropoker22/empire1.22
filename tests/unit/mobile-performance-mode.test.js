import { describe, expect, it } from "vitest";
import {
  applyMobilePerformanceMode,
  detectMobilePerformanceMode,
  getCappedDevicePixelRatio
} from "../../page-assets/js/app/performance/mobilePerformanceMode.js";

class FakeClassList {
  constructor() {
    this.tokens = new Set();
  }

  toggle(token, force) {
    if (force) {
      this.tokens.add(token);
    } else {
      this.tokens.delete(token);
    }
  }

  contains(token) {
    return this.tokens.has(token);
  }
}

function createFakeDocument() {
  return {
    documentElement: { clientWidth: 390, classList: new FakeClassList(), dataset: {} },
    body: { classList: new FakeClassList(), dataset: {} }
  };
}

describe("mobile performance mode", () => {
  it("activates on small mobile viewports and caps DPR", () => {
    const documentRef = createFakeDocument();
    const windowRef = {
      innerWidth: 390,
      devicePixelRatio: 3,
      document: documentRef,
      navigator: { userAgent: "Mozilla/5.0 iPhone Mobile" },
      matchMedia: (query) => ({
        matches: query.includes("max-width") || query.includes("pointer")
      })
    };

    const mode = detectMobilePerformanceMode({ windowRef, documentRef });

    expect(mode.active).toBe(true);
    expect(mode.renderFpsCap).toBe(30);
    expect(getCappedDevicePixelRatio(windowRef, mode)).toBe(1.5);

    applyMobilePerformanceMode(mode, { windowRef, documentRef });

    expect(documentRef.documentElement.classList.contains("is-mobile-performance-mode")).toBe(true);
    expect(documentRef.body.dataset.mobilePerformanceMode).toBe("true");
    expect(windowRef.empireStreetsPerformanceMetrics.mobilePerformanceModeActive).toBe(true);
  });

  it("keeps desktop mode inactive without capping DPR", () => {
    const documentRef = createFakeDocument();
    documentRef.documentElement.clientWidth = 1440;
    const windowRef = {
      innerWidth: 1440,
      devicePixelRatio: 2.5,
      document: documentRef,
      navigator: { userAgent: "Desktop" },
      matchMedia: () => ({ matches: false })
    };
    const mode = detectMobilePerformanceMode({ windowRef, documentRef });

    applyMobilePerformanceMode(mode, { windowRef, documentRef });

    expect(mode.active).toBe(false);
    expect(getCappedDevicePixelRatio(windowRef, mode)).toBe(2.5);
    expect(documentRef.documentElement.classList.contains("is-mobile-performance-mode")).toBe(false);
  });
});

