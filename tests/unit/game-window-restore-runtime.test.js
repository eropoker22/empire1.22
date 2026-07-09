// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const modulePath = "../../page-assets/js/app/game-window-restore-runtime.js";

const definitions = Object.freeze([
  {
    id: "storage",
    openSelector: "[data-storage-popup-open]",
    closeSelector: "[data-storage-popup-close]",
    windowSelector: "[data-storage-popup]"
  }
]);

function createShell() {
  document.body.innerHTML = `
    <button type="button" data-storage-popup-open>SKLAD</button>
    <main id="game-root" data-page="game"></main>
    <div data-storage-popup hidden class="hidden">
      <button type="button" data-storage-popup-close>Zavřít</button>
    </div>
  `;

  const openButton = document.querySelector("[data-storage-popup-open]");
  const closeButton = document.querySelector("[data-storage-popup-close]");
  const popup = document.querySelector("[data-storage-popup]");

  openButton.addEventListener("click", () => {
    popup.hidden = false;
    popup.classList.remove("hidden");
  });
  closeButton.addEventListener("click", () => {
    popup.hidden = true;
    popup.classList.add("hidden");
  });

  return {
    root: document.querySelector("#game-root"),
    openButton,
    closeButton,
    popup
  };
}

function createBuildingsShell() {
  document.body.innerHTML = `
    <main id="game-root" data-page="game">
      <button type="button" data-buildings-popup-open>Budovy</button>
      <div data-buildings-popup hidden class="hidden">
        <button type="button" data-buildings-popup-close>Zavřít</button>
      </div>
    </main>
  `;

  const openButton = document.querySelector("[data-buildings-popup-open]");
  const popup = document.querySelector("[data-buildings-popup]");
  openButton.addEventListener("click", () => {
    popup.hidden = false;
    popup.classList.remove("hidden");
  });

  return {
    root: document.querySelector("#game-root"),
    openButton,
    popup
  };
}

describe("game window restore runtime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    window.sessionStorage.clear();
    document.body.innerHTML = "";
  });

  it("keeps the last opened game window even after it is closed", async () => {
    const { initGameWindowRestoreRuntime } = await import(modulePath);
    const { root, openButton, closeButton } = createShell();

    initGameWindowRestoreRuntime({ root, windowRef: window, definitions });
    openButton.click();

    expect(window.sessionStorage.getItem("empire:game:last-open-window:v1")).toContain('"id":"storage"');

    closeButton.click();

    expect(window.sessionStorage.getItem("empire:game:last-open-window:v1")).toContain('"id":"storage"');
  });

  it("keeps the stored window closed after reload bootstrap", async () => {
    const { initGameWindowRestoreRuntime } = await import(modulePath);
    const { root, openButton, popup } = createShell();
    const clickSpy = vi.spyOn(openButton, "click");
    window.sessionStorage.setItem("empire:game:last-open-window:v1", JSON.stringify({
      id: "storage",
      savedAt: Date.now()
    }));

    initGameWindowRestoreRuntime({ root, windowRef: window, definitions });
    vi.advanceTimersByTime(160);

    expect(clickSpy).not.toHaveBeenCalled();
    expect(popup.hidden).toBe(true);
    expect(window.sessionStorage.getItem("empire:game:last-open-window:v1")).toContain('"id":"storage"');
  });

  it("does not reopen the buildings card after game.html refresh", async () => {
    const { GAME_WINDOW_RESTORE_DEFINITIONS, initGameWindowRestoreRuntime } = await import(modulePath);
    const { root, openButton, popup } = createBuildingsShell();
    const clickSpy = vi.spyOn(openButton, "click");
    window.sessionStorage.setItem("empire:game:last-open-window:v1", JSON.stringify({
      id: "buildings",
      savedAt: Date.now()
    }));

    initGameWindowRestoreRuntime({ root, windowRef: window, definitions: GAME_WINDOW_RESTORE_DEFINITIONS });
    vi.advanceTimersByTime(160);

    expect(clickSpy).not.toHaveBeenCalled();
    expect(popup.hidden).toBe(true);
    expect(window.sessionStorage.getItem("empire:game:last-open-window:v1")).toContain('"id":"buildings"');
  });

  it("keeps a concrete district building detail stored without reopening it", async () => {
    const { initGameWindowRestoreRuntime } = await import(modulePath);
    const { root } = createShell();
    const openBuildingDetail = vi.fn(() => true);
    window.EmpireRuntime = { openBuildingDetail };

    initGameWindowRestoreRuntime({ root, windowRef: window, definitions });
    document.dispatchEvent(new CustomEvent("empire:building-opened", {
      detail: {
        districtId: 9,
        buildingName: "Klinika",
        displayName: "Klinika"
      }
    }));

    expect(window.sessionStorage.getItem("empire:game:last-open-window:v1")).toContain('"id":"building-detail"');

    document.body.innerHTML = "";
    const nextShell = createShell();
    initGameWindowRestoreRuntime({ root: nextShell.root, windowRef: window, definitions });
    vi.advanceTimersByTime(160);

    expect(openBuildingDetail).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("empire:game:last-open-window:v1")).toContain('"id":"building-detail"');
    expect(window.sessionStorage.getItem("empire:game:last-open-window:v1")).toContain('"buildingName":"Klinika"');
  });
});
