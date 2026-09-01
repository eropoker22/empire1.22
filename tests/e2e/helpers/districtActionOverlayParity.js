import { expect } from "@playwright/test";
import {
  captureIsolatedParityScreenshot,
  openParityLocalDemo,
  parityComputedStyleProperties
} from "./uiParityCapture.js";
import {
  createModalParityViewportBatches,
  modalParityViewports,
  validateModalParityViewportMatrix
} from "./modalParityViewports.js";
import {
  HOSTED_E2E_STARTING_PLAYER_STATE
} from "../../../scripts/local-hosted/hosted-e2e-starting-player-state.mjs";

const AUTHORITATIVE_TEXT = "<authoritative>";
const CANONICAL_LAYOUT_TEXT_STATE_PROPERTY =
  "__empireDistrictActionParityCanonicalLayoutTextState";

export const districtActionOverlayParityViewports = modalParityViewports;

export const districtActionOverlayParityViewportBatches = createModalParityViewportBatches(
  "district-action"
);

export const districtActionOverlayNames = Object.freeze([
  "spy-confirm",
  "robbery-setup",
  "robbery-confirm",
  "heist-inline",
  "attack-setup",
  "attack-confirm",
  "occupy-confirm"
]);

const freezeDefinition = (definition) => Object.freeze({
  ...definition,
  canonicalLayoutTextEntries: Object.freeze(
    (definition.canonicalLayoutTextEntries || []).map((entry) => Object.freeze({ ...entry }))
  ),
  dynamicAssetSelectors: Object.freeze([...(definition.dynamicAssetSelectors || [])]),
  dynamicLeafSelectors: Object.freeze([...(definition.dynamicLeafSelectors || [])]),
  dynamicValueWrapperSelectors: Object.freeze([
    ...(definition.dynamicValueWrapperSelectors || [])
  ]),
  requiredSectionSelectors: Object.freeze([...(definition.requiredSectionSelectors || [])]),
  semanticDatasetKeys: Object.freeze([...(definition.semanticDatasetKeys || [])])
});

