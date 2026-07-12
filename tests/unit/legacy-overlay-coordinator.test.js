// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  closeOverlay,
  getTopOverlay,
  openOverlay
} from "../../page-assets/js/app/ui/legacyOverlayCoordinator.js";
import { createRuntimePopupBinders } from "../../page-assets/js/app/ui/runtimePopupBinders.js";

describe("legacy overlay coordinator priority layers", () => {
  let actionOverlay;
  let storageOverlay;

  beforeEach(() => {
    document.body.innerHTML = "";
    actionOverlay = document.createElement("div");
    actionOverlay.style.zIndex = "19000";
    storageOverlay = document.createElement("div");
    storageOverlay.style.zIndex = "50000";
    document.body.append(actionOverlay, storageOverlay);
  });

  afterEach(() => {
    closeOverlay(storageOverlay, { restoreFocus: false, suppressMapInput: false });
    closeOverlay(actionOverlay, { restoreFocus: false, suppressMapInput: false });
    document.body.innerHTML = "";
  });

  it("keeps the priority storage window above a later action overlay", () => {
    openOverlay(storageOverlay, { alwaysOnTop: true, skipFocus: true });
    openOverlay(actionOverlay, { skipFocus: true });

    expect(getTopOverlay()?.element).toBe(storageOverlay);
    expect(actionOverlay.style.zIndex).toBe("19000");
  });

  it("raises storage above an action overlay when storage opens second", () => {
    openOverlay(actionOverlay, { skipFocus: true });
    openOverlay(storageOverlay, { alwaysOnTop: true, skipFocus: true });

    expect(getTopOverlay()?.element).toBe(storageOverlay);
    expect(Number.parseInt(storageOverlay.style.zIndex, 10)).toBeGreaterThan(19000);
  });

  it("moves storage from the game shell to the document layer before opening it", () => {
    const root = document.createElement("main");
    const openButton = document.createElement("button");
    openButton.setAttribute("data-storage-popup-open", "");
    storageOverlay.setAttribute("data-storage-popup", "");
    storageOverlay.hidden = true;
    storageOverlay.classList.add("hidden");
    storageOverlay.innerHTML = '<button data-storage-popup-close type="button">Zavřít</button><div class="storage-popup-card"></div>';
    document.body.append(openButton, root);
    root.append(storageOverlay);

    const binders = createRuntimePopupBinders({
      STORAGE_POPUP_OPEN_SELECTOR: "[data-storage-popup-open]",
      STORAGE_POPUP_SELECTOR: "[data-storage-popup]",
      STORAGE_POPUP_CLOSE_SELECTOR: "[data-storage-popup-close]"
    });
    binders.bindStoragePopup(root);
    openButton.click();

    expect(storageOverlay.parentElement).toBe(document.body);
    expect(storageOverlay.hidden).toBe(false);
  });
});
