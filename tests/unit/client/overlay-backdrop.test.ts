/* @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { createOverlayBackdrop } from "../../../apps/client/src/modals/overlay-backdrop";
import { closeOverlay, getTopOverlay, isOverlayOpen, openOverlay } from "../../../apps/client/src/modals/overlay-state";

describe("overlay backdrop", () => {
  afterEach(() => {
    while (isOverlayOpen()) {
      closeOverlay("test:cleanup");
    }
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
});