export const districtActionOverlayDefinitions = Object.freeze({
  "spy-confirm": freezeDefinition({
    actionId: "spy",
    closeSelector: "[data-spy-confirm-close]",
    dynamicLeafSelectors: [
      "[data-spy-confirm-title]",
      "[data-spy-confirm-source]",
      "[data-spy-confirm-available]",
      "[data-spy-confirm-duration]"
    ],
    dynamicValueWrapperSelectors: [
      "[data-spy-confirm-available]",
      "[data-spy-confirm-duration]"
    ],
    hostedRole: "creator",
    hostedTargetDistrictId: "district:25",
    localRole: "creator",
    localTargetDistrictId: "district:25",
    openBehavior: "click-action",
    requiredSectionSelectors: [
      ".district-modal-hero",
      ".district-action-confirm-popup-body",
      ".modal__actions"
    ],
    semanticDatasetKeys: ["districtType", "atmosphereState"],
    shellSelector: "[data-spy-confirm-popup]",
    stage: "confirmation",
    targetSelector: "[data-spy-confirm-card]"
  }),
  "robbery-setup": freezeDefinition({
    actionId: "rob",
    closeSelector: "[data-robbery-setup-close]",
    dynamicLeafSelectors: [
      "[data-robbery-target-title]",
      "[data-robbery-source-select]",
      "[data-robbery-member-input]",
      "[data-robbery-zone]",
      "[data-robbery-recommendation]",
      "[data-robbery-risk-level]",
      "[data-robbery-loot-preview]",
      "[data-robbery-trap-preview]",
      "[data-robbery-scout-report]",
      "[data-robbery-heat-estimate]",
      "[data-robbery-risk-description]",
      "[data-robbery-status]",
      "[data-robbery-available-members]",
      "[data-robbery-available-spies]"
    ],
    hostedRole: "creator",
    hostedTargetDistrictId: "district:24",
    localRole: "creator",
    localTargetDistrictId: "district:24",
    openBehavior: "click-action",
    requiredSectionSelectors: [
      ".district-modal-hero",
      ".attack-setup-popup-body",
      ".attack-setup-popup-actions"
    ],
    roundedCompositeSelector: "[data-robbery-confirm]",
    semanticDatasetKeys: ["districtType", "atmosphereState"],
    shellSelector: "[data-robbery-setup-popup]",
    stage: "setup",
    targetSelector: "[data-robbery-setup-card]"
  }),
  "robbery-confirm": freezeDefinition({
    actionId: "rob",
    canonicalLayoutTextEntries: [
      {
        selector: "[data-robbery-confirm-duration]",
        text: "10m 00s"
      }
    ],
    closeSelector: "[data-robbery-confirm-close]",
    dynamicLeafSelectors: [
      "[data-robbery-confirm-title]",
      "[data-robbery-confirm-source]",
      "[data-robbery-confirm-members]",
      "[data-robbery-confirm-duration]"
    ],
    dynamicValueWrapperSelectors: [
      "[data-robbery-confirm-members]",
      "[data-robbery-confirm-duration]"
    ],
    hostedRole: "creator",
    hostedTargetDistrictId: "district:24",
    localRole: "creator",
    localTargetDistrictId: "district:24",
    openBehavior: "prepare-robbery",
    requiredSectionSelectors: [
      ".district-modal-hero",
      ".district-action-confirm-popup-body",
      ".modal__actions"
    ],
    semanticDatasetKeys: ["districtType", "atmosphereState"],
    shellSelector: "[data-robbery-confirm-popup]",
    stage: "confirmation",
    targetSelector: "[data-robbery-confirm-card]"
  }),
  "heist-inline": freezeDefinition({
    actionId: "heist",
    closeSelector: "button[data-district-popup-close]",
    dynamicLeafSelectors: [".district-popup-action__sub"],
    hostedRole: "hunter",
    hostedTargetDistrictId: "district:2",
    localRole: "attacker",
    localTargetDistrictId: "district:45",
    openBehavior: "inspect-only",
    requiredSectionSelectors: [],
    semanticDatasetKeys: ["districtActionId", "districtActionLabel"],
    shellSelector: "[data-district-popup]",
    stage: "inline-pre-submit",
    targetSelector: "[data-district-action-id=\"heist\"]"
  }),
  "attack-setup": freezeDefinition({
    actionId: "attack",
    closeSelector: "[data-attack-setup-close]",
    dynamicAssetSelectors: ["[data-attack-setup-atmosphere-image]"],
    dynamicLeafSelectors: [
      "[data-attack-target-title]",
      "[data-attack-source-select]",
      "[data-attack-available-population]",
      "[data-attack-required-population]",
      "[data-attack-estimated-power]",
      "[data-attack-status]",
      "[data-attack-owned]",
      "[data-attack-weapon-input]"
    ],
    hostedRole: "hunter",
    hostedTargetDistrictId: "district:2",
    localRole: "attacker",
    localTargetDistrictId: "district:45",
    openBehavior: "click-action",
    requiredSectionSelectors: [
      ".district-modal-hero",
      ".attack-setup-popup-body",
      ".attack-setup-popup-weapons"
    ],
    semanticDatasetKeys: ["districtType", "atmosphereState"],
    shellSelector: "[data-attack-setup-popup]",
    stage: "setup",
    targetSelector: "[data-attack-setup-card]"
  }),
  "attack-confirm": freezeDefinition({
    actionId: "attack",
    canonicalLayoutTextEntries: [
      { selector: "[data-attack-confirm-title]", text: "District 45" },
      { selector: "[data-attack-confirm-source]", text: "District 21" },
      { selector: "[data-attack-confirm-members]", text: "10" },
      { selector: "[data-attack-confirm-power]", text: "120" },
      { selector: "[data-attack-confirm-scenario]", text: "Verdikt po odpočtu" },
      { selector: "[data-attack-confirm-duration]", text: "22m 00s" },
      {
        selector: "[data-attack-confirm-note]",
        text: "Po potvrzení se spustí útok. Výsledek server připíše po uvedeném čase."
      }
    ],
    closeSelector: "[data-attack-confirm-close]",
    dynamicAssetSelectors: ["[data-attack-confirm-atmosphere-image]"],
    dynamicLeafSelectors: [
      "[data-attack-confirm-title]",
      "[data-attack-confirm-source]",
      "[data-attack-confirm-members]",
      "[data-attack-confirm-power]",
      "[data-attack-confirm-scenario]",
      "[data-attack-confirm-duration]",
      "[data-attack-confirm-note]"
    ],
    dynamicValueWrapperSelectors: [
      "[data-attack-confirm-source]",
      "[data-attack-confirm-members]",
      "[data-attack-confirm-power]",
      "[data-attack-confirm-scenario]",
      "[data-attack-confirm-duration]"
    ],
    hostedRole: "hunter",
    hostedTargetDistrictId: "district:2",
    localRole: "attacker",
    localTargetDistrictId: "district:45",
    openBehavior: "prepare-attack",
    requiredSectionSelectors: [
      ".district-modal-hero",
      ".district-action-confirm-popup-body",
      ".modal__actions"
    ],
    semanticDatasetKeys: ["districtType", "atmosphereState"],
    shellSelector: "[data-attack-confirm-popup]",
    stage: "confirmation",
    targetSelector: "[data-attack-confirm-card]"
  }),
  "occupy-confirm": freezeDefinition({
    actionId: "occupy",
    canonicalLayoutTextEntries: [
      {
        selector: "[data-occupy-confirm-title]",
        text: "District 6"
      },
      {
        selector: "[data-occupy-confirm-cost]",
        text: "50 populace · 10 vlivu"
      },
      {
        selector: "[data-occupy-confirm-duration]",
        text: "12m 00s"
      },
      {
        selector: "[data-occupy-confirm-note]",
        text: "Po potvrzení se spustí obsazování. District bliká tvojí barvou a po doběhnutí přejde pod tebe."
      }
    ],
    closeSelector: "[data-occupy-confirm-close]",
    dynamicLeafSelectors: [
      "[data-occupy-confirm-title]",
      "[data-occupy-confirm-source]",
      "[data-occupy-confirm-cost]",
      "[data-occupy-confirm-duration]",
      "[data-occupy-confirm-note]"
    ],
    dynamicValueWrapperSelectors: [
      "[data-occupy-confirm-cost]",
      "[data-occupy-confirm-duration]"
    ],
    hostedRole: "creator",
    hostedTargetDistrictId: "district:6",
    localRole: "occupier",
    localTargetDistrictId: "district:6",
    openBehavior: "click-action",
    requiredSectionSelectors: [
      ".district-modal-hero",
      ".district-action-confirm-popup-body",
      ".modal__actions"
    ],
    semanticDatasetKeys: ["districtType", "atmosphereState"],
    shellSelector: "[data-occupy-confirm-popup]",
    stage: "confirmation",
    targetSelector: "[data-occupy-confirm-card]"
  })
});

export const districtActionOverlayScenarioEvidence = Object.freeze({
  hostedEntry: "browser-registration-lobby-spawn-bootstrap",
  hostedScenario: "fixture-backed:multiplayer-core",
  resultSurface: "not-triggered-because-every-current-result-requires-authoritative-state-mutation",
  stateBoundary: "pre-submit-only"
});

const localRoleDefinitions = Object.freeze({
  creator: Object.freeze({
    ownedDistrictIds: Object.freeze([1, 2]),
    revealedDefenseDistrictIds: Object.freeze([]),
    revealedTypeDistrictIds: Object.freeze([]),
    occupiableDistrictIds: Object.freeze([]),
    startDistrictId: 1
  }),
  occupier: Object.freeze({
    ownedDistrictIds: Object.freeze([1, 5]),
    revealedDefenseDistrictIds: Object.freeze([6]),
    revealedTypeDistrictIds: Object.freeze([6]),
    occupiableDistrictIds: Object.freeze([6]),
    startDistrictId: 5
  }),
  attacker: Object.freeze({
    ownedDistrictIds: Object.freeze([21, 22, 44]),
    revealedDefenseDistrictIds: Object.freeze([45]),
    revealedTypeDistrictIds: Object.freeze([45]),
    occupiableDistrictIds: Object.freeze([]),
    startDistrictId: 21
  })
});

