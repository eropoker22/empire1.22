import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEGACY_STORAGE_KEYS,
  clearState,
  getStorageKey,
  loadDemoState,
  loadState,
  saveDemoState,
  saveState
} from "../../page-assets/js/app/persistence/legacyStorage.js";

const createLocalStorage = () => {
  const store = new Map();

  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
};

describe("legacy storage persistence boundary", () => {
  beforeEach(() => {
    globalThis.window = { localStorage: createLocalStorage() };
  });

  afterEach(() => {
    delete globalThis.window;
    vi.restoreAllMocks();
  });

  it("keeps the legacy unscoped state key for default save/load", () => {
    const state = { registration: { identity: "Boss" }, economy: { cleanMoney: 1200 } };

    expect(saveState(null, null, state)).toBe(true);

    expect(window.localStorage.getItem(LEGACY_STORAGE_KEYS.session)).toBe(JSON.stringify(state));
    expect(loadState()).toEqual(state);
  });

  it("roundtrips scoped free and war state without key collisions", () => {
    const freeKey = getStorageKey("free", "free-eu-01");
    const warKey = getStorageKey("war", "war-eu-01");

    expect(freeKey).not.toBe(warKey);

    saveState("free", "free-eu-01", { mode: "free" });
    saveState("war", "war-eu-01", { mode: "war" });

    expect(loadState("free", "free-eu-01")).toEqual({ mode: "free" });
    expect(loadState("war", "war-eu-01")).toEqual({ mode: "war" });
  });

  it("falls back to the legacy session key for old saved state", () => {
    const legacyState = { registration: { serverMode: "free", serverId: "free-eu-01" } };
    window.localStorage.setItem(LEGACY_STORAGE_KEYS.session, JSON.stringify(legacyState));

    expect(loadState("free", "free-eu-01")).toEqual(legacyState);
  });

  it("returns null for missing state and warns instead of throwing on corrupted JSON", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(loadState("free", "free-eu-01")).toBeNull();

    window.localStorage.setItem(getStorageKey("free", "free-eu-01"), "{broken");

    expect(loadState("free", "free-eu-01")).toBeNull();
    expect(consoleWarn).toHaveBeenCalledTimes(1);
  });

  it("clears only the selected scoped key", () => {
    saveState("free", "free-eu-01", { mode: "free" });
    saveState("war", "war-eu-01", { mode: "war" });

    expect(clearState("free", "free-eu-01")).toBe(true);

    expect(loadState("free", "free-eu-01")).toBeNull();
    expect(loadState("war", "war-eu-01")).toEqual({ mode: "war" });
  });

  it("saves and loads demo state through an isolated demo key", () => {
    const demoState = { id: "launch-demo", world: { ownedDistrictIds: [1, 2] } };

    expect(saveDemoState("Launch Demo", demoState)).toBe(true);

    expect(loadDemoState("launch-demo")).toEqual(demoState);
    expect(loadState("free", "free-eu-01")).toBeNull();
  });
});
