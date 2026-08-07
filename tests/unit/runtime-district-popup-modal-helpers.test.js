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

  it("keeps only one close control available while the atmosphere image is open", () => {
    const card = document.createElement("div");
    const popupClose = document.createElement("button");
    const windowElement = document.createElement("aside");
    card.setAttribute("data-district-popup-card", "");
    popupClose.className = "district-popup-close";
    windowElement.setAttribute("data-district-atmosphere-window", "");
    windowElement.hidden = true;
    card.append(popupClose, windowElement);
    document.body.append(card);

    showDistrictPopupModal(windowElement);

    expect(card.dataset.districtAtmosphereOpen).toBe("true");
    expect(popupClose.hidden).toBe(true);
    expect(popupClose.disabled).toBe(true);
    expect(popupClose.getAttribute("aria-hidden")).toBe("true");

    hideDistrictPopupModal(windowElement, { suppressMapInput: false });

    expect(card.dataset.districtAtmosphereOpen).toBeUndefined();
    expect(popupClose.hidden).toBe(false);
    expect(popupClose.disabled).toBe(false);
    expect(popupClose.hasAttribute("aria-hidden")).toBe(false);
    document.body.innerHTML = "";
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

  it("enables district building pointer input only after the entry animation settles", async () => {
    const districtPopup = document.createElement("div");
    const card = document.createElement("div");
    let finishAnimation;
    const finished = new Promise((resolve) => {
      finishAnimation = resolve;
    });
    districtPopup.hidden = true;
    districtPopup.setAttribute("data-district-popup", "");
    card.setAttribute("data-district-popup-card", "");
    card.getAnimations = vi.fn(() => [{
      effect: {
        getComputedTiming: () => ({ endTime: 320 })
      },
      finished,
      playState: "running"
    }]);
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback();
        return 1;
      });
    districtPopup.append(card);
    document.body.append(districtPopup);

    showDistrictPopupModal(districtPopup);

    expect(districtPopup.dataset.districtPopupInteractionReady).toBe("entering");
    expect(card.style.pointerEvents).toBe("none");
    expect(card.getAnimations).toHaveBeenCalledWith({ subtree: true });

    finishAnimation();
    await finished;
    await Promise.resolve();

    expect(districtPopup.dataset.districtPopupInteractionReady).toBe("ready");
    expect(card.style.pointerEvents).toBe("");

    hideDistrictPopupModal(districtPopup, { suppressMapInput: false });
    requestAnimationFrame.mockRestore();
    document.body.innerHTML = "";
  });

  it("does not let a stale entry animation unlock a reopened district popup", async () => {
    const districtPopup = document.createElement("div");
    const card = document.createElement("div");
    const animationResolvers = [];
    const animationPromises = [0, 1].map(() => new Promise((resolve) => {
      animationResolvers.push(resolve);
    }));
    let animationIndex = 0;
    districtPopup.hidden = true;
    districtPopup.setAttribute("data-district-popup", "");
    card.setAttribute("data-district-popup-card", "");
    card.getAnimations = vi.fn(() => [{
      effect: {
        getComputedTiming: () => ({ endTime: 320 })
      },
      finished: animationPromises[animationIndex++],
      playState: "running"
    }]);
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback();
        return 1;
      });
    districtPopup.append(card);
    document.body.append(districtPopup);

    showDistrictPopupModal(districtPopup);
    hideDistrictPopupModal(districtPopup, { suppressMapInput: false });
    showDistrictPopupModal(districtPopup);

    animationResolvers[0]();
    await animationPromises[0];
    await Promise.resolve();
    expect(districtPopup.dataset.districtPopupInteractionReady).toBe("entering");
    expect(card.style.pointerEvents).toBe("none");

    animationResolvers[1]();
    await animationPromises[1];
    await Promise.resolve();
    expect(districtPopup.dataset.districtPopupInteractionReady).toBe("ready");
    expect(card.style.pointerEvents).toBe("");

    hideDistrictPopupModal(districtPopup, { suppressMapInput: false });
    requestAnimationFrame.mockRestore();
    document.body.innerHTML = "";
  });

  it("allows an intentional handoff from a district sheet to a building modal", () => {
    const districtPopup = document.createElement("div");
    const buildingModal = document.createElement("div");
    const buildingTrigger = document.createElement("button");
    districtPopup.setAttribute("data-district-popup", "");
    buildingModal.hidden = true;
    buildingTrigger.addEventListener("click", () => {
      openOverlay(buildingModal, { skipFocus: true });
    });
    document.body.append(districtPopup, buildingModal, buildingTrigger);

    showDistrictPopupModal(districtPopup);
    hideDistrictPopupModal(districtPopup, { suppressMapInput: false });
    buildingTrigger.click();

    expect(buildingModal.hidden).toBe(false);
    expect(getTopOverlay()?.element).toBe(buildingModal);

    buildingModal.hidden = true;
    closeOverlay(buildingModal, { restoreFocus: false, suppressMapInput: false });
    document.body.innerHTML = "";
  });

  it("preserves the authoritative district selection during a building handoff", () => {
    const districtPopup = document.createElement("div");
    districtPopup.setAttribute("data-district-popup", "");
    const closed = vi.fn();
    document.addEventListener("empire:district-closed", closed);
    document.body.append(districtPopup);

    showDistrictPopupModal(districtPopup);
    hideDistrictPopupModal(districtPopup, {
      preserveDistrictSelection: true,
      suppressMapInput: false
    });

    expect(districtPopup.hidden).toBe(true);
    expect(districtPopup.dataset.districtPopupHandoff).toBe("building-detail");
    expect(closed).not.toHaveBeenCalled();

    showDistrictPopupModal(districtPopup);
    expect(districtPopup.dataset.districtPopupHandoff).toBeUndefined();

    document.removeEventListener("empire:district-closed", closed);
    hideDistrictPopupModal(districtPopup, { suppressMapInput: false });
    document.body.innerHTML = "";
  });
});
