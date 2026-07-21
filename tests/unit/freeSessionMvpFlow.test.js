import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveLobbyStep, saveLoginStep } from "../../page-assets/js/app/auth-flow.js";
import { evaluateFreeSessionReadiness } from "../../page-assets/js/app/dev/freeSessionChecklist.js";
import { createDefaultPreviewSession } from "../../page-assets/js/app/model/authority-state.js";
import { createResultPayloadBuilders } from "../../page-assets/js/app/runtime/resultPayloadBuilders.js";
import {
  markOnboardingStepDone,
  updateOnboardingProgress
} from "../../page-assets/js/app/runtime/onboardingBridge.js";
import { resolvePoliceHeatFeedback } from "../../page-assets/js/app/runtime/policeHeatBridge.js";
import { FREE_SESSION_ONBOARDING_STEPS, renderOnboardingPanel } from "../../page-assets/js/app/ui/onboardingPanel.js";
import { renderPoliceFeedPanel } from "../../page-assets/js/app/ui/policeFeedPanel.js";

const SESSION_STORAGE_KEY = "empireStreets.session.v1";
const CANONICAL_FREE_SERVER_ID = "instance:free:eu-central:public-1";

function createLocalStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
}

class FakeClassList {
  constructor() {
    this.tokens = new Set();
  }

  add(...tokens) {
    for (const token of tokens) if (token) this.tokens.add(token);
  }

  toggle(token, force) {
    const shouldAdd = force === undefined ? !this.tokens.has(token) : Boolean(force);
    if (shouldAdd) this.tokens.add(token);
    else this.tokens.delete(token);
    return shouldAdd;
  }

  contains(token) {
    return this.tokens.has(token);
  }
}

class FakeElement {
  constructor(ownerDocument, tagName = "div") {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.parentNode = null;
  }

  set className(value) {
    this.classList = new FakeClassList();
    for (const token of String(value || "").split(/\s+/u).filter(Boolean)) {
      this.classList.add(token);
    }
  }

