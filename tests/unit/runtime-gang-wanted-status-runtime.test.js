import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildGangWantedStatusViewModel,
  buildServerGangWantedStatusViewModel,
  createGangWantedStatusRuntime
} from "../../page-assets/js/app/runtime/gangWantedStatusRuntime.js";

const originalDocument = globalThis.document;

class FakeClassList {
  add() {}
  remove() {}
  toggle() {}
}

class FakeElement {
  constructor(textContent = "") {
    this.textContent = textContent;
    this.hidden = false;
    this.disabled = false;
    this.listeners = new Map();
    this.classList = new FakeClassList();
  }

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }

  dispatch(name, event = {}) {
    this.listeners.get(name)?.({ target: this, ...event });
  }

  setAttribute() {}
}

class FakeRoot {
  constructor(map = {}, listMap = {}) {
    this.map = map;
    this.listMap = listMap;
  }

  querySelector(selector) {
    return this.map[selector] || null;
  }

  querySelectorAll(selector) {
    return this.listMap[selector] || [];
  }
}

afterEach(() => {
  globalThis.document = originalDocument;
});

describe("gang wanted status runtime", () => {
  it("builds wanted view model from resolved state without runtime coupling", () => {
    const viewModel = buildGangWantedStatusViewModel({
      economyState: { cleanMoney: 20, dirtyMoney: 4 },
      gangState: {
        heat: 72,
        influence: 12,
        heatJournal: [],
        heatReductionAuditTimestamps: [990],
        policeRaidProtectionUntil: 123
      },
      heatLevel: { id: 3, label: "III", title: "Raid risk", description: "Police pressure" },
      heatTiers: [{ id: 3, label: "III", title: "Raid risk" }],
      journal: [
        { type: "rise", amount: 5 },
        { type: "fall", amount: 2 }
      ],
      policeFeedback: {
        riskKey: "high",
        pendingRaid: { raidId: "raid:1", status: "pending" },
        activePoliceActionCount: 1
      }
    }, {
      cleanActionCost: 10,
      dirtyActionCost: 8,
      influenceActionCost: 20,
      formatProtectionLabel: () => "chráněno",
      getTierEffect: () => "vyšší kontroly",
      resolveAuditRisk: () => 10,
      now: () => 1000
    });

    expect(viewModel).toMatchObject({
      heat: 72,
      levelId: 3,
      riskKey: "high",
      activePoliceActionCount: 1,
      dirtyActionDisabled: true,
      cleanActionDisabled: false,
      influenceActionDisabled: true,
      auditRiskPct: 10,
      protectionLabel: "chráněno"
    });
    expect(viewModel.pendingRaid).toMatchObject({ raidId: "raid:1" });
    expect(viewModel.riseEntries).toHaveLength(1);
    expect(viewModel.fallEntries).toHaveLength(1);
    expect(viewModel.levels[0].effect).toBe("vyšší kontroly");
  });

  it("maps hosted wanted values only from the authoritative player read model", () => {
    const viewModel = buildServerGangWantedStatusViewModel({
      serverPlayer: {
        economy: {
          cleanCash: 12_345,
          dirtyCash: 678,
          influence: 44
        },
        police: {
          heat: 82,
          wantedLevel: 3,
          wantedLevelLabel: "3 / 5",
          riskTier: "high",
          protection: {
            raidConsequenceMultiplier: 0.75,
            sources: ["Magistrát"]
          }
        }
      },
      heatTiers: [{ id: 3, label: "Tier 3", title: "Známý problém" }]
    }, {
      resolveHeatTier: () => ({
        id: 3,
        label: "Tier 3",
        title: "Známý problém",
        description: "Častější kontroly."
      }),
      resolvePoliceFeedback: ({ policeReadModel }) => ({
        riskKey: policeReadModel.riskTier,
        pendingRaid: null
      })
    });

    expect(viewModel).toMatchObject({
      available: true,
      heat: 82,
      heatLabel: "82",
      levelId: 3,
      levelLabel: "3 / 5",
      title: "Známý problém",
      protectionLabel: "Magistrát -25 % následky raidu",
      auditRiskLabel: "—",
      riseEmptyText: "—",
      fallEmptyText: "—",
      dirtyActionDisabled: true,
      cleanActionDisabled: true,
      influenceActionDisabled: true,
      clearLogDisabled: true
    });
    expect(viewModel.riseEntries).toEqual([]);
    expect(viewModel.fallEntries).toEqual([]);
  });

  it("formats authoritative heat with at most one decimal place", () => {
    const viewModel = buildServerGangWantedStatusViewModel({
      serverPlayer: {
        police: { heat: 42.934567 }
      }
    }, {
      resolveHeatTier: () => ({
        id: 2,
        title: "Podezřelý",
        description: "Policie sleduje provoz."
      })
    });

    expect(viewModel.heat).toBe(42.934567);
    expect(viewModel.heatLabel).toBe("42,9");
  });

  it("binds wanted popup controls and delegates gameplay callbacks", () => {
    const elements = {
      heat: new FakeElement(),
      stars: new FakeElement(),
      popup: new FakeElement(),
      popupHeat: new FakeElement(),
      popupLevel: new FakeElement(),
      popupTier: new FakeElement(),
      popupDescription: new FakeElement(),
      popupProtection: new FakeElement(),
      popupLevels: new FakeElement(),
      popupRiseList: new FakeElement(),
      popupFallList: new FakeElement(),
      popupFeedback: new FakeElement(),
      dirty: new FakeElement(),
      clean: new FakeElement(),
      influence: new FakeElement(),
      clear: new FakeElement(),
      close: new FakeElement(),
      star: new FakeElement()
    };
    const root = new FakeRoot({
      "[heat]": elements.heat,
      "[stars]": elements.stars,
      "[popup]": elements.popup,
      "[popup-heat]": elements.popupHeat,
      "[popup-level]": elements.popupLevel,
      "[popup-tier]": elements.popupTier,
      "[popup-description]": elements.popupDescription,
      "[popup-protection]": elements.popupProtection,
      "[popup-levels]": elements.popupLevels,
      "[popup-rise]": elements.popupRiseList,
      "[popup-fall]": elements.popupFallList,
      "[popup-feedback]": elements.popupFeedback,
      "[dirty]": elements.dirty,
      "[clean]": elements.clean,
      "[influence]": elements.influence,
      "[clear]": elements.clear
    }, {
      "[star]": [elements.star],
      "[close]": [elements.close]
    });
    globalThis.document = { addEventListener: vi.fn() };
    const onDirtyAction = vi.fn();
    const onInfluenceAction = vi.fn();
    const renderHeatBadge = vi.fn();
    const runtime = createGangWantedStatusRuntime({
      cleanActionCost: 10,
      dirtyActionCost: 10,
      influenceActionCost: 20,
      gangHeatTiers: [{ id: 1, label: "I", title: "Nízký" }],
      getPoliceTierShortEffect: () => "effect",
      getResolvedDistrictPoliceActions: () => ({ 2: { districtId: 2 } }),
      getResolvedEconomyState: () => ({ cleanMoney: 10, dirtyMoney: 10 }),
      normalizeGangHeatJournal: () => [],
      onDirtyAction,
      renderHeatBadge,
      renderWantedFeedback: vi.fn(),
      renderWantedPanel: vi.fn(),
      resolvePoliceHeatFeedback: () => ({
        riskKey: "high",
        pendingRaid: { raidId: "raid:1", status: "pending" }
      }),
      resolveGangHeatTier: () => ({ id: 1, label: "I", title: "Nízký", description: "Klid" }),
      onInfluenceAction,
      syncGangHeatDecay: () => ({ heat: 12, influence: 25, heatJournal: [] }),
      selectors: {
        cleanAction: "[clean]",
        clearLog: "[clear]",
        dirtyAction: "[dirty]",
        influenceAction: "[influence]",
        gangHeat: "[heat]",
        gangStar: "[star]",
        gangStars: "[stars]",
        popup: "[popup]",
        popupClose: "[close]",
        popupDescription: "[popup-description]",
        popupFeedback: "[popup-feedback]",
        popupFallList: "[popup-fall]",
        popupHeat: "[popup-heat]",
        popupLevel: "[popup-level]",
        popupLevels: "[popup-levels]",
        popupProtection: "[popup-protection]",
        popupRiseList: "[popup-rise]",
        popupTier: "[popup-tier]"
      }
    });

    expect(runtime.bindGangWantedStatus(root)).toBe(true);
    elements.heat.dispatch("click");
    elements.dirty.dispatch("click");
    elements.influence.dispatch("click");

    expect(elements.popup.hidden).toBe(false);
    expect(onDirtyAction).toHaveBeenCalledWith(expect.objectContaining({
      root,
      syncWantedStatus: expect.any(Function)
    }));
    expect(onInfluenceAction).toHaveBeenCalledWith(expect.objectContaining({
      root,
      syncWantedStatus: expect.any(Function)
    }));
    expect(renderHeatBadge).toHaveBeenCalledWith(expect.objectContaining({
      activePoliceActionCount: 1,
      riskKey: "high",
      pendingRaid: { raidId: "raid:1", status: "pending" }
    }), expect.any(Object));
  });

  it("mirrors wanted tier and protection text into duplicate responsive mounts", () => {
    const elements = {
      heat: new FakeElement(),
      stars: new FakeElement(),
      popup: new FakeElement(),
      popupHeat: new FakeElement(),
      popupLevelDesktop: new FakeElement(),
      popupLevelMobile: new FakeElement(),
      popupTier: new FakeElement(),
      popupDescription: new FakeElement(),
      popupProtectionDesktop: new FakeElement(),
      popupProtectionMobile: new FakeElement(),
      popupLevels: new FakeElement(),
      popupRiseList: new FakeElement(),
      popupFallList: new FakeElement(),
      popupFeedback: new FakeElement(),
      star: new FakeElement()
    };
    const root = new FakeRoot({
      "[heat]": elements.heat,
      "[stars]": elements.stars,
      "[popup]": elements.popup,
      "[popup-heat]": elements.popupHeat,
      "[popup-tier]": elements.popupTier,
      "[popup-description]": elements.popupDescription,
      "[popup-levels]": elements.popupLevels,
      "[popup-rise]": elements.popupRiseList,
      "[popup-fall]": elements.popupFallList,
      "[popup-feedback]": elements.popupFeedback
    }, {
      "[popup-level]": [elements.popupLevelDesktop, elements.popupLevelMobile],
      "[popup-protection]": [elements.popupProtectionDesktop, elements.popupProtectionMobile],
      "[star]": [elements.star],
      "[close]": []
    });
    globalThis.document = { addEventListener: vi.fn() };
    const runtime = createGangWantedStatusRuntime({
      cleanActionCost: 10,
      dirtyActionCost: 10,
      influenceActionCost: 20,
      gangHeatTiers: [{ id: 2, label: "II", title: "Střední" }],
      getPoliceTierShortEffect: () => "effect",
      getResolvedDistrictPoliceActions: () => ({}),
      getResolvedEconomyState: () => ({ cleanMoney: 10, dirtyMoney: 10 }),
      normalizeGangHeatJournal: () => [],
      renderHeatBadge: vi.fn(),
      renderWantedFeedback: vi.fn(),
      renderWantedPanel: (_viewModel, { mounts }) => {
        mounts.popupLevel.textContent = "2 / 6";
        mounts.popupProtection.textContent = "Aktivní";
      },
      resolveGangHeatTier: () => ({ id: 2, label: "II", title: "Střední", description: "Pozor" }),
      syncGangHeatDecay: () => ({ heat: 24, influence: 25, heatJournal: [] }),
      selectors: {
        cleanAction: "[clean]",
        clearLog: "[clear]",
        dirtyAction: "[dirty]",
        influenceAction: "[influence]",
        gangHeat: "[heat]",
        gangStar: "[star]",
        gangStars: "[stars]",
        popup: "[popup]",
        popupClose: "[close]",
        popupDescription: "[popup-description]",
        popupFeedback: "[popup-feedback]",
        popupFallList: "[popup-fall]",
        popupHeat: "[popup-heat]",
        popupLevel: "[popup-level]",
        popupLevels: "[popup-levels]",
        popupProtection: "[popup-protection]",
        popupRiseList: "[popup-rise]",
        popupTier: "[popup-tier]"
      }
    });

    expect(runtime.bindGangWantedStatus(root)).toBe(true);

    expect(elements.popupLevelDesktop.textContent).toBe("2 / 6");
    expect(elements.popupLevelMobile.textContent).toBe("2 / 6");
    expect(elements.popupProtectionDesktop.textContent).toBe("Aktivní");
    expect(elements.popupProtectionMobile.textContent).toBe("Aktivní");
  });

  it("never reads or mutates local wanted state while hosted projection is active", () => {
    const elements = {
      heat: new FakeElement(),
      stars: new FakeElement(),
      popup: new FakeElement(),
      popupHeat: new FakeElement(),
      popupLevel: new FakeElement(),
      popupTier: new FakeElement(),
      popupDescription: new FakeElement(),
      popupProtection: new FakeElement(),
      popupAuditRisk: new FakeElement(),
      popupLevels: new FakeElement(),
      popupRiseList: new FakeElement(),
      popupFallList: new FakeElement(),
      popupFeedback: new FakeElement(),
      dirty: new FakeElement(),
      clean: new FakeElement(),
      influence: new FakeElement(),
      clear: new FakeElement(),
      star: new FakeElement()
    };
    const root = new FakeRoot({
      "[heat]": elements.heat,
      "[stars]": elements.stars,
      "[popup]": elements.popup,
      "[popup-heat]": elements.popupHeat,
      "[popup-level]": elements.popupLevel,
      "[popup-tier]": elements.popupTier,
      "[popup-description]": elements.popupDescription,
      "[popup-protection]": elements.popupProtection,
      "[popup-audit]": elements.popupAuditRisk,
      "[popup-levels]": elements.popupLevels,
      "[popup-rise]": elements.popupRiseList,
      "[popup-fall]": elements.popupFallList,
      "[popup-feedback]": elements.popupFeedback,
      "[dirty]": elements.dirty,
      "[clean]": elements.clean,
      "[influence]": elements.influence,
      "[clear]": elements.clear
    }, {
      "[star]": [elements.star],
      "[close]": []
    });
    globalThis.document = { addEventListener: vi.fn() };
    const getResolvedEconomyState = vi.fn(() => {
      throw new Error("hosted must not read local economy");
    });
    const getResolvedDistrictPoliceActions = vi.fn(() => {
      throw new Error("hosted must not read local police actions");
    });
    const syncGangHeatDecay = vi.fn(() => {
      throw new Error("hosted must not run local heat decay");
    });
    const normalizeGangHeatJournal = vi.fn(() => {
      throw new Error("hosted must not read local heat journal");
    });
    const renderWantedPanel = vi.fn();
    const onDirtyAction = vi.fn();
    const onClearLog = vi.fn();
    const renderWantedFeedback = vi.fn();
    const runtime = createGangWantedStatusRuntime({
      cleanActionCost: 10_000,
      dirtyActionCost: 2_500,
      influenceActionCost: 50,
      gangHeatTiers: [{ id: 2, label: "Tier 2", title: "Podezřelý" }],
      getServerPlayerView: () => ({
        economy: { cleanCash: 99_000, dirtyCash: 88_000, influence: 77 },
        police: {
          heat: 42,
          wantedLevel: 2,
          wantedLevelLabel: "2 / 5",
          protection: { raidConsequenceMultiplier: 1, sources: [] }
        }
      }),
      getResolvedDistrictPoliceActions,
      getResolvedEconomyState,
      isServerAuthoritativeMode: () => true,
      normalizeGangHeatJournal,
      onClearLog,
      onDirtyAction,
      renderHeatBadge: vi.fn(),
      renderWantedFeedback,
      renderWantedPanel,
      resolveGangHeatTier: () => ({ id: 2, label: "Tier 2", title: "Podezřelý", description: "Policie sleduje provoz." }),
      resolvePoliceHeatFeedback: () => ({ riskKey: "medium" }),
      syncGangHeatDecay,
      selectors: {
        cleanAction: "[clean]",
        clearLog: "[clear]",
        dirtyAction: "[dirty]",
        influenceAction: "[influence]",
        gangHeat: "[heat]",
        gangStar: "[star]",
        gangStars: "[stars]",
        popup: "[popup]",
        popupAuditRisk: "[popup-audit]",
        popupClose: "[close]",
        popupDescription: "[popup-description]",
        popupFeedback: "[popup-feedback]",
        popupFallList: "[popup-fall]",
        popupHeat: "[popup-heat]",
        popupLevel: "[popup-level]",
        popupLevels: "[popup-levels]",
        popupProtection: "[popup-protection]",
        popupRiseList: "[popup-rise]",
        popupTier: "[popup-tier]"
      }
    });

    expect(runtime.bindGangWantedStatus(root)).toBe(true);
    expect(renderWantedPanel).toHaveBeenCalledWith(expect.objectContaining({
      heat: 42,
      heatLabel: "42",
      levelLabel: "2 / 5",
      protectionLabel: "Bez ochrany",
      auditRiskLabel: "—",
      riseEmptyText: "—",
      fallEmptyText: "—",
      dirtyActionDisabled: true,
      cleanActionDisabled: true,
      influenceActionDisabled: true,
      clearLogDisabled: true
    }), expect.any(Object));
    expect(getResolvedEconomyState).not.toHaveBeenCalled();
    expect(getResolvedDistrictPoliceActions).not.toHaveBeenCalled();
    expect(syncGangHeatDecay).not.toHaveBeenCalled();
    expect(normalizeGangHeatJournal).not.toHaveBeenCalled();

    elements.dirty.dispatch("click");
    elements.clear.dispatch("click");

    expect(onDirtyAction).not.toHaveBeenCalled();
    expect(onClearLog).not.toHaveBeenCalled();
    expect(renderWantedFeedback).toHaveBeenCalledWith(
      elements.popupFeedback,
      "warning",
      "Akce není v autoritativním serverovém modelu dostupná."
    );
  });
});