const forbiddenDynamicMaskSelectors = new Set([
  "*",
  "body",
  "html",
  "[data-district-popup]",
  "[data-attack-setup-card]",
  "[data-attack-confirm-card]",
  "[data-robbery-setup-card]",
  "[data-robbery-confirm-card]",
  "[data-spy-confirm-card]",
  "[data-occupy-confirm-card]"
]);

export function validateDistrictActionOverlayParityCoverage({
  definitions = districtActionOverlayDefinitions,
  surfaceNames = districtActionOverlayNames,
  viewportBatches = districtActionOverlayParityViewportBatches,
  viewports = districtActionOverlayParityViewports
} = {}) {
  const resolvedSurfaceNames = Array.from(surfaceNames);
  const viewportContract = validateModalParityViewportMatrix({
    batches: viewportBatches,
    viewports
  });
  if (JSON.stringify(resolvedSurfaceNames) !== JSON.stringify(districtActionOverlayNames)) {
    throw new Error("District action overlay parity must keep the canonical surface order.");
  }

  for (const surfaceName of resolvedSurfaceNames) {
    const definition = definitions[surfaceName];
    if (!definition) {
      throw new Error(`District action parity surface ${surfaceName} is missing.`);
    }
    for (const key of [
      "actionId",
      "closeSelector",
      "hostedRole",
      "hostedTargetDistrictId",
      "localRole",
      "localTargetDistrictId",
      "openBehavior",
      "shellSelector",
      "stage",
      "targetSelector"
    ]) {
      if (!definition[key]) {
        throw new Error(`District action parity surface ${surfaceName} lacks ${key}.`);
      }
    }
    if (!localRoleDefinitions[definition.localRole]) {
      throw new Error(`District action parity surface ${surfaceName} has an unknown local role.`);
    }
    if (!Array.isArray(definition.requiredSectionSelectors)
      || (definition.stage !== "inline-pre-submit" && definition.requiredSectionSelectors.length < 2)) {
      throw new Error(`District action parity surface ${surfaceName} lacks structural section guards.`);
    }
    if ([...definition.dynamicAssetSelectors, ...definition.dynamicLeafSelectors].some((selector) => (
      forbiddenDynamicMaskSelectors.has(selector)
      || selector === definition.shellSelector
      || selector === definition.targetSelector
    ))) {
      throw new Error(`District action parity surface ${surfaceName} masks a structural container.`);
    }
    const canonicalLayoutTextSelectors = new Set();
    for (const entry of definition.canonicalLayoutTextEntries) {
      if (!entry?.selector || !entry?.text) {
        throw new Error(`District action parity surface ${surfaceName} has invalid canonical layout text.`);
      }
      if (!definition.dynamicLeafSelectors.includes(entry.selector)) {
        throw new Error(
          `District action parity surface ${surfaceName} canonicalizes a non-dynamic layout leaf.`
        );
      }
      if (canonicalLayoutTextSelectors.has(entry.selector)) {
        throw new Error(
          `District action parity surface ${surfaceName} canonicalizes the same layout leaf twice.`
        );
      }
      canonicalLayoutTextSelectors.add(entry.selector);
    }
  }

  return Object.freeze({
    actionIds: Object.freeze(Array.from(new Set(resolvedSurfaceNames.map(
      (surfaceName) => definitions[surfaceName].actionId
    )))),
    batchCount: viewportContract.batchCount,
    comparisonCount: resolvedSurfaceNames.length * viewportContract.viewportNames.length,
    resultSurface: districtActionOverlayScenarioEvidence.resultSurface,
    surfaceNames: Object.freeze(resolvedSurfaceNames),
    viewportNames: viewportContract.viewportNames
  });
}

export function resolveDistrictActionOverlayDefinition(surfaceName) {
  const definition = districtActionOverlayDefinitions[surfaceName];
  if (!definition) {
    throw new Error(`Unknown district action parity surface: ${surfaceName}`);
  }
  return definition;
}

export async function openLocalDemoDistrictActionParityRole(page, roleName, {
  mapPhase = "day"
} = {}) {
  const role = localRoleDefinitions[roleName];
  if (!role) {
    throw new Error(`Unknown local district action parity role: ${roleName}`);
  }
  const startingPlayerState = {
    ...HOSTED_E2E_STARTING_PLAYER_STATE,
    cleanCash: 1_000_000,
    dirtyCash: 1_000_000,
    population: 500,
    materials: {
      ...HOSTED_E2E_STARTING_PLAYER_STATE.materials,
      bazooka: 20,
      chemicals: 100
    }
  };
  await openParityLocalDemo(page, {
    gamePhase: "launch",
    mapPhase,
    ownedDistrictIds: role.ownedDistrictIds,
    startDistrictId: role.startDistrictId,
    startingPlayerState
  });
  await page.evaluate(({ configuredRole, configuredMapPhase }) => {
    const bridge = window.empireLocalDemoGameplayBridge;
    if (!bridge?.updateStoredPreviewSession) {
      throw new Error("Local demo gameplay bridge is unavailable for action parity setup.");
    }
    bridge.updateStoredPreviewSession((session) => ({
      ...session,
      gang: {
        ...session.gang,
        members: 500,
        population: 500
      },
      missions: {
        ...session.missions,
        attackOrders: [],
        occupyOrders: [],
        robberyOrders: [],
        spy: {
          available: 2,
          missions: []
        },
        spyIntel: {
          occupiableDistrictIds: configuredRole.occupiableDistrictIds,
          revealedDefenseDistrictIds: configuredRole.revealedDefenseDistrictIds,
          revealedTypeDistrictIds: configuredRole.revealedTypeDistrictIds
        }
      },
      world: {
        ...session.world,
        ownedDistrictIds: configuredRole.ownedDistrictIds,
        phaseState: {
          ...session.world?.phaseState,
          cityMinutes: configuredMapPhase === "night" ? 1_334 : 720,
          gamePhase: "launch",
          mapPhase: configuredMapPhase
        }
      }
    }));
    document.dispatchEvent(new CustomEvent("empire:world-state-changed", {
      detail: { ownedDistrictIdsChanged: true }
    }));
  }, {
    configuredMapPhase: mapPhase,
    configuredRole: role
  });
  await expect.poll(() => page.evaluate(() => {
    const state = window.empireStreetsDistrictState?.getState?.() || {};
    const launchOwners = new Map(state.launchOwners || []);
    return {
      gamePhase: state.gamePhase || "",
      launchOwner25: launchOwners.get(25) || null,
      launchOwner45: launchOwners.get(45) || null,
      ownedDistrictIds: state.ownedDistrictIds || []
    };
  })).toEqual({
    gamePhase: "launch",
    launchOwner25: 3,
    launchOwner45: 9,
    ownedDistrictIds: [...role.ownedDistrictIds]
  });
}

