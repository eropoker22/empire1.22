// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import {
  bindDistrictAtmosphereWindowControls,
  hideDistrictPopupModal,
  showDistrictPopupModal
} from "../../page-assets/js/app/ui/districtPopupModalHelpers.js";
import { setElementHtml } from "../../page-assets/js/app/ui/districtPopupElements.js";
import {
  closeOverlay,
  getTopOverlay,
  openOverlay
} from "../../page-assets/js/app/ui/legacyOverlayCoordinator.js";

function createElement() {
  const listeners = new Map();
  return {
    hidden: true,
    dataset: {},
    attrs: new Map(),
    addEventListener: vi.fn((type, handler) => {
      listeners.set(type, handler);
    }),
    dispatch(type, event = {}) {
      listeners.get(type)?.(event);
    },
    removeAttribute(name) {
      if (name === "hidden") {
        this.hidden = false;
      }
      this.attrs.delete(name);
    },
    setAttribute(name, value) {
      if (name === "hidden") {
        this.hidden = true;
      }
      this.attrs.set(name, value);
    }
  };
}

describe("district popup modal helpers", () => {
  it("renders helper HTML values as escaped text", () => {
    const element = { innerHTML: "" };

    expect(setElementHtml(element, "<img src=x onerror=alert(1)> & 'district'")).toBe(true);
    expect(element.innerHTML).toBe("&lt;img src=x onerror=alert(1)&gt; &amp; &#39;district&#39;");
  });

  it("keeps atmosphere window clicks from bubbling back to the hero trigger", () => {
    const trigger = createElement();
    const windowElement = createElement();
    const closeButton = createElement();
    trigger.dataset.atmosphereState = "revealed";

    const boundCount = bindDistrictAtmosphereWindowControls({ trigger, windowElement, closeButton });

    expect(boundCount).toBe(4);
    const openClick = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };
    trigger.dispatch("click", openClick);
    expect(windowElement.hidden).toBe(false);
    expect(trigger.attrs.get("aria-expanded")).toBe("true");
    expect(openClick.preventDefault).toHaveBeenCalledTimes(1);
    expect(openClick.stopPropagation).toHaveBeenCalledTimes(1);

    const innerClick = { stopPropagation: vi.fn() };
    windowElement.dispatch("click", innerClick);

    expect(innerClick.stopPropagation).toHaveBeenCalledTimes(1);
    expect(windowElement.hidden).toBe(false);
    expect(trigger.attrs.get("aria-expanded")).toBe("true");

    const closeClick = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };
    closeButton.dispatch("click", closeClick);

    expect(closeClick.preventDefault).toHaveBeenCalledTimes(1);
    expect(closeClick.stopPropagation).toHaveBeenCalledTimes(1);
    expect(windowElement.hidden).toBe(true);
    expect(trigger.attrs.get("aria-expanded")).toBe("false");
  });

  it("opens the atmosphere window for locked sectors so the blackout image is visible", () => {
    const trigger = createElement();
    const windowElement = createElement();
    trigger.dataset.atmosphereState = "locked";

    bindDistrictAtmosphereWindowControls({ trigger, windowElement });

    const openClick = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    };
    trigger.dispatch("click", openClick);

    expect(windowElement.hidden).toBe(false);
    expect(trigger.attrs.get("aria-expanded")).toBe("true");
    expect(openClick.preventDefault).toHaveBeenCalledTimes(1);
    expect(openClick.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it("does not move a refreshed district sheet above its active action modal", () => {
    const districtPopup = document.createElement("div");
    const actionModal = document.createElement("div");
    districtPopup.setAttribute("data-district-popup", "");
    document.body.append(districtPopup, actionModal);

    showDistrictPopupModal(districtPopup);
    openOverlay(actionModal, { skipFocus: true });
    showDistrictPopupModal(districtPopup);

    expect(getTopOverlay()?.element).toBe(actionModal);

    actionModal.hidden = true;
    closeOverlay(actionModal, { restoreFocus: false, suppressMapInput: false });
    hideDistrictPopupModal(districtPopup);
    document.body.innerHTML = "";
  });
});
