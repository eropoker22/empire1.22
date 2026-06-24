/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOverlayBackdrop } from "../../../apps/client/src/modals/overlay-backdrop";
import { closeOverlay, getTopOverlay, isOverlayOpen, openOverlay } from "../../../apps/client/src/modals/overlay-state";

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
  afterEach(() => {
    while (isOverlayOpen()) {
      closeOverlay("test:cleanup");
    }

    vi.restoreAllMocks();
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
    expect(backdrop.element.hidden).toBe(false);
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

  it("otevření prvního overlaye nezmění scrollY a zamkne body", () => {
    const initialScrollY = 77;
    setWindowScrollY(initialScrollY);

    openOverlay("district_sheet");

    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe(`-${initialScrollY}px`);
    expect(document.body.style.left).toBe("0");
    expect(document.body.style.right).toBe("0");
    expect(document.body.style.width).toBe("100%");
    expect(window.scrollY).toBe(initialScrollY);
  });

  it("zavření posledního overlaye obnoví scrollY a původní style", () => {
    const originalBodyStyles = captureBodyStyles();
    const initialScrollY = 141;
    setWindowScrollY(initialScrollY);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    openOverlay("district_sheet");
    closeOverlay("close overlay");

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, initialScrollY);
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

    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe(`-${initialScrollY}px`);

    closeOverlay("close top");
    expect(scrollTo).not.toHaveBeenCalled();
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe(`-${initialScrollY}px`);

    closeOverlay("close bottom");
    expect(scrollTo).toHaveBeenCalledWith(0, initialScrollY);
    expect(document.body.style.position).toBe("");
    expect(document.body.style.top).toBe("");
    expect(document.body.style.left).toBe("");
    expect(document.body.style.right).toBe("");
    expect(document.body.style.width).toBe("");
  });
});
