import fs from "node:fs/promises";
import path from "node:path";
import { expect } from "@playwright/test";
import {
  resolveBuildingPresentationDefinition
} from "../../../page-assets/js/app/runtime/buildingPresentationContract.js";

const SESSION_KEY = "empireStreets.session.v1";
const SCOPED_SESSION_KEY = "empireStreets.session.free.instance-free-eu-central-public-1.v1";

export const parityViewports = Object.freeze([
  Object.freeze({ name: "desktop-1440x900", width: 1440, height: 900 }),
  Object.freeze({ name: "mobile-390x844", width: 390, height: 844 }),
  Object.freeze({ name: "mobile-320x568", width: 320, height: 568 }),
  Object.freeze({ name: "mobile-360x800", width: 360, height: 800 }),
  Object.freeze({ name: "mobile-430x932", width: 430, height: 932 }),
  Object.freeze({ name: "tablet-768x1024", width: 768, height: 1024 }),
  Object.freeze({ name: "tablet-820x1180", width: 820, height: 1180 }),
  Object.freeze({ name: "desktop-1024x768", width: 1024, height: 768 }),
  Object.freeze({ name: "desktop-1366x768", width: 1366, height: 768 }),
  Object.freeze({ name: "desktop-1920x1080", width: 1920, height: 1080 })
]);

export const parityCaptureViewports = Object.freeze(parityViewports.slice(0, 2));

export const paritySurfaces = Object.freeze({
  district: Object.freeze({
    selector: "[data-district-popup-card]",
    shell: "[data-district-popup]"
  }),
  buildingDetail: Object.freeze({
    selector: "[data-district-building-detail-popup]:not([hidden])",
    shell: "[data-district-building-detail-popup]:not([hidden])"
  }),
  restaurant: Object.freeze({
    selector: "[data-district-building-detail-popup]:not([hidden])",
    shell: "[data-district-building-detail-popup]:not([hidden])"
  }),
  arcade: Object.freeze({
    selector: "[data-district-building-detail-popup]:not([hidden])",
    shell: "[data-district-building-detail-popup]:not([hidden])"
  }),
  pharmacy: Object.freeze({
    selector: "[data-pharmacy-popup] [role='dialog']",
    shell: "[data-pharmacy-popup]"
  }),
  drugLab: Object.freeze({
    selector: "[data-druglab-popup] [role='dialog']",
    shell: "[data-druglab-popup]"
  }),
  factory: Object.freeze({
    selector: "[data-factory-popup] [role='dialog']",
    shell: "[data-factory-popup]"
  }),
  armory: Object.freeze({
    selector: "[data-armory-popup] [role='dialog']",
    shell: "[data-armory-popup]"
  }),
  cityEvents: Object.freeze({
    selector: "#events-modal .events-modal__content",
    shell: "#events-modal"
  }),
  cityEventDetail: Object.freeze({
    selector: "#event-detail-modal .event-detail-modal__content",
    shell: "#event-detail-modal"
  })
});

