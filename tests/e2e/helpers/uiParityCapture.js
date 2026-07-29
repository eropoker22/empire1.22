import fs from "node:fs/promises";
import path from "node:path";
import { expect } from "@playwright/test";

const SESSION_KEY = "empireStreets.session.v1";
const SCOPED_SESSION_KEY = "empireStreets.session.free.instance-free-eu-central-public-1.v1";

export const parityViewports = Object.freeze([
  Object.freeze({ name: "desktop-1440x900", width: 1440, height: 900 }),
  Object.freeze({ name: "mobile-390x844", width: 390, height: 844 })
]);

export const paritySurfaces = Object.freeze({
  district: Object.freeze({
    selector: "[data-district-popup-card]",
    shell: "[data-district-popup]"
  }),
  restaurant: Object.freeze({
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

export async function openParityLocalDemo(page) {
  await page.addInitScript(({ sessionKey, scopedSessionKey }) => {
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
        startDistrictId: 21,
        preferredStartDistrictId: 21,
        factionLocked: true,
        hasCompletedServerEntry: true,
        serverRegistrationStatus: "faction_locked",
        lastLoginAt: now
      },
      world: {
        ownedDistrictIds: [21, 66, 68],
        phaseState: { gamePhase: "live", mapPhase: "night", cityMinutes: 1_334 }
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
  }, { sessionKey: SESSION_KEY, scopedSessionKey: SCOPED_SESSION_KEY });
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
    restaurant: ["restaurant", "restaurace"]
  };
  const normalized = String(buildingTypeOrLabel).toLocaleLowerCase("cs");
  const expectedLabels = aliases[normalized] || [normalized];
  const opened = await page.locator("[data-district-building-name]").evaluateAll((buttons, expected) => {
    const button = buttons.find((candidate) => {
      const type = String(candidate.dataset.districtBuildingType || "").toLocaleLowerCase("cs");
      const text = String(candidate.textContent || "").toLocaleLowerCase("cs");
      return expected.some((label) => type === label || text.includes(label));
    });
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  }, expectedLabels);
  expect(opened, `Building ${buildingTypeOrLabel} should be interactive`).toBe(true);
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

export async function closeSurface(page, surfaceName) {
  const closeSelectors = {
    district: "[data-district-popup-close]",
    restaurant: "[data-district-building-detail-close]",
    pharmacy: "[data-pharmacy-popup-close]",
    drugLab: "[data-druglab-popup-close]",
    factory: "[data-factory-popup-close]",
    armory: "[data-armory-popup-close]",
    cityEvents: "#events-modal-close",
    cityEventDetail: "#event-detail-modal-close"
  };
  const close = page.locator(closeSelectors[surfaceName]).last();
  if (await close.isVisible().catch(() => false)) await close.click();
  await expect(page.locator(paritySurfaces[surfaceName].shell)).toBeHidden();
}

export async function openCityEvents(page) {
  await page.locator("#city-events-open").click();
  await expect(page.locator("#events-modal")).toBeVisible();
}

export async function openFirstCityEventDetail(page) {
  const firstAgent = page.locator(".events-agent:not([aria-disabled='true'])").first();
  await firstAgent.click();
  const firstOffer = page.locator("#events-tasklist [data-event-open]").first();
  await expect(firstOffer).toBeVisible();
  await firstOffer.click();
  await expect(page.locator("#event-detail-modal")).toBeVisible();
}

function artifactDirectory(mode, viewportName) {
  return path.resolve("artifacts", "live-demo-ui-parity", "baseline", mode, viewportName);
}

export async function captureParitySurface(page, {
  mode,
  viewport,
  surfaceName
}) {
  const definition = paritySurfaces[surfaceName];
  const target = page.locator(definition.selector).first();
  await expect(target).toBeVisible();
  const directory = artifactDirectory(mode, viewport.name);
  await fs.mkdir(directory, { recursive: true });
  const metadata = await page.evaluate(({ selector, shellSelector }) => {
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
    const modalCandidates = Array.from(document.querySelectorAll([
      "[role='dialog']",
      "[data-district-popup]",
      "[data-district-building-detail-popup]",
      "[data-pharmacy-popup]",
      "[data-druglab-popup]",
      "[data-factory-popup]",
      "[data-armory-popup]",
      "#events-modal",
      "#event-detail-modal",
      "[data-gameplay-slice-client]"
    ].join(","))).filter(isVisible);
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
    return {
      html: shell?.outerHTML || "",
      classNames: Array.from(new Set(Array.from(shell?.querySelectorAll?.("*") || [])
        .flatMap((element) => Array.from(element.classList || [])))).sort(),
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
      selectedBuildingId: visibleBuildingDetail?.dataset.districtBuildingDetailName
        || shell?.dataset.serverBuildingId
        || shell?.dataset.buildingId
        || null
    };
  }, { selector: definition.selector, shellSelector: definition.shell });
  const basePath = path.join(directory, surfaceName);
  await target.screenshot({ path: `${basePath}.png`, animations: "disabled" });
  await fs.writeFile(`${basePath}.html`, metadata.html, "utf8");
  await fs.writeFile(`${basePath}.json`, `${JSON.stringify({
    ...metadata,
    html: undefined
  }, null, 2)}\n`, "utf8");
  return metadata;
}
