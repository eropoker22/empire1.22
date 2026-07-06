import { describe, expect, it } from "vitest";
import { createAuthoritySessionAccessors } from "../../page-assets/js/app/runtime/authoritySessionAccessors.js";

function createSession() {
  return {
    inventory: { weapons: {}, materials: null, drugs: null },
    production: { jobs: null },
    economy: null,
    missions: {
      attackOrders: [{ id: "a" }],
      occupyOrders: null,
      robberyOrders: [{ id: "r" }],
      spy: {
        available: 1,
        missions: [
          { id: "active", returnAt: new Date(Date.now() + 60_000).toISOString() },
          { id: "expired-captured", status: "captured", cooldownUntil: new Date(Date.now() - 1_000).toISOString() }
        ]
      },
      spyIntel: { occupiableDistrictIds: ["2"], revealedTypeDistrictIds: ["3"], revealedDefenseDistrictIds: ["4"] }
    }
  };
}

describe("authority session accessors", () => {
  it("normalizes inventory, economy, and spy state through injected storage", () => {
    let session = createSession();
    const events = [];
    const api = createAuthoritySessionAccessors({
      clamp: (value, min, max) => Math.min(Math.max(value, min), max),
      defaultDrugInventory: { neon: 1 },
      defaultMaterialInventory: { chemicals: 2 },
      defaultWeaponInventory: { pistol: 1 },
      documentRef: { dispatchEvent: (event) => events.push(event.type) },
      CustomEventCtor: class FakeCustomEvent {
        constructor(type) {
          this.type = type;
        }
      },
      defaultEconomyState: { cleanMoney: 10, dirtyMoney: 20 },
      factionCatalog: { mafian: {} },
      factionWeaponPresets: { mafian: { pistol: 3 } },
      getAuthoritySession: () => session,
      getStoredRegistration: () => ({ factionId: "mafian" }),
      maxSpies: 3,
      updateStoredPreviewSession: (updater) => {
        session = updater(session);
      }
    });

    expect(api.getResolvedMaterialInventory()).toEqual({ chemicals: 2 });
    expect(api.getResolvedDrugInventory()).toEqual({ neon: 1 });
    expect(api.getResolvedEconomyState()).toEqual({ cleanMoney: 10, dirtyMoney: 20 });
    expect(events).toContain("empire:economy-state-changed");
    expect(api.getResolvedSpyState()).toEqual({
      available: 2,
      missions: [expect.objectContaining({ id: "active" })]
    });
    expect(api.getResolvedSpyIntel()).toEqual({
      occupiableDistrictIds: [2],
      revealedTypeDistrictIds: [3],
      revealedDefenseDistrictIds: [4]
    });
    expect(api.createWeaponInventoryFromFaction("mafian")).toEqual({ pistol: 1 });
  });

  it("resets a district spy mission and successful spy intel without touching other districts", () => {
    let session = createSession();
    session = {
      ...session,
      missions: {
        ...session.missions,
        spy: {
          available: 0,
          missions: [
            { id: "target-number", targetDistrictId: 2, returnAt: new Date(Date.now() + 60_000).toISOString() },
            { id: "target-string", targetDistrictId: "district:2", returnAt: new Date(Date.now() + 60_000).toISOString() },
            { id: "other", targetDistrictId: 3, returnAt: new Date(Date.now() + 60_000).toISOString() }
          ]
        },
        spyIntel: {
          occupiableDistrictIds: ["district:2", 3],
          revealedTypeDistrictIds: [2, 4],
          revealedDefenseDistrictIds: ["2", 5]
        }
      }
    };
    const api = createAuthoritySessionAccessors({
      clamp: (value, min, max) => Math.min(Math.max(value, min), max),
      defaultDrugInventory: { neon: 1 },
      defaultMaterialInventory: { chemicals: 2 },
      defaultWeaponInventory: { pistol: 1 },
      getAuthoritySession: () => session,
      maxSpies: 3,
      updateStoredPreviewSession: (updater) => {
        session = updater(session);
      }
    });

    expect(api.resetSpyDistrictState(2)).toEqual({
      changed: true,
      removedMissionIds: ["target-number", "target-string"],
      spyIntelChanged: true,
      spyStateChanged: true,
      targetDistrictId: 2
    });
    expect(api.getResolvedSpyState()).toEqual({
      available: 2,
      missions: [expect.objectContaining({ id: "other", targetDistrictId: 3 })]
    });
    expect(api.getResolvedSpyIntel()).toEqual({
      occupiableDistrictIds: [3],
      revealedTypeDistrictIds: [4],
      revealedDefenseDistrictIds: [5]
    });
    expect(api.resetSpyDistrictState(2)).toEqual({
      changed: false,
      removedMissionIds: [],
      spyIntelChanged: false,
      spyStateChanged: false,
      targetDistrictId: 2
    });
  });
});