export async function openParityLocalDemo(page, {
  ownedDistrictIds = [21, 66, 68],
  startDistrictId = ownedDistrictIds[0] || 21,
  mapPhase = "night"
} = {}) {
  await page.addInitScript(({
    sessionKey,
    scopedSessionKey,
    ownedDistrictIds: configuredOwnedDistrictIds,
    startDistrictId: configuredStartDistrictId,
    mapPhase: configuredMapPhase
  }) => {
    window.EmpireConfigOverrides = Object.freeze({
      ...(window.EmpireConfigOverrides || {}),
      localDemoEnabled: true
    });
    window.__EMPIRE_E2E__ = true;
    const now = new Date().toISOString();
    const serverId = "instance:free:eu-central:public-1";
    const session = {
      registration: {
        identity: "UI Parity Demo",
        gangName: "UI Parity Demo",
        isGuest: true,
        loginKind: "guest",
        serverId,
        serverInstanceId: serverId,
        activeServerId: serverId,
        activeServerInstanceId: serverId,
        serverMode: "free",
        activeServerMode: "free",
        factionId: "mafian",
        selectedFaction: "mafian",
        startDistrictId: configuredStartDistrictId,
        preferredStartDistrictId: configuredStartDistrictId,
        factionLocked: true,
        hasCompletedServerEntry: true,
        serverRegistrationStatus: "faction_locked",
        lastLoginAt: now
      },
      world: {
        ownedDistrictIds: configuredOwnedDistrictIds,
        phaseState: {
          gamePhase: "live",
          mapPhase: configuredMapPhase,
          cityMinutes: configuredMapPhase === "night" ? 1_334 : 720
        }
      },
      inventory: {
        weapons: {},
        materials: { chemicals: 20, biomass: 20, "stim-pack": 0 },
        drugs: { "neon-dust": 10, "pulse-shot": 10, "velvet-smoke": 10 },
        factorySupplies: { metalParts: 40, techCore: 20, combatModule: 8 }
      },
      economy: { cleanMoney: 100_000, dirtyMoney: 10_000 },
      gang: { members: 30, population: 30, heat: 0, influence: 500, lastHeatDecayAt: now },
      missions: {
        attackOrders: [],
        occupyOrders: [],
        robberyOrders: [],
        spy: { available: 3, missions: [] }
      },
      production: {
        jobs: {},
        factory: { level: 1, resources: {}, slots: [], updatedAt: Date.now() },
        buildings: {
          pharmacy: { level: 1 },
          druglab: { level: 1 },
          armory: { level: 1 }
        }
      }
    };
    localStorage.clear();
    localStorage.setItem("empire:active_guest_mode", "free");
    localStorage.setItem("empire:active_mode", "free");
    localStorage.setItem(sessionKey, JSON.stringify(session));
    localStorage.setItem(scopedSessionKey, JSON.stringify(session));
    localStorage.setItem(
      "empire:onboarding:v2:onboarding:UI%20Parity%20Demo",
      JSON.stringify({
        completed: true,
        skipped: true,
        currentStepId: "completed",
        dismissedAt: now,
        version: "demo-v1-clean"
      })
    );
  }, {
    sessionKey: SESSION_KEY,
    scopedSessionKey: SCOPED_SESSION_KEY,
    ownedDistrictIds,
    startDistrictId,
    mapPhase
  });
  await page.goto("/pages/game.html?runtimeMode=local-demo&autoStartLocalDemo=1", { waitUntil: "load" });
  await page.waitForFunction(() => (
    window.EmpireRuntime
    && document.querySelector("#game-root")?.dataset?.runtimeInit === "ready"
    && document.documentElement?.dataset?.runtimeMode === "local-demo"
  ));
  const milestone = page.locator("[data-server-milestone-modal]");
  if (await milestone.isVisible()) {
    await milestone.locator("[data-server-milestone-confirm]").click();
    await expect(milestone).toBeHidden();
  }
}

export async function openDistrictById(page, districtId) {
  const canonicalDistrictId = String(districtId).startsWith("district:")
    ? String(districtId)
    : `district:${districtId}`;
  const numericDistrictId = Number(canonicalDistrictId.replace(/^district:/u, ""));
  const selected = await page.evaluate(async (id) => {
    const executionMode = document.documentElement.dataset.runtimeMode;
    if (executionMode !== "server-authoritative") return true;
    const renderState = await window.EmpireGameplaySliceClient?.selectDistrict?.(id);
    const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.();
    return Boolean(renderState && readModel?.district?.districtId === id);
  }, canonicalDistrictId);
  expect(selected, `Server must return the requested district ${canonicalDistrictId}`).toBe(true);
  const opened = await page.evaluate((id) => (
    window.empireStreetsDistrictState?.openDistrict?.(id)
    || window.EmpireRuntime?.selectDistrict?.(id)
    || false
  ), numericDistrictId);
  expect(opened, `District ${districtId} should open through the shared map controller`).toBe(true);
  await expect(page.locator("[data-district-popup-card]")).toBeVisible();
}

