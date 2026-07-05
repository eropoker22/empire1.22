/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOverlayBackdrop } from "../../../apps/client/src/modals/overlay-backdrop";
import {
  closeOverlay,
  getTopOverlay,
  isOverlayOpen,
  lockModalScroll,
  openOverlay,
  resetOverlayStateForTests,
  unlockModalScroll
} from "../../../apps/client/src/modals/overlay-state";

const setWindowScrollY = (value: number): void => {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value,
    writable: true
  });
};

const captureBodyStyles = (): Record<string, string> => {
  const { body } = document;

  return {
    left: body.style.left,
    position: body.style.position,
    right: body.style.right,
    top: body.style.top,
    width: body.style.width
  };
};

const restoreBodyStyles = (styles: Record<string, string>): void => {
  const { body } = document;
  body.style.left = styles.left;
  body.style.position = styles.position;
  body.style.right = styles.right;
  body.style.top = styles.top;
  body.style.width = styles.width;
};

describe("overlay backdrop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: vi.fn((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      })
    });
  });

  afterEach(() => {
    while (isOverlayOpen()) {
      closeOverlay("test:cleanup");
    }
    vi.runOnlyPendingTimers();

    resetOverlayStateForTests();
    vi.restoreAllMocks();
    vi.useRealTimers();
    restoreBodyStyles({
      left: "",
      position: "",
      right: "",
      top: "",
      width: ""
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("backdrop má třídy overlay-root a backdrop", () => {
    const root = document.createElement("div");
    const backdrop = createOverlayBackdrop({ mount: root });

    expect(backdrop.element.classList.contains("overlay-root")).toBe(true);
    expect(backdrop.element.classList.contains("backdrop")).toBe(true);
    expect(backdrop.element.classList.contains("gameplay-slice-backdrop")).toBe(true);
  });

  it("tap na backdrop zavře topmost overlay", () => {
    const root = document.createElement("div");
    const backdrop = createOverlayBackdrop({ mount: root });

    openOverlay("district_sheet");
    openOverlay("confirmation_modal");
    backdrop.sync();
    expect(getTopOverlay()).toBe("confirmation_modal");
    expect(backdrop.element.hidden).toBe(false);

    const pointerDown = new Event("pointerdown", { bubbles: true, cancelable: true });
    const pointerUp = new Event("pointerup", { bubbles: true, cancelable: true });
    const click = new Event("click", { bubbles: true, cancelable: true });

    backdrop.element.dispatchEvent(pointerDown);
    backdrop.element.dispatchEvent(pointerUp);
    backdrop.element.dispatchEvent(click);

    expect(pointerDown.defaultPrevented).toBe(true);
    expect(pointerUp.defaultPrevented).toBe(true);
    expect(click.defaultPrevented).toBe(true);

    expect(getTopOverlay()).toBe("district_sheet");
    expect(isOverlayOpen()).toBe(true);
    expect(backdrop.element.hidden).toBe(false);

    backdrop.element.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));

    expect(getTopOverlay()).toBe(null);
    expect(isOverlayOpen()).toBe(false);
    expect(backdrop.element.hidden).toBe(true);
  });

  it("backdrop close callback dostane jen zavřený topmost overlay", () => {
    const root = document.createElement("div");
    const onCloseTopOverlay = vi.fn();
    const backdrop = createOverlayBackdrop({ mount: root, onCloseTopOverlay });

    openOverlay("district_sheet");
    openOverlay("confirmation_modal");
    backdrop.sync();

    backdrop.element.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));

    expect(onCloseTopOverlay).toHaveBeenCalledTimes(1);
    expect(onCloseTopOverlay).toHaveBeenCalledWith("confirmation_modal");
    expect(getTopOverlay()).toBe("district_sheet");
  });

  it("tap na backdrop neotevře mapu pod ním", () => {
    const root = document.createElement("div");
    const mapButton = document.createElement("button");
    mapButton.dataset.districtId = "district:1";
    let districtClickedUnderBackdrop = false;
    root.addEventListener("click", () => {
      districtClickedUnderBackdrop = true;
    });

    root.append(mapButton);
    const backdrop = createOverlayBackdrop({ mount: root });
    openOverlay("district_sheet");
    backdrop.sync();

    backdrop.element.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    expect(districtClickedUnderBackdrop).toBe(false);
    expect(backdrop.element.hidden).toBe(true);
  });

  it("tap uvnitř sheetu backdrop nezavře", () => {
    const root = document.createElement("div");
    const sheet = document.createElement("section");
    sheet.style.position = "fixed";
    sheet.style.zIndex = "3";
    sheet.style.top = "0";
    sheet.style.left = "0";
    sheet.style.right = "0";
    sheet.style.bottom = "0";
    root.append(sheet);

    const backdrop = createOverlayBackdrop({ mount: root });
    openOverlay("district_sheet");
    backdrop.sync();

    expect(isOverlayOpen()).toBe(true);
    sheet.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
    expect(isOverlayOpen()).toBe(true);
    expect(getTopOverlay()).toBe("district_sheet");
  });

  it("otevření prvního overlaye zamkne body na aktuální scroll pozici", () => {
    const initialScrollY = 77;
    setWindowScrollY(initialScrollY);

    openOverlay("district_sheet");

    expect(document.body.dataset.overlayScrollLocked).toBe("true");
    expect(document.documentElement.classList.contains("game-modal-scroll-locked")).toBe(true);
    expect(document.body.classList.contains("game-modal-scroll-locked")).toBe(true);
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe(`-${initialScrollY}px`);
    expect(document.body.style.left).toBe("0px");
    expect(document.body.style.right).toBe("0px");
    expect(document.body.style.width).toBe("100%");
    expect(window.scrollY).toBe(initialScrollY);
  });

  it("mobile overlay lock drží fixed body na aktuální layout šířce bez desktop gutter kompenzace", () => {
    const originalMatchMedia = window.matchMedia;
    const originalInnerWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");
    const originalClientWidth = Object.getOwnPropertyDescriptor(document.documentElement, "clientWidth");

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        media: "(max-width: 720px)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 393
    });
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 360
    });

    try {
      openOverlay("district_sheet");

      expect(document.body.dataset.overlayScrollLocked).toBe("true");
      expect(document.body.style.position).toBe("fixed");
      expect(document.body.style.width).toBe("360px");
      expect(document.body.style.paddingRight).toBe("");
      expect(document.documentElement.style.getPropertyValue("scrollbar-gutter")).toBe("");

      closeOverlay("close mobile overlay");
      expect(document.body.dataset.overlayScrollLocked).toBeUndefined();
      expect(document.body.style.width).toBe("");
    } finally {
      if (originalMatchMedia) {
        Object.defineProperty(window, "matchMedia", {
          configurable: true,
          value: originalMatchMedia
        });
      } else {
        delete (window as Partial<Window>).matchMedia;
      }
      if (originalInnerWidth) {
        Object.defineProperty(window, "innerWidth", originalInnerWidth);
      }
      if (originalClientWidth) {
        Object.defineProperty(document.documentElement, "clientWidth", originalClientWidth);
      } else {
        Reflect.deleteProperty(document.documentElement, "clientWidth");
      }
    }
  });

  it("zavření posledního overlaye obnoví scrollY bez přepisování style", () => {
    const originalBodyStyles = captureBodyStyles();
    const initialScrollY = 141;
    setWindowScrollY(initialScrollY);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    openOverlay("district_sheet");
    closeOverlay("close overlay");

    expect(scrollTo).toHaveBeenCalledWith({ top: initialScrollY, left: 0, behavior: "auto" });
    expect(document.body.dataset.overlayScrollLocked).toBeUndefined();
    expect(document.body.style.position).toBe(originalBodyStyles.position);
    expect(document.body.style.top).toBe(originalBodyStyles.top);
    expect(document.body.style.left).toBe(originalBodyStyles.left);
    expect(document.body.style.right).toBe(originalBodyStyles.right);
    expect(document.body.style.width).toBe(originalBodyStyles.width);
  });

  it("dva overlaye drží scroll lock do odemknutí posledního", () => {
    const initialScrollY = 64;
    setWindowScrollY(initialScrollY);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    openOverlay("district_sheet");
    openOverlay("confirmation_modal");

    expect(document.body.dataset.overlayScrollLocked).toBe("true");
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe(`-${initialScrollY}px`);

    closeOverlay("close top");
    expect(scrollTo).not.toHaveBeenCalled();
    expect(document.body.dataset.overlayScrollLocked).toBe("true");
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe(`-${initialScrollY}px`);

    closeOverlay("close bottom");
    expect(scrollTo).toHaveBeenCalledWith({ top: initialScrollY, left: 0, behavior: "auto" });
    expect(document.body.dataset.overlayScrollLocked).toBeUndefined();
    expect(document.body.style.position).toBe("");
    expect(document.body.style.top).toBe("");
    expect(document.body.style.left).toBe("");
    expect(document.body.style.right).toBe("");
    expect(document.body.style.width).toBe("");
  });

  it("compat modal lock uses the same stack without popping an unrelated top overlay", () => {
    const initialScrollY = 92;
    setWindowScrollY(initialScrollY);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    expect(lockModalScroll()).toBe(true);
    openOverlay("district_sheet");

    expect(getTopOverlay()).toBe("district_sheet");
    expect(document.body.dataset.overlayScrollLocked).toBe("true");
    expect(unlockModalScroll()).toBe(true);

    expect(getTopOverlay()).toBe("district_sheet");
    expect(isOverlayOpen()).toBe(true);
    expect(document.body.dataset.overlayScrollLocked).toBe("true");
    expect(scrollTo).not.toHaveBeenCalled();

    closeOverlay("close district sheet");

    expect(isOverlayOpen()).toBe(false);
    expect(document.body.dataset.overlayScrollLocked).toBeUndefined();
    expect(scrollTo).toHaveBeenCalledWith({ top: initialScrollY, left: 0, behavior: "auto" });
  });
});
