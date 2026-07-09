import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensureBuildingDetailPanel,
  renderBuildingDetailInfoSection,
  renderBuildingDetailPanel
} from "../../page-assets/js/app/ui/buildingDetailPanel.js";
import {
  renderCollectProductionButton,
  renderFactoryBuildingInfo,
  renderProductionBuildingInfo,
  renderFactorySlotCard,
  renderProductionOutputs,
  renderProductionPanel
} from "../../page-assets/js/app/ui/productionPanel.js";
import {
  renderCraftButton,
  renderRecipeCard,
  renderRecipeList,
  renderRecipeRequirements
} from "../../page-assets/js/app/ui/recipePanel.js";
import { PRODUCTION_SLOT_VISUALS } from "../../page-assets/js/app/runtime/productionBuildingData.js";

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
const originalHTMLElement = globalThis.HTMLElement;
const originalHTMLButtonElement = globalThis.HTMLButtonElement;

class FakeClassList {
  constructor() {
    this.tokens = new Set();
  }

  add(...tokens) {
    for (const token of tokens) if (token) this.tokens.add(token);
  }

  remove(...tokens) {
    for (const token of tokens) this.tokens.delete(token);
  }

  toggle(token, force) {
    if (force) this.add(token);
    else this.remove(token);
  }