export async function openBuildingFromDistrict(page, buildingTypeOrLabel) {
  const aliases = {
    armory: ["armory", "zbrojovka"],
    druglab: ["druglab", "drug_lab", "laboratoř", "lab"],
    drug_lab: ["druglab", "drug_lab", "laboratoř", "lab"],
    factory: ["factory", "továrna"],
    pharmacy: ["pharmacy", "lékárna"],
    restaurant: ["restaurant", "restaurace"],
    arcade: ["arcade", "herna"]
  };
  const normalized = String(buildingTypeOrLabel).toLocaleLowerCase("cs");
  const canonicalBaseName = resolveBuildingPresentationDefinition(normalized)?.baseName || "";
  const expectedLabels = Array.from(new Set([
    ...(aliases[normalized] || [normalized]),
    canonicalBaseName.toLocaleLowerCase("cs")
  ].filter(Boolean)));
  const chips = page.locator("[data-district-building-name]");
  let matchingIndex = -1;
  await expect.poll(async () => {
    matchingIndex = await chips.evaluateAll((buttons, expected) => buttons.findIndex((candidate) => {
      const type = String(candidate.dataset.districtBuildingType || "").toLocaleLowerCase("cs");
      const text = String(candidate.textContent || "").toLocaleLowerCase("cs");
      return expected.some((label) => type === label || text.includes(label));
    }), expectedLabels);
    return matchingIndex;
  }, {
    message: `Building ${buildingTypeOrLabel} should be rendered as an interactive district chip`,
    timeout: 30_000
  }).toBeGreaterThanOrEqual(0);
  const button = chips.nth(matchingIndex);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.click();
}

export async function openProductionShortcut(page, type) {
  const selectors = {
    pharmacy: "[data-pharmacy-popup-open]",
    drugLab: "[data-druglab-popup-open]",
    factory: "[data-factory-popup-open]",
    armory: "[data-armory-popup-open]"
  };
  await page.locator(selectors[type]).click();
  await expect(page.locator(paritySurfaces[type].shell)).toBeVisible({ timeout: 30_000 });
}

export function resolveBuildingParitySurfaceName(buildingTypeId) {
  const normalizedTypeId = String(buildingTypeId || "").trim().replace(/-/gu, "_");
  return {
    pharmacy: "pharmacy",
    drug_lab: "drugLab",
    factory: "factory",
    armory: "armory"
  }[normalizedTypeId] || "buildingDetail";
}

