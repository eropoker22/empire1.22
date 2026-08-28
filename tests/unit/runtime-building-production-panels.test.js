import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensureBuildingDetailPanel,
  renderBuildingDetailInfoSection,
  renderBuildingDetailPanel
} from "../../page-assets/js/app/ui/buildingDetailPanel.js";
import {
  renderBuildingDetailPanel as renderClientBuildingDetailPanel
} from "../../client/page-assets/js/app/ui/buildingDetailPanel.js";
import {
  renderCollectProductionButton,
  renderFactoryBuildingInfo,
  renderProductionBuildingInfo,
  renderFactorySlotCard,
  renderServerFactorySlotList,
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

const buildingDetailPanelRenderers = [
  ["source", renderBuildingDetailPanel],
  ["client", renderClientBuildingDetailPanel]
];

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
  it.each(buildingDetailPanelRenderers)("renders building detail with canonical collect identity using the %s renderer", (_implementation, renderPanel) => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:factory" });

    renderPanel({
      shell,
      title: "Továrna",
      badge: "Výroba",
      levelLabel: "L3",
      name: "Továrna",
      meta: "District 1",
      stats: [{ label: "Čisté / hod", value: "$120" }],
      mechanics: [{ label: "Výstup", value: "Metal Parts" }],
      buildingTypeId: "apartment_block",
      collect: {
        visible: true,
        enabled: true,
        title: "Vybrat připravený výstup",
        actionId: "collect_population",
        buildingTypeId: "apartment_block"
      },
      upgrade: { disabled: false, title: "Upgrade na L4" },
      actions: []
    });

    expect(shell.hidden).toBe(false);
    expect(shell.querySelector("[data-district-building-detail-title]").textContent).toBe("Továrna");
    expect(shell.querySelector("[data-district-building-detail-stats]").children[0].children[0].textContent).toBe("Čisté / hod");
    const readyCollectButton = shell.querySelector("[data-district-building-detail-collect]");
    expect(readyCollectButton.classList.contains("is-empty")).toBe(false);
    expect(readyCollectButton.dataset.districtBuildingDetailActionId).toBe("collect_population");
    expect(readyCollectButton.dataset.districtBuildingDetailBuildingTypeId).toBe("apartment_block");

    renderPanel({
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
    expect(emptyCollectButton.dataset.districtBuildingDetailActionId).toBeUndefined();
    expect(emptyCollectButton.dataset.districtBuildingDetailBuildingTypeId).toBeUndefined();

    renderPanel({
      shell,
      title: "Bytový blok",
      collect: {
        visible: true,
        enabled: false,
        title: "Bytový blok potřebuje alespoň 10 lidí k výběru.",
        actionId: "collect_population",
        buildingTypeId: "apartment_block"
      },
      upgrade: { disabled: true, title: "" },
      stats: [],
      mechanics: [],
      actions: []
    });

    const pendingCollectButton = shell.querySelector("[data-district-building-detail-collect]");
    expect(pendingCollectButton.disabled).toBe(true);
    expect(pendingCollectButton.dataset.districtBuildingDetailActionId).toBe("collect_population");
    expect(pendingCollectButton.dataset.districtBuildingDetailBuildingTypeId).toBe("apartment_block");

    expect(() => renderPanel(null)).not.toThrow();
    expect(() => renderPanel({ shell, stats: [], mechanics: [], actions: [] })).not.toThrow();
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

  it("keeps one special-action submission in flight and ignores rapid duplicate clicks", async () => {
    const document = setupDocument();
    const root = document.createElement("div");
    let finishSubmission;
    const onRunAction = vi.fn(() => new Promise((resolve) => {
      finishSubmission = resolve;
    }));
    const shell = ensureBuildingDetailPanel(root, { onRunAction }, { popupKey: "12:casino-single-flight" });

    renderBuildingDetailPanel({
      shell,
      mechanicsType: "casino",
      title: "Kasino",
      name: "Kasino",
      stats: [],
      mechanics: [],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { disabled: true, title: "" },
      showActionsInSinglePanel: true,
      actions: [{
        index: 0,
        actionId: "vip_night",
        buildingTypeId: "casino",
        title: "VIP noc"
      }]
    });

    const action = shell.querySelector("[data-district-building-detail-action-index]");
    const command = action.querySelector(".building-info-action-row__button");
    const body = shell.querySelector(".district-building-detail-body");
    const clickAction = () => {
      for (const handler of body.eventListeners.get("click") || []) handler({ target: action });
    };

    clickAction();
    clickAction();

    expect(onRunAction).toHaveBeenCalledTimes(1);
    expect(action.disabled).toBe(true);
    expect(action.dataset.districtBuildingDetailActionSubmitting).toBe("true");
    expect(command.textContent).toBe("PROBÍHÁ…");

    finishSubmission(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(action.disabled).toBe(false);
    expect(action.dataset.districtBuildingDetailActionSubmitting).toBeUndefined();
    expect(command.textContent).toBe("SPUSTIT");
  });

  it("shows a disabled action reason directly inside the grey action button", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "2:dealers" });

    renderBuildingDetailPanel({
      shell,
      mechanicsType: "recycling-center",
      title: "Recyklační centrum",
      badge: "Obnova materiálu",
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
        actionId: "extract_losses",
        buildingTypeId: "recycling_center",
        title: "Vytěžit ztráty",
        disabled: true,
        disabledReason: "Nemáš žádné ztráty k vytěžení.",
        disabledTone: "insufficient-funds",
        cooldownLabel: "Cooldown 16m 00s"
      }]
    });

    const action = shell.querySelector("[data-district-building-detail-action-id='extract_losses']");
    expect(action.disabled).toBe(true);
    expect(action.dataset.districtBuildingDetailDisabledTone).toBe("insufficient-funds");
    expect(action.querySelector(".building-info-action-row__desc").hidden).toBe(false);
    expect(action.querySelector(".building-info-action-row__desc").textContent).toBe("Nemáš žádné ztráty k vytěžení.");
  });

  it("toggles the compact full-store effects layout only for a full convenience store", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:convenience-store" });
    const viewModel = {
      shell,
      mechanicsType: "convenience-store",
      title: "Večerka",
      name: "Večerka",
      stats: [],
      mechanics: [],
      effects: [
        { text: "Clean cash +100/h", tone: "clean" },
        { text: "Plná kapacita", tone: "neutral" }
      ],
      collect: { visible: true, enabled: true, title: "Vybrat obyvatele" },
      upgrade: { visible: false, disabled: true, title: "" },
      actions: []
    };

    renderBuildingDetailPanel({ ...viewModel, convenienceStoreIsFull: true });
    expect(shell.classList.contains("is-convenience-store-full")).toBe(true);

    renderBuildingDetailPanel({ ...viewModel, convenienceStoreIsFull: false });
    expect(shell.classList.contains("is-convenience-store-full")).toBe(false);
  });

  it("marks only authoritative cash, heat and influence effect numbers as dynamic presentation values", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "83:casino" });

    renderBuildingDetailPanel({
      shell,
      mechanicsType: "casino",
      title: "Kasino",
      name: "Kasino",
      stats: [],
      mechanics: [],
      effects: [
        { text: "Clean cash +$4572/hod", tone: "clean" },
        { text: "Dirty cash +$2540/hod", tone: "dirty" },
        { text: "Heat +150/den", tone: "heat" },
        { text: "Vliv +121/den", tone: "influence" },
        { text: "DEN: dirty $2540/h -> $2235/h · heat 150/den -> 168/den", tone: "phase" },
        { text: "DEN: heat 150/den -> 143/den · vliv 120/den -> 134/den", tone: "phase" },
        {
          text: "NOC: clean $1800/h -> $1890/h · dirty $1200/h -> $1440/h",
          tone: "phase"
        },
        {
          text: "DEN: clean $100/h -> $50/h · dirty $100/h -> $50/h · drby -10 % · přesnost +8 %",
          tone: "phase"
        },
        {
          text: "DEN: clean $10800/h -> $12420/h · dirty $2700/h -> $2430/h · heat 288/den -> 316/den",
          tone: "phase"
        },
        {
          text: "DEN: clean $10800/h -> $12420/h · dirty $2700/h -> $2430/h · heat 288/den -> 316/den · drby +5 % · přesnost -6 %",
          tone: "phase"
        },
        {
          text: "DEN: clean $10800/h -> $12420/h · dirty $2700/h -> $2430/h · heat 288/den -> 316/den · reputace 5/den -> 6/den",
          tone: "phase"
        },
        {
          text: "DEN: clean $100/h -> $50/h · dirty $100/h -> $50/h · přesnost +8 % · drby -10 %",
          tone: "phase"
        },
        { text: "Dirty cash +$500", tone: "dirty" }
      ],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { disabled: true, title: "" },
      actions: []
    });

    const effects = shell.querySelectorAll(".district-building-detail-effect-cell");
    const dynamicValues = (effect) => Array.from(
      effect.querySelectorAll("[data-building-dynamic-effect]")
    ).map((element) => ({
      kind: element.dataset.buildingDynamicEffect,
      text: element.textContent
    }));
    expect(effects[0].children[0].textContent).toBe("Clean cash +$4572/hod");
    expect(dynamicValues(effects[0])).toEqual([{ kind: "clean-cash-rate", text: "4572" }]);
    expect(effects[1].children[0].textContent).toBe("Dirty cash +$2540/hod");
    expect(dynamicValues(effects[1])).toEqual([{ kind: "dirty-cash-rate", text: "2540" }]);
    expect(dynamicValues(effects[2])).toEqual([{ kind: "heat-rate", text: "150" }]);
    expect(effects[2].children[0].textContent).toBe("Heat +150/den");
    expect(dynamicValues(effects[3])).toEqual([{ kind: "influence-rate", text: "121" }]);
    expect(effects[4].children[0].textContent).toBe("DEN: dirty $2540/h -> $2235/h · heat 150/den -> 168/den");
    expect(dynamicValues(effects[4])).toEqual([
      { kind: "phase-dirty-cash-base", text: "2540" },
      { kind: "phase-dirty-cash-effective", text: "2235" },
      { kind: "phase-heat-base", text: "150" },
      { kind: "phase-heat-effective", text: "168" }
    ]);
    expect(effects[4].querySelector("strong").children.at(-1).textContent).toBe("/den");
    expect(effects[5].children[0].textContent).toBe(
      "DEN: heat 150/den -> 143/den · vliv 120/den -> 134/den"
    );
    expect(dynamicValues(effects[5])).toEqual([
      { kind: "phase-heat-base", text: "150" },
      { kind: "phase-heat-effective", text: "143" }
    ]);
    expect(effects[5].querySelector("strong").children.at(-1).textContent).toBe(
      "/den · vliv 120/den -> 134/den"
    );
    expect(effects[6].children[0].textContent).toBe(
      "NOC: clean $1800/h -> $1890/h · dirty $1200/h -> $1440/h"
    );
    expect(dynamicValues(effects[6])).toEqual([
      { kind: "phase-clean-cash-base", text: "1800" },
      { kind: "phase-clean-cash-effective", text: "1890" },
      { kind: "phase-dirty-cash-base", text: "1200" },
      { kind: "phase-dirty-cash-effective", text: "1440" }
    ]);
    expect(effects[6].querySelector("strong").children.at(-1).textContent).toBe("/h");
    expect(effects[7].children[0].textContent).toBe(
      "DEN: clean $100/h -> $50/h · dirty $100/h -> $50/h · drby -10 % · přesnost +8 %"
    );
    expect(dynamicValues(effects[7])).toEqual([
      { kind: "phase-clean-cash-base", text: "100" },
      { kind: "phase-clean-cash-effective", text: "50" },
      { kind: "phase-dirty-cash-base", text: "100" },
      { kind: "phase-dirty-cash-effective", text: "50" }
    ]);
    expect(effects[7].querySelector("strong").children.at(-1).textContent).toBe(
      "/h · drby -10 % · přesnost +8 %"
    );
    expect(effects[8].children[0].textContent).toBe(
      "DEN: clean $10800/h -> $12420/h · dirty $2700/h -> $2430/h · heat 288/den -> 316/den"
    );
    expect(dynamicValues(effects[8])).toEqual([
      { kind: "phase-clean-cash-base", text: "10800" },
      { kind: "phase-clean-cash-effective", text: "12420" },
      { kind: "phase-dirty-cash-base", text: "2700" },
      { kind: "phase-dirty-cash-effective", text: "2430" },
      { kind: "phase-heat-base", text: "288" },
      { kind: "phase-heat-effective", text: "316" }
    ]);
    expect(effects[8].querySelector("strong").children.at(-1).textContent).toBe("/den");
    expect(effects[9].children[0].textContent).toBe(
      "DEN: clean $10800/h -> $12420/h · dirty $2700/h -> $2430/h · heat 288/den -> 316/den · drby +5 % · přesnost -6 %"
    );
    expect(dynamicValues(effects[9])).toEqual([
      { kind: "phase-clean-cash-base", text: "10800" },
      { kind: "phase-clean-cash-effective", text: "12420" },
      { kind: "phase-dirty-cash-base", text: "2700" },
      { kind: "phase-dirty-cash-effective", text: "2430" },
      { kind: "phase-heat-base", text: "288" },
      { kind: "phase-heat-effective", text: "316" }
    ]);
    expect(effects[9].querySelector("strong").children.at(-1).textContent).toBe(
      "/den · drby +5 % · přesnost -6 %"
    );
    expect(effects[10].children[0].textContent).toBe(
      "DEN: clean $10800/h -> $12420/h · dirty $2700/h -> $2430/h · heat 288/den -> 316/den · reputace 5/den -> 6/den"
    );
    expect(dynamicValues(effects[10])).toEqual([]);
    expect(effects[11].children[0].textContent).toBe(
      "DEN: clean $100/h -> $50/h · dirty $100/h -> $50/h · přesnost +8 % · drby -10 %"
    );
    expect(dynamicValues(effects[11])).toEqual([]);
    expect(dynamicValues(effects[12])).toEqual([]);
  });

  it("marks only population-buffer value nodes as dynamic", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "62:school" });

    renderBuildingDetailPanel({
      shell,
      mechanicsType: "school",
      title: "Škola",
      name: "Škola",
      stats: [
        {
          label: "Populace",
          value: "4/12",
          dynamicValue: "population-buffer",
          dynamicStaticCapacity: 12
        },
        { label: "Clean / min", value: "+$10" },
        { label: "Do naplnění", value: "2 min", dynamicValue: "population-buffer" }
      ],
      mechanics: [
        { label: "K výběru", value: "4/12", dynamicValue: "population-buffer" },
        { label: "Produkce", value: "+0.25 populace/min" }
      ],
      effects: [
        {
          dynamicValue: "population-buffer",
          dynamicStaticCapacity: 12,
          text: "4/12",
          tone: "population"
        },
        {
          dynamicValue: "population-buffer",
          dynamicValuePrefix: "Naplnění za ",
          text: "Naplnění za 2 min",
          tone: "cooldown"
        }
      ],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { disabled: true, title: "" },
      actions: []
    });

    const stats = shell.querySelector("[data-district-building-detail-stats]").children;
    const mechanics = shell.querySelector("[data-district-building-detail-mechanics]").children;
    expect(stats[0].dataset.buildingDynamicValue).toBeUndefined();
    expect(stats[0].children[1].dataset.buildingDynamicValue).toBeUndefined();
    expect(stats[0].children[1].children[0].dataset.buildingDynamicValue).toBe("population-buffer");
    expect(stats[0].children[1].children[0].textContent).toBe("4");
    expect(stats[0].children[1].children[1].dataset.buildingPopulationCapacity).toBe("12");
    expect(stats[0].children[1].children[1].textContent).toBe("/12");
    expect(stats[1].children[1].dataset.buildingDynamicValue).toBeUndefined();
    expect(stats[2].children[1].children[0].dataset.buildingDynamicValue).toBe("population-buffer");
    expect(mechanics[0].dataset.buildingDynamicValue).toBeUndefined();
    expect(mechanics[0].children[1].children[0].dataset.buildingDynamicValue).toBe("population-buffer");
    expect(mechanics[1].children[1].dataset.buildingDynamicValue).toBeUndefined();
    const effectValues = shell.querySelectorAll(".district-building-detail-effect-cell");
    expect(effectValues[0].children[0].children[0].dataset.buildingDynamicValue).toBe("population-buffer");
    expect(effectValues[0].children[0].children[0].textContent).toBe("4");
    expect(effectValues[0].children[0].children[1].dataset.buildingPopulationCapacity).toBe("12");
    expect(effectValues[0].children[0].children[1].textContent).toBe("/12");
    const countdownEffectValue = effectValues[1].children[0];
    expect(countdownEffectValue.dataset.buildingDynamicLayout).toBe("prefixed");
    expect(countdownEffectValue.children[0].dataset.buildingStaticValue).toBe("population-buffer-prefix");
    expect(countdownEffectValue.children[0].textContent).toBe("Naplnění za ");
    expect(countdownEffectValue.children[1].dataset.buildingDynamicValue).toBe("population-buffer");
    expect(countdownEffectValue.children[1].textContent).toBe("2 min");
  });

  it("renders fixed Street Dealer slots and submits the slot-bound local sale intent", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const onRunAction = vi.fn();
    const shell = ensureBuildingDetailPanel(root, { onRunAction }, { popupKey: "2:dealers" });

    renderBuildingDetailPanel({
      shell,
      mechanicsType: "street-dealers",
      title: "Pouliční dealeři",
      badge: "Distribuce",
      levelLabel: "L1",
      name: "Pouliční dealeři",
      stats: [],
      mechanics: [],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { disabled: true, title: "" },
      showActionsInSinglePanel: true,
      actions: [{
        index: 0,
        actionId: "start_drug_sale",
        buildingTypeId: "street_dealers",
        title: "Spustit prodej",
        disabled: false,
        dealerSale: {
          phase: "day",
          phaseStatusLabel: "DEN: heat +30 %, riziko +10 p. b.",
          slots: [
            { slotId: "slot-1", label: "Neon Dust", itemId: "neon-dust", itemLabel: "Neon Dust", ownedAmount: 10, unitSalePriceDirtyCash: 625, minimumAmountPerSale: 10, locked: false, statusLabel: "Připraveno" },
            { slotId: "slot-2", label: "Pulse Shot", itemId: "pulse-shot", itemLabel: "Pulse Shot", ownedAmount: 10, unitSalePriceDirtyCash: 1000, minimumAmountPerSale: 10, locked: false, statusLabel: "Připraveno" },
            { slotId: "slot-3", label: "Velvet Smoke", itemId: "velvet-smoke", itemLabel: "Velvet Smoke", ownedAmount: 10, unitSalePriceDirtyCash: 1125, minimumAmountPerSale: 10, locked: false, statusLabel: "Připraveno" }
          ],
          items: [
            { itemId: "neon-dust", label: "Neon Dust", ownedAmount: 10, minimumAmountPerSale: 10, unitSalePriceDirtyCash: 625 }
          ]
        }
      }]
    });

    const action = shell.querySelector("[data-district-building-detail-action-id='start_drug_sale']");
    const slot = shell.querySelector("[data-dealer-sale-slot]");
    const item = shell.querySelector("[data-dealer-sale-item]");
    const amount = shell.querySelector("[data-dealer-sale-amount]");
    expect(slot.children).toHaveLength(3);
    expect(item.children).toHaveLength(0);
    const slotLabels = Array.from(slot.children).map((option) => option.textContent);
    expect(slotLabels).toEqual([
      "Neon Dust · Připraveno",
      "Pulse Shot · Připraveno",
      "Velvet Smoke · Připraveno"
    ]);
    expect(slotLabels.join(" ")).not.toContain("Slot 1");
    expect(slotLabels.join(" ")).not.toContain("Volný");

    slot.value = "slot-1";
    amount.value = "10";
    for (const handler of amount.eventListeners.get("input") || []) handler({ target: amount });
    expect(shell.querySelector(".dealer-sale-action__status").textContent).toContain("DEN: heat +30 %");
    expect(action.disabled).toBe(false);
    const modalBody = shell.querySelector(".district-building-detail-body");
    for (const handler of modalBody.eventListeners.get("click") || []) handler({ target: action });

    expect(onRunAction).toHaveBeenCalledTimes(1);
    const [receivedShell, payload] = onRunAction.mock.calls[0];
    expect(receivedShell).toBe(shell);
    expect(payload).toMatchObject({
      actionId: "start_drug_sale",
      dealerSlotId: "slot-1",
      itemId: "neon-dust",
      amount: 10
    });
  });

  it("renders projected select, number and text inputs and submits exact typed values", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const onRunAction = vi.fn();
    const shell = ensureBuildingDetailPanel(root, { onRunAction }, { popupKey: "79:stock-exchange" });

    renderBuildingDetailPanel({
      shell,
      mechanicsType: "exchange",
      title: "Burza",
      name: "Burza",
      stats: [],
      mechanics: [],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { disabled: true, title: "" },
      showActionsInSinglePanel: true,
      actions: [{
        index: 0,
        actionId: "speculative_buy",
        buildingTypeId: "stock_exchange",
        title: "Spekulativní nákup",
        disabled: false,
        requiresInput: [
          {
            id: "targetCategory",
            type: "select",
            label: "Kategorie marketu",
            required: true,
            options: [
              { value: "chemicals", label: "Chemicals" },
              { value: "electronics", label: "Electronics" }
            ]
          },
          {
            id: "investmentCleanCash",
            type: "number",
            label: "Investice",
            required: true,
            min: 1,
            max: 5000
          },
          {
            id: "targetZone",
            type: "text",
            label: "Cílová zóna",
            required: false
          }
        ]
      }]
    });

    const action = shell.querySelector("[data-district-building-detail-action-id='speculative_buy']");
    const targetCategory = shell.querySelector("[data-building-action-input='targetCategory']");
    const investment = shell.querySelector("[data-building-action-input='investmentCleanCash']");
    const targetZone = shell.querySelector("[data-building-action-input='targetZone']");
    expect(action.closest("[data-building-action-inputs]").dataset.buildingActionInputsActionId).toBe("speculative_buy");
    expect(targetCategory.tagName).toBe("SELECT");
    expect(targetCategory.children.map((option) => option.value)).toEqual(["chemicals", "electronics"]);
    expect(investment.type).toBe("number");
    expect(investment.min).toBe("1");
    expect(investment.max).toBe("5000");
    expect(targetZone.type).toBe("text");

    investment.value = "";
    for (const handler of investment.eventListeners.get("input") || []) handler({ target: investment });
    expect(action.disabled).toBe(true);
    expect(shell.querySelector(".building-action-inputs__status").textContent).toBe(
      "Doplň všechna povinná pole."
    );

    targetCategory.value = "electronics";
    investment.value = "2750";
    targetZone.value = "downtown";
    for (const control of [targetCategory, investment, targetZone]) {
      for (const handler of control.eventListeners.get("input") || []) handler({ target: control });
    }
    expect(action.disabled).toBe(false);

    const modalBody = shell.querySelector(".district-building-detail-body");
    for (const handler of modalBody.eventListeners.get("click") || []) handler({ target: action });

    expect(onRunAction).toHaveBeenCalledTimes(1);
    const [, payload] = onRunAction.mock.calls[0];
    expect(payload.inputs).toEqual({
      targetCategory: "electronics",
      investmentCleanCash: 2750,
      targetZone: "downtown"
    });
    expect(payload).toMatchObject({
      actionId: "speculative_buy",
      targetCategory: "electronics",
      investmentCleanCash: 2750,
      targetZone: "downtown"
    });
  });

  it("keeps the action command at the bottom while the cooldown remains specific", () => {
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
    expect(action.querySelector(".building-info-action-row__button").textContent).toBe("COOLDOWN");
    expect(action.querySelector(".building-info-action-row__cooldown").textContent).toBe("Zbývá 12m 00s");
  });

  it("renders a clear bottom command for ready downtown actions", () => {
    const document = setupDocument();
    const root = document.createElement("div");
    const shell = ensureBuildingDetailPanel(root, {}, { popupKey: "1:stock" });

    renderBuildingDetailPanel({
      shell,
      districtType: "downtown",
      mechanicsType: "stock-exchange",
      title: "Burza",
      badge: "",
      levelLabel: "",
      name: "Burza",
      meta: "",
      stats: [],
      mechanics: [],
      collect: { visible: false, enabled: false, title: "" },
      upgrade: { visible: false, disabled: true, title: "" },
      showActionsInSinglePanel: true,
      actions: [{
        index: 0,
        actionId: "speculative_buy",
        buildingTypeId: "stock_exchange",
        title: "Spekulativní nákup",
        rewardSummary: "Materiálový market: zisk, neutrální výsledek nebo ztráta.",
        cooldownLabel: "Čekání 16m 00s",
        cooldownRemainingMs: 0,
        disabled: false
      }]
    });

    const action = shell.querySelector("[data-district-building-detail-action-id='speculative_buy']");
    expect(shell.dataset.buildingDistrictType).toBe("downtown");
    expect(action.querySelector(".building-info-action-row__desc").textContent).toContain("Materiálový market");
    expect(action.querySelector(".building-info-action-row__button").textContent).toBe("SPUSTIT");
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

  it("preserves equivalent production card nodes until their presentation or scope changes", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const createCard = (status) => {
      const card = document.createElement("article");
      card.className = "drug-production-slot";
      const label = document.createElement("strong");
      label.textContent = status;
      card.append(label);
      return card;
    };

    renderProductionPanel({
      mount,
      recipes: [{ prebuiltCard: createCard("Připraveno") }]
    }, {}, { presentationScopeKey: "druglab:building:a" });
    const firstCard = mount.children[0];

    renderProductionPanel({
      mount,
      recipes: [{ prebuiltCard: createCard("Připraveno") }]
    }, {}, { presentationScopeKey: "druglab:building:a" });
    expect(mount.children[0]).toBe(firstCard);

    renderProductionPanel({
      mount,
      recipes: [{ prebuiltCard: createCard("Připraveno") }]
    }, {}, { presentationScopeKey: "druglab:building:b" });
    const otherBuildingCard = mount.children[0];
    expect(otherBuildingCard).not.toBe(firstCard);

    renderProductionPanel({
      mount,
      recipes: [{ prebuiltCard: createCard("Výroba") }]
    }, {}, { presentationScopeKey: "druglab:building:b" });
    expect(mount.children[0]).not.toBe(otherBuildingCard);
    expect(mount.children[0].textContent).toBe("");
    expect(mount.children[0].children[0].textContent).toBe("Výroba");
  });

  it("uses the latest recipe callback when an equivalent production card stays mounted", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const firstOnStart = vi.fn();
    const latestOnStart = vi.fn();
    const createViewModel = (revision) => ({
      districtId: "district-a",
      buildingId: "building-a",
      buildingName: "druglab",
      recipeId: "pulse-shot",
      revision,
      recipe: {
        name: "Pulse Shot",
        inputs: {},
        output: { inventory: "drugs", itemId: "pulse-shot", amount: 1 },
        durationMs: 1000
      },
      inputAmounts: {},
      maxBatches: 1,
      canStart: true
    });

    const firstCard = renderRecipeCard(createViewModel(1), { onStart: firstOnStart }, { mount });
    renderProductionPanel({ mount, recipes: [{ prebuiltCard: firstCard }] }, {}, {
      presentationScopeKey: "druglab:district-a:building-a"
    });
    const mountedCard = mount.children[0];

    const nextCard = renderRecipeCard(createViewModel(2), { onStart: latestOnStart }, { mount });
    renderProductionPanel({ mount, recipes: [{ prebuiltCard: nextCard }] }, {}, {
      presentationScopeKey: "druglab:district-a:building-a"
    });

    expect(mount.children[0]).toBe(mountedCard);
    mountedCard.querySelector("[data-drug-lab-slot-start]").click();
    expect(firstOnStart).not.toHaveBeenCalled();
    expect(latestOnStart).toHaveBeenCalledWith(expect.objectContaining({ revision: 2, batchCount: 1 }));
  });

  it("replaces a visually equivalent recipe card when its quantity limit changes", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const createViewModel = (maxBatches) => ({
      districtId: "district-a",
      buildingId: "building-a",
      buildingName: "druglab",
      recipeId: "pulse-shot",
      recipe: {
        name: "Pulse Shot",
        inputs: {},
        output: { inventory: "drugs", itemId: "pulse-shot", amount: 1 },
        durationMs: 1000
      },
      inputAmounts: {},
      maxBatches,
      maxSelectableBatches: maxBatches,
      canStart: true
    });

    const firstCard = renderRecipeCard(createViewModel(4), {}, { mount });
    renderProductionPanel({ mount, recipes: [{ prebuiltCard: firstCard }] }, {}, {
      presentationScopeKey: "druglab:district-a:building-a"
    });
    const mountedCard = mount.children[0];

    const nextCard = renderRecipeCard(createViewModel(2), {}, { mount });
    renderProductionPanel({ mount, recipes: [{ prebuiltCard: nextCard }] }, {}, {
      presentationScopeKey: "druglab:district-a:building-a"
    });

    expect(mount.children[0]).not.toBe(mountedCard);
    const quantityButtons = mount.children[0].querySelectorAll(".drug-production-slot__quantity-btn");
    quantityButtons[1].click();
    quantityButtons[1].click();
    expect(mount.children[0].querySelector(".armory-slot__quantity-value").textContent).toBe("2");
    expect(quantityButtons[1].disabled).toBe(true);
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
    expect(disabled.querySelector(".pharmacy-slot__btn--start").title).toContain("Chybí vstupy");
    expect(disabled.querySelector(".pharmacy-slot__btn--stop").disabled).toBe(true);
    expect(disabled.querySelector(".pharmacy-slot__btn--stop").title).toContain("Není co zrušit");
    expect(renderRecipeList([{ buildingName: "pharmacy", recipeId: "stim", recipe }], {}, { mount }).children).toHaveLength(1);
  });

  it("renders instant Pharmacy output from authoritative warehouse inventory", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const card = renderRecipeCard({
      buildingName: "pharmacy",
      recipeId: "chemicals",
      recipe: {
        name: "Chemikálie",
        inputs: {},
        output: { inventory: "materials", itemId: "chemicals", amount: 1 },
        cleanMoneyCost: 360,
        durationMs: 10_000
      },
      executionMode: "instant",
      outputInventoryAmount: 59,
      outputInventoryCapacity: 60,
      outputCap: 12,
      queueCap: 8,
      maxBatches: 1,
      canStart: true
    }, {}, { mount });

    expect(findMetricValue(card, "Ve skladu")).toBe("59/60 ks");
    expect(findMetricValue(card, "Vyrobeno")).toBe(null);
    expect(findMetricValue(card, "Čas")).toBe("Okamžitě");
    expect(findMetricValue(card, "Fronta")).toBe("Bez fronty");
    expect(card.querySelector(".pharmacy-slot__btn--stop")).toBe(null);
  });

  it("renders instant Drug Lab output only from authoritative warehouse inventory", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const card = renderRecipeCard({
      buildingName: "druglab",
      recipeId: "neon-dust",
      recipe: {
        name: "Neon Dust",
        inputs: { chemicals: 2 },
        output: { inventory: "drugs", itemId: "neon-dust", amount: 1 },
        durationMs: 10_000
      },
      executionMode: "instant",
      outputInventoryAmount: 20,
      outputInventoryCapacity: 60,
      outputCap: 10,
      queueCap: 8,
      maxBatches: 1,
      canStart: true
    }, {}, { mount });

    expect(findMetricValue(card, "Ve skladu")).toBe("20/60 ks");
    expect(findMetricValue(card, "Vyrobeno")).toBe(null);
    expect(findMetricValue(card, "Čas")).toBe("Okamžitě");
    expect(findMetricValue(card, "Fronta")).toBe("Bez fronty");
    expect(card.querySelector("[data-drug-lab-slot-stop]")).toBe(null);
  });

  it("keeps recipe queue metrics tied to real jobs instead of selected previews", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const recipe = {
      name: "Neon Dust",
      inputs: { chemicals: 2 },
      output: { inventory: "drugs", itemId: "neon-dust", amount: 1 },
      durationMs: 1000
    };

    const idleCard = renderRecipeCard({
      buildingName: "druglab",
      recipeId: "neon-dust",
      recipe,
      inputAmounts: { chemicals: 10 },
      outputCap: 10,
      queueCap: 8,
      maxBatches: 3,
      canStart: true
    }, {}, { mount });
    expect(findMetricValue(idleCard, "Vyrobeno")).toBe("0/10 ks");
    expect(findMetricValue(idleCard, "Výstup")).toBe(null);
    expect(findMetricValue(idleCard, "Fronta")).toBe("0/8 ks");
    idleCard.querySelectorAll(".armory-slot__quantity-btn")[1].click();
    expect(findMetricValue(idleCard, "Fronta")).toBe("0/8 ks");

    const runningLab = renderRecipeCard({
      buildingName: "druglab",
      recipeId: "neon-dust",
      recipe,
      outputCap: 10,
      queueCap: 8,
      job: { status: "running", output: { inventory: "drugs", itemId: "neon-dust", amount: 2 }, quantity: 2, durationMs: 2000 }
    }, {}, { mount });
    expect(findMetricValue(runningLab, "Vyrobeno")).toBe("0/10 ks");
    expect(findMetricValue(runningLab, "Fronta")).toBe("2/8 ks");

    const readyLab = renderRecipeCard({
      buildingName: "druglab",
      recipeId: "neon-dust",
      recipe,
      outputCap: 10,
      queueCap: 8,
      job: { status: "ready", output: { inventory: "drugs", itemId: "neon-dust", amount: 2 }, quantity: 2, durationMs: 2000 }
    }, {}, { mount });
    expect(findMetricValue(readyLab, "Vyrobeno")).toBe("2/10 ks");
    expect(findMetricValue(readyLab, "Fronta")).toBe("0/8 ks");

    const runningPharmacy = renderRecipeCard({
      buildingName: "pharmacy",
      recipeId: "chemicals",
      recipe: { ...recipe, inputs: {}, output: { inventory: "materials", itemId: "chemicals", amount: 1 } },
      outputCap: 12,
      queueCap: 8,
      job: { status: "running", output: { inventory: "materials", itemId: "chemicals", amount: 2 }, quantity: 2, durationMs: 2000 }
    }, {}, { mount });
    expect(findMetricValue(runningPharmacy, "Fronta")).toBe("2/8 ks");
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
      outputCap: 10,
      queueCap: 8,
      job: { status: "running", output: { inventory: "drugs", itemId: "neon-dust", amount: 5 }, quantity: 5, durationMs: 5000 }
    }, {}, { mount });
    const readyCard = renderRecipeCard({
      buildingName: "druglab",
      recipeId: "neon-dust",
      recipe,
      outputCap: 10,
      queueCap: 8,
      job: { status: "ready", output: { inventory: "drugs", itemId: "neon-dust", amount: 2 }, quantity: 2, durationMs: 2000 }
    }, {}, { mount });

    expect(findMetricValue(runningCard, "Vyrobeno")).toBe("0/10 ks");
    expect(findMetricValue(runningCard, "Fronta")).toBe("5/8 ks");
    expect(findMetricValue(readyCard, "Vyrobeno")).toBe("2/10 ks");
    expect(findMetricValue(readyCard, "Fronta")).toBe("0/8 ks");
  });

  it("updates drug lab input requirements with selected production quantity", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const recipe = {
      name: "Pulse Shot",
      inputs: { chemicals: 2, biomass: 1 },
      output: { inventory: "drugs", itemId: "pulse-shot", amount: 1 },
      durationMs: 1000
    };

    const card = renderRecipeCard({
      buildingName: "druglab",
      recipeId: "pulse-shot",
      recipe,
      inputAmounts: { chemicals: 12, biomass: 12 },
      outputCap: 6,
      queueCap: 5,
      maxBatches: 4,
      canStart: true
    }, {}, { mount });

    expect(card.querySelector(".drug-production-slot__supply-row--count-2")).not.toBe(null);
    expect(card.querySelectorAll(".drug-production-slot__supply-value").map((item) => item.textContent)).toEqual(["2/12", "1/12"]);

    const quantityButtons = card.querySelectorAll(".drug-production-slot__quantity-btn");
    quantityButtons[1].click();
    quantityButtons[1].click();

    expect(card.querySelectorAll(".drug-production-slot__supply-value").map((item) => item.textContent)).toEqual(["6/12", "3/12"]);
    expect(findMetricValue(card, "Vyrobeno")).toBe("0/6 ks");
    expect(findMetricValue(card, "Fronta")).toBe("0/5 ks");
  });

  it("updates armory material requirements with selected production quantity", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const card = renderRecipeCard({
      buildingName: "armory",
      recipeId: "vest",
      recipe: {
        name: "Vesta",
        inputs: { "metal-parts": 3, "tech-core": 1 },
        output: { inventory: "weapons", itemId: "vest", amount: 1 },
        durationMs: 1000
      },
      inputAmounts: { "metal-parts": 10, "tech-core": 5 },
      maxBatches: 4,
      canStart: true
    }, {}, { mount });

    expect(card.querySelectorAll(".armory-slot__material-value").map((item) => item.textContent)).toEqual(["3/10", "1/5"]);

    const quantityButtons = card.querySelectorAll(".armory-slot__quantity-btn");
    quantityButtons[1].click();
    quantityButtons[1].click();
    expect(card.querySelectorAll(".armory-slot__material-value").map((item) => item.textContent)).toEqual(["9/10", "3/5"]);

    quantityButtons[0].click();
    expect(card.querySelectorAll(".armory-slot__material-value").map((item) => item.textContent)).toEqual(["6/10", "2/5"]);
  });

  it("renders the Armory server line with canonical storage values and material-only inputs", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const card = renderRecipeCard({
      buildingId: "building:district-1:armory:1",
      buildingName: "armory",
      recipeId: "pistol",
      recipe: {
        name: "Pistole",
        inputs: { "metal-parts": 3, "tech-core": 1 },
        output: { inventory: "weapons", itemId: "pistol", amount: 1 },
        durationMs: 300000
      },
      visual: PRODUCTION_SLOT_VISUALS.armory.pistol,
      armoryStrengthPreview: { label: "Síla útoku", basePower: 4, bonusLabel: "+0.4" },
      job: {
        status: "running",
        isProducing: true,
        producedAmount: 2,
        queuedAmount: 3,
        activeAmount: 1,
        waitingAmount: 2,
        durationMs: 300000,
        output: { inventory: "weapons", itemId: "pistol", amount: 1 }
      },
      slotState: { label: "Výroba", isActive: true },
      outputInventoryAmount: 200,
      outputInventoryCapacity: 90,
      outputCap: 5,
      queueCap: 4,
      inputAmounts: { "metal-parts": 12, "tech-core": 4 },
      canStart: true,
      canCancelWaiting: true,
      maxBatches: 2,
      maxSelectableBatches: 2
    }, {}, {
      mount,
      getResourceLabel: (resourceKey) => ({ "metal-parts": "Metal Parts", "tech-core": "Tech Core" })[resourceKey]
    });

    expect(card.className).toContain("armory-slot--attack");
    expect(card.querySelector(".armory-slot__head")).not.toBe(null);
    expect(card.querySelector(".armory-slot__strength").children.map((child) => child.textContent).join(""))
      .toBe("Síla útoku 4 (+0.4)");
    expect(findMetricValue(card, "Vyrobeno")).toBe("2/5 ks");
    expect(findMetricValue(card, "Ve skladu")).toBe("200/90 ks");
    expect(findMetricValue(card, "Fronta")).toBe("3/4 ks");
    expect(card.querySelector(".drug-production-slot__metric--supplies").children[0].textContent).toBe("Materiál");
    expect(card.querySelectorAll(".armory-slot__material-value").map((item) => item.textContent)).toEqual(["3/12", "1/4"]);
    expect(card.querySelectorAll(".drug-production-slot__supply-pill")).toHaveLength(0);
    expect(card.querySelector(".drug-production-slot__state").textContent).toBe("Výroba");
  });

  it("renders Combat Module as the second high-tier Armory material chip", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const card = renderRecipeCard({
      buildingId: "building:district-1:armory:1",
      buildingName: "armory",
      recipeId: "smg",
      recipe: {
        name: "SMG",
        inputs: { "metal-parts": 2, "combat-module": 1 },
        output: { inventory: "weapons", itemId: "smg", amount: 1 },
        durationMs: 480000
      },
      visual: PRODUCTION_SLOT_VISUALS.armory.smg,
      job: {
        status: "ready",
        producedAmount: 0,
        queuedAmount: 0,
        activeAmount: 0,
        waitingAmount: 0,
        durationMs: 480000,
        output: { inventory: "weapons", itemId: "smg", amount: 1 }
      },
      slotState: { label: "Připraveno", isActive: false },
      outputInventoryAmount: 0,
      outputInventoryCapacity: 8,
      outputCap: 3,
      queueCap: 3,
      inputAmounts: { "metal-parts": 8, "combat-module": 3 },
      canStart: true,
      canCancelWaiting: false,
      maxBatches: 3,
      maxSelectableBatches: 3
    }, {}, {
      mount,
      getResourceLabel: (resourceKey) => ({ "metal-parts": "Metal Parts", "combat-module": "Combat Module" })[resourceKey]
    });

    expect(card.querySelectorAll(".armory-slot__material-pill")).toHaveLength(2);
    expect(card.querySelectorAll(".armory-slot__material-name").map((item) => item.textContent)).toEqual(["Metal Parts", "Combat Module"]);
    expect(card.querySelectorAll(".armory-slot__material-value").map((item) => item.textContent)).toEqual(["2/8", "1/3"]);
  });

  it("renders local Armory high-tier recipes with their real Combat Module costs", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const card = renderRecipeCard({
      buildingName: "armory",
      recipeId: "bazooka",
      recipe: {
        name: "Bazuka",
        inputs: { "metal-parts": 3, "combat-module": 2 },
        output: { inventory: "weapons", itemId: "bazooka", amount: 1 },
        durationMs: 1000
      },
      inputAmounts: { "metal-parts": 9, "combat-module": 5 },
      maxBatches: 2,
      canStart: true
    }, {}, {
      mount,
      getResourceLabel: (resourceKey) => resourceKey === "combat-module" ? "Bojový modul" : "Metal Parts"
    });

    expect(card.querySelectorAll(".armory-slot__material-name").map((item) => item.textContent)).toEqual(["Metal Parts", "Bojový modul"]);
    expect(card.querySelectorAll(".armory-slot__material-value").map((item) => item.textContent)).toEqual(["3/9", "2/5"]);
    expect(card.querySelector(".armory-slot__material-pill--combat")).not.toBe(null);
  });

  it("limits Ghost Serum to its two canonical material inputs", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const card = renderRecipeCard({
      buildingName: "druglab",
      recipeId: "ghost-serum",
      recipe: {
        name: "Ghost Serum",
        inputs: { "neon-dust": 2, "pulse-shot": 1 },
        output: { inventory: "drugs", itemId: "ghost-serum", amount: 1 },
        durationMs: 1000
      },
      inputAmounts: { "neon-dust": 10, "pulse-shot": 10 },
      maxBatches: 3,
      canStart: true
    }, {}, { mount });

    expect(card.querySelector(".drug-production-slot__product")).toBe(null);
    expect(card.querySelector(".drug-production-slot__supply-row--count-2")).not.toBe(null);
    expect(card.querySelectorAll(".drug-production-slot__supply-value").map((item) => item.textContent)).toEqual(["2/10", "1/10"]);
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
        inputs: { chemicals: 2, biomass: 1 },
        output: { inventory: "drugs", itemId: "pulse-shot", amount: 1 },
        durationMs: 1000
      },
      inputAmounts: { chemicals: 0, biomass: 0 },
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
      inputs: {},
      output: { inventory: "materials", itemId: "chemicals", amount: 1 },
      durationMs: 60000
    };

    const card = renderRecipeCard({
      buildingName: "pharmacy",
      recipeId: "chemicals",
      recipe,
      inputAmounts: {},
      outputCap: 12,
      queueCap: 8,
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
    expect(findMetricValue(card, "Vyrobeno")).toBe("0/12 ks");

    card.querySelector(".pharmacy-slot__btn--start").click();

    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({
      batchCount: 3
    }));
    expect(card.classList.contains("production-slot--start-flash")).toBe(true);
    expect(card.dataset.productionStartEffect).toBe("true");
  });

  it("preserves canonical recipe quantity by physical building and recipe", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const onStart = vi.fn();
    const render = (buildingId, recipeId = "chemicals") => renderRecipeCard({
      buildingId,
      buildingName: "pharmacy",
      recipeId,
      recipe: {
        name: recipeId,
        cleanMoneyCost: 100,
        inputs: {},
        output: { inventory: "materials", itemId: recipeId, amount: 1 },
        durationMs: 1000
      },
      job: { status: "ready", queuedAmount: 0, producedAmount: 0 },
      outputCap: 12,
      queueCap: 8,
      maxBatches: 4,
      maxSelectableBatches: 4,
      canStart: true,
      canCancelWaiting: false
    }, { onStart }, { mount });

    const firstCard = render("building:district-1:pharmacy:1");
    firstCard.querySelectorAll(".pharmacy-slot__quantity-btn")[1].click();
    expect(firstCard.querySelector(".pharmacy-slot__quantity-value").textContent).toBe("2");

    mount.replaceChildren();
    expect(render("building:district-1:pharmacy:1").querySelector(".pharmacy-slot__quantity-value").textContent).toBe("2");

    mount.replaceChildren();
    const siblingRecipeCard = render("building:district-1:pharmacy:1", "biomass");
    expect(siblingRecipeCard.querySelector(".pharmacy-slot__quantity-value").textContent).toBe("1");
    siblingRecipeCard.querySelectorAll(".pharmacy-slot__quantity-btn")[1].click();
    expect(siblingRecipeCard.querySelector(".pharmacy-slot__quantity-value").textContent).toBe("2");

    mount.replaceChildren();
    expect(render("building:district-2:pharmacy:1").querySelector(".pharmacy-slot__quantity-value").textContent).toBe("1");

    mount.replaceChildren();
    const restoredCard = render("building:district-1:pharmacy:1");
    expect(restoredCard.querySelector(".pharmacy-slot__quantity-value").textContent).toBe("2");
    restoredCard.querySelector(".pharmacy-slot__btn--start").click();
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ batchCount: 2 }));

    mount.replaceChildren();
    const restartedCard = render("building:district-1:pharmacy:1");
    expect(restartedCard.querySelector(".pharmacy-slot__quantity-value").textContent).toBe("1");
    expect(restartedCard.classList.contains("production-slot--start-flash")).toBe(true);

    mount.replaceChildren();
    expect(render("building:district-1:pharmacy:1", "biomass").querySelector(".pharmacy-slot__quantity-value").textContent).toBe("2");
  });

  it("enables Pharmacy cancel only when a running line has a waiting unit", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const onStop = vi.fn();
    const card = renderRecipeCard({
      buildingName: "pharmacy",
      recipeId: "chemicals",
      recipe: {
        name: "Chemicals",
        cleanMoneyCost: 360,
        inputs: {},
        output: { inventory: "materials", itemId: "chemicals", amount: 1 },
        durationMs: 1000
      },
      job: {
        status: "running",
        cleanMoneyCost: 720,
        output: { inventory: "materials", itemId: "chemicals", amount: 2 },
        quantity: 2,
        durationMs: 2000
      },
      canStart: false
    }, { onStop }, { mount });

    const cancelButton = card.querySelector(".pharmacy-slot__btn--stop");
    expect(cancelButton.textContent).toBe("Zrušit");
    expect(cancelButton.disabled).toBe(false);

    cancelButton.click();

    expect(onStop).toHaveBeenCalledOnce();
  });

  it("keeps authoritative Pharmacy cancellation disabled despite queued display state", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const card = renderRecipeCard({
      buildingId: "building:district-1:pharmacy:1",
      buildingName: "pharmacy",
      recipeId: "chemicals",
      recipe: {
        name: "Chemicals",
        cleanMoneyCost: 360,
        inputs: {},
        output: { inventory: "materials", itemId: "chemicals", amount: 1 },
        durationMs: 1000
      },
      job: {
        status: "running",
        isProducing: true,
        activeAmount: 1,
        waitingAmount: 3,
        queuedAmount: 4,
        producedAmount: 13,
        output: { inventory: "materials", itemId: "chemicals", amount: 1 }
      },
      slotState: { label: "Plná kapacita", isActive: true },
      outputCap: 12,
      queueCap: 8,
      maxBatches: 0,
      maxSelectableBatches: 0,
      canStart: false,
      canCancelWaiting: false
    }, {}, { mount });

    expect(findMetricValue(card, "Vyrobeno")).toBe("13/12 ks");
    expect(card.querySelector(".pharmacy-slot__state").textContent).toBe("Plná kapacita");
    expect(card.querySelector(".pharmacy-slot__btn--start").disabled).toBe(true);
    expect(card.querySelector(".pharmacy-slot__btn--stop").disabled).toBe(true);
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
        inputs: { chemicals: 2 },
        output: { inventory: "drugs", itemId: "neon-dust", amount: 1 },
        durationMs: 1000
      },
      inputAmounts: { chemicals: 12 },
      outputCap: 10,
      queueCap: 8,
      maxBatches: 4,
      canStart: true,
      job: {
        status: "running",
        output: { inventory: "drugs", itemId: "neon-dust", amount: 1 },
        quantity: 1,
        durationMs: 1000
      }
    }, { onStart }, { mount });

    const startButton = card.querySelector(".drug-lab-mini-btn");
    expect(startButton.textContent).toBe("Spustit");
    expect(startButton.disabled).toBe(false);

    card.querySelectorAll(".drug-production-slot__quantity-btn")[1].click();
    expect(card.querySelectorAll(".drug-production-slot__supply-value").map((item) => item.textContent)).toEqual(["4/12"]);

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

  it("renders a full Armory queue and disables adding or starting more pieces", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const card = renderRecipeCard({
      buildingName: "armory",
      recipeId: "baseball-bat",
      recipe: {
        name: "Baseballová pálka",
        inputs: { "metal-parts": 2 },
        output: { inventory: "weapons", itemId: "baseball-bat", amount: 1 },
        durationMs: 1000
      },
      inputAmounts: { "metal-parts": 20 },
      outputCap: 8,
      queueCap: 6,
      maxBatches: 0,
      maxSelectableBatches: 0,
      canStart: false,
      job: {
        status: "running",
        output: { inventory: "weapons", itemId: "baseball-bat", amount: 6 },
        quantity: 6,
        durationMs: 6000
      }
    }, {}, { mount });

    expect(findMetricValue(card, "Fronta")).toBe("6/6 ks");
    expect(findMetricValue(card, "Vyrobeno")).toBe("0/8 ks");
    expect(card.querySelectorAll(".armory-slot__quantity-btn")[1].disabled).toBe(true);
    expect(card.querySelector("[data-armory-slot-start]").disabled).toBe(true);
    expect(findMetricValue(card, "Výstup")).toBe(null);
  });

  it("shows armory output as ready-to-collect amount only and marks attack/defense slot tone", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const attackRecipe = {
      name: "Baseballová pálka",
      inputs: { "metal-parts": 2 },
      output: { inventory: "weapons", itemId: "baseball-bat", amount: 1 },
      durationMs: 1000
    };
    const defenseRecipe = {
      name: "Vesta",
      inputs: { "metal-parts": 3, "tech-core": 1 },
      output: { inventory: "weapons", itemId: "vest", amount: 1 },
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
      outputCap: 8,
      queueCap: 6
    }, {}, { mount });
    const readyCard = renderRecipeCard({
      buildingName: "armory",
      recipeId: "baseball-bat",
      recipe: attackRecipe,
      outputCap: 8,
      queueCap: 6,
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
      outputCap: 5,
      queueCap: 4
    }, {}, { mount });

    expect(findMetricValue(idleCard, "Vyrobeno")).toBe("0/8 ks");
    expect(findMetricValue(readyCard, "Vyrobeno")).toBe("2/8 ks");
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
        slotCap: 5,
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
      inputAmounts: { techCore: 5 },
      queuedAmount: 1,
      slotStorageCap: 5
    }, { onStartSlot, onPauseSlot }, { mount, now: 100000 });

    expect(findMetricValue(card, "Výstup")).toBe(null);
    expect(card.querySelector(".drug-production-slot__product")).toBe(null);
    expect(findMetricValue(card, "Čas")).toBe("7m 30s");
    expect(findMetricValue(card, "Cena")).toBe("$650 clean");
    expect(findMetricValue(card, "Vyrobeno")).toBe("0/5 ks");
    expect(findMetricValue(card, "Ve frontě")).toBe("1/5 ks");
    expect(card.querySelector(".factory-slot__material-pill").children.map((child) => child.textContent)).toEqual(["Tech Core", "1/5"]);
    expect(card.querySelector("[data-factory-slot-toggle-state=\"start\"]").textContent).toBe("Spustit");
    expect(card.querySelector("[data-factory-slot-toggle-state=\"stop\"]").textContent).toBe("Zrušit");

    card.querySelectorAll(".factory-slot__quantity-btn")[1].click();

    expect(findMetricValue(card, "Cena")).toBe("$1300 clean");
    expect(card.querySelector(".factory-slot__material-pill").children.map((child) => child.textContent)).toEqual(["Tech Core", "2/5"]);

    card.querySelector("[data-factory-slot-toggle-state=\"start\"]").click();

    expect(onStartSlot).toHaveBeenCalledWith(expect.any(Object), { batchCount: 2 });
    expect(card.classList.contains("production-slot--running")).toBe(true);
    expect(card.classList.contains("production-slot--start-flash")).toBe(true);

    card.querySelector("[data-factory-slot-toggle-state=\"stop\"]").click();
    expect(onPauseSlot).toHaveBeenCalledWith(expect.any(Object));
  });

  it("centers and colors the Metal Parts requirement inside the Tech Core slot", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const card = renderFactorySlotCard({
      slot: {
        id: "tech",
        resourceKey: "techCore",
        queuedAmount: 0,
        producedAmount: 2,
        slotCap: 5
      },
      title: "Tech Core",
      durationMs: 600000,
      displayCost: { cleanCash: 900, metalParts: 3 },
      inputAmounts: { metalParts: 8 },
      queueCap: 5,
      slotOutputCap: 5,
      canStart: true
    }, {}, { mount, now: 100000 });

    const materialRow = card.querySelector(".factory-slot__material-row");
    const materialPill = card.querySelector(".factory-slot__material-pill");
    expect(findMetricValue(card, "Vyrobeno")).toBe("2/5 ks");
    expect(materialRow.children).toHaveLength(1);
    expect(materialPill.dataset.resourceColor).toBe("metal-parts");
    expect(materialPill.children.map((child) => child.textContent)).toEqual(["Metal Parts", "3/8"]);
  });

  it("uses the existing Factory slot layout for authoritative production lines", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const onStartSlot = vi.fn();
    const onPauseSlot = vi.fn();
    const line = {
      recipeId: "combat-module",
      resourceKey: "combat-module",
      label: "Bojový modul",
      status: "waiting",
      producedAmount: 1,
      producedCapacity: 2,
      queuedAmount: 1,
      queueCapacity: 2,
      maxStartQuantity: 1,
      canStart: true,
      canCancelWaiting: true,
      effectiveUnitDurationTicks: 180,
      remainingMs: 0,
      costDisplayRows: [
        { resourceKey: "cash", amount: 2500, availableAmount: 5000 },
        { resourceKey: "metal-parts", label: "Metal Parts", amount: 4, availableAmount: 12 },
        { resourceKey: "tech-core", label: "Tech Core", amount: 2, availableAmount: 0 }
      ]
    };

    renderServerFactorySlotList(mount, [line], { onStartSlot, onPauseSlot }, {
      tickRateMs: 5000,
      now: 100000
    });

    const card = mount.children[0];
    expect(card.className).toContain("factory-slot");
    expect(card.querySelector(".factory-slot__title-wrap")).not.toBe(null);
    expect(card.querySelector(".drug-production-slot__icon--red")).not.toBe(null);
    expect(findMetricValue(card, "Čas")).toBe("15m 00s");
    expect(findMetricValue(card, "Cena")).toBe("$2500 clean");
    expect(findMetricValue(card, "Vyrobeno")).toBe("1/2 ks");
    expect(card.querySelectorAll(".factory-slot__material-pill").map((pill) => pill.children.map((child) => child.textContent))).toEqual([
      ["Metal Parts", "4/12"],
      ["Tech Core", "2/0"]
    ]);
    expect(findMetricValue(card, "Ve frontě")).toBe("1/2 ks");
    expect(card.querySelector("[data-factory-slot-toggle-state=\"stop\"]").attributes.get("aria-label"))
      .toBe("Zrušit čekající výrobu Bojový modul");
    card.querySelector("[data-factory-slot-toggle-state=\"start\"]").click();
    card.querySelector("[data-factory-slot-toggle-state=\"stop\"]").click();
    const submittedSlot = onStartSlot.mock.calls[0][0];
    expect(submittedSlot).toMatchObject({
      recipeId: "combat-module",
      status: "waiting",
      canStart: true,
      canCancelWaiting: true,
      displayCost: { cleanCash: 2500, metalParts: 4, techCore: 2 },
      inputAmounts: { metalParts: 12, techCore: 0 }
    });
    expect(submittedSlot).not.toHaveProperty("serverLine");
    expect(onStartSlot).toHaveBeenCalledWith(submittedSlot, { batchCount: 1 });
    expect(onPauseSlot).toHaveBeenCalledWith(submittedSlot);
  });

  it("uses demo-canonical Factory timing and capacity labels for adapted server lines", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const createCard = ({ resourceKey, durationMs, secondaryLine, producedCapacity, queueCapacity }) => renderFactorySlotCard({
      recipeId: resourceKey,
      status: "ready",
      canCancelWaiting: false,
      slot: {
        resourceKey: resourceKey === "metal-parts" ? "metalParts" : "combatModule",
        producedAmount: 0,
        queuedAmount: 0,
        slotCap: producedCapacity,
        queueCap: queueCapacity
      },
      title: resourceKey,
      durationMs,
      secondaryLine,
      displayCost: { cleanCash: 0, metalParts: 0, techCore: 0 },
      inputAmounts: {},
      queueCap: queueCapacity,
      slotStorageCap: queueCapacity,
      slotOutputCap: producedCapacity,
      canStart: true,
      maxStartQuantity: 1
    }, {}, { mount });

    const metalCard = createCard({
      resourceKey: "metal-parts",
      durationMs: 240000,
      secondaryLine: "",
      producedCapacity: 12,
      queueCapacity: 17
    });
    const combatCard = createCard({
      resourceKey: "combat-module",
      durationMs: 900000,
      secondaryLine: "15 min / kus",
      producedCapacity: 2,
      queueCapacity: 5
    });

    expect(findMetricValue(metalCard, "Čas")).toBe("4m 00s");
    expect(findMetricValue(metalCard, "Vyrobeno")).toBe("0/12 ks");
    expect(findMetricValue(metalCard, "Ve frontě")).toBe("0/17 ks");
    expect(findMetricValue(combatCard, "Čas")).toBe("15 min / kus");
    expect(findMetricValue(combatCard, "Vyrobeno")).toBe("0/2 ks");
  });

  it("preserves the selected Factory quantity across authoritative rerenders", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const onStartSlot = vi.fn();
    const line = {
      recipeId: "metal-parts",
      resourceKey: "metal-parts",
      label: "Metal Parts",
      status: "ready",
      producedAmount: 0,
      producedCapacity: 10,
      queuedAmount: 0,
      queueCapacity: 8,
      maxStartQuantity: 4,
      canStart: true,
      canCancelWaiting: false,
      effectiveUnitDurationTicks: 24,
      remainingMs: 0,
      costDisplayRows: [{ resourceKey: "cash", amount: 360 }]
    };

    renderServerFactorySlotList(mount, [line], { onStartSlot }, {
      selectionScopeKey: "building:factory:a"
    });
    const firstCard = mount.children[0];
    firstCard.querySelectorAll(".factory-slot__quantity-btn")
      .find((button) => button.textContent === "+")
      .click();
    expect(firstCard.querySelector(".factory-slot__quantity-value").textContent).toBe("2");

    renderServerFactorySlotList(mount, [line], { onStartSlot }, {
      selectionScopeKey: "building:factory:a"
    });
    const rerenderedCard = mount.children[0];
    expect(rerenderedCard).toBe(firstCard);
    expect(rerenderedCard.querySelector(".factory-slot__quantity-value").textContent).toBe("2");

    renderServerFactorySlotList(mount, [line], { onStartSlot }, {
      selectionScopeKey: "building:factory:b"
    });
    const otherFactoryCard = mount.children[0];
    expect(otherFactoryCard).not.toBe(rerenderedCard);
    expect(otherFactoryCard.querySelector(".factory-slot__quantity-value").textContent).toBe("1");

    renderServerFactorySlotList(mount, [line], { onStartSlot }, {
      selectionScopeKey: "building:factory:a"
    });
    const restoredCard = mount.children[0];
    expect(restoredCard).not.toBe(otherFactoryCard);
    expect(restoredCard.querySelector(".factory-slot__quantity-value").textContent).toBe("2");
    restoredCard.querySelector('[data-factory-slot-toggle-state="start"]').click();
    expect(onStartSlot).toHaveBeenCalledWith(
      expect.objectContaining({ recipeId: "metal-parts", canStart: true, maxStartQuantity: 4 }),
      { batchCount: 2 }
    );
    expect(onStartSlot.mock.calls[0][0]).not.toHaveProperty("serverLine");

    renderServerFactorySlotList(mount, [line], { onStartSlot }, {
      selectionScopeKey: "building:factory:a"
    });
    expect(mount.children[0]).not.toBe(restoredCard);
    expect(mount.children[0].querySelector(".factory-slot__quantity-value").textContent).toBe("1");
  });

  it("keeps Factory loading slots visible without exposing local production values", () => {
    const document = setupDocument();
    const mount = document.createElement("div");

    renderServerFactorySlotList(mount, [{
      recipeId: "metal-parts",
      resourceKey: "metal-parts",
      label: "Metal Parts",
      loading: true,
      status: "loading",
      queuedAmount: 0,
      queueCapacity: 0,
      canStart: false,
      canCancelWaiting: false,
      maxStartQuantity: 0,
      disabledReason: "Načítám serverový detail Továrny."
    }], {}, { mount });

    const card = mount.children[0];
    expect(card.className).toContain("factory-slot--loading");
    expect(card.querySelector(".drug-production-slot__state").textContent).toBe("Načítání");
    expect(findMetricValue(card, "Čas")).toBe("—");
    expect(findMetricValue(card, "Cena")).toBe("—");
    expect(findMetricValue(card, "Vyrobeno")).toBe("—");
    expect(findMetricValue(card, "Ve frontě")).toBe("—");
    expect(card.querySelector(".factory-slot__materials")).toBe(null);
    expect(card.querySelector("[data-factory-slot-toggle-state=\"start\"]").disabled).toBe(true);
    expect(card.querySelector("[data-factory-slot-toggle-state=\"stop\"]").disabled).toBe(true);
  });

  it("shows pharmacy output as ready-to-collect capacity without unit text", () => {
    const document = setupDocument();
    const mount = document.createElement("div");
    const recipe = {
      name: "Chemicals",
      cleanMoneyCost: 360,
      output: { inventory: "materials", itemId: "chemicals", amount: 1 },
      durationMs: 60000
    };

    const runningCard = renderRecipeCard({
      buildingName: "pharmacy",
      recipeId: "chemicals",
      recipe,
      outputCap: 12,
      queueCap: 8,
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
      outputCap: 12,
      queueCap: 8,
      job: {
        status: "ready",
        output: { inventory: "materials", itemId: "chemicals", amount: 2 },
        quantity: 2,
        durationMs: 60000
      }
    }, {}, { mount });

    expect(findMetricValue(runningCard, "Vyrobeno")).toBe("0/12 ks");
    expect(findMetricValue(readyCard, "Vyrobeno")).toBe("2/12 ks");
    expect(readyCard.querySelector(".pharmacy-slot__btn--start").textContent).toBe("Spustit");
    expect(readyCard.querySelector(".pharmacy-slot__btn--start").disabled).toBe(false);
    expect(findMetricValue(readyCard, "Fronta")).toBe("0/8 ks");
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
        infoText: "Zbrojovka vyrábí výzbroj z Metal Parts, Tech Core a Combat Module."
      },
      state: { level: 3 },
      maxLevel: 14,
      multiplier: 1.2,
      nextMultiplier: 1.3,
      effectsLabel: "Zbrojovka · produkce +20%",
      readyCount: 2,
      upgradeCost: 100
    }, {}, { mount: document.body, formatCurrency: (value) => `$${value}` });

    expect(infoTextElement.textContent).toBe("Zbrojovka vyrábí výzbroj z Metal Parts, Tech Core a Combat Module.");
    expect(infoEffectsElement.textContent).not.toContain("max výstup");
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
