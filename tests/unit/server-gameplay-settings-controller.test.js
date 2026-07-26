// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createServerGameplaySettingsController
} from "../../page-assets/js/app/ui/serverGameplaySettingsController.js";

describe("server gameplay settings controller", () => {
  beforeEach(() => {
    document.body.innerHTML = createFixture();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.className = "";
    vi.restoreAllMocks();
  });

  it("uses the isolated preference store without legacy gameplay persistence", () => {
    const source = readFileSync(resolve(
      process.cwd(),
      "page-assets/js/app/ui/serverGameplaySettingsController.js"
    ), "utf8");
    expect(source).toContain("settingsPreferenceStorage.js");
    expect(source).not.toMatch(/legacyStorage|runtime\.js/u);
  });

  it("mounts once, previews local preferences, and reverts an unsaved close", () => {
    const settingsRuntime = createSettingsRuntime();
    const controller = createController(settingsRuntime);
    const openButton = document.querySelector("[data-nav-settings]");
    const addListener = vi.spyOn(openButton, "addEventListener");

    expect(controller.mount()).toBe(true);
    expect(controller.mount()).toBe(false);
    expect(addListener.mock.calls.filter(([type]) => type === "click")).toHaveLength(1);

    expect(controller.open()).toBe(true);
    const modal = document.querySelector("#settings-modal");
    const borders = document.querySelector("#settings-map-district-borders");
    expect(modal.hidden).toBe(false);
    expect(borders.checked).toBe(true);

    borders.checked = false;
    borders.dispatchEvent(new Event("change", { bubbles: true }));

    expect(settingsRuntime.applySettingsState).toHaveBeenCalledTimes(1);
    expect(settingsRuntime.getCurrent()).toMatchObject({
      mapDistrictBorders: false
    });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(modal.hidden).toBe(true);
    expect(settingsRuntime.applySettingsState).toHaveBeenCalledTimes(2);
    expect(settingsRuntime.getCurrent()).toEqual(DEFAULT_SETTINGS);
    expect(controller.destroy()).toBe(true);
  });

  it("saves edited preferences without rolling them back on close", () => {
    const settingsRuntime = createSettingsRuntime();
    const controller = createController(settingsRuntime);
    controller.mount();
    controller.open();

    const language = document.querySelector("#settings-language");
    const visibility = document.querySelector("#settings-map-visibility");
    language.value = "en";
    language.dispatchEvent(new Event("change", { bubbles: true }));
    visibility.value = "only-player";
    visibility.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("#settings-save-btn").click();

    expect(document.querySelector("#settings-modal").hidden).toBe(true);
    expect(settingsRuntime.getCurrent()).toEqual({
      ...DEFAULT_SETTINGS,
      language: "en",
      mapVisibilityMode: "only-player"
    });
    expect(controller.getSettings()).toEqual(settingsRuntime.getCurrent());
    expect(controller.destroy()).toBe(true);
  });

  it("reverts an open preview during destroy and removes every listener", () => {
    const settingsRuntime = createSettingsRuntime();
    const controller = createController(settingsRuntime);
    const openButton = document.querySelector("[data-nav-settings]");
    const removeListener = vi.spyOn(openButton, "removeEventListener");
    const modal = document.querySelector("#settings-modal");
    controller.mount();
    controller.open();

    const allianceSymbols = document.querySelector("#settings-map-alliance-symbols");
    allianceSymbols.checked = false;
    allianceSymbols.dispatchEvent(new Event("change", { bubbles: true }));
    expect(settingsRuntime.getCurrent().mapAllianceSymbols).toBe(false);

    expect(controller.destroy()).toBe(true);
    expect(controller.destroy()).toBe(false);
    expect(modal.hidden).toBe(true);
    expect(settingsRuntime.getCurrent()).toEqual(DEFAULT_SETTINGS);
    expect(removeListener.mock.calls.filter(([type]) => type === "click")).toHaveLength(1);

    const applyCountAfterDestroy = settingsRuntime.applySettingsState.mock.calls.length;
    expect(controller.open()).toBe(false);
    allianceSymbols.checked = false;
    allianceSymbols.dispatchEvent(new Event("change", { bubbles: true }));

    expect(modal.hidden).toBe(true);
    expect(settingsRuntime.applySettingsState).toHaveBeenCalledTimes(applyCountAfterDestroy);
  });
});

const DEFAULT_SETTINGS = Object.freeze({
  mapDistrictBorders: true,
  mapAllianceSymbols: true,
  mapVisibilityMode: "all",
  language: "cs"
});

function createSettingsRuntime(initialSettings = DEFAULT_SETTINGS) {
  let current = { ...initialSettings };
  return {
    getSettingsState: vi.fn(() => ({ ...current })),
    applySettingsState: vi.fn((settings) => {
      current = { ...settings };
      return { ...current };
    }),
    getCurrent: () => ({ ...current })
  };
}

function createController(settingsRuntime) {
  return createServerGameplaySettingsController({
    root: document.querySelector("#game-root"),
    documentRef: document,
    windowRef: window,
    settingsRuntime,
    managePageLifecycle: false
  });
}

function createFixture() {
  return `<main id="game-root">
    <button type="button" data-nav-settings>Nastavení</button>
    <section id="settings-modal" class="hidden" hidden>
      <button type="button" id="settings-modal-backdrop">Pozadí</button>
      <button type="button" id="settings-modal-close">Zavřít</button>
      <input id="settings-map-district-borders" type="checkbox">
      <input id="settings-map-alliance-symbols" type="checkbox">
      <select id="settings-map-visibility">
        <option value="all">Vše</option>
        <option value="hide-enemies">Skrýt nepřátele</option>
        <option value="only-player">Jen hráč</option>
      </select>
      <select id="settings-language">
        <option value="cs">Čeština</option>
        <option value="en">English</option>
      </select>
      <button type="button" id="settings-save-btn">Uložit</button>
    </section>
  </main>`;
}