export async function selectProductionBuildingTab(page, surfaceName, tabName) {
  const normalizedTabName = String(tabName || "stats").trim();
  const selector = surfaceName === "factory"
    ? `[data-factory-tab="${normalizedTabName}"]`
    : `[data-production-building-tab$=":${normalizedTabName}"]`;
  const tab = page.locator(`${paritySurfaces[surfaceName].shell}:visible`).locator(selector);
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

export async function closeSurface(page, surfaceName) {
  const closeSelectors = {
    district: "[data-district-popup-close]",
    buildingDetail: "[data-district-building-detail-close]",
    restaurant: "[data-district-building-detail-close]",
    arcade: "[data-district-building-detail-close]",
    pharmacy: "[data-pharmacy-popup-close]",
    drugLab: "[data-druglab-popup-close]",
    factory: "[data-factory-popup-close]",
    armory: "[data-armory-popup-close]",
    cityEvents: "#events-modal-close",
    cityEventDetail: "#event-detail-modal-close"
  };
  const allShells = page.locator(paritySurfaces[surfaceName].shell);
  const shell = page.locator(`${paritySurfaces[surfaceName].shell}:visible`).last();
  if (!(await shell.isVisible().catch(() => false))) {
    await expect(allShells).toBeHidden();
    return;
  }
  const close = shell.locator(`${closeSelectors[surfaceName]}:visible`).last();
  await expect(close).toBeVisible();
  await close.click();
  await expect(shell).toBeHidden();
}

export async function openCityEvents(page) {
  const modal = page.locator("#events-modal");
  if (!(await modal.isVisible().catch(() => false))) {
    await page.locator("#city-events-open").click();
  }
  await expect(modal).toBeVisible();
}

export async function openFirstCityEventDetail(page) {
  const firstAgent = page.locator(".events-agent:not([aria-disabled='true'])").first();
  await firstAgent.click();
  const firstOffer = page.locator("#events-tasklist [data-event-open]").first();
  await expect(firstOffer).toBeVisible();
  await firstOffer.click();
  await expect(page.locator("#event-detail-modal")).toBeVisible();
}

function artifactDirectory(phase, mode, viewportName) {
  const artifactRoot = String(process.env.EMPIRE_UI_PARITY_ARTIFACT_ROOT || "").trim();
  return path.resolve(
    artifactRoot || path.join("artifacts", "live-demo-ui-parity"),
    phase,
    mode,
    viewportName
  );
}

export async function readParitySurfaceMetadata(page, surfaceName) {
  const definition = paritySurfaces[surfaceName];
  const target = page.locator(definition.selector).first();
  await expect(target).toBeVisible();
  return page.evaluate(({ selector, shellSelector }) => {
    const targetElement = document.querySelector(selector);
    const shell = document.querySelector(shellSelector) || targetElement;
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement) || element.hidden) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || 1) > 0
        && rect.width > 0
        && rect.height > 0;
    };
    const ownedModalRootSelector = [
      "[data-district-popup]",
      "[data-district-building-detail-popup]",
      "[data-pharmacy-popup]",
      "[data-druglab-popup]",
      "[data-factory-popup]",
      "[data-armory-popup]",
      "#events-modal",
      "#event-detail-modal",
      "[data-gameplay-slice-client]"
    ].join(",");
    const ownedModalRoots = Array.from(
      document.querySelectorAll(ownedModalRootSelector)
    ).filter(isVisible);
    const unownedDialogs = Array.from(document.querySelectorAll("[role='dialog']"))
      .filter(isVisible)
      .filter((element) => {
        const ownedRoot = element.closest(ownedModalRootSelector);
        return !ownedRoot || ownedRoot === element;
      });
    const modalCandidates = Array.from(new Set([
      ...ownedModalRoots,
      ...unownedDialogs
    ]));
    const overlays = modalCandidates.map((element) => ({
      id: element.id || null,
      owner: element.dataset.uiOwner || null,
      className: element.className || "",
      zIndex: Number.parseInt(getComputedStyle(element).zIndex || "0", 10) || 0
    })).sort((left, right) => right.zIndex - left.zIndex);
    const selectedDistrict = window.empireStreetsDistrictState?.getSelectedDistrict?.();
    const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
      || window.empireStreetsGameplaySliceReadModel
      || null;
    const visibleBuildingDetail = document.querySelector("[data-district-building-detail-popup]:not([hidden])");
    const classNames = Array.from(new Set([
      ...Array.from(shell?.classList || []),
      ...Array.from(targetElement?.classList || []),
      ...Array.from(shell?.querySelectorAll?.("*") || [])
        .filter(isVisible)
        .flatMap((element) => Array.from(element.classList || []))
    ])).sort();
    return {
      html: shell?.outerHTML || "",
      classNames,
      visibleModalCount: modalCandidates.length,
      visibleModalOwners: overlays.map((entry) => entry.owner).filter(Boolean),
      topOverlay: overlays[0] || null,
      bodyOverflow: getComputedStyle(document.body).overflow,
      executionMode: document.documentElement.dataset.runtimeMode
        || document.documentElement.dataset.gameplayExecutionMode
        || null,
      stateVersion: readModel?.server?.stateVersion ?? null,
      selectedDistrictId: readModel?.district?.districtId
        || selectedDistrict?.districtId
        || selectedDistrict?.id
        || null,
      selectedBuildingId: shell?.dataset.serverBuildingId
        || visibleBuildingDetail?.dataset.serverBuildingId
        || visibleBuildingDetail?.dataset.districtBuildingDetailName
        || shell?.dataset.buildingId
        || null,
      surfaceOwner: shell?.dataset.uiOwner
        || targetElement?.closest?.("[data-ui-owner]")?.dataset?.uiOwner
        || null,
      uiOwnership: window.empireUiOwnershipDiagnostics?.getSummary?.() || null
    };
  }, { selector: definition.selector, shellSelector: definition.shell });
}