  append(...children) {
    for (const child of children.filter(Boolean)) {
      child.parentNode = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  addEventListener() {}
}

class FakeDocument {
  createTextNode(text = "") {
    return {
      ownerDocument: this,
      textContent: String(text || ""),
      children: [],
      parentNode: null
    };
  }

  createElement(tagName) {
    return new FakeElement(this, tagName);
  }
}

class FakeRoot {
  constructor(selectors = []) {
    this.selectors = new Set(selectors);
  }

  querySelector(selector) {
    return String(selector || "")
      .split(",")
      .map((item) => item.trim())
      .some((item) => this.selectors.has(item))
      ? {}
      : null;
  }
}

function collectText(element) {
  return [
    element?.textContent || "",
    ...(element?.children || []).map((child) => collectText(child))
  ].join(" ");
}

function createBuilders(overrides = {}) {
  return createResultPayloadBuilders({
    currentPlayerId: 1,
    startPhaseOwnerByDistrictId: new Map([[1, 1], [2, 2]]),
    getLaunchPlayerName: (ownerId) => `Player ${ownerId}`,
    getStoredRegistration: () => ({ identity: "MVP Boss" }),
    getAllianceLabel: () => "",
    getWorldState: () => ({
      ownedDistrictIds: [1],
      districtDefenseById: { 2: 80 },
      districtDefenseLoadoutById: { 2: { pistol: 1 } }
    }),
    getDistrictById: (districtId) => ({ id: districtId, districtType: "resident" }),
    resolveDistrictBuildingProfile: () => ({ buildings: [{ displayName: "Armory" }] }),
    districtTypeMeta: { resident: { label: "Resident" } },
    unknownAtmosphereMeta: { label: "Neznámá" },
    getDistrictAtmosphereMeta: () => ({ label: "Napjatá" }),
    formatDurationLabel: (value) => `${value}ms`,
    formatDistrictReference: (districtId) => `District ${districtId}`,
    resolveDistrictNumericId: (value) => Number(value?.id ?? value?.districtId ?? value) || 0,
    spySuccessEmptyDistrictQuotes: ["Empty success"],
    spySuccessOccupiedDistrictQuotes: ["Occupied success"],
    spyMediumFailEmptyDistrictQuotes: ["Empty medium"],
    spyMediumFailOccupiedDistrictQuotes: ["Occupied medium"],
    spyMajorFailEmptyDistrictQuotes: ["Empty major"],
    spyMajorFailOccupiedDistrictQuotes: ["Occupied major"],
    spyCaptureCooldownMs: 30_000,
    now: () => 1_000,
    random: () => 0,
    ...overrides
  });
}

describe("free session MVP flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T10:00:00.000Z"));
    globalThis.window = { localStorage: createLocalStorage() };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.window;
  });

  it("creates a normal free session with player and start district, not demo mode", () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(createDefaultPreviewSession()));
    saveLoginStep({ identity: "MVP Boss", isGuest: true, mode: "free" });
    const session = saveLobbyStep({ serverId: "free-eu-01", districtId: 27 });

    expect(session.registration.identity).toBe("MVP Boss");
    expect(session.registration.activeServerId).toBe(CANONICAL_FREE_SERVER_ID);
    expect(session.registration.activeServerInstanceId).toBe(CANONICAL_FREE_SERVER_ID);
    expect(session.registration.serverMode).toBe("free");
    expect(session.registration.serverRegistrationStatus).toBe("server_selected");
    expect(session.registration.preferredStartDistrictId).toBe(27);
    expect(session.registration.startDistrictId).toBe(27);
    expect(session.world.ownedDistrictIds).toEqual([]);
    expect(session.world.phaseState.gamePhase).toBe("live");
  });

  it("computes onboarding progress across the requested free loop checkpoints", () => {
    let progress = { completedStepIds: [] };
    const update = (context, eventOrState) => {
      progress = updateOnboardingProgress({ ...context, progress }, eventOrState);
      return progress;
    };

    update({ world: { ownedDistrictIds: [1] } }, { type: "onboarding:next", detail: { stepId: "welcome" } });
    update({ world: { ownedDistrictIds: [1] } }, { type: "district:own-opened", detail: { district: { id: 1 } } });
    update({ world: { ownedDistrictIds: [1] } }, { type: "building:opened", detail: { buildingName: "Armory" } });
    expect(progress.currentStepId).toBe("building-action");
    update({ world: { ownedDistrictIds: [1] } }, {
      type: "building-action:feedback",
      detail: {
        payload: {
          actionId: "sell_drugs",
          buildingTypeId: "street_dealers"
        }
      }
    });
    progress = markOnboardingStepDone("heat-police", progress);
    progress = markOnboardingStepDone("production-choice", progress);
    progress = markOnboardingStepDone("alliance-guide", progress);
    progress = markOnboardingStepDone("bounty-boost-guide", progress);
    update({ world: { ownedDistrictIds: [1] } }, { type: "spy:started", detail: { targetDistrictId: 2 } });
    update({ world: { ownedDistrictIds: [1] } }, { type: "trap:moved", detail: { targetDistrictId: 1, sourceDistrictId: 2 } });
    update({ world: { ownedDistrictIds: [1] } }, { type: "onboarding:next", detail: { stepId: "done" } });

    expect(progress.completedCount).toBe(FREE_SESSION_ONBOARDING_STEPS.length);
    expect(progress.status).toBe("complete");
  });

  it("renders onboarding and police fallback UI without crashing on partial state", () => {
    const documentRef = new FakeDocument();
    const onboardingMount = documentRef.createElement("section");
    const policeMount = documentRef.createElement("section");

    expect(renderOnboardingPanel({ currentStepId: "your-district" }, {}, { mount: onboardingMount })).toBe(true);
    expect(onboardingMount.children.length).toBeGreaterThan(0);

    const policeFeedback = resolvePoliceHeatFeedback({
      gangState: { heat: 96 },
      heatLevel: { id: 4 },
      policeActions: {}
    });
    expect(policeFeedback.riskKey).toBe("high");
    expect(policeFeedback.hasRealPoliceEvent).toBe(false);
    expect(renderPoliceFeedPanel(policeMount, policeFeedback)).toBe(true);
    expect(policeMount.dataset.policeRisk).toBe("high");
  });

  it("renders the simplified onboarding v1 completion state", () => {
    const documentRef = new FakeDocument();
    const onboardingMount = documentRef.createElement("section");

    expect(renderOnboardingPanel({ currentStepId: "done" }, {}, { mount: onboardingMount, readModel: {} })).toBe(true);

    const text = collectText(onboardingMount);
    expect(text).toContain("Eliminace");
    expect(text).toContain("Každé 4h reálného času");
    expect(text).toContain("Základy znáš, hodně štěstí!");
    expect(text).toContain("Pokračovat");
    expect(text).not.toContain("Rozkazy běží v čase");
  });

  it("builds spy and attack result fallback payloads for partial reports", () => {
    const builders = createBuilders();
    const spyPayload = builders.createSpyResultPayload({
      mission: { targetDistrictId: 2 },
      scenarioLabel: "Částečný úspěch",
      isUnownedDistrict: false
    });
    const attackPayload = builders.createAttackResultPayload({
      order: {},
      targetDistrictId: 2,
      outcome: {},
      deployedMembers: 0,
      memberLoss: 0,
      currentDefense: 0,
      nextDefense: 0
    });

    expect(spyPayload.title).toContain("Špehování");
    expect(spyPayload.rows.length).toBeGreaterThan(0);
    expect(attackPayload.title).toBe("NEÚSPĚCH");
    expect(attackPayload.durationValue).toBe("0ms");
    expect(attackPayload.lootLabel).toBe("Žádný");
    expect(attackPayload.policeWarningLabel).toBe("Sleduj police feed");
    expect(attackPayload.extraRows.map((row) => row.label)).toEqual([
      "Loot",
      "Heat gained",
      "Police warning",
      "Cooldown",
      "Další krok"
    ]);
  });

  it("marks the free session smoke context ready when core state, DOM, and public APIs exist", () => {
    const result = evaluateFreeSessionReadiness({
      root: new FakeRoot([
        "[data-map-canvas]",
        "[data-topbar-clean-money]",
        "[data-storage-popup]",
        "[data-district-building-detail]",
        "[data-production-panel]",
        "[data-spy-confirm-popup]",
        "[data-attack-confirm-popup]",
        "[data-attack-result-modal]",
        "[data-wanted-panel]",
        "[data-police-feed]"
      ]),
      state: {
        playerId: "player:1",
        player: { id: "player:1" },
        districts: [
          { id: 1, ownerId: "player:1", buildings: [{ id: "armory" }] },
          { id: 2, ownerId: "enemy" }
        ]
      },
      windowRef: {
        EmpireRuntime: { refreshAllUi() {}, openDistrict() {}, startSpy() {}, startAttack() {} },
        empireStreetsDistrictState: { getSelectedDistrict() {}, openDistrict() {} }
      },
      demoActive: false
    });

    expect(result.status).toBe("ready");
    expect(result.blockers).toEqual([]);
  });
});
