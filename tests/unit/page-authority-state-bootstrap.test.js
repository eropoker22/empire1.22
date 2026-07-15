import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "../../page-assets/js/config.js";

const SESSION_STORAGE_KEY = STORAGE_KEYS.session;

const createLocalStorage = () => {
  const store = new Map();

  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
};

describe("authority state bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.window = { localStorage: createLocalStorage() };
  });

  afterEach(() => {
    delete globalThis.window;
  });

  it("preserves the local-demo session across reloads without resetting economy or city time", async () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      registration: null,
      economy: { cleanMoney: 1234, dirtyMoney: 300 },
      world: {
        phaseState: {
          mapPhase: "day",
          gamePhase: "live",
          cityMinutes: 18 * 60 + 45
        }
      }
    }));

    const authorityState = await import("../../page-assets/js/app/model/authority-state.js");
    const bootSession = authorityState.getStoredPreviewSession();

    expect(bootSession.economy.cleanMoney).toBe(1234);
    expect(bootSession.world.phaseState).toMatchObject({
      mapPhase: "day",
      cityMinutes: 18 * 60 + 45
    });

    authorityState.updateStoredPreviewSession((session) => ({
      ...session,
      economy: {
        ...session.economy,
        cleanMoney: 18000
      },
      world: {
        ...session.world,
        phaseState: {
          ...session.world.phaseState,
          mapPhase: "day",
          cityMinutes: 6 * 60 + 12
        }
      }
    }));

    expect(authorityState.getStoredPreviewSession().economy.cleanMoney).toBe(18000);
    expect(authorityState.getStoredPreviewSession().world.phaseState.cityMinutes).toBe(6 * 60 + 12);

    vi.resetModules();
    const reloadedAuthorityState = await import("../../page-assets/js/app/model/authority-state.js");
    expect(reloadedAuthorityState.getStoredPreviewSession().economy.cleanMoney).toBe(18000);
    expect(reloadedAuthorityState.getStoredPreviewSession().world.phaseState).toMatchObject({
      mapPhase: "day",
      cityMinutes: 6 * 60 + 12
    });
  });
});