  contains(token) {
    return this.tokens.has(token);
  }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.ownerDocument = null;
    this.dataset = {};
    this.attributes = new Map();
    this.eventListeners = new Map();
    this.classList = new FakeClassList();
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.type = "";
    this.title = "";
    this.tabIndex = 0;
    this.style = {
      values: new Map(),
      setProperty(name, value) {
        this.values.set(name, String(value));
      },
      removeProperty(name) {
        this.values.delete(name);
      }
    };
    this._className = "";
  }

  set className(value) {
    this._className = String(value || "");
    this.classList = new FakeClassList();
    for (const token of this._className.split(/\s+/u).filter(Boolean)) {
      this.classList.add(token);
    }
  }

  get className() {
    return this._className;
  }

  get isConnected() {
    return Boolean(this.parentNode);
  }

  append(...children) {
    for (const child of children.filter(Boolean)) {
      child.parentNode = this;
      child.ownerDocument = this.ownerDocument;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
    this.textContent = children.map((child) => child?.textContent || "").join("");
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  addEventListener(type, handler) {
    const handlers = this.eventListeners.get(type) || [];
    handlers.push(handler);
    this.eventListeners.set(type, handlers);
  }

  click() {
    for (const handler of this.eventListeners.get("click") || []) {
      handler({ target: this, currentTarget: this });
    }
  }

  matches(selector) {
    if (selector.startsWith(".")) {
      return this.classList.contains(selector.slice(1));
    }
    const dataMatch = selector.match(/^\[data-([a-z0-9-]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/iu);
    if (dataMatch) {
      const key = dataMatch[1].replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
      return dataMatch[2] == null ? key in this.dataset : this.dataset[key] === dataMatch[2];
    }
    if (/^[a-z][a-z0-9-]*$/iu.test(selector)) {
      return this.tagName.toLowerCase() === selector.toLowerCase();
    }
    return false;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const selectors = String(selector || "").split(",").map((part) => part.trim()).filter(Boolean);
    const result = [];
    const visit = (node) => {
      for (const child of node.children || []) {
        if (selectors.some((item) => child.matches(item))) result.push(child);
        visit(child);
      }
    };
    visit(this);
    return result;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches?.(selector)) return node;
      node = node.parentNode;
    }
    return null;
  }
}

class FakeDocument {
  constructor() {
    this.body = this.createElement("body");
  }

  createElement(tagName) {
    const element = new FakeElement(tagName);
    element.ownerDocument = this;
    return element;
  }

  createTextNode(text) {
    const node = this.createElement("#text");
    node.textContent = String(text);
    return node;
  }

  createDocumentFragment() {
    return this.createElement("#fragment");
  }

  addEventListener() {}
}

function setupDocument() {
  const document = new FakeDocument();
  globalThis.document = document;
  globalThis.window = {};
  globalThis.HTMLElement = FakeElement;
  globalThis.HTMLButtonElement = FakeElement;
  return document;
}

function findMetricValue(card, labelText) {
  const metrics = card.querySelectorAll(".drug-production-slot__metric,.pharmacy-slot__metric");
  for (const metric of metrics) {
    const label = metric.querySelector(".drug-production-slot__metric-label,.pharmacy-slot__metric-label");
    if (label?.textContent !== labelText) continue;
    return metric.querySelector(".drug-production-slot__metric-value,.drug-production-slot__metric-inline-value,.pharmacy-slot__metric-value")?.textContent;
  }
  return null;
}

afterEach(() => {
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
  globalThis.HTMLElement = originalHTMLElement;
  globalThis.HTMLButtonElement = originalHTMLButtonElement;
});

describe("building detail, production and recipe UI modules", () => {
  it("renders building detail with a mock building and without building data", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:factory" });

    renderBuildingDetailPanel({
      shell,
      title: "Továrna",
      badge: "Výroba",
      levelLabel: "L3",
      name: "Továrna",
      meta: "District 1",
      stats: [{ label: "Čisté / hod", value: "$120" }],
      mechanics: [{ label: "Výstup", value: "Metal Parts" }],
      collect: { visible: true, enabled: true, title: "Vybrat připravený výstup" },
      upgrade: { disabled: false, title: "Upgrade na L4" },
      actions: []
    });

    expect(shell.hidden).toBe(false);
    expect(shell.querySelector("[data-district-building-detail-title]").textContent).toBe("Továrna");
    expect(shell.querySelector("[data-district-building-detail-stats]").children[0].children[0].textContent).toBe("Čisté / hod");
    expect(shell.querySelector("[data-district-building-detail-collect]").classList.contains("is-empty")).toBe(false);

    renderBuildingDetailPanel({
      shell,
      title: "Továrna",
      collect: { visible: true, enabled: false, title: "Zatím není co vybrat" },
      upgrade: { disabled: true, title: "" },
      stats: [],
      mechanics: [],
      actions: []
    });

    const emptyCollectButton = shell.querySelector("[data-district-building-detail-collect]");
    expect(emptyCollectButton.disabled).toBe(true);
    expect(emptyCollectButton.classList.contains("is-empty")).toBe(true);

    expect(() => renderBuildingDetailPanel(null)).not.toThrow();
    expect(() => renderBuildingDetailPanel({ shell, stats: [], mechanics: [], actions: [] })).not.toThrow();
  });

  it("keeps generic building collect and upgrade controls in the top-right header tools", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:restaurant" });
    const headerTools = shell.querySelector(".district-building-detail-header-tools");
    const levelBadge = shell.querySelector("[data-district-building-detail-level]");
    const collectButton = shell.querySelector("[data-district-building-detail-collect]");
    const upgradeButton = shell.querySelector("[data-district-building-detail-upgrade]");
    const closeButton = headerTools.querySelector("[data-district-building-detail-close]");

    expect(headerTools).not.toBe(null);
    expect(levelBadge.parentNode).toBe(headerTools);
    expect(collectButton.parentNode).toBe(headerTools);
    expect(upgradeButton.parentNode).toBe(headerTools);
    expect(closeButton.parentNode).toBe(headerTools);
    expect(headerTools.children.map((child) => child.dataset)).toEqual([
      { districtBuildingDetailLevel: "true" },
      { districtBuildingDetailCollect: "true" },
      { districtBuildingDetailUpgrade: "true" },
      { districtBuildingDetailClose: "true" }
    ]);
  });

  it("adds stable per-building CSS hooks to generic building detail cards", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:building" });
    const card = shell.querySelector(".district-building-detail-card");

    renderBuildingDetailPanel({
      shell,
      mechanicsType: "restaurant",
      title: "Restaurace",
      badge: "Lokální cashflow",
      levelLabel: "L1",
      districtType: "commercial",
      stats: [],
      mechanics: [],
      collect: { visible: false },
      upgrade: { disabled: false },
      actions: []
    });

    expect(shell.dataset.buildingMechanicsType).toBe("restaurant");
    expect(card.dataset.buildingMechanicsType).toBe("restaurant");
    expect(shell.dataset.buildingDetailCssHook).toBe("building-detail--restaurant");
    expect(card.dataset.buildingDetailCssHook).toBe("building-detail-card--restaurant");
    expect(shell.classList.contains("building-detail--restaurant")).toBe(true);
    expect(card.classList.contains("building-detail-card--restaurant")).toBe(true);

    renderBuildingDetailPanel({
      shell,
      mechanicsType: "casino",
      title: "Kasino",
      badge: "High-risk praní",
      levelLabel: "L1",
      districtType: "commercial",
      stats: [],
      mechanics: [],
      collect: { visible: false },
      upgrade: { disabled: false },
      actions: []
    });

    expect(shell.dataset.buildingMechanicsType).toBe("casino");
    expect(card.dataset.buildingMechanicsType).toBe("casino");
    expect(shell.classList.contains("building-detail--restaurant")).toBe(false);
    expect(card.classList.contains("building-detail-card--restaurant")).toBe(false);
    expect(shell.classList.contains("building-detail--casino")).toBe(true);
    expect(card.classList.contains("building-detail-card--casino")).toBe(true);
  });

  it("hides building header badges when only the type text is present", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:casino" });

    renderBuildingDetailPanel({
      shell,
      mechanicsType: "casino",
      title: "Kasino",
      badge: "High-risk praní",
      levelLabel: "L2",
      districtType: "commercial",
      stats: [],
      mechanics: [],
      collect: { visible: false },
      upgrade: { disabled: false },
      actions: []
    });

    const badge = shell.querySelector("[data-district-building-detail-badge]");
    expect(badge.textContent).toBe("");
    expect(badge.hidden).toBe(true);
    expect(badge.style.display).toBe("none");
    expect(badge.dataset.districtBuildingDetailBadgeKind).toBe("");
    expect(badge.attributes.get("aria-hidden")).toBe("true");
  });

  it("shows only the building count in the detail header", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:restaurant" });

    renderBuildingDetailPanel({
      shell,
      mechanicsType: "restaurant",
      title: "Restaurace",
      badge: "Lokální cashflow",
      countLabel: "Počet: 4",
      levelLabel: "L1",
      districtType: "commercial",
      stats: [],
      mechanics: [],
      collect: { visible: false },
      upgrade: { disabled: false },
      actions: []
    });

    const badge = shell.querySelector("[data-district-building-detail-badge]");
    expect(badge.textContent).toBe("Počet: 4");
    expect(badge.hidden).toBe(false);
    expect(badge.style.display).toBe("");
    expect(badge.dataset.districtBuildingDetailBadgeKind).toBe("count");
    expect(badge.classList.contains("building-detail-title__badge--count")).toBe(true);
    expect(badge.attributes.get("aria-hidden")).toBe("false");
  });

  it("applies and clears downtown building detail card styling hooks", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "12:bank" });
    const card = shell.querySelector(".district-building-detail-card");

    renderBuildingDetailPanel({
      shell,
      title: "Centrální banka",
      badge: "Finance",
      levelLabel: "L1",
      districtType: "downtown",
      isDowntownBuilding: true,
      stats: [],
      mechanics: [],
      collect: { visible: false },
      upgrade: { disabled: true, title: "" },
      actions: []
    });

    expect(shell.dataset.buildingDistrictType).toBe("downtown");
    expect(card.dataset.buildingDistrictType).toBe("downtown");
    expect(shell.classList.contains("is-downtown-building-detail")).toBe(true);
    expect(card.classList.contains("is-downtown-building-card")).toBe(true);
    expect(card.dataset.buildingHasCustomBackground).toBeUndefined();

    renderBuildingDetailPanel({
      shell,
      title: "Restaurace",
      badge: "Lokální cashflow",
      levelLabel: "L1",
      districtType: "commercial",
      backgroundImagePath: "../img/budovy/commercial/restaurace/res1.png",
      stats: [],
      mechanics: [],
      collect: { visible: false },
      upgrade: { disabled: true, title: "" },
      actions: []
    });

    expect(shell.dataset.buildingDistrictType).toBe("commercial");
    expect(card.dataset.buildingDistrictType).toBe("commercial");
    expect(shell.classList.contains("is-downtown-building-detail")).toBe(false);
    expect(card.classList.contains("is-downtown-building-card")).toBe(false);
    expect(card.dataset.buildingHasCustomBackground).toBe("true");
    expect(card.style.values.get("--building-detail-background-image")).toContain("../img/budovy/commercial/restaurace/res1.png");

    renderBuildingDetailPanel({
      shell,
      title: "Restaurace",
      badge: "Lokální cashflow",
      levelLabel: "L1",
      districtType: "commercial",
      stats: [],
      mechanics: [],
      collect: { visible: false },
      upgrade: { disabled: true, title: "" },
      actions: []
    });

    expect(card.dataset.buildingHasCustomBackground).toBeUndefined();
    expect(card.style.values.has("--building-detail-background-image")).toBe(false);
  });

  it("hides the upgrade button when a passive building cannot be upgraded", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:garage" });

    renderBuildingDetailPanel({
      shell,
      mechanicsType: "garage",
      title: "Garáž",
      badge: "Logistika",
      levelLabel: "L1",
      name: "Garáž",
      meta: "District 1",
      stats: [{ label: "Upgrade", value: "Bez upgradu" }],
      mechanics: [{ label: "Cooldowny", value: "-6%" }],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { visible: false, disabled: true, title: "Garáž je pasivní budova bez upgradu." },
      actions: []
    });

    const upgradeButton = shell.querySelector("[data-district-building-detail-upgrade]");
    const statsPanel = shell.querySelector("[data-district-building-detail-panel='stats']");
    const infoPanel = shell.querySelector("[data-district-building-detail-panel='info']");

    expect(upgradeButton.hidden).toBe(true);
    expect(upgradeButton.style.display).toBe("none");
    expect(upgradeButton.disabled).toBe(true);
    expect(shell.querySelector(".district-building-detail-tabs")).toBe(null);
    expect(shell.classList.contains("is-building-detail-single-panel")).toBe(true);
    expect(statsPanel.hidden).toBe(false);
    expect(infoPanel).toBe(null);
    expect(statsPanel.querySelector(".district-building-detail-info-card")).toBe(null);
  });

  it("renders apartment block detail as one combined panel without tabs", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:apartment" });

    renderBuildingDetailPanel({
      shell,
      mechanicsType: "apartment-block",
      title: "Bytový blok",
      badge: "Členové gangu",
      levelLabel: "L1",
      name: "Bytový blok",
      meta: "Členové gangu · District 1",
      stats: [{ label: "Obyvatelé", value: "8/20" }],
      mechanics: [{ label: "Produkce", value: "+0.30 obyv./min" }],
      collect: { visible: true, enabled: true, title: "Vybrat obyvatele" },
      upgrade: { disabled: true, title: "Bez upgradu" },
      actions: [{ index: 0, title: "Vybrat obyvatele", description: "Přidá členy gangu.", cooldownLabel: "Cooldown: 0s" }]
    });

    const panels = shell.querySelectorAll("[data-district-building-detail-panel]");
    const statsPanel = shell.querySelector("[data-district-building-detail-panel='stats']");
    const infoPanel = shell.querySelector("[data-district-building-detail-panel='info']");

    expect(shell.querySelector(".district-building-detail-tabs")).toBe(null);
    expect(shell.classList.contains("is-building-detail-single-panel")).toBe(true);
    expect(panels).toHaveLength(1);
    expect(statsPanel.hidden).toBe(false);
    expect(statsPanel.classList.contains("district-building-detail-panel--merged")).toBe(true);
    expect(infoPanel).toBe(null);
    expect(statsPanel.querySelector(".district-building-detail-info-card")).toBe(null);
    expect(shell.querySelector("[data-district-building-detail-action-section]").hidden).toBe(true);
  });

  it("keeps restaurant detail sections alive across an empty refresh render", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:restaurant" });
    const restaurantView = {
      shell,
      mechanicsType: "restaurant",
      title: "Restaurace",
      intro: "Restaurace generuje čisté peníze a městské drby.",
      badge: "Lokální cashflow",
      levelLabel: "L1",
      name: "Restaurace",
      meta: "",
      stats: [{ label: "Clean / min", value: "+$38" }],
      mechanics: [{ label: "Drby", value: "šance x1.12" }],
      effects: [{ text: "Clean cash +2280/hod", tone: "clean" }],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { disabled: false, title: "Upgrade" },
      showActionsInSinglePanel: true,
      actions: [{ index: 0, title: "Vybrat tržby", description: "Vybere lokální tržby.", cooldownLabel: "Cooldown: 30m" }]
    };

    renderBuildingDetailPanel(restaurantView);
    renderBuildingDetailPanel({
      shell,
      mechanicsType: "restaurant",
      title: "Restaurace",
      stats: [],
      mechanics: [],
      effects: [],
      collect: { visible: false },
      upgrade: { disabled: false },
      showActionsInSinglePanel: true,
      actions: []
    });
    renderBuildingDetailPanel(restaurantView);

    const statsPanel = shell.querySelector("[data-district-building-detail-panel='stats']");
    const mechanics = statsPanel.querySelector("[data-district-building-detail-mechanics]");
    const effects = statsPanel.querySelector("[data-district-building-detail-effects]");
    const actionSection = statsPanel.querySelector("[data-district-building-detail-action-section]");
    const action = shell.querySelector("[data-district-building-detail-action-index]");

    expect(mechanics.children[0].children[0].textContent).toBe("Drby");
    expect(mechanics.children[0].children[1].textContent).toBe("šance x1.12");
    expect(effects.children[0].children[0].textContent).toBe("Clean cash +2280/hod");
    expect(actionSection.hidden).toBe(false);
    expect(action.querySelector(".building-info-action-row__title").textContent).toBe("Vybrat tržby");
  });

  it("renders focused action buildings as a single panel while keeping action controls", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:clinic" });
    renderBuildingDetailPanel({
      shell,
      mechanicsType: "clinic",
      title: "Klinika",
      intro: "Klinika drží gang při životě.",
      badge: "Recovery",
      levelLabel: "L1",
      name: "Klinika",
      meta: "",
      stats: [{ label: "Recovery rate", value: "15 %" }],
      mechanics: [{ label: "Stabilizace", value: "připravená" }],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { disabled: true, title: "Max level" },
      showActionsInSinglePanel: true,
      actions: [{ index: 0, title: "Stabilizační protokol", description: "Vrací čerstvé ztráty.", cooldownLabel: "Cooldown: 18m 00s" }]
    });

    const statsPanel = shell.querySelector("[data-district-building-detail-panel='stats']");
    const infoPanel = shell.querySelector("[data-district-building-detail-panel='info']");
    const actions = shell.querySelectorAll("[data-district-building-detail-action-index]");

    expect(shell.querySelector(".district-building-detail-tabs")).toBe(null);
    expect(shell.classList.contains("is-building-detail-single-panel")).toBe(true);
    expect(statsPanel.hidden).toBe(false);
    expect(infoPanel).toBe(null);
    expect(statsPanel.querySelector(".building-detail-info-text").textContent).toBe("Klinika drží gang při životě.");
    expect(statsPanel.querySelector(".district-building-detail-info-card")).toBe(null);
    expect(actions).toHaveLength(1);
    expect(actions[0].querySelector(".building-info-action-row__title").textContent).toBe("Stabilizační protokol");
  });

  it("renders commercial action buildings as one merged panel with actions", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:casino" });
    renderBuildingDetailPanel({
      shell,
      mechanicsType: "casino",
      title: "Kasino",
      intro: "Kasino pere velké částky s velkým rizikem.",
      badge: "High-risk praní",
      levelLabel: "L2",
      name: "Kasino",
      meta: "",
      stats: [{ label: "Kapacita praní", value: "$8000" }],
      mechanics: [{ label: "Tichá herna", value: "pere část dirty cash" }],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { disabled: false, title: "Upgrade na L3" },
      showActionsInSinglePanel: true,
      actions: [{ index: 0, title: "Tichá herna", description: "Vypere dirty cash.", cooldownLabel: "Cooldown: 14m 00s" }]
    });

    const statsPanel = shell.querySelector("[data-district-building-detail-panel='stats']");
    const infoPanel = shell.querySelector("[data-district-building-detail-panel='info']");
    const actions = shell.querySelectorAll("[data-district-building-detail-action-index]");

    expect(shell.querySelector(".district-building-detail-tabs")).toBe(null);
    expect(shell.classList.contains("is-building-detail-single-panel")).toBe(true);
    expect(statsPanel.classList.contains("district-building-detail-panel--merged")).toBe(true);
    expect(infoPanel).toBe(null);
    expect(actions).toHaveLength(1);
    expect(actions[0].querySelector(".building-info-action-row__title").textContent).toBe("Tichá herna");
  });

  it("dispatches district building detail actions through one delegated actionId payload", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const onRunAction = vi.fn();
    const shell = ensureBuildingDetailPanel(root, { onRunAction }, { popupKey: "12:casino" });
    shell.dataset.districtBuildingDetailDistrictId = "12";
    shell.dataset.districtBuildingDetailName = "kasino";
    shell.dataset.districtBuildingDetailDisplayName = "Kasino";

    renderBuildingDetailPanel({
      shell,
      mechanicsType: "casino",
      title: "Kasino",
      badge: "High-risk praní",
      levelLabel: "L2",
      name: "Kasino",
      meta: "",
      stats: [],
      mechanics: [],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { disabled: false, title: "Upgrade na L3" },
      showActionsInSinglePanel: true,
      actions: [{
        index: 1,
        actionId: "vip_night",
        buildingTypeId: "casino",
        title: "VIP noc",
        description: "Dlouhý popis nesmí být na tlačítku.",
        phaseLockLabel: "Jen v noci",
        cooldownLabel: "Ready"
      }]
    });

    const action = shell.querySelector("[data-district-building-detail-action-index]");
    const body = shell.querySelector(".district-building-detail-body");
    for (const handler of body.eventListeners.get("click") || []) {
      handler({ target: action });
    }

    expect(action.querySelector(".building-info-action-row__desc").textContent).toBe("");
    expect(action.dataset.districtBuildingDetailHasPhaseLock).toBe("true");
    expect(action.querySelector(".building-info-action-row__phase").textContent).toBe("Jen v noci");
    expect(onRunAction).toHaveBeenCalledTimes(1);
    const [receivedShell, payload] = onRunAction.mock.calls[0];
    expect(receivedShell).toBe(shell);
    expect(payload).toEqual(expect.objectContaining({
      actionId: "vip_night",
      actionIndex: 1,
      buildingTypeId: "casino",
      districtId: "12",
      buildingId: "kasino",
      buildingName: "Kasino"
    }));
  });

  it("shows disabled action reason directly inside the grey action button", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "2:dealers" });

    renderBuildingDetailPanel({
      shell,
      mechanicsType: "street-dealers",
      title: "Pouliční dealeři",
      badge: "Distribuce",
      levelLabel: "L1",
      name: "Pouliční dealeři",
      meta: "",
      stats: [],
      mechanics: [],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { disabled: true, title: "" },
      showActionsInSinglePanel: true,
      actions: [{
        index: 2,
        actionId: "street_dealers_move_stash",
        buildingTypeId: "street_dealers",
        title: "Přesunout stash",
        disabled: true,
        disabledReason: "Potřebuješ biomass x3.",
        disabledTone: "insufficient-funds",
        cooldownLabel: "Cooldown 10m 00s"
      }]
    });

    const action = shell.querySelector("[data-district-building-detail-action-id='street_dealers_move_stash']");
    expect(action.disabled).toBe(true);
    expect(action.dataset.districtBuildingDetailDisabledTone).toBe("insufficient-funds");
    expect(action.querySelector(".building-info-action-row__desc").hidden).toBe(false);
    expect(action.querySelector(".building-info-action-row__desc").textContent).toBe("Potřebuješ biomass x3.");
  });

  it("keeps action cooldown only in the corner label", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "2:casino" });

    renderBuildingDetailPanel({
      shell,
      mechanicsType: "casino",
      title: "Kasino",
      badge: "High-risk praní",
      levelLabel: "L1",
      name: "Kasino",
      meta: "",
      stats: [],
      mechanics: [],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { disabled: true, title: "" },
      showActionsInSinglePanel: true,
      actions: [{
        index: 0,
        actionId: "vip_night",
        buildingTypeId: "casino",
        title: "VIP noc",
        disabled: true,
        disabledReason: "Cooldown 12m 00s.",
        rewardSummary: "Clean cash +500",
        cooldownLabel: "Zbývá 12m 00s",
        cooldownRemainingMs: 12 * 60 * 1000
      }]
    });

    const action = shell.querySelector("[data-district-building-detail-action-id='vip_night']");
    expect(action.querySelector(".building-info-action-row__desc").textContent).toBe("Clean cash +500");
    expect(action.querySelector(".building-info-action-row__cooldown").textContent).toBe("Zbývá 12m 00s");
  });

  it("renders infrastructure buildings as one merged panel with support actions", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:power" });
    renderBuildingDetailPanel({
      shell,
      mechanicsType: "power-plant",
      title: "Energetická stanice",
      intro: "Energetická stanice drží provoz districtu stabilní.",
      badge: "Infrastruktura",
      levelLabel: "L2",
      name: "Energetická stanice",
      meta: "",
      stats: [{ label: "Akce", value: "síť / výroba / výpadky" }],
      mechanics: [{ label: "Stabilizovat síť", value: "dočasně zvedne income districtu" }],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { disabled: false, title: "Upgrade na L3" },
      showActionsInSinglePanel: true,
      actions: [
        { index: 0, title: "Stabilizovat síť", description: "Zvedne income.", cooldownLabel: "Cooldown: 0s" },
        { index: 1, title: "Napájet výrobu", description: "Podpoří výrobu.", cooldownLabel: "Cooldown: 0s" },
        { index: 2, title: "Snížit heat", description: "Sníží heat.", cooldownLabel: "Cooldown: 0s" }
      ]
    });

    const infoPanel = shell.querySelector("[data-district-building-detail-panel='info']");
    const actions = shell.querySelectorAll("[data-district-building-detail-action-index]");

    expect(shell.querySelector(".district-building-detail-tabs")).toBe(null);
    expect(shell.classList.contains("is-building-detail-single-panel")).toBe(true);
    expect(infoPanel).toBe(null);
    expect(actions).toHaveLength(3);
    expect(actions[2].querySelector(".building-info-action-row__title").textContent).toBe("Snížit heat");
  });

  it("renders street economy buildings as one merged panel with actions", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:smuggling" });
    renderBuildingDetailPanel({
      shell,
      mechanicsType: "smuggling-tunnel",
      title: "Pašovací tunel",
      intro: "Pašovací tunel drží dirty proud mimo světlo.",
      badge: "Pašování",
      levelLabel: "L2",
      name: "Pašovací tunel",
      meta: "",
      stats: [{ label: "Dirty / min", value: "+$22" }],
      mechanics: [{ label: "Otevřít kanál", value: "Cena $800 dirty" }],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { disabled: false, title: "Upgrade na L3" },
      showActionsInSinglePanel: true,
      actions: [{ index: 0, title: "Otevřít kanál", description: "Zvedne dirty cash tunelů.", cooldownLabel: "Cooldown: 18m 00s" }]
    });

    const infoPanel = shell.querySelector("[data-district-building-detail-panel='info']");
    const actions = shell.querySelectorAll("[data-district-building-detail-action-index]");

    expect(shell.querySelector(".district-building-detail-tabs")).toBe(null);
    expect(shell.classList.contains("is-building-detail-single-panel")).toBe(true);
    expect(infoPanel).toBe(null);
    expect(actions).toHaveLength(1);
    expect(actions[0].querySelector(".building-info-action-row__title").textContent).toBe("Otevřít kanál");
  });

  it("keeps arcade special actions at the bottom of the single-panel card", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:arcade" });
    renderBuildingDetailPanel({
      shell,
      mechanicsType: "arcade",
      title: "Herna",
      intro: "Herna je pouliční cashflow a menší pračka.",
      badge: "Dirty cash",
      levelLabel: "",
      name: "Herna",
      meta: "",
      stats: [{ label: "Dirty / min", value: "+$72" }],
      mechanics: [{ label: "Noční automaty", value: "NOC only" }],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { visible: false, disabled: true, title: "" },
      showActionsInSinglePanel: true,
      actions: [
        {
          index: 0,
          actionId: "night_machines",
          buildingTypeId: "arcade",
          title: "Noční automaty",
          rewardSummary: "Clean income +35%",
          cooldownLabel: "Cooldown 16m 00s"
        },
        {
          index: 1,
          actionId: "back_cashdesk",
          buildingTypeId: "arcade",
          title: "Zadní pokladna",
          rewardSummary: "Praní 13% dirty cash",
          cooldownLabel: "Cooldown 12m 00s"
        }
      ]
    });

    const statsPanel = shell.querySelector("[data-district-building-detail-panel='stats']");
    const intro = statsPanel.querySelector(".building-detail-info-text");
    const actionSection = shell.querySelector("[data-district-building-detail-action-section]");
    const actions = shell.querySelectorAll("[data-district-building-detail-action-index]");

    expect(actions).toHaveLength(2);
    expect(actionSection.parentNode).toBe(statsPanel);
    expect(statsPanel.children.indexOf(actionSection)).toBe(statsPanel.children.length - 1);
    expect(statsPanel.children.indexOf(actionSection)).toBeGreaterThan(statsPanel.children.indexOf(intro));
  });

  it("keeps a single pinned apartment intro across live refresh renders", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:apartment-refresh" });
    const viewModel = {
      shell,
      mechanicsType: "apartment-block",
      title: "Bytový blok",
      intro: "Bytový blok negeneruje cash ani heat.",
      badge: "Členové gangu",
      levelLabel: "L1",
      stats: [],
      mechanics: [],
      collect: { visible: true, enabled: false, title: "Čeká na obyvatele" },
      upgrade: { disabled: true, title: "Bez upgradu" },
      actions: []
    };
    renderBuildingDetailPanel(viewModel);
    renderBuildingDetailPanel(viewModel);

    const statsPanel = shell.querySelector("[data-district-building-detail-panel='stats']");
    const pinnedIntroCount = statsPanel.children.filter((child) => child.classList.contains("building-detail-info-text")).length;
    expect(pinnedIntroCount).toBe(1);
  });

  it("deduplicates legacy pinned intros without dropping school card content", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:school-refresh" });
    const statsPanel = shell.querySelector("[data-district-building-detail-panel='stats']");
    const legacyIntro = document.createElement("p");
    legacyIntro.className = "building-detail-info-text";
    legacyIntro.textContent = "Starý popisek školy.";
    statsPanel.append(legacyIntro);

    const viewModel = {
      shell,
      mechanicsType: "school",
      title: "Škola",
      intro: "Škola pasivně zvyšuje lokální populační zásobu.",
      badge: "Vzdělání",
      levelLabel: "L1",
      stats: [{ label: "Populace", value: "4/12" }],
      mechanics: [{ label: "K výběru", value: "4/12" }],
      effects: [{ text: "Populace +0.25/min", tone: "population" }],
      collect: { visible: true, enabled: true, title: "Vybrat připravený výstup: 4/12 členů" },
      upgrade: { disabled: true, title: "Bez upgradu" },
      actions: []
    };
    renderBuildingDetailPanel(viewModel);
    renderBuildingDetailPanel(viewModel);

    const pinnedIntros = statsPanel.children.filter((child) => child.classList.contains("building-detail-info-text"));
    expect(pinnedIntros).toHaveLength(1);
    expect(pinnedIntros[0].dataset.districtBuildingDetailInlineInfo).toBe("true");
    expect(statsPanel.querySelector("[data-district-building-detail-stats]").children).toHaveLength(1);
    expect(statsPanel.querySelector("[data-district-building-detail-mechanics]").children).toHaveLength(1);
  });

  it("does not pin empty single-panel intro rows", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:clinic-empty-info" });

    renderBuildingDetailPanel({
      shell,
      mechanicsType: "clinic",
      title: "Klinika",
      badge: "Recovery",
      levelLabel: "",
      name: "Klinika",
      meta: "",
      stats: [{ label: "Recovery pool", value: "0 položek" }],
      mechanics: [{ label: "Stabilizace", value: "čeká" }],
      effects: [{ text: "Clean cash +$3100/hod", tone: "clean" }],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { visible: false, disabled: true, title: "" },
      showActionsInSinglePanel: true,
      actions: [{
        index: 0,
        actionId: "stabilization_protocol",
        buildingTypeId: "clinic",
        title: "Stabilizační protokol",
        disabled: true,
        disabledReason: "Žádné ztráty k léčbě.",
        cooldownLabel: "Cooldown 17m 39s"
      }]
    });

    const statsPanel = shell.querySelector("[data-district-building-detail-panel='stats']");
    const infoPanel = shell.querySelector("[data-district-building-detail-panel='info']");

    expect(statsPanel.querySelector(".building-detail-info-text")).toBe(null);
    expect(statsPanel.querySelector(".district-building-detail-info-card")).toBe(null);
    expect(infoPanel).toBe(null);
  });

  it("removes empty visible single-panel sections after rendering", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:clinic-empty-strip" });
    const statsPanel = shell.querySelector("[data-district-building-detail-panel='stats']");
    const emptyStrip = document.createElement("div");
    emptyStrip.className = "building-info-card__section";
    statsPanel.append(emptyStrip);

    renderBuildingDetailPanel({
      shell,
      mechanicsType: "clinic",
      title: "Klinika",
      badge: "Recovery",
      levelLabel: "",
      name: "Klinika",
      meta: "",
      stats: [{ label: "Recovery pool", value: "0 položek" }],
      mechanics: [{ label: "Stabilizace", value: "čeká" }],
      effects: [{ text: "Clean cash +$3100/hod", tone: "clean" }],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { visible: false, disabled: true, title: "" },
      showActionsInSinglePanel: true,
      actions: [{
        index: 0,
        actionId: "stabilization_protocol",
        buildingTypeId: "clinic",
        title: "Stabilizační protokol",
        disabled: true,
        disabledReason: "Žádné ztráty k léčbě.",
        cooldownLabel: "Cooldown 17m 39s"
      }]
    });

    expect(statsPanel.children.includes(emptyStrip)).toBe(false);
  });

  it("renders production outputs and empty production panels", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const outputs = renderProductionOutputs([{ itemId: "metalParts", label: "Metal Parts", amount: 2 }], { mount });

    expect(outputs.children[0].children[0].textContent).toBe("Metal Parts");
    expect(outputs.children[0].children[1].textContent).toBe("2");

    expect(renderProductionPanel({ mount, recipes: [] })).toBe(true);
    expect(mount.children[0].textContent).toBe("Bez produkce.");
  });

  it("renders factory info like a compact production briefing", () => {
    const document = setupDocument();
    const infoPanel = document.createElement("div");

    expect(renderFactoryBuildingInfo(infoPanel, {
      description: "Továrna vyrábí technické komponenty.",
      effectsLabel: "Výroba běží přes sloty · fronta po kusech",
      upgrade: { costLabel: "$4200", benefitLabel: "L2 · x1.10 rychlost" },
      products: [
        {
          id: "metal-parts",
          title: "Metal Parts",
          description: "Kovové díly pro zbraně.",
          durationLabel: "4 min",
          costLabel: "120 Clean Cash"
        },
        {
          id: "tech-core",
          title: "Tech Core",
          description: "Technologické jádro.",
          durationLabel: "8 min",
          costLabel: "300 Clean Cash"
        },
        {
          id: "combat-module",
          title: "Bojový modul",
          description: "High-tech bojový modul.",
          durationLabel: "15 min",
          costLabel: "650 Clean Cash + 1 Tech Core"
        }
      ]
    })).toBe(true);

    expect(infoPanel.querySelector(".building-info-card__title").textContent).toBe("Továrna");
    expect(infoPanel.querySelector(".building-info-card__effects").textContent).toContain("fronta po kusech");
    expect(infoPanel.querySelector(".building-info-card__actions")).toBe(null);

    const products = infoPanel.querySelectorAll(".factory-info-output");
    expect(products).toHaveLength(3);
    expect(products[0].dataset.resourceColor).toBe("metal-parts");
    expect(products[0].children[0].textContent).toBe("Metal Parts");
    expect(products[0].querySelectorAll(".factory-info-output__meta-item")[0].children[1].textContent).toBe("4 min");
    expect(products[2].querySelectorAll(".factory-info-output__meta-item")[1].children[1].textContent).toBe("650 Clean Cash + 1 Tech Core");
  });

  it("renders recipe requirements with enough and missing resources", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const requirements = renderRecipeRequirements(
      { inputs: { chemicals: 2, biomass: 3 } },
      { chemicals: 4, biomass: 1 },
      { mount, getResourceLabel: (itemId) => itemId }
    );

    expect(requirements.children[0].children[1].textContent).toBe("2/4");
    expect(requirements.children[1].children[1].textContent).toBe("3/1");
  });

  it("calls craft and collect callbacks from buttons", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const onCraft = vi.fn();
    const onCollect = vi.fn();

    renderCraftButton({ id: "stim" }, { onCraft }, { mount }).click();
    renderCollectProductionButton({ status: "ready" }, { onCollect }, { mount }).click();

    expect(onCraft).toHaveBeenCalledOnce();
    expect(onCollect).toHaveBeenCalledOnce();
  });

  it("renders recipe cards for enough and insufficient materials", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const recipe = {
      name: "Stim Pack",
      inputs: { chemicals: 1 },
      output: { inventory: "materials", itemId: "stim-pack", amount: 1 },
      durationMs: 1000
    };

    const enabled = renderRecipeCard({
      buildingName: "pharmacy",
      recipeId: "stim",
      recipe,
      inputAmounts: { chemicals: 2 },
      maxBatches: 2,
      canStart: true
    }, {}, { mount });
    const disabled = renderRecipeCard({
      buildingName: "pharmacy",
      recipeId: "stim",
      recipe,
      inputAmounts: { chemicals: 0 },
      maxBatches: 0,
      canStart: false
    }, {}, { mount });

    expect(enabled.querySelector(".pharmacy-slot__btn--start").disabled).toBe(false);
    expect(disabled.querySelector(".pharmacy-slot__btn--start").disabled).toBe(true);
    expect(renderRecipeList([{ buildingName: "pharmacy", recipeId: "stim", recipe }], {}, { mount }).children).toHaveLength(1);
  });

  it("keeps recipe queue metrics tied to real jobs instead of selected previews", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const recipe = {
      name: "Neon Dust",
      inputs: { chemicals: 1 },
      output: { inventory: "drugs", itemId: "neon-dust", amount: 6 },
      durationMs: 1000
    };

    const idleCard = renderRecipeCard({
      buildingName: "druglab",
      recipeId: "neon-dust",
      recipe,
      inputAmounts: { chemicals: 10 },
      outputCap: 15,
      maxBatches: 3,
      canStart: true
    }, {}, { mount });
    expect(findMetricValue(idleCard, "Vyrobeno")).toBe("0/15 ks");
    expect(findMetricValue(idleCard, "Výstup")).toBe(null);
    expect(findMetricValue(idleCard, "Ve frontě")).toBe("0/15 ks");
    idleCard.querySelectorAll(".armory-slot__quantity-btn")[1].click();
    expect(findMetricValue(idleCard, "Ve frontě")).toBe("0/15 ks");

    const runningLab = renderRecipeCard({
      buildingName: "druglab",
      recipeId: "neon-dust",
      recipe,
      outputCap: 15,
      job: { status: "running", output: { inventory: "drugs", itemId: "neon-dust", amount: 12 }, quantity: 2, durationMs: 2000 }
    }, {}, { mount });
    expect(findMetricValue(runningLab, "Vyrobeno")).toBe("0/15 ks");
    expect(findMetricValue(runningLab, "Ve frontě")).toBe("12/15 ks");

    const readyLab = renderRecipeCard({
      buildingName: "druglab",
      recipeId: "neon-dust",
      recipe,
      outputCap: 15,
      job: { status: "ready", output: { inventory: "drugs", itemId: "neon-dust", amount: 12 }, quantity: 2, durationMs: 2000 }
    }, {}, { mount });
    expect(findMetricValue(readyLab, "Vyrobeno")).toBe("12/15 ks");
    expect(findMetricValue(readyLab, "Ve frontě")).toBe("0/15 ks");

    const runningPharmacy = renderRecipeCard({
      buildingName: "pharmacy",
      recipeId: "chemicals",
      recipe: { ...recipe, output: { inventory: "materials", itemId: "chemicals", amount: 20 } },
      outputCap: 15,
      job: { status: "running", output: { inventory: "materials", itemId: "chemicals", amount: 40 }, quantity: 2, durationMs: 2000 }
    }, {}, { mount });
    expect(findMetricValue(runningPharmacy, "Ve frontě")).toBe("2/15 ks");
  });

  it("renders production output and queue metrics with separate caps", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const recipe = {
      name: "Neon Dust",
      inputs: { chemicals: 1 },
      output: { inventory: "drugs", itemId: "neon-dust", amount: 1 },
      durationMs: 1000
    };

    const runningCard = renderRecipeCard({
      buildingName: "druglab",
      recipeId: "neon-dust",
      recipe,
      outputCap: 25,
      queueCap: 23,
      job: { status: "running", output: { inventory: "drugs", itemId: "neon-dust", amount: 10 }, quantity: 10, durationMs: 10000 }
    }, {}, { mount });
    const readyCard = renderRecipeCard({
      buildingName: "druglab",
      recipeId: "neon-dust",
      recipe,
      outputCap: 25,
      queueCap: 23,
      job: { status: "ready", output: { inventory: "drugs", itemId: "neon-dust", amount: 2 }, quantity: 2, durationMs: 2000 }
    }, {}, { mount });

    expect(findMetricValue(runningCard, "Vyrobeno")).toBe("0/25 ks");
    expect(findMetricValue(runningCard, "Ve frontě")).toBe("10/23 ks");
    expect(findMetricValue(readyCard, "Vyrobeno")).toBe("2/25 ks");
    expect(findMetricValue(readyCard, "Ve frontě")).toBe("0/23 ks");
  });

  it("updates drug lab input requirements with selected production quantity", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const recipe = {
      name: "Neon Dust",
      inputs: { chemicals: 3, biomass: 2 },
      output: { inventory: "drugs", itemId: "neon-dust", amount: 6 },
      durationMs: 1000
    };

    const card = renderRecipeCard({
      buildingName: "druglab",
      recipeId: "neon-dust",
      recipe,
      inputAmounts: { chemicals: 12, biomass: 12 },
      outputCap: 15,
      maxBatches: 4,
      canStart: true
    }, {}, { mount });

    expect(card.querySelector(".drug-production-slot__supply-row--count-2")).not.toBe(null);
    expect(card.querySelectorAll(".drug-production-slot__supply-value").map((item) => item.textContent)).toEqual(["3/12", "2/12"]);

    const quantityButtons = card.querySelectorAll(".drug-production-slot__quantity-btn");
    quantityButtons[1].click();
    quantityButtons[1].click();

    expect(card.querySelectorAll(".drug-production-slot__supply-value").map((item) => item.textContent)).toEqual(["9/12", "6/12"]);
    expect(findMetricValue(card, "Vyrobeno")).toBe("0/15 ks");
    expect(findMetricValue(card, "Ve frontě")).toBe("0/15 ks");
  });

  it("updates armory material requirements with selected production quantity", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const card = renderRecipeCard({
      buildingName: "armory",
      recipeId: "vest",
      recipe: {
        name: "Vesta",
        inputs: { "metal-parts": 2, "tech-core": 1 },
        output: { inventory: "weapons", itemId: "vest", amount: 1 },
        durationMs: 1000
      },
      inputAmounts: { "metal-parts": 10, "tech-core": 5 },
      maxBatches: 4,
      canStart: true
    }, {}, { mount });

    expect(card.querySelectorAll(".armory-slot__material-value").map((item) => item.textContent)).toEqual(["2/10", "1/5"]);

    const quantityButtons = card.querySelectorAll(".armory-slot__quantity-btn");
    quantityButtons[1].click();
    quantityButtons[1].click();
    expect(card.querySelectorAll(".armory-slot__material-value").map((item) => item.textContent)).toEqual(["6/10", "3/5"]);

    quantityButtons[0].click();
    expect(card.querySelectorAll(".armory-slot__material-value").map((item) => item.textContent)).toEqual(["4/10", "2/5"]);
  });

  it("spreads three drug lab inputs across the full supply row", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const card = renderRecipeCard({
      buildingName: "druglab",
      recipeId: "ghost-serum",
      recipe: {
        name: "Ghost Serum",
        inputs: { chemicals: 2, biomass: 1, "stim-pack": 2 },
        output: { inventory: "drugs", itemId: "ghost-serum", amount: 3 },
        durationMs: 1000
      },
      inputAmounts: { chemicals: 10, biomass: 10, "stim-pack": 10 },
      maxBatches: 3,
      canStart: true
    }, {}, { mount });

    expect(card.querySelector(".drug-production-slot__product")).toBe(null);
    expect(card.querySelector(".drug-production-slot__supply-row--count-3")).not.toBe(null);
    expect(card.querySelectorAll(".drug-production-slot__supply-value").map((item) => item.textContent)).toEqual(["2/10", "1/10", "2/10"]);
  });

  it("keeps non-neon drug lab slot controls interactive when inputs are missing", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const onStart = vi.fn();
    const card = renderRecipeCard({
      buildingName: "druglab",
      recipeId: "pulse-shot",
      recipe: {
        name: "Pulse Shot",
        inputs: { chemicals: 2, "stim-pack": 1 },
        output: { inventory: "drugs", itemId: "pulse-shot", amount: 5 },
        durationMs: 1000
      },
      inputAmounts: { chemicals: 0, "stim-pack": 0 },
      maxBatches: 0,
      maxSelectableBatches: 99,
      canStart: false,
      allowStartWithMissingInputs: true
    }, { onStart }, { mount });

    const quantityButtons = card.querySelectorAll(".drug-production-slot__quantity-btn");
    const startButton = card.querySelector("[data-drug-lab-slot-start]");
    expect(quantityButtons[1].disabled).toBe(false);
    expect(startButton.disabled).toBe(false);

    quantityButtons[1].click();
    quantityButtons[1].click();
    expect(card.querySelectorAll(".drug-production-slot__supply-value").map((item) => item.textContent)).toEqual(["6/0", "3/0"]);

    startButton.click();
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ recipeId: "pulse-shot", batchCount: 3 }));
  });

  it("starts pharmacy production with selected quantity and previews scaled clean cost", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const onStart = vi.fn();
    const recipe = {
      name: "Chemicals",
      cleanMoneyCost: 360,
      inputs: { biomass: 1 },
      output: { inventory: "materials", itemId: "chemicals", amount: 20 },
      durationMs: 60000
    };

    const card = renderRecipeCard({
      buildingName: "pharmacy",
      recipeId: "chemicals",
      recipe,
      inputAmounts: { biomass: 10 },
      outputCap: 15,
      maxBatches: 5,
      canStart: true
    }, { onStart, getMaxBatches: () => 5 }, {
      mount,
      formatCurrency: (value) => `$${value}`,
      formatDurationLabel: (value) => `${Math.ceil(Number(value || 0) / 60000)}m`
    });

    expect(card.querySelector(".pharmacy-slot__product")).toBe(null);
    expect(card.querySelector(".pharmacy-slot__title")?.textContent).toBe("Chemicals");

    const quantityButtons = card.querySelectorAll(".pharmacy-slot__quantity-btn");
    quantityButtons[1].click();
    quantityButtons[1].click();

    expect(findMetricValue(card, "Cena")).toBe("$1080 clean");
    expect(findMetricValue(card, "Vyrobeno")).toBe("0/15 ks");

    card.querySelector(".pharmacy-slot__btn--start").click();

    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({
      batchCount: 3
    }));
  });

  it("renders pharmacy running action as cancel instead of collect", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const onStop = vi.fn();
    const card = renderRecipeCard({
      buildingName: "pharmacy",
      recipeId: "meds",
      recipe: {
        name: "Meds",
        cleanMoneyCost: 50,
        inputs: { chemicals: 1 },
        output: { inventory: "drugs", itemId: "meds", amount: 1 },
        durationMs: 1000
      },
      job: {
        status: "running",
        cleanMoneyCost: 50,
        output: { inventory: "drugs", itemId: "meds", amount: 1 },
        quantity: 1,
        durationMs: 1000
      },
      canStart: false
    }, { onStop }, { mount });

    const cancelButton = card.querySelector(".pharmacy-slot__btn--stop");
    expect(cancelButton.textContent).toBe("Zrušit");
    expect(cancelButton.disabled).toBe(false);

    cancelButton.click();

    expect(onStop).toHaveBeenCalledOnce();
  });

  it("allows adding more quantity while recipe production is already running", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const onStart = vi.fn();
    const card = renderRecipeCard({
      buildingName: "druglab",
      recipeId: "neon-dust",
      recipe: {
        name: "Neon Dust",
        inputs: { chemicals: 3, biomass: 2 },
        output: { inventory: "drugs", itemId: "neon-dust", amount: 6 },
        durationMs: 1000
      },
      inputAmounts: { chemicals: 12, biomass: 12 },
      maxBatches: 4,
      canStart: true,
      job: {
        status: "running",
        output: { inventory: "drugs", itemId: "neon-dust", amount: 6 },
        quantity: 1,
        durationMs: 1000
      }
    }, { onStart }, { mount });

    const startButton = card.querySelector(".drug-lab-mini-btn");
    expect(startButton.textContent).toBe("Spustit");
    expect(startButton.disabled).toBe(false);

    card.querySelectorAll(".drug-production-slot__quantity-btn")[1].click();
    expect(card.querySelectorAll(".drug-production-slot__supply-value").map((item) => item.textContent)).toEqual(["6/12", "4/12"]);

    startButton.click();

    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ batchCount: 2 }));
  });

  it("shows countdown to next recipe output while production is running", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const now = new Date("2026-05-28T10:00:30.000Z").getTime();
    const card = renderRecipeCard({
      buildingName: "pharmacy",
      recipeId: "chemicals",
      recipe: {
        name: "Chemicals",
        output: { inventory: "materials", itemId: "chemicals", amount: 1 },
        durationMs: 60000
      },
      effectiveDurationMs: 60000,
      job: {
        status: "running",
        output: { inventory: "materials", itemId: "chemicals", amount: 3 },
        quantity: 3,
        durationMs: 180000,
        readyAt: new Date(now + 90000).toISOString()
      }
    }, {}, { mount, now });

    expect(findMetricValue(card, "Čas")).toBe("30s");
  });

  it("renders armory queue output against the 15 piece slot cap", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const card = renderRecipeCard({
      buildingName: "armory",
      recipeId: "baseball-bat",
      recipe: {
        name: "Baseballová pálka",
        inputs: { "metal-parts": 2 },
        output: { inventory: "weapons", itemId: "baseball-bat", amount: 5 },
        durationMs: 1000
      },
      inputAmounts: { "metal-parts": 20 },
      outputCap: 15,
      maxBatches: 1,
      canStart: true,
      job: {
        status: "running",
        output: { inventory: "weapons", itemId: "baseball-bat", amount: 10 },
        quantity: 2,
        durationMs: 2000
      }
    }, {}, { mount });

    expect(findMetricValue(card, "Ve frontě")).toBe("10/15 ks");
    expect(findMetricValue(card, "Vyrobeno")).toBe("0/15 ks");
    expect(findMetricValue(card, "Výstup")).toBe(null);
  });

  it("shows armory output as ready-to-collect amount only and marks attack/defense slot tone", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const attackRecipe = {
      name: "Baseballová pálka",
      inputs: { "metal-parts": 2 },
      output: { inventory: "weapons", itemId: "baseball-bat", amount: 5 },
      durationMs: 1000
    };
    const defenseRecipe = {
      name: "Vesta",
      inputs: { "metal-parts": 3, "tech-core": 1 },
      output: { inventory: "weapons", itemId: "vest", amount: 3 },
      durationMs: 1000
    };

    const idleCard = renderRecipeCard({
      buildingName: "armory",
      recipeId: "baseball-bat",
      recipe: attackRecipe,
      armoryStrengthPreview: {
        label: "Síla útoku",
        basePower: 5,
        bonusPower: 0.4,
        bonusLabel: "+0.4"
      },
      outputCap: 15
    }, {}, { mount });
    const readyCard = renderRecipeCard({
      buildingName: "armory",
      recipeId: "baseball-bat",
      recipe: attackRecipe,
      outputCap: 15,
      job: {
        status: "ready",
        output: { inventory: "weapons", itemId: "baseball-bat", amount: 2 },
        quantity: 2,
        durationMs: 1000
      }
    }, {}, { mount });
    const defenseCard = renderRecipeCard({
      buildingName: "armory",
      recipeId: "vest",
      recipe: defenseRecipe,
      armoryStrengthPreview: {
        label: "Síla obrany",
        basePower: 6,
        bonusPower: 0.3,
        bonusLabel: "+0.3"
      },
      outputCap: 15
    }, {}, { mount });

    expect(findMetricValue(idleCard, "Vyrobeno")).toBe("0/15 ks");
    expect(findMetricValue(readyCard, "Vyrobeno")).toBe("2/15 ks");
    expect(findMetricValue(readyCard, "Výstup")).toBe(null);
    expect(readyCard.querySelectorAll(".drug-lab-mini-btn")[1].textContent).toBe("Zrušit");
    expect(readyCard.querySelectorAll(".drug-lab-mini-btn")[1].disabled).toBe(true);
    expect(idleCard.className).toContain("armory-slot--attack");
    expect(defenseCard.className).toContain("armory-slot--defense");
    expect(idleCard.querySelector(".drug-production-slot__product")).toBe(null);
    expect(defenseCard.querySelector(".drug-production-slot__product")).toBe(null);
    expect(idleCard.querySelector(".armory-slot__strength").children.map((child) => child.textContent).join("")).toBe("Síla útoku 5 (+0.4)");
    expect(idleCard.querySelector(".armory-slot__strength-bonus").textContent).toBe("(+0.4)");
    expect(defenseCard.querySelector(".armory-slot__strength").children.map((child) => child.textContent).join("")).toBe("Síla obrany 6 (+0.3)");
  });

  it("keeps armory attack and defense recipe visuals grouped by icon role", () => {
    const attackGlyph = PRODUCTION_SLOT_VISUALS.armory.smg.iconGlyphClass;
    const defenseGlyph = PRODUCTION_SLOT_VISUALS.armory.barricades.iconGlyphClass;

    for (const recipeId of ["baseball-bat", "pistol", "grenade", "smg", "bazooka"]) {
      expect(PRODUCTION_SLOT_VISUALS.armory[recipeId].iconGlyphClass).toBe(attackGlyph);
      expect(PRODUCTION_SLOT_VISUALS.armory[recipeId].productLabel).toBeUndefined();
    }

    for (const recipeId of ["vest", "barricades", "cameras", "defense-tower", "alarm"]) {
      expect(PRODUCTION_SLOT_VISUALS.armory[recipeId].iconGlyphClass).toBe(defenseGlyph);
      expect(PRODUCTION_SLOT_VISUALS.armory[recipeId].productLabel).toBeUndefined();
    }
  });

  it("renders factory slots with queue quantity controls and scaled price", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const onStartSlot = vi.fn();
    const onPauseSlot = vi.fn();
    const card = renderFactorySlotCard({
      slot: {
        id: "combat",
        resourceKey: "combatModule",
        mode: "craft",
        isProducing: true,
        queuedAmount: 1,
        producedAmount: 0,
        productionRemainder: 0.5,
        lastTick: 100000
      },
      title: "Bojový modul",
      typeLabel: "",
      secondaryLine: "15 min",
      durationMs: 900000,
      priceLabel: "650 + 1 Tech Core",
      unitCost: { metalParts: 2, techCore: 1 },
      displayCost: { cleanCash: 650, techCore: 1 },
      queuedAmount: 1,
      slotStorageCap: 5
    }, { onStartSlot, onPauseSlot }, { mount, now: 100000 });

    expect(findMetricValue(card, "Výstup")).toBe(null);
    expect(card.querySelector(".drug-production-slot__product")).toBe(null);
    expect(findMetricValue(card, "Čas")).toBe("7m 30s");
    expect(findMetricValue(card, "Cena")).toBe("650 + 1 Tech Core");
    expect(findMetricValue(card, "Ve frontě")).toBe("1/5 ks");
    expect(card.querySelector("[data-factory-slot-toggle-state=\"start\"]").textContent).toBe("Spustit");
    expect(card.querySelector("[data-factory-slot-toggle-state=\"stop\"]").textContent).toBe("Zrušit");

    card.querySelectorAll(".factory-slot__quantity-btn")[1].click();

    expect(findMetricValue(card, "Cena")).toBe("1300 + 2 Tech Core");

    card.querySelector("[data-factory-slot-toggle-state=\"start\"]").click();

    expect(onStartSlot).toHaveBeenCalledWith(expect.any(Object), { batchCount: 2 });

    card.querySelector("[data-factory-slot-toggle-state=\"stop\"]").click();
    expect(onPauseSlot).toHaveBeenCalledWith(expect.any(Object));
  });

  it("shows pharmacy output as ready-to-collect capacity without unit text", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const recipe = {
      name: "Chemicals",
      cleanMoneyCost: 360,
      output: { inventory: "materials", itemId: "chemicals", amount: 20 },
      durationMs: 60000
    };

    const runningCard = renderRecipeCard({
      buildingName: "pharmacy",
      recipeId: "chemicals",
      recipe,
      outputCap: 15,
      job: {
        status: "running",
        output: { inventory: "materials", itemId: "chemicals", amount: 2 },
        quantity: 2,
        durationMs: 60000
      }
    }, {}, { mount });
    const readyCard = renderRecipeCard({
      buildingName: "pharmacy",
      recipeId: "chemicals",
      recipe,
      outputCap: 15,
      job: {
        status: "ready",
        output: { inventory: "materials", itemId: "chemicals", amount: 2 },
        quantity: 2,
        durationMs: 60000
      }
    }, {}, { mount });

    expect(findMetricValue(runningCard, "Vyrobeno")).toBe("0/15 ks");
    expect(findMetricValue(readyCard, "Vyrobeno")).toBe("2/15 ks");
    expect(readyCard.querySelector(".pharmacy-slot__btn--start").textContent).toBe("Spustit");
    expect(readyCard.querySelector(".pharmacy-slot__btn--start").disabled).toBe(false);
    expect(findMetricValue(readyCard, "Ve frontě")).toBe("0/15 ks");
  });

  it("keeps pharmacy info tab concise and focused on active mechanics", () => {
    const document = setupDocument();
    const infoTextElement = document.createElement("p");
    const infoEffectsElement = document.createElement("p");
    const infoActionsElement = document.createElement("ul");

    renderProductionBuildingInfo({
      infoTextElement,
      infoEffectsElement,
      infoActionsElement,
      buildingName: "pharmacy",
      config: {
        infoText: "Lékárna vyrábí základní materiály pro Lab.",
        infoActions: ["Vybrat", "Zrušit", "Upgrade"]
      },
      state: { level: 2 },
      maxLevel: 14,
      multiplier: 1.2,
      nextMultiplier: 1.3,
      effectsLabel: "Lékárna · produkce +20%",
      readyCount: 2,
      upgradeCost: 100
    }, {}, { mount: document.body, formatCurrency: (value) => `$${value}` });

    expect(infoTextElement.textContent).toBe("Lékárna vyrábí základní materiály pro Lab.");
    expect(infoEffectsElement.textContent).not.toContain("fronta po kusech");
    expect(infoEffectsElement.textContent).not.toContain("zrušení vrací náklady");
    expect(infoTextElement.textContent).not.toContain("Hotovo k vyzvednutí");
    expect(infoActionsElement.children).toHaveLength(0);
  });

  it("keeps armory info tab compact and removes special action rows", () => {
    const document = setupDocument();
    const infoTextElement = document.createElement("p");
    const infoEffectsElement = document.createElement("p");
    const infoActionsElement = document.createElement("ul");

    renderProductionBuildingInfo({
      infoTextElement,
      infoEffectsElement,
      infoActionsElement,
      buildingName: "armory",
      config: {
        infoText: "Zbrojovka vyrábí výzbroj.",
        outputCap: 15
      },
      state: { level: 3 },
      maxLevel: 14,
      multiplier: 1.2,
      nextMultiplier: 1.3,
      effectsLabel: "Zbrojovka · produkce +20%",
      readyCount: 2,
      upgradeCost: 100
    }, {}, { mount: document.body, formatCurrency: (value) => `$${value}` });

    expect(infoTextElement.textContent).toBe("Zbrojovka vyrábí výzbroj.");
    expect(infoEffectsElement.textContent).toContain("max výstup 15 ks");
    expect(infoEffectsElement.textContent).not.toContain("vstupy podle množství");
    expect(infoEffectsElement.textContent).not.toContain("Speciální akce");
    expect(infoActionsElement.children).toHaveLength(0);
  });

  it("keeps lab info tab focused on current mechanics", () => {
    const document = setupDocument();
    const infoTextElement = document.createElement("p");
    const infoEffectsElement = document.createElement("p");
    const infoActionsElement = document.createElement("ul");

    renderProductionBuildingInfo({
      infoTextElement,
      infoEffectsElement,
      infoActionsElement,
      buildingName: "druglab",
      config: {
        infoText: "Lab míchá výrobu z Lékarny do drog a podpůrných směsí pro další byznys a boost."
      },
      state: { level: 2 },
      maxLevel: 14,
      multiplier: 1.1,
      nextMultiplier: 1.2,
      effectsLabel: "Lab · produkce +10%",
      readyCount: 1,
      upgradeCost: 100
    }, {}, { mount: document.body, formatCurrency: (value) => `$${value}` });

    expect(infoTextElement.textContent).toBe("Lab míchá výrobu z Lékarny do drog a podpůrných směsí pro další byznys a boost.");
    expect(infoEffectsElement.textContent).not.toContain("fronta po dávkách");
    expect(infoEffectsElement.textContent).not.toContain("vstupy podle množství");
    expect(infoActionsElement.children).toHaveLength(0);
  });

  it("missing DOM containers do not crash", () => {
    setupDocument();

    expect(renderProductionPanel({ mount: null, recipes: [] })).toBe(false);
    expect(ensureBuildingDetailPanel(null)).toBe(null);
  });
});
