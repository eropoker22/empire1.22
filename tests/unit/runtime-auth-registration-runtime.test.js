import { describe, expect, it, vi } from "vitest";
import { createAuthRegistrationRuntime } from "../../page-assets/js/app/runtime/authRegistrationRuntime.js";

function createElement(dataset = {}) {
  const listeners = new Map();

  return {
    dataset,
    disabled: false,
    readOnly: false,
    value: "",
    addEventListener: vi.fn((type, listener) => {
      listeners.set(type, [...(listeners.get(type) || []), listener]);
    }),
    classList: {
      toggle: vi.fn()
    },
    dispatch(type) {
      for (const listener of listeners.get(type) || []) {
        listener({ preventDefault: vi.fn(), type });
      }
    }
  };
}

function createRoot(elements = {}, all = {}) {
  return {
    querySelector: vi.fn((selector) => elements[selector] || null),
    querySelectorAll: vi.fn((selector) => all[selector] || [])
  };
}

function createRuntime(overrides = {}) {
  return createAuthRegistrationRuntime({
    DEFAULT_DRUG_INVENTORY: { meds: 1 },
    DEFAULT_GANG_MEMBERS: 4,
    DEFAULT_MATERIAL_INVENTORY: { metal: 2 },
    FACTION_CATALOG: {
      mafian: {
        name: "Mafian",
        startingPackage: {
          cleanMoney: 100,
          dirtyMoney: 50,
          heat: 3,
          influence: 7
        }
      },
      cartel: {
        name: "Cartel",
        startingPackage: {
          cleanMoney: 80,
          dirtyMoney: 90,
          heat: 8,
          influence: 6
        }
      }
    },
    createCompletedRegistrationStatusViewModel: vi.fn(({ identity }) => ({
      note: `${identity} done`,
      title: "Registrace dokončena"
    })),
    createDefaultMarketPriceState: vi.fn(() => ({ market: true })),
    createExistingRegistrationViewModel: vi.fn(() => ({
      activeFactionId: "mafian",
      identityReadOnly: false,
      identityValue: "",
      locked: false,
      optionsDisabled: false,
      statusNote: "Vyber",
      statusTitle: "Výběr frakce"
    })),
    createFactionPreviewViewModel: vi.fn((faction) => ({ name: faction.name })),
    createLockedRegistrationStatusViewModel: vi.fn(() => ({ note: "locked", title: "Locked" })),
    createWeaponInventoryFromFaction: vi.fn((factionId) => ({ factionId })),
    getStoredRegistration: vi.fn(() => null),
    renderAuthStatus: vi.fn(),
    renderFactionPreviewPanel: vi.fn(),
    selectors: {
      authForm: ".form",
      factionInput: ".faction",
      factionOption: ".option",
      identity: ".identity",
      statusMount: ".status"
    },
    setStoredDrugInventory: vi.fn(),
    setStoredEconomyState: vi.fn(),
    setStoredGangState: vi.fn(),
    setStoredMarketPriceState: vi.fn(),
    setStoredMaterialInventory: vi.fn(),
    setStoredProductionState: vi.fn(),
    setStoredRegistration: vi.fn(),
    setStoredWeaponInventory: vi.fn(),
    ...overrides
  });
}

describe("auth registration runtime", () => {
  it("handles missing registration DOM without crashing", () => {
    expect(createRuntime().bindFactionRegistration(createRoot())).toBe(false);
    expect(createRuntime().bindFactionRegistration(null)).toBe(false);
  });

  it("binds faction selection and submits initial registration through existing state setters", () => {
    const form = createElement();
    const identity = createElement();
    const factionInput = createElement();
    const option = createElement({ factionId: "cartel" });
    const status = createElement();
    identity.value = "Boss";
    const setStoredRegistration = vi.fn();
    const setStoredEconomyState = vi.fn();
    const setStoredGangState = vi.fn();
    const runtime = createRuntime({
      setStoredEconomyState,
      setStoredGangState,
      setStoredRegistration
    });
    const root = createRoot({
      ".faction": factionInput,
      ".form": form,
      ".identity": identity,
      ".status": status
    }, {
      ".option": [option]
    });

    expect(runtime.bindFactionRegistration(root)).toBe(true);
    option.dispatch("click");
    form.dispatch("submit");

    expect(factionInput.value).toBe("cartel");
    expect(setStoredRegistration).toHaveBeenCalledWith(expect.objectContaining({
      factionId: "cartel",
      identity: "Boss"
    }));
    expect(setStoredEconomyState).toHaveBeenCalledWith({
      cleanMoney: 80,
      dirtyMoney: 90
    });
    expect(setStoredGangState).toHaveBeenCalledWith(expect.objectContaining({
      heat: 8,
      influence: 6,
      members: 4
    }));
    expect(identity.readOnly).toBe(true);
    expect(option.disabled).toBe(true);
  });
});
