import { describe, expect, it, vi } from "vitest";
import { bindDesktopGameScrollLimit } from "../../page-assets/js/app/runtime/desktopScrollLimitRuntime.js";

const createWindowMock = ({ matches = true, scrollY = 0, innerHeight = 900 } = {}) => {
  const listeners = new Map();
  const media = {
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };
  return {
    scrollY,
    pageYOffset: scrollY,
    innerHeight,
    visualViewport: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    },
    matchMedia: vi.fn(() => media),
    requestAnimationFrame: vi.fn((callback) => {
      callback();
      return 1;
    }),
    cancelAnimationFrame: vi.fn(),
    addEventListener: vi.fn((type, callback) => {
      listeners.set(type, callback);
    }),
    removeEventListener: vi.fn(),
    scrollTo: vi.fn()
  };
};

const createDocumentMock = ({ anchorBottom = 700 } = {}) => ({
  body: {
    scrollTop: 0,
    classList: {
      contains: vi.fn(() => false)
    }
  },
  documentElement: {
    clientHeight: 900,
    scrollTop: 0
  },
  querySelector: vi.fn(() => ({
    getBoundingClientRect: () => ({ bottom: anchorBottom })
  }))
});

describe("desktop game scroll limit runtime", () => {
  it("clamps desktop scroll to 250px below the command bar", () => {
    const windowObj = createWindowMock({ scrollY: 500, innerHeight: 900 });
    const documentObj = createDocumentMock({ anchorBottom: 200 });

    bindDesktopGameScrollLimit(documentObj, windowObj);

    expect(windowObj.scrollTo).toHaveBeenCalledWith({
      top: 50,
      left: 0,
      behavior: "instant"
    });
  });

  it("does not clamp outside the desktop media query", () => {
    const windowObj = createWindowMock({ matches: false, scrollY: 500, innerHeight: 900 });
    const documentObj = createDocumentMock({ anchorBottom: 700 });

    bindDesktopGameScrollLimit(documentObj, windowObj);

    expect(windowObj.scrollTo).not.toHaveBeenCalled();
  });
});
