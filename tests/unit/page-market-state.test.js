import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultPreviewSession,
  getAuthoritySession,
  updateStoredPreviewSession
} from "../../page-assets/js/app/model/authority-state.js";

const SESSION_STORAGE_KEY = "empireStreets.session.v1";

const createLocalStorage = () => {
  const store = new Map();

  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
};

describe("page market state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T10:00:00.000Z"));
    globalThis.window = { localStorage: createLocalStorage() };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.window;
  });

  it("keeps market prices scoped to the selected server", () => {
    const baseSession = createDefaultPreviewSession();

    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        ...baseSession,
        registration: {
          serverId: "war-eu-01",
          serverLabel: "Vortex City WAR-01"
        },
        market: {
          ...baseSession.market,
          serverId: "war-eu-01",
          playerListings: [
            {
              id: "listing-war-chemicals",
              sellerId: "seller:war",
              sellerName: "War Dealer",
              inventory: "materials",
              itemId: "chemicals",
              itemName: "Chemicals",
              amount: 4,
              unitPrice: 420,
              currency: "cleanMoney",
              createdAt: Date.now(),
              expiresAt: Date.now() + 600000
            }
          ],
          items: {
            ...baseSession.market.items,
            "market:chemicals": {
              price: 111,
              previousPrice: 100
            }
          }
        }
      })
    );

    expect(getAuthoritySession().market.serverId).toBe("war-eu-01");
    expect(getAuthoritySession().market.items["market:chemicals"].price).toBe(111);

    updateStoredPreviewSession((session) => ({
      ...session,
      registration: {
        ...session.registration,
        serverId: "free-eu-01",
        serverLabel: "Neon Drift FREE-01"
      }
    }));

    const session = getAuthoritySession();

    expect(session.market.serverId).toBe("free-eu-01");
    expect(session.market.items["market:chemicals"].price).toBe(19);
    expect(session.marketByServerId["war-eu-01"].items["market:chemicals"].price).toBe(111);
    expect(session.marketByServerId["war-eu-01"].playerListings).toHaveLength(1);
  });
});