export async function openDistrictActionOverlayFromVisibleUi(page, surfaceName, {
  authority
} = {}) {
  const definition = resolveDistrictActionOverlayDefinition(surfaceName);
  const targetDistrictId = authority === "hosted"
    ? definition.hostedTargetDistrictId
    : definition.localTargetDistrictId;
  await closeDistrictActionParitySurfaces(page);
  await clickDistrictFromVisibleMap(page, targetDistrictId, authority);
  const numericDistrictId = Number(targetDistrictId.replace(/^district:/u, ""));
  const action = page.locator(
    `[data-district-popup][data-district-id="${numericDistrictId}"]`
      + ` [data-district-action-id="${definition.actionId}"]`
  );
  await expect(
    action,
    `${authority} ${surfaceName} must expose ${definition.actionId} through the visible district popup`
  ).toBeVisible();
  await expect(action).toBeEnabled();

  if (definition.openBehavior === "inspect-only") {
    await action.focus();
  } else {
    await action.click();
    if (definition.openBehavior === "prepare-robbery") {
      await prepareRobberyConfirmation(page);
    }
    if (definition.openBehavior === "prepare-attack") {
      await prepareAttackConfirmation(page);
    }
  }

  const shell = page.locator(`${definition.shellSelector}:visible`).last();
  const target = page.locator(`${definition.targetSelector}:visible`).last();
  await expect(shell, `${surfaceName} shell must be visible`).toBeVisible();
  if (definition.shellSelector === "[data-district-popup]") {
    await expect(
      shell,
      `${surfaceName} district popup must finish its interaction-entry lifecycle`
    ).toHaveAttribute("data-district-popup-interaction-ready", "ready");
  }
  await expect(target, `${surfaceName} presentation target must be visible`).toBeVisible();
  for (const selector of definition.requiredSectionSelectors) {
    await expect(
      target.locator(selector).first(),
      `${surfaceName} must keep required section ${selector}`
    ).toBeVisible();
  }
  // The trusted district click leaves the real mouse pointer at the selected
  // map coordinate. Depending on the viewport, the newly opened overlay can
  // place a stepper button under that pointer and activate its genuine hover
  // treatment. Move the pointer to the inert page corner before comparing
  // presentation contracts so local and hosted captures observe the same
  // resting UI state.
  await page.mouse.move(1, 1);
  await settleActionOverlay(target);
  for (const selector of definition.dynamicAssetSelectors) {
    const asset = target.locator(selector).first();
    await expect(asset, `${surfaceName} dynamic asset ${selector} must be visible`).toBeVisible();
    await expect.poll(() => asset.evaluate((element) => (
      element instanceof HTMLImageElement
      && element.complete
      && element.naturalWidth > 0
      && element.naturalHeight > 0
    )), {
      message: `${surfaceName} dynamic asset ${selector} must finish loading`
    }).toBe(true);
  }
  return target;
}

async function clickDistrictFromVisibleMap(page, districtId, authority) {
  const numericDistrictId = Number(String(districtId).replace(/^district:/u, ""));
  const canvasHost = page.locator("[data-map-canvas]");
  await expect(canvasHost).toBeVisible();
  await canvasHost.scrollIntoViewIfNeeded();
  const resetResult = await page.evaluate(async () => {
    const didReset = window.empireStreetsMapNavigation?.resetZoom?.();
    await new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(resolve);
      });
    });
    return {
      didReset,
      state: window.empireStreetsMapNavigation?.getState?.() || null
    };
  });
  expect(resetResult, "Visible map navigation must reset before the trusted district click").toMatchObject({
    didReset: true,
    state: { scale: 1, x: 0, y: 0 }
  });
  const point = await page.evaluate((requestedDistrictId) => {
    const district = window.empireStreetsDistrictState?.getDistrictById?.(requestedDistrictId);
    const canvas = document.querySelector("[data-district-canvas]");
    const host = document.querySelector("[data-map-canvas]");
    const viewport = document.querySelector("[data-map-viewport]");
    if (
      !district
      || !(canvas instanceof HTMLCanvasElement)
      || !(host instanceof HTMLElement)
      || !(viewport instanceof HTMLElement)
    ) {
      return null;
    }
    const hostRect = host.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const viewportInset = 4;
    const x = hostRect.left + (Number(district.centerX) / canvas.width) * hostRect.width;
    const y = hostRect.top + (Number(district.centerY) / canvas.height) * hostRect.height;
    return {
      x,
      y,
      insideViewport: (
        x >= viewportRect.left + viewportInset
        && x <= viewportRect.right - viewportInset
        && y >= viewportRect.top + viewportInset
        && y <= viewportRect.bottom - viewportInset
      ),
      viewport: {
        bottom: viewportRect.bottom,
        left: viewportRect.left,
        right: viewportRect.right,
        top: viewportRect.top
      }
    };
  }, numericDistrictId);
  expect(point, `District ${districtId} must expose a visible canvas point`).toBeTruthy();
  expect(
    point.insideViewport,
    `District ${districtId} point ${JSON.stringify(point)} must be inside the visible map viewport`
  ).toBe(true);
  await page.mouse.click(point.x, point.y);
  const popup = page.locator("[data-district-popup]:visible").last();
  await expect(popup).toBeVisible();
  await expect(popup).toHaveAttribute("data-district-id", String(numericDistrictId));
  if (authority === "hosted") {
    const canonicalDistrictId = `district:${numericDistrictId}`;
    await expect.poll(() => page.evaluate(() => (
      window.EmpireGameplaySliceClient?.getCurrentReadModel?.()?.district?.districtId || null
    )), {
      message: `Hosted district ${canonicalDistrictId} must finish authoritative selection`,
      timeout: 30_000
    }).toBe(canonicalDistrictId);
    await expect(popup).toHaveAttribute(
      "data-server-district-id",
      canonicalDistrictId,
      { timeout: 30_000 }
    );
  }
}