export async function captureParitySurface(page, {
  mode,
  phase = "after",
  viewport,
  surfaceName
}) {
  const definition = paritySurfaces[surfaceName];
  const target = page.locator(definition.selector).first();
  await expect(target).toBeVisible();
  const directory = artifactDirectory(phase, mode, viewport.name);
  await fs.mkdir(directory, { recursive: true });
  const metadata = await readParitySurfaceMetadata(page, surfaceName);
  const presentation = ["buildingDetail", "restaurant", "arcade"].includes(surfaceName)
    ? await getBuildingPresentationSignature(page, surfaceName)
    : null;
  const basePath = path.join(directory, surfaceName);
  const dynamicMasks = target.locator([
    "[data-production-progress]",
    "[data-production-countdown]",
    "[data-countdown]",
    "[data-city-events-countdown]",
    "time"
  ].join(","));
  await target.screenshot({
    path: `${basePath}.png`,
    animations: "disabled",
    mask: await dynamicMasks.count() ? [dynamicMasks] : []
  });
  await fs.writeFile(`${basePath}.html`, metadata.html, "utf8");
  await fs.writeFile(`${basePath}.json`, `${JSON.stringify({
    ...metadata,
    presentation,
    html: undefined
  }, null, 2)}\n`, "utf8");
  return metadata;
}

export async function getParitySurfaceSignature(page, surfaceName) {
  const metadata = await readParitySurfaceMetadata(page, surfaceName);
  return {
    owner: metadata.surfaceOwner,
    canonicalClassNames: normalizeParityClassNames(metadata.classNames),
    selectedDistrictId: metadata.selectedDistrictId,
    selectedBuildingId: metadata.selectedBuildingId,
    visibleModalCount: metadata.visibleModalCount
  };
}

export async function getBuildingPresentationSignature(page, surfaceName) {
  const definition = paritySurfaces[surfaceName];
  const target = page.locator(definition.selector).first();
  await expect(target).toBeVisible();
  return target.evaluate((targetElement) => {
    const normalizeText = (value) => String(value || "").replace(/\s+/gu, " ").trim();
    const visibleElements = (selector) => Array.from(targetElement.querySelectorAll(selector))
      .filter((element) => {
        if (!(element instanceof HTMLElement) || element.hidden) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && rect.width > 0
          && rect.height > 0;
      });
    const actionGrid = targetElement.querySelector(".district-building-detail-actions");
    const actionRows = visibleElements(
      ".district-building-detail-actions .building-info-action-row"
    );
    const actionRects = actionRows.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    });
    const actionStyle = actionGrid instanceof HTMLElement
      ? getComputedStyle(actionGrid)
      : null;
    return {
      title: normalizeText(
        targetElement.querySelector("[data-district-building-detail-title]")?.textContent
        || targetElement.querySelector(".modal__title")?.textContent
      ),
      sectionHeadings: visibleElements(
        "[data-district-building-detail-panel] h5"
      ).map((element) => normalizeText(element.textContent)),
      mechanics: visibleElements(
        ".district-building-detail-mechanics .district-building-detail-mechanic-row"
      ).map((element) => normalizeText(element.textContent)),
      effects: visibleElements(
        "[data-district-building-detail-effects-section] .district-building-detail-effect-cell"
      ).map((element) => normalizeText(element.textContent)),
      actions: actionRows.map((element) => ({
        actionId: element.dataset.districtBuildingDetailActionId || "",
        title: normalizeText(
          element.querySelector(".building-info-action-row__title")?.textContent
        ),
        description: normalizeText(
          element.querySelector(".building-info-action-row__desc")?.textContent
        ),
        phase: normalizeText(
          element.querySelector(".building-info-action-row__phase")?.textContent
        )
      })),
      actionGrid: {
        display: actionStyle?.display || "",
        gridTemplateColumns: actionStyle?.gridTemplateColumns || "",
        columnCount: new Set(actionRects.map((rect) => rect.left)).size,
        rowCount: new Set(actionRects.map((rect) => rect.top)).size,
        rects: actionRects
      }
    };
  });
}

