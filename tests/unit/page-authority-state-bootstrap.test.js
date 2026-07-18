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

  it("preserves discovered districts, ownership, and active production across reloads", async () => {
    const authorityState = await import("../../page-assets/js/app/model/authority-state.js");
    const productionJob = {
      version: 2,
      recipeId: "druglab:meth",
      queuedAmount: 2,
      producedAmount: 0,
      isProducing: true,
      readyAtMs: 1_800_000,
      lastProgressAtMs: 1_700_000
    };

    authorityState.updateStoredPreviewSession((session) => ({
      ...session,
      missions: {
        ...session.missions,
        occupyOrders: [{ id: "occupy:12", targetDistrictId: 12, resolveAt: "2026-07-18T12:30:00.000Z" }],
        spy: {
          ...session.missions.spy,
          missions: [{ id: "spy:19", targetDistrictId: 19, returnAt: "2026-07-18T12:20:00.000Z" }]
        },
        spyIntel: {
          occupiableDistrictIds: [19],
          revealedTypeDistrictIds: [19],
          revealedDefenseDistrictIds: [19]
        }
      },
      production: {
        ...session.production,
        jobs: { "druglab:meth": productionJob }
      },
      world: {
        ...session.world,
        ownedDistrictIds: [4, 12]
      }
    }));

    vi.resetModules();
    const reloadedAuthorityState = await import("../../page-assets/js/app/model/authority-state.js");
    const restored = reloadedAuthorityState.getStoredPreviewSession();

    expect(restored.missions.spyIntel).toMatchObject({
      occupiableDistrictIds: [19],
      revealedTypeDistrictIds: [19],
      revealedDefenseDistrictIds: [19]
    });
    expect(restored.missions.occupyOrders).toEqual([
      expect.objectContaining({ id: "occupy:12", targetDistrictId: 12 })
    ]);
    expect(restored.world.ownedDistrictIds).toEqual([4, 12]);
    expect(restored.production.jobs["druglab:meth"]).toMatchObject(productionJob);
  });

  it("migrates legacy Factory slots and supplies to canonical jobs exactly once", async () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      inventory: {
        materials: { "metal-parts": 3 },
        factorySupplies: { metalParts: 7, techCore: 4, combatModule: 2 }
      },
      production: {
        jobs: {},
        factory: {
          level: 3,
          resources: { metalParts: 2, techCore: 0, combatModule: 0 },
          slots: [{
            id: 1,
            resourceKey: "metalParts",
            queuedAmount: 3,
            producedAmount: 2,
            productionRemainder: 0.5,
            reservedCleanCash: 900,
            reservedInputs: {},
            isProducing: true,
            lastTick: 1_000,
            slotCap: 10,
            queueCap: 8
          }]
        }
      }
    }));

    const authorityState = await import("../../page-assets/js/app/model/authority-state.js");
    const migrated = authorityState.getStoredPreviewSession();
    expect(migrated.inventory.materials).toMatchObject({
      "metal-parts": 7,
      "tech-core": 4,
      "combat-module": 2
    });
    expect(migrated.inventory.factorySupplies).toBeUndefined();
    expect(migrated.production.factory).toBeUndefined();
    expect(migrated.production.jobs["factory:metal-parts"]).toMatchObject({
      queuedAmount: 3,
      producedAmount: 2,
      cleanMoneyCost: 900,
      lastProgressAtMs: 1_000,
      activeWorkRemainingMs: 120_000
    });
    expect(migrated.production.jobs["factory:metal-parts"].reservationUnits).toHaveLength(3);

    authorityState.setStoredPreviewSession(migrated);
    const restored = authorityState.getStoredPreviewSession();
    expect(restored.production.jobs["factory:metal-parts"]).toEqual(migrated.production.jobs["factory:metal-parts"]);
    expect(restored.inventory.materials["metal-parts"]).toBe(7);
  });
});