async function prepareRobberyConfirmation(page) {
  const setup = page.locator("[data-robbery-setup-popup]:visible");
  await expect(setup).toBeVisible();
  const input = setup.locator("[data-robbery-member-input]");
  await expect(input).toBeDisabled();
  await expect(input).toHaveValue("1");
  const prepare = setup.locator("[data-robbery-confirm]");
  await expect(prepare).toBeEnabled();
  await prepare.click();
}

async function prepareAttackConfirmation(page) {
  const setup = page.locator("[data-attack-setup-popup]:visible");
  await expect(setup).toBeVisible();
  const source = setup.locator("[data-attack-source-select]");
  await source.selectOption({ index: 1 });
  const bazooka = setup.locator('[data-attack-weapon-input="bazooka"]');
  await setParityNumberInput(bazooka, "1");
  const prepare = setup.locator("[data-attack-confirm]");
  await expect(prepare).toBeEnabled();
  await prepare.click();
}

async function setParityNumberInput(input, value) {
  await input.evaluate((element, nextValue) => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    valueSetter?.call(element, nextValue);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  await expect(input).toHaveValue(value);
}

async function settleActionOverlay(target) {
  await target.evaluate(async (targetElement) => {
    for (const animation of targetElement.getAnimations({ subtree: true })) {
      try {
        animation.finish();
      } catch {}
    }
    await Promise.all(Array.from(targetElement.querySelectorAll("img")).map((image) => (
      image.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          })
    )));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

export async function closeDistrictActionParitySurfaces(page) {
  const closeSelectors = [
    "[data-attack-confirm-close]",
    "[data-attack-setup-close]",
    "[data-robbery-confirm-close]",
    "[data-robbery-setup-close]",
    "[data-occupy-confirm-close]",
    "[data-spy-confirm-close]"
  ];
  for (const selector of closeSelectors) {
    const close = page.locator(`${selector}:visible`).last();
    if (await close.isVisible().catch(() => false)) {
      await close.click();
    }
  }
  const districtClose = page.locator("[data-district-popup]:visible button[data-district-popup-close]").last();
  if (await districtClose.isVisible().catch(() => false)) {
    await districtClose.click();
  }
  await expect(page.locator("[data-district-popup]:visible")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveClass(/\bgame-mobile-close-guard\b/u);
}

export async function applyDistrictActionOverlayCanonicalLayoutText(page, surfaceName) {
  const definition = resolveDistrictActionOverlayDefinition(surfaceName);
  if (definition.canonicalLayoutTextEntries.length === 0) {
    return { entries: [] };
  }
  const target = page.locator(`${definition.targetSelector}:visible`).last();
  await expect(target).toBeVisible();
  return target.evaluate(async (targetElement, config) => {
    const isVisible = (element) => {
      if (!(element instanceof Element) || element.hasAttribute("hidden")) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || 1) > 0
        && rect.width > 0
        && rect.height > 0;
    };
    const existingRegistry = globalThis[config.stateProperty];
    if (existingRegistry !== undefined && !(existingRegistry instanceof Map)) {
      throw new Error(`${config.surfaceName} canonical layout registry has an invalid shape.`);
    }
    const registry = existingRegistry || new Map();
    if (!existingRegistry) {
      Object.defineProperty(globalThis, config.stateProperty, {
        configurable: true,
        value: registry
      });
    }
    if (Array.from(registry.values()).some((capture) => (
      capture.targetElement === targetElement
    ))) {
      throw new Error(`${config.surfaceName} canonical layout target is already normalized.`);
    }
    let captureToken;
    do {
      captureToken = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    } while (registry.has(captureToken));
    let capture = null;
    const removeCapture = () => {
      try {
        capture?.observer?.disconnect();
        for (const record of capture?.records || []) {
          for (const [element, actualText] of record.actualTextByElement) {
            if (element.textContent === record.canonicalText) {
              element.textContent = actualText;
            }
          }
        }
      } finally {
        registry.delete(captureToken);
        if (registry.size === 0 && globalThis[config.stateProperty] === registry) {
          delete globalThis[config.stateProperty];
        }
      }
    };

    try {
      const records = config.entries.map((entry) => {
        const matches = Array.from(targetElement.querySelectorAll(entry.selector)).filter(isVisible);
        if (matches.length !== 1) {
          throw new Error(
            `${config.surfaceName} canonical layout leaf ${entry.selector} matched ${matches.length} visible elements.`
          );
        }
        const element = matches[0];
        if (element.childElementCount !== 0) {
          throw new Error(
            `${config.surfaceName} canonical layout leaf ${entry.selector} must remain text-only.`
          );
        }
        return {
          actualTextByElement: new Map(),
          canonicalText: entry.text,
          latestActualText: element.textContent,
          selector: entry.selector
        };
      });
      capture = {
        normalizing: false,
        observer: null,
        observerError: null,
        records,
        restoring: false,
        targetElement
      };
      const normalizeRecord = (record) => {
        const matches = Array.from(targetElement.querySelectorAll(record.selector))
          .filter(isVisible);
        if (matches.length !== 1) {
          throw new Error(
            `${config.surfaceName} canonical layout leaf ${record.selector} matched ${matches.length} visible elements after a renderer update.`
          );
        }
        const element = matches[0];
        if (element.childElementCount !== 0) {
          throw new Error(
            `${config.surfaceName} canonical layout leaf ${record.selector} stopped being text-only.`
          );
        }
        if (element.textContent === record.canonicalText) return;
        record.latestActualText = element.textContent;
        record.actualTextByElement.set(element, record.latestActualText);
        element.textContent = record.canonicalText;
      };
      const normalizeRecords = () => {
        if (capture.normalizing || capture.restoring) return;
        capture.normalizing = true;
        try {
          for (const record of capture.records) normalizeRecord(record);
        } catch (error) {
          capture.observerError ||= error instanceof Error ? error.message : String(error);
        } finally {
          capture.normalizing = false;
        }
      };
      capture.observer = new MutationObserver(normalizeRecords);
      registry.set(captureToken, capture);
      normalizeRecords();
      if (capture.observerError) {
        throw new Error(capture.observerError);
      }
      capture.observer.observe(targetElement, {
        attributeFilter: ["hidden"],
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true
      });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (capture.observerError) {
        throw new Error(capture.observerError);
      }
      return {
        captureToken,
        entries: records.map(({ selector }) => ({ selector }))
      };
    } catch (error) {
      try {
        removeCapture();
      } catch {}
      throw error;
    }
  }, {
    entries: definition.canonicalLayoutTextEntries,
    stateProperty: CANONICAL_LAYOUT_TEXT_STATE_PROPERTY,
    surfaceName
  });
}

export async function restoreDistrictActionOverlayCanonicalLayoutText(
  page,
  surfaceName,
  state
) {
  const definition = resolveDistrictActionOverlayDefinition(surfaceName);
  if (definition.canonicalLayoutTextEntries.length === 0) return [];
  if (!state?.captureToken) {
    throw new Error(`${surfaceName} canonical layout restore is missing its capture token.`);
  }
  return page.evaluate(async (config) => {
    const registry = globalThis[config.stateProperty];
    const capture = registry instanceof Map ? registry.get(config.captureToken) : null;
    if (!capture) {
      if (registry instanceof Map) {
        registry.delete(config.captureToken);
        if (registry.size === 0 && globalThis[config.stateProperty] === registry) {
          delete globalThis[config.stateProperty];
        }
      }
      throw new Error(`${config.surfaceName} canonical layout capture token is missing.`);
    }
    const results = [];
    const failures = [];
    try {
      capture.restoring = true;
      try {
        capture.observer?.takeRecords();
        capture.observer?.disconnect();
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
      for (const record of capture.records) {
        try {
          const allMatches = Array.from(capture.targetElement.querySelectorAll(record.selector));
          const visibleMatches = allMatches.filter((element) => {
            if (!(element instanceof Element) || element.hasAttribute("hidden")) return false;
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none"
              && style.visibility !== "hidden"
              && Number(style.opacity || 1) > 0
              && rect.width > 0
              && rect.height > 0;
          });
          const currentElement = visibleMatches.length === 1
            ? visibleMatches[0]
            : allMatches.length === 1
              ? allMatches[0]
              : null;
          if (currentElement && currentElement.textContent !== record.canonicalText) {
            record.latestActualText = currentElement.textContent;
            if (record.actualTextByElement.has(currentElement)) {
              record.actualTextByElement.set(currentElement, record.latestActualText);
            }
          }
          let preservedLiveUpdate = false;
          let restoredCount = 0;
          for (const [element, actualText] of record.actualTextByElement) {
            if (element.textContent === record.canonicalText) {
              element.textContent = actualText;
              restoredCount += 1;
            } else {
              preservedLiveUpdate = true;
            }
          }
          results.push({
            latestActualText: record.latestActualText,
            selector: record.selector,
            status: preservedLiveUpdate
              ? "preserved-live-update"
              : restoredCount > 0
                ? capture.targetElement.isConnected ? "restored" : "restored-detached"
                : "unchanged"
          });
        } catch (error) {
          failures.push(error instanceof Error ? error.message : String(error));
        }
      }
      if (capture.observerError) failures.push(capture.observerError);
      if (!capture.targetElement.isConnected) {
        failures.push(`${config.surfaceName} canonical layout target disconnected before restore.`);
      }
    } finally {
      registry.delete(config.captureToken);
      if (registry.size === 0 && globalThis[config.stateProperty] === registry) {
        delete globalThis[config.stateProperty];
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `${config.surfaceName} canonical layout cleanup failed: ${failures.join(" | ")}`
      );
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return results;
  }, {
    captureToken: state.captureToken,
    stateProperty: CANONICAL_LAYOUT_TEXT_STATE_PROPERTY,
    surfaceName
  });
}

export async function getDistrictActionOverlayPresentationSignature(page, surfaceName) {
  const definition = resolveDistrictActionOverlayDefinition(surfaceName);
  const target = page.locator(`${definition.targetSelector}:visible`).last();
  await expect(target).toBeVisible();
  return target.evaluate((targetElement, config) => {
    const normalizeText = (value) => String(value || "").replace(/\s+/gu, " ").trim();
    const dynamicAssetSelector = config.dynamicAssetSelectors.join(",");
    const dynamicSelector = config.dynamicLeafSelectors.join(",");
    const dynamicValueWrapperSelector = config.dynamicValueWrapperSelectors.join(",");
    const isVisible = (element) => {
      if (!(element instanceof Element) || element.hasAttribute("hidden")) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || 1) > 0
        && rect.width > 0
        && rect.height > 0;
    };
    const isDynamicLeaf = (element) => Boolean(
      dynamicSelector
      && (element.matches?.(dynamicSelector) || element.closest?.(dynamicSelector))
    );
    const isDynamicAsset = (element) => Boolean(
      dynamicAssetSelector
      && element.matches?.(dynamicAssetSelector)
    );
    const isDynamicValueWrapper = (element) => {
      if (
        !dynamicValueWrapperSelector
        || element.tagName !== "SPAN"
        || element.attributes.length > 0
        || element.children.length !== 1
        || !element.firstElementChild?.matches?.(dynamicValueWrapperSelector)
      ) {
        return false;
      }
      return Array.from(element.childNodes).every((node) => (
        node === element.firstElementChild
        || (node.nodeType === Node.TEXT_NODE && !normalizeText(node.textContent))
      ));
    };
    const classNames = (element) => Array.from(element.classList || []).sort();
    const targetRect = targetElement.getBoundingClientRect();
    const relativeRect = (element) => {
      const rect = element.getBoundingClientRect();
      const hasAuthoritativeWidth = isDynamicValueWrapper(element);
      return {
        height: Math.round(rect.height),
        width: hasAuthoritativeWidth ? config.authoritativeText : Math.round(rect.width),
        x: hasAuthoritativeWidth ? config.authoritativeText : Math.round(rect.left - targetRect.left),
        y: Math.round(rect.top - targetRect.top)
      };
    };
    const elementPath = (element) => {
      if (element === targetElement) return "surface";
      const segments = [];
      let current = element;
      while (current instanceof Element && current !== targetElement) {
        const parent = current.parentElement;
        if (!parent) break;
        const siblings = Array.from(parent.children)
          .filter((candidate) => candidate.tagName === current.tagName)
          .filter(isVisible);
        segments.unshift(`${current.tagName.toLowerCase()}:${siblings.indexOf(current)}`);
        current = parent;
      }
      return segments.join("/");
    };
    const computedStyle = (element) => {
      const style = getComputedStyle(element);
      return Object.fromEntries(config.computedStyleProperties.map((propertyName) => [
        propertyName,
        propertyName === "width" && isDynamicValueWrapper(element)
          ? config.authoritativeText
          : String(style[propertyName] || "")
      ]));
    };
    const pseudoElementStyle = (pseudoElement) => {
      const style = getComputedStyle(targetElement, pseudoElement);
      return {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        boxShadow: style.boxShadow,
        content: style.content,
        display: style.display,
        filter: style.filter,
        mixBlendMode: style.mixBlendMode,
        opacity: style.opacity,
        transform: style.transform,
        zIndex: style.zIndex
      };
    };
    const dataset = (element) => ({
      keys: Object.keys(element.dataset || {}).sort(),
      semanticValues: Object.fromEntries(config.semanticDatasetKeys
        .filter((key) => Object.hasOwn(element.dataset || {}, key))
        .map((key) => [key, String(element.dataset[key] || "")]))
    });
    const scrollSignature = (element) => {
      const style = getComputedStyle(element);
      const canScrollX = element.scrollWidth > element.clientWidth
        && ["auto", "overlay", "scroll"].includes(style.overflowX);
      const canScrollY = element.scrollHeight > element.clientHeight
        && ["auto", "overlay", "scroll"].includes(style.overflowY);
      return {
        canScrollX,
        canScrollY,
        maxScrollLeft: canScrollX ? Math.max(0, element.scrollWidth - element.clientWidth) : 0,
        maxScrollTop: canScrollY ? Math.max(0, element.scrollHeight - element.clientHeight) : 0,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        scrollLeft: Math.round(element.scrollLeft),
        scrollTop: Math.round(element.scrollTop)
      };
    };
    const visibleNodes = [targetElement, ...targetElement.querySelectorAll("*")].filter(isVisible);
    const structuralNodes = visibleNodes.filter((element) => !isDynamicLeaf(element));
    const controls = visibleNodes.filter((element) => element.matches?.(
      "button, input, select, textarea, a[href], [role='button'], [role='tab']"
    ));
    const focusableNodes = controls.filter((element) => (
      !element.matches?.("[disabled], [aria-disabled='true'], [tabindex='-1']")
    ));
    const activeElement = document.activeElement instanceof Element
      ? document.activeElement
      : null;
    const sectionNodes = Array.from(new Set(config.requiredSectionSelectors.flatMap((selector) => (
      Array.from(targetElement.querySelectorAll(selector)).filter(isVisible)
    )))).sort((left, right) => (
      left === right
        ? 0
        : left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1
    ));

    return {
      classNames: Array.from(new Set(visibleNodes.flatMap(classNames))).sort(),
      controls: controls.map((element) => ({
        ariaDisabled: element.getAttribute("aria-disabled"),
        ariaLabel: isDynamicLeaf(element) ? config.authoritativeText : element.getAttribute("aria-label"),
        classes: classNames(element),
        dataset: dataset(element),
        disabled: "disabled" in element ? Boolean(element.disabled) : false,
        path: elementPath(element),
        tabIndex: element.tabIndex,
        tag: element.tagName.toLowerCase(),
        text: isDynamicLeaf(element) ? config.authoritativeText : normalizeText(element.textContent),
        type: element.getAttribute("type"),
        value: "value" in element
          ? isDynamicLeaf(element) ? config.authoritativeText : String(element.value || "")
          : null
      })),
      domTree: visibleNodes.map((element) => ({
        alt: isDynamicLeaf(element) ? config.authoritativeText : element.getAttribute("alt"),
        ariaLabel: isDynamicLeaf(element) ? config.authoritativeText : element.getAttribute("aria-label"),
        classes: classNames(element),
        dataset: dataset(element),
        disabled: "disabled" in element ? Boolean(element.disabled) : false,
        path: elementPath(element),
        role: element.getAttribute("role"),
        src: element.matches?.("img")
          ? isDynamicLeaf(element) || isDynamicAsset(element)
            ? config.authoritativeText
            : element.getAttribute("src")
          : null,
        tag: element.tagName.toLowerCase(),
        text: element.children.length === 0
          ? isDynamicLeaf(element) ? config.authoritativeText : normalizeText(element.textContent)
          : ""
      })),
      focus: {
        activeElement: activeElement && activeElement !== document.body
          ? {
              classes: classNames(activeElement),
              insideSurface: targetElement.contains(activeElement),
              path: targetElement.contains(activeElement) ? elementPath(activeElement) : "outside-surface",
              tag: activeElement.tagName.toLowerCase()
            }
          : null,
        focusableOrder: focusableNodes.map((element) => ({
          classes: classNames(element),
          path: elementPath(element),
          tabIndex: element.tabIndex,
          tag: element.tagName.toLowerCase()
        }))
      },
      layout: structuralNodes.map((element) => ({
        classes: classNames(element),
        path: elementPath(element),
        rect: relativeRect(element),
        style: computedStyle(element),
        tag: element.tagName.toLowerCase()
      })),
      pseudoElements: {
        after: pseudoElementStyle("::after"),
        before: pseudoElementStyle("::before")
      },
      sections: sectionNodes.map((element) => ({
        classes: classNames(element),
        path: elementPath(element),
        rect: relativeRect(element),
        tag: element.tagName.toLowerCase()
      })),
      scroll: {
        surface: scrollSignature(targetElement),
        visibleRegions: structuralNodes
          .filter((element) => (
            element === targetElement
            || element.scrollHeight > element.clientHeight
            || element.scrollWidth > element.clientWidth
          ))
          .map((element) => ({
            path: elementPath(element),
            ...scrollSignature(element)
          }))
      }
    };
  }, {
    authoritativeText: AUTHORITATIVE_TEXT,
    computedStyleProperties: parityComputedStyleProperties,
    dynamicAssetSelectors: definition.dynamicAssetSelectors,
    dynamicLeafSelectors: definition.dynamicLeafSelectors,
    dynamicValueWrapperSelectors: definition.dynamicValueWrapperSelectors,
    requiredSectionSelectors: definition.requiredSectionSelectors,
    semanticDatasetKeys: definition.semanticDatasetKeys
  });
}

export async function exerciseDistrictActionOverlayFocus(page, surfaceName) {
  const definition = resolveDistrictActionOverlayDefinition(surfaceName);
  const target = page.locator(`${definition.targetSelector}:visible`).last();
  await expect(target).toBeVisible();
  const focusableSelector = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [role='button']:not([aria-disabled='true']), [role='tab']:not([aria-disabled='true']), [tabindex]:not([tabindex='-1'])";
  const targetIsFocusable = await target.evaluate((element, selector) => element.matches(selector), focusableSelector);
  const focusable = target.locator(focusableSelector);
  const nestedCount = await focusable.count();
  const count = nestedCount + (targetIsFocusable ? 1 : 0);
  expect(count, `${surfaceName} must expose a focusable control`).toBeGreaterThan(0);
  const first = targetIsFocusable ? target : focusable.first();
  await first.focus();
  const firstPath = await readActiveFocusPath(target);
  await page.keyboard.press("Tab");
  const nextPath = await readActiveFocusPath(target);
  await page.keyboard.press("Shift+Tab");
  const restoredPath = await readActiveFocusPath(target);
  return {
    count,
    firstPath,
    nextPath,
    restoredPath
  };
}

async function readActiveFocusPath(target) {
  return target.evaluate((targetElement) => {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof Element)) return null;
    if (!targetElement.contains(activeElement)) return "outside-surface";
    if (activeElement === targetElement) return "surface";
    const segments = [];
    let current = activeElement;
    while (current instanceof Element && current !== targetElement) {
      const parent = current.parentElement;
      if (!parent) break;
      const siblings = Array.from(parent.children).filter(
        (candidate) => candidate.tagName === current.tagName
      );
      segments.unshift(`${current.tagName.toLowerCase()}:${siblings.indexOf(current)}`);
      current = parent;
    }
    return segments.join("/");
  });
}

export async function exerciseDistrictActionOverlayScroll(page, surfaceName) {
  const definition = resolveDistrictActionOverlayDefinition(surfaceName);
  const target = page.locator(`${definition.targetSelector}:visible`).last();
  await expect(target).toBeVisible();
  return target.evaluate(async (targetElement) => {
    const candidates = [targetElement, ...targetElement.querySelectorAll("*")]
      .filter((element) => element instanceof HTMLElement && !element.hidden)
      .map((element) => ({ element, overflowY: getComputedStyle(element).overflowY }))
      .filter(({ element, overflowY }) => (
        element.scrollHeight > element.clientHeight + 1
        && ["auto", "overlay", "scroll"].includes(overflowY)
      ))
      .sort((left, right) => (
        (right.element.scrollHeight - right.element.clientHeight)
        - (left.element.scrollHeight - left.element.clientHeight)
      ));
    const candidate = candidates[0];
    if (!candidate) {
      return {
        available: false,
        maxScrollTop: 0,
        moved: false,
        overflowY: null,
        reachedBottom: false,
        resetTop: true
      };
    }
    const region = candidate.element;
    const maxScrollTop = Math.max(0, region.scrollHeight - region.clientHeight);
    region.scrollTop = maxScrollTop;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const result = {
      available: true,
      maxScrollTop,
      moved: region.scrollTop > 0,
      overflowY: candidate.overflowY,
      reachedBottom: Math.abs(region.scrollTop - maxScrollTop) <= 1,
      resetTop: false
    };
    region.scrollTop = 0;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    result.resetTop = region.scrollTop === 0;
    return result;
  });
}

export async function captureDistrictActionOverlayScreenshot(page, {
  path,
  surfaceName
}) {
  const definition = resolveDistrictActionOverlayDefinition(surfaceName);
  const stabilizeInlineAction = definition.stage === "inline-pre-submit";
  const inlineRasterStabilizationSelector = stabilizeInlineAction
    ? [
        definition.targetSelector,
        ".district-popup-card",
        ".district-popup-body",
        ".district-popup-action-section"
      ].join(",")
    : "";
  const target = page.locator(`${definition.targetSelector}:visible`).last();
  await expect(target).toBeVisible();
  return captureIsolatedParityScreenshot(page, {
    includeStabilizationDiagnostics: stabilizeInlineAction,
    ignoreSelector: [
      ...definition.dynamicAssetSelectors,
      ...definition.dynamicLeafSelectors
    ].join(","),
    path,
    roundedCompositeSelector: stabilizeInlineAction
      ? definition.targetSelector
      : definition.roundedCompositeSelector
        || (definition.stage === "confirmation" ? ".modal__actions button" : ""),
    roundedCompositeRasterFringePx: definition.stage === "confirmation" ? 4 : 2,
    stableAnimationSelector: inlineRasterStabilizationSelector,
    stableBackdropFilterSelector: inlineRasterStabilizationSelector,
    stableBackdropShellSelector: definition.shellSelector,
    stableDescendantDevicePixelAlignmentSelector: stabilizeInlineAction
      ? ".district-popup-action__label"
      : "",
    stableDescendantDevicePixelAlignmentMode: "target-relative-paint-origin",
    stableRasterRootSelector: definition.shellSelector,
    stableRasterSelector: inlineRasterStabilizationSelector,
    stableTargetDevicePixelAlignment: stabilizeInlineAction,
    stableTargetDevicePixelAlignmentMode: "translate",
    // Modal cards can have identical relative layout but a different absolute
    // viewport origin (for example after their source district is selected).
    // Capture every isolated surface at the same opaque paint origin so text,
    // borders and translucent layers rasterize on the same device pixels.
    stableTargetPaintOrigin: true,
    stableTargetPseudoElements: stabilizeInlineAction,
    stableTargetStyleProperties: stabilizeInlineAction
      // The real computed background is asserted by the presentation signature.
      // Replace every translucent background layer only for the isolated raster:
      // otherwise two identical glass buttons composite different district artwork.
       ? {
          transition: "none",
          background: "rgb(6, 10, 18)",
          // The live 8px/9px optical padding is asserted by the presentation
          // signature. Use symmetric capture padding so the 14px glyph range
          // starts on an integer pixel instead of Chromium's unstable y=15.5.
          "padding-bottom": "8px"
        }
      : {},
    target
  });
}