export async function getProductionPresentationSignature(page, surfaceName) {
  const definition = paritySurfaces[surfaceName];
  const target = page.locator(definition.selector).first();
  await expect(target).toBeVisible();
  return target.evaluate((targetElement) => {
    const normalizeText = (value) => String(value || "").replace(/\s+/gu, " ").trim();
    const visibleElements = (selector) => Array.from(targetElement.querySelectorAll(selector))
      .filter((element) => {
        if (!(element instanceof HTMLElement) || element.hidden) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && rect.width > 0
          && rect.height > 0;
      });
    return {
      title: normalizeText(targetElement.querySelector(".modal__header h3")?.textContent),
      tabs: visibleElements(
        "[data-production-building-tab], [data-factory-tab]"
      ).map((element) => ({
        key: element.dataset.productionBuildingTab || element.dataset.factoryTab || "",
        label: normalizeText(element.textContent),
        selected: element.getAttribute("aria-selected") === "true"
      })),
      sectionHeadings: visibleElements(
        "[data-production-building-panel] h5, [data-factory-panel] h5"
      ).map((element) => normalizeText(element.textContent)),
      recipeLabels: visibleElements([
        ".pharmacy-slot__title",
        ".drug-production-slot__title"
      ].join(",")).map((element) => normalizeText(element.textContent))
    };
  });
}

export async function getParityDomStructureSignature(page, surfaceName) {
  const definition = paritySurfaces[surfaceName];
  const target = page.locator(definition.selector).first();
  await expect(target).toBeVisible();
  return target.evaluate((targetElement) => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement) || element.hidden) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || 1) > 0
        && rect.width > 0
        && rect.height > 0;
    };
    const normalizeText = (value) => String(value || "").replace(/\s+/gu, " ").trim();
    const normalizeClasses = (element) => Array.from(element.classList || [])
      .filter((className) => (
        !/^(?:is|has|tone|state|status|theme|mode)--?/u.test(className)
        && !/(?:loading|disabled|active|selected|server-authoritative|local-demo)/u.test(className)
      ))
      .map((className) => className.replace(/--.*$/u, ""))
      .filter(Boolean)
      .sort();
    const targetRect = targetElement.getBoundingClientRect();
    const relativeRect = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.left - targetRect.left),
        y: Math.round(rect.top - targetRect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    };
    const structuralKey = (element, index = 0) => {
      const datasetKey = [
        element.dataset.districtBuildingDetailPanel,
        element.dataset.productionBuildingPanel,
        element.dataset.factoryPanel,
        element.dataset.productionPanel
      ].find(Boolean);
      if (datasetKey) return datasetKey;
      const heading = normalizeText(element.querySelector?.(":scope > h5")?.textContent);
      if (heading) return heading;
      const className = normalizeClasses(element)[0];
      return className || `${element.tagName.toLowerCase()}:${index}`;
    };
    const activePanels = Array.from(targetElement.querySelectorAll([
      "[data-district-building-detail-panel]",
      "[data-production-building-panel]",
      "[data-factory-panel]"
    ].join(","))).filter(isVisible);
    const sections = activePanels.flatMap((panel) => Array.from(panel.children)
      .filter(isVisible)
      .map((element, index) => ({
        key: structuralKey(element, index),
        tag: element.tagName.toLowerCase(),
        classes: normalizeClasses(element),
        rect: relativeRect(element)
      })));
    const structuralElements = Array.from(new Set([
      targetElement,
      ...targetElement.querySelectorAll([
        ".modal__header",
        ".modal__body",
        ".building-detail-tabs",
        "[data-district-building-detail-panel]",
        "[data-production-building-panel]",
        "[data-factory-panel]",
        ".building-tech-popup-overview-grid",
        "[data-district-building-detail-stats]",
        "[data-district-building-detail-mechanics]",
        "[data-district-building-detail-effects]",
        "[data-district-building-detail-actions]",
        ".building-detail-actions",
        "[data-production-panel]",
        "[data-factory-slot-list]"
      ].join(","))
    ])).filter(isVisible);

    return {
      classNames: Array.from(new Set(
        [targetElement, ...targetElement.querySelectorAll("*")]
          .filter(isVisible)
          .flatMap((element) => normalizeClasses(element))
      )).sort(),
      sectionOrder: sections.map((section) => section.key),
      sections,
      counts: {
        visiblePanels: activePanels.length,
        tabs: Array.from(targetElement.querySelectorAll(
          "[data-district-building-detail-tab], [data-production-building-tab], [data-factory-tab]"
        )).filter(isVisible).length,
        stats: Array.from(targetElement.querySelectorAll(
          ".district-building-detail-stat-row, .building-tech-popup-stat-card"
        )).filter(isVisible).length,
        mechanics: Array.from(targetElement.querySelectorAll(
          ".district-building-detail-mechanic-row"
        )).filter(isVisible).length,
        effects: Array.from(targetElement.querySelectorAll(
          ".district-building-detail-effect-cell"
        )).filter(isVisible).length,
        actions: Array.from(targetElement.querySelectorAll(
          ".building-info-action-row"
        )).filter(isVisible).length,
        productionCards: Array.from(targetElement.querySelectorAll([
          ".production-recipe-card",
          ".pharmacy-slot",
          ".drug-production-slot",
          ".factory-slot",
          ".armory-slot",
          ".factory-slot-card",
          ".production-craft-card",
          "[data-production-panel] > article",
          "[data-factory-slot-list] > article"
        ].join(","))).filter(isVisible).length
      },
      layout: structuralElements.map((element, index) => {
        const style = getComputedStyle(element);
        return {
          key: element === targetElement ? "surface" : structuralKey(element, index),
          tag: element.tagName.toLowerCase(),
          classes: normalizeClasses(element),
          display: style.display,
          position: style.position,
          gridTemplateColumns: style.gridTemplateColumns,
          flexDirection: style.flexDirection,
          rect: relativeRect(element)
        };
      })
    };
  });
}

export function normalizeParityClassNames(classNames = []) {
  return Array.from(new Set(classNames
    .filter((className) => (
      !/^(?:is|has|tone|state|status|theme|mode)--?/u.test(className)
      && !/(?:loading|disabled|active|selected|server-authoritative|local-demo)/u.test(className)
      && className !== "district-popup-action__label"
    ))
    .map((className) => className.replace(/--.*$/u, ""))))
    .sort();
}

export async function expectNoDuplicateVisibleUi(page) {
  const summary = await page.evaluate(() => (
    window.empireUiOwnershipDiagnostics?.check?.("playwright-assertion")
    || window.empireUiOwnershipDiagnostics?.getSummary?.()
    || null
  ));
  expect(summary, "Development UI ownership diagnostics must be active").toBeTruthy();
  expect(summary.violations || [], "Only one visible renderer may own each surface").toEqual([]);
  return summary;
}
