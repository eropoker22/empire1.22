import { expect } from "@playwright/test";
import {
  captureIsolatedParityScreenshot,
  parityComputedStyleProperties
} from "./uiParityCapture.js";
import {
  createModalParityViewportBatches,
  modalParityViewports,
  validateModalParityViewportMatrix
} from "./modalParityViewports.js";

const AUTHORITATIVE_TEXT = "<authoritative>";
const LEADERBOARD_EMPTY_QUERY = "__utility_parity_no_player__";
const UTILITY_CANONICAL_CONTENT_REGISTRY_PROPERTY =
  "__empireUtilityParityCanonicalContentRegistry";
const UTILITY_CANONICAL_TEXT_ATTRIBUTE_NAMES = Object.freeze([
  "alt",
  "aria-description",
  "aria-label",
  "aria-valuetext",
  "title"
]);

export const utilityParityViewports = modalParityViewports;

export const utilityParityViewportBatches = createModalParityViewportBatches("utility");

export const utilityParitySurfaceNames = Object.freeze([
  "profile",
  "storage",
  "wanted",
  "settings",
  "about",
  "leaderboard",
  "onboarding"
]);

export const utilityParitySurfaces = Object.freeze({
  profile: Object.freeze({
    closeSelector: ".player-popup-card [data-player-popup-close]",
    dynamicLeafSelector: [
      "[data-player-popup-avatar]",
      "[data-player-popup-avatar-fallback]",
      "[data-player-popup-name]",
      "[data-player-popup-identity]",
      "[data-player-popup-gang]",
      "[data-player-popup-faction]",
      "[data-player-popup-server]",
      "[data-player-popup-empire-score]",
      "[data-player-popup-influence]",
      "[data-player-popup-heat]",
      "[data-player-popup-protection]",
      "[data-player-popup-alliance]",
      "[data-player-popup-districts]",
      "[data-player-popup-clean-money]",
      "[data-player-popup-dirty-money]"
    ].join(","),
    requiredSectionSelectors: Object.freeze([
      ".player-popup-header",
      ".player-popup-body"
    ]),
    semanticDatasetKeys: Object.freeze([]),
    shellSelector: "[data-player-popup]",
    stableBackdropFilterSelector: "[data-player-popup-card]",
    targetSelector: "[data-player-popup-card]",
    triggerSelector: "[data-player-profile-open]"
  }),
  storage: Object.freeze({
    closeSelector: ".storage-popup-card [data-storage-popup-close]",
    dynamicLeafSelector: "[data-storage-value]",
    requiredSectionSelectors: Object.freeze([
      ".storage-popup-section--defense .storage-popup-subtitle--with-close",
      ".storage-popup-section--attack",
      ".storage-popup-section--defense",
      ".storage-popup-section--materials",
      ".storage-popup-section--factory",
      ".storage-popup-section--drugs"
    ]),
    semanticDatasetKeys: Object.freeze([
      "storageResource",
      "storageState",
      "storageTone"
    ]),
    shellSelector: "[data-storage-popup]",
    stableBackdropColor: "rgb(2, 6, 12)",
    stableBackdropFilterSelector: ".storage-popup-card,.storage-popup-backdrop",
    stableAnimationSelector: ".storage-popup-card,.storage-popup-backdrop",
    targetSelector: ".storage-popup-card",
    triggerSelector: "[data-storage-popup-open]"
  }),
  wanted: Object.freeze({
    canonicalDisabledSelector: [
      "[data-wanted-popup-dirty]",
      "[data-wanted-popup-clean]",
      "[data-wanted-popup-influence]",
      "[data-wanted-popup-clear-log]"
    ].join(","),
    closeSelector: ".wanted-popup-card [data-wanted-popup-close]",
    dynamicLeafSelector: [
      "[data-wanted-popup-heat]",
      "[data-wanted-popup-level]",
      "[data-wanted-popup-tier] .wanted-popup-title__text",
      "[data-wanted-popup-description]",
      "[data-wanted-popup-protection]",
      "[data-wanted-popup-audit-risk]",
      "[data-wanted-popup-rise-list] .wanted-popup-item > *",
      "[data-wanted-popup-fall-list] .wanted-popup-item > *",
      "[data-wanted-popup-rise-list] .wanted-popup-empty",
      "[data-wanted-popup-fall-list] .wanted-popup-empty"
    ].join(","),
    requiredSectionSelectors: Object.freeze([
      ".wanted-popup-header",
      ".wanted-popup-top",
      ".wanted-popup-levels",
      ".wanted-popup-grid",
      ".wanted-popup-panel:first-of-type",
      ".wanted-popup-panel:last-of-type"
    ]),
    semanticDatasetKeys: Object.freeze([]),
    shellSelector: "[data-wanted-popup]",
    stableBackdropFilterSelector: [
      ".wanted-popup-card",
      ".wanted-popup-hero__copy",
      ".wanted-popup-meta",
      ".wanted-popup-panel",
      ".wanted-popup-actions",
      ".wanted-popup-level",
      ".wanted-popup-feedback",
      ".wanted-popup-item",
      ".wanted-popup-empty"
    ].join(","),
    targetSelector: ".wanted-popup-card",
    triggerSelector: "[data-gang-heat]"
  }),
  settings: Object.freeze({
    closeSelector: "#settings-modal-close",
    dynamicLeafSelector: "",
    requiredSectionSelectors: Object.freeze([
      ".modal__header",
      ".settings-modal__body",
      ".settings-modal__actions"
    ]),
    semanticDatasetKeys: Object.freeze([]),
    shellSelector: "#settings-modal",
    targetSelector: ".settings-modal__content",
    triggerSelector: "[data-nav-settings]"
  }),
  about: Object.freeze({
    closeSelector: ".login-about-dialog [data-login-about-close]",
    dynamicLeafSelector: "",
    requiredSectionSelectors: Object.freeze([
      ".login-about-terminal-header",
      ".login-about-hero-copy",
      ".login-about-workspace",
      ".login-about-content"
    ]),
    semanticDatasetKeys: Object.freeze([
      "loginAboutSection"
    ]),
    shellSelector: "[data-login-about-overlay]",
    targetSelector: ".login-about-dialog",
    triggerSelector: "[data-login-about-open]"
  }),
  leaderboard: Object.freeze({
    canonicalDisabledSelector: [
      '[data-leaderboard-filter="active"]',
      '[data-leaderboard-tab="money"]',
      '[data-leaderboard-tab="wanted"]',
      '[data-leaderboard-tab="attacks"]'
    ].join(","),
    closeSelector: ".leaderboard-popup-card > [data-leaderboard-popup-close]",
    dynamicLeafSelector: [
      "[data-leaderboard-server-badge]",
      "[data-leaderboard-phase]",
      "[data-leaderboard-my-rank] .leaderboard-my-rank__hero > strong",
      "[data-leaderboard-stats] .leaderboard-popup-stat > strong",
      "[data-leaderboard-count]"
    ].join(","),
    requiredSectionSelectors: Object.freeze([
      ".leaderboard-terminal__header",
      ".leaderboard-control-strip",
      ".leaderboard-popup-tabs",
      ".leaderboard-terminal__body",
      ".leaderboard-my-rank",
      ".leaderboard-board",
      ".leaderboard-popup-stats",
      ".leaderboard-popup-list"
    ]),
    semanticDatasetKeys: Object.freeze([
      "leaderboardAction",
      "leaderboardFilter",
      "leaderboardTab"
    ]),
    shellSelector: "[data-leaderboard-popup]",
    targetSelector: ".leaderboard-popup-card",
    triggerSelector: "[data-leaderboard-popup-open]"
  }),
  onboarding: Object.freeze({
    closeSelector: "[data-onboarding-skip-action]",
    dynamicLeafSelector: "",
    requiredSectionSelectors: Object.freeze([
      ".empire-onboarding__header",
      ".empire-onboarding__content",
      ".empire-onboarding__actions"
    ]),
    semanticDatasetKeys: Object.freeze([
      "onboardingPrimaryMode",
      "onboardingScroll",
      "onboardingStep"
    ]),
    shellSelector: "[data-onboarding-panel]",
    targetSelector: "[data-onboarding-panel]",
    triggerSelector: "[data-onboarding-launch]"
  })
});

const forbiddenDynamicMaskSelectors = new Set([
  "*",
  "body",
  "html",
  "[data-leaderboard-list]",
  "[data-leaderboard-my-rank]",
  "[data-leaderboard-stats]"
]);

function splitSelectors(selectorList = "") {
  return String(selectorList || "")
    .split(",")
    .map((selector) => selector.trim())
    .filter(Boolean);
}

export function validateUtilityParityCoverage({
  surfaceNames = utilityParitySurfaceNames,
  surfaces = utilityParitySurfaces,
  viewportBatches = utilityParityViewportBatches,
  viewports = utilityParityViewports
} = {}) {
  const resolvedSurfaceNames = Array.from(surfaceNames);
  const viewportContract = validateModalParityViewportMatrix({
    batches: viewportBatches,
    viewports
  });

  if (JSON.stringify(resolvedSurfaceNames) !== JSON.stringify(utilityParitySurfaceNames)) {
    throw new Error("Utility parity surface order must cover the complete canonical list.");
  }

  for (const surfaceName of resolvedSurfaceNames) {
    const definition = surfaces[surfaceName];
    if (!definition) {
      throw new Error(`Utility parity surface ${surfaceName} is missing.`);
    }
    for (const propertyName of [
      "closeSelector",
      "requiredSectionSelectors",
      "semanticDatasetKeys",
      "shellSelector",
      "targetSelector",
      "triggerSelector"
    ]) {
      if (!definition[propertyName]) {
        throw new Error(`Utility parity surface ${surfaceName} lacks ${propertyName}.`);
      }
    }
    if (!Array.isArray(definition.requiredSectionSelectors)
      || definition.requiredSectionSelectors.length < 2) {
      throw new Error(`Utility parity surface ${surfaceName} must guard multiple visible sections.`);
    }
    const dynamicSelectors = splitSelectors(definition.dynamicLeafSelector);
    if (dynamicSelectors.some((selector) => (
      forbiddenDynamicMaskSelectors.has(selector)
      || selector === definition.shellSelector
      || selector === definition.targetSelector
    ))) {
      throw new Error(`Utility parity surface ${surfaceName} masks a structural container.`);
    }
  }

  return Object.freeze({
    batchCount: viewportContract.batchCount,
    comparisonCount: resolvedSurfaceNames.length * viewportContract.viewportNames.length,
    surfaceNames: Object.freeze(resolvedSurfaceNames),
    viewportNames: viewportContract.viewportNames
  });
}

function resolveUtilityParitySurface(surfaceName) {
  const definition = utilityParitySurfaces[surfaceName];
  if (!definition) {
    throw new Error(`Unknown utility parity surface: ${surfaceName}`);
  }
  return definition;
}

async function settleUtilitySurface(target, { ignoreImageSelector = "" } = {}) {
  await target.evaluate(async (targetElement, config) => {
    const settleAnimations = async () => {
      for (const animation of targetElement.getAnimations({ subtree: true })) {
        const timing = animation.effect?.getComputedTiming?.() || {};
        const endTime = Number(timing.endTime);
        try {
          if (Number.isFinite(endTime) && endTime >= 0 && endTime <= 5_000) {
            animation.finish();
          } else {
            animation.pause();
            await animation.ready.catch(() => undefined);
            animation.currentTime = 0;
          }
        } catch {}
      }
    };
    await settleAnimations();
    const images = Array.from(targetElement.querySelectorAll("img")).filter((image) => (
      !config.ignoreImageSelector
      || (!image.matches(config.ignoreImageSelector) && !image.closest(config.ignoreImageSelector))
    ));
    await Promise.all(images.map(async (image) => {
      if (image.complete) return;
      await new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    }));
    await new Promise((resolve) => requestAnimationFrame(() => (
      requestAnimationFrame(resolve)
    )));
    await settleAnimations();
  }, { ignoreImageSelector });
}

async function assertRequiredUtilitySections(target, definition, surfaceName) {
  for (const selector of definition.requiredSectionSelectors) {
    await expect(
      target.locator(selector).first(),
      `${surfaceName} must keep required visible section ${selector}`
    ).toBeVisible();
  }
}

export async function openUtilityParitySurface(page, surfaceName) {
  const definition = resolveUtilityParitySurface(surfaceName);
  if (surfaceName === "onboarding") {
    const settingsDefinition = resolveUtilityParitySurface("settings");
    const settingsTrigger = page.locator(`${settingsDefinition.triggerSelector}:visible`).first();
    await expect(settingsTrigger).toBeVisible();
    await settingsTrigger.click();
    await expect(page.locator(settingsDefinition.shellSelector)).toBeVisible();
    const onboardingTrigger = page.locator(`${definition.triggerSelector}:visible`).first();
    await expect(onboardingTrigger).toBeVisible();
    await onboardingTrigger.click();
    await expect(page.locator(settingsDefinition.shellSelector)).toBeHidden();
  } else {
    const trigger = page.locator(`${definition.triggerSelector}:visible`).first();
    await expect(trigger, `${surfaceName} must open through its visible game.html trigger`).toBeVisible();
    await trigger.click();
  }

  const shell = page.locator(`${definition.shellSelector}:visible`).last();
  const target = page.locator(`${definition.targetSelector}:visible`).last();
  try {
    await expect(shell, `${surfaceName} shell must become visible`).toBeVisible();
  } catch (error) {
    const diagnostics = await page.evaluate(({ shellSelector, triggerSelector }) => {
      const overlay = document.querySelector(shellSelector);
      const trigger = document.querySelector(`${triggerSelector}:not([hidden])`);
      const legacyState = globalThis[Symbol.for("empire.legacyOverlayCoordinator.state")];
      const describeOverlay = (entry) => ({
        ariaHidden: entry?.element?.getAttribute?.("aria-hidden") ?? null,
        className: String(entry?.element?.className || ""),
        connected: entry?.element?.isConnected === true,
        hidden: entry?.element?.hidden === true
      });
      return {
        bodyClasses: Array.from(document.body.classList).sort(),
        legacyOverlayStack: Array.isArray(legacyState?.overlayStack)
          ? legacyState.overlayStack.map(describeOverlay)
          : [],
        legacySuppressionRemainingMs: Math.max(
          0,
          Math.ceil(Number(legacyState?.suppressMapInputUntil || 0) - performance.now())
        ),
        overlay: overlay
          ? {
              ariaHidden: overlay.getAttribute("aria-hidden"),
              controllerBound: overlay.dataset.loginAboutControllerBound || null,
              display: getComputedStyle(overlay).display,
              hidden: overlay.hidden,
              modalBound: overlay.dataset.loginModalBound || null
            }
          : null,
        trigger: trigger
          ? {
              connected: trigger.isConnected,
              display: getComputedStyle(trigger).display,
              pointerEvents: getComputedStyle(trigger).pointerEvents
            }
          : null,
        url: location.href
      };
    }, {
      shellSelector: definition.shellSelector,
      triggerSelector: definition.triggerSelector
    });
    throw new Error(
      `${surfaceName} failed to open through its visible trigger: ${JSON.stringify(diagnostics)}`,
      { cause: error }
    );
  }
  await expect(target, `${surfaceName} target must become visible`).toBeVisible();

  if (surfaceName === "leaderboard") {
    const search = target.locator("[data-leaderboard-search]");
    await expect(search).toBeVisible();
    await search.fill(LEADERBOARD_EMPTY_QUERY);
    await expect(target.locator("[data-leaderboard-count]")).toHaveText("0 hráčů");
    await expect(target.locator("[data-leaderboard-list] .leaderboard-detail-empty"))
      .toHaveText("Žádný boss neodpovídá aktuálním filtrům.");
  }

  await assertRequiredUtilitySections(target, definition, surfaceName);
  await settleUtilitySurface(target, {
    ignoreImageSelector: definition.dynamicLeafSelector
  });
  return target;
}

export async function closeUtilityParitySurface(page, surfaceName) {
  const definition = resolveUtilityParitySurface(surfaceName);
  const shell = page.locator(`${definition.shellSelector}:visible`).last();
  if (!(await shell.isVisible().catch(() => false))) {
    await expect(page.locator(definition.shellSelector)).toBeHidden();
    return;
  }
  const closeButton = page.locator(`${definition.closeSelector}:visible`).last();
  await expect(closeButton, `${surfaceName} must expose its visible close action`).toBeVisible();
  await closeButton.click();
  await expect(page.locator(definition.shellSelector)).toBeHidden();
  // The game-page compatibility coordinator shields clicks for 450 ms and
  // the mobile close assist for 460 ms. A serial parity test must not issue
  // the next real user click inside either production guard window.
  await page.waitForTimeout(470);
}

export async function applyUtilityParityCanonicalContent(page, surfaceName) {
  const definition = resolveUtilityParitySurface(surfaceName);
  if (!definition.dynamicLeafSelector) return { captureToken: null };
  const target = page.locator(`${definition.targetSelector}:visible`).last();
  await expect(target).toBeVisible();
  return target.evaluate(async (targetElement, config) => {
    const existingRegistry = globalThis[config.registryProperty];
    if (existingRegistry !== undefined && !(existingRegistry instanceof Map)) {
      throw new Error(`${config.surfaceName} canonical utility registry has an invalid shape.`);
    }
    const registry = existingRegistry || new Map();
    if (!existingRegistry) {
      Object.defineProperty(globalThis, config.registryProperty, {
        configurable: true,
        value: registry
      });
    }
    if (Array.from(registry.values()).some((entry) => entry.targetElement === targetElement)) {
      throw new Error(`${config.surfaceName} utility target already has a canonical content lock.`);
    }
    let captureToken;
    do {
      captureToken = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    } while (registry.has(captureToken));

    const capture = {
      attributeRecords: new Map(),
      normalizing: false,
      observer: null,
      observerError: null,
      restored: false,
      restoring: false,
      targetElement,
      textRecords: new Map()
    };
    const readDynamicLeafElements = () => (
      Array.from(targetElement.querySelectorAll(config.dynamicLeafSelector))
    );
    const readOutermostDynamicLeafElements = (elements) => elements.filter((element) => (
      !elements.some((candidate) => candidate !== element && candidate.contains(element))
    ));
    const voidElementNames = new Set([
      "AREA", "BASE", "BR", "COL", "EMBED", "HR", "IMG", "INPUT", "LINK", "META",
      "PARAM", "SOURCE", "TRACK", "WBR"
    ]);
    const normalizeTextNodes = (dynamicLeafElements) => {
      for (const element of readOutermostDynamicLeafElements(dynamicLeafElements)) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) {
          const textNode = walker.currentNode;
          if (capture.textRecords.has(textNode) || /\S/u.test(textNode.data)) {
            textNodes.push(textNode);
          }
        }
        if (
          textNodes.length === 0
          && element.childElementCount === 0
          && !voidElementNames.has(element.tagName)
        ) {
          const insertedTextNode = document.createTextNode("");
          element.append(insertedTextNode);
          capture.textRecords.set(insertedTextNode, {
            canonicalText: "",
            latestActualText: "",
            removeOnRestore: true
          });
          textNodes.push(insertedTextNode);
        }
        for (const [index, textNode] of textNodes.entries()) {
          const canonicalText = index === 0 ? config.authoritativeText : "";
          let record = capture.textRecords.get(textNode);
          if (!record) {
            record = {
              canonicalText,
              latestActualText: textNode.data,
              removeOnRestore: false
            };
            capture.textRecords.set(textNode, record);
          } else {
            if (textNode.data !== record.canonicalText) {
              record.latestActualText = textNode.data;
              record.removeOnRestore = false;
            }
            record.canonicalText = canonicalText;
          }
          if (textNode.data !== canonicalText) textNode.data = canonicalText;
        }
      }
    };
    const normalizeTextAttributes = (dynamicLeafElements) => {
      const elements = new Set(dynamicLeafElements.flatMap((element) => (
        [element, ...element.querySelectorAll("*")]
      )));
      for (const element of elements) {
        let records = capture.attributeRecords.get(element);
        for (const name of config.attributeNames) {
          const hasAttribute = element.hasAttribute(name);
          const currentValue = hasAttribute ? element.getAttribute(name) : null;
          let record = records?.get(name);
          if (!record) {
            if (!hasAttribute) continue;
            if (!records) {
              records = new Map();
              capture.attributeRecords.set(element, records);
            }
            record = {
              canonicalHadAttribute: true,
              canonicalValue: config.authoritativeText,
              latestActualHadAttribute: true,
              latestActualValue: currentValue
            };
            records.set(name, record);
          } else if (
            hasAttribute !== record.canonicalHadAttribute
            || (hasAttribute && currentValue !== record.canonicalValue)
          ) {
            record.latestActualHadAttribute = hasAttribute;
            record.latestActualValue = currentValue;
          }
          if (!hasAttribute || currentValue !== record.canonicalValue) {
            element.setAttribute(name, record.canonicalValue);
          }
        }
      }
    };
    const normalizeDisabledAttributes = () => {
      if (!config.canonicalDisabledSelector) return;
      const elements = Array.from(
        targetElement.querySelectorAll(config.canonicalDisabledSelector)
      );
      if (elements.length === 0) {
        throw new Error(
          `${config.surfaceName} canonical disabled selector matched no elements.`
        );
      }
      for (const element of elements) {
        let records = capture.attributeRecords.get(element);
        if (!records) {
          records = new Map();
          capture.attributeRecords.set(element, records);
        }
        for (const [name, canonicalValue] of [
          ["disabled", ""],
          ["aria-disabled", "true"]
        ]) {
          const hasAttribute = element.hasAttribute(name);
          const currentValue = hasAttribute ? element.getAttribute(name) : null;
          let record = records.get(name);
          if (!record) {
            record = {
              canonicalHadAttribute: true,
              canonicalValue,
              latestActualHadAttribute: hasAttribute,
              latestActualValue: currentValue
            };
            records.set(name, record);
          } else if (
            hasAttribute !== record.canonicalHadAttribute
            || (hasAttribute && currentValue !== record.canonicalValue)
          ) {
            record.latestActualHadAttribute = hasAttribute;
            record.latestActualValue = currentValue;
          }
          if (!hasAttribute || currentValue !== record.canonicalValue) {
            element.setAttribute(name, record.canonicalValue);
          }
        }
      }
    };
    const normalizeCanonicalContent = () => {
      if (capture.normalizing || capture.restoring) return;
      capture.normalizing = true;
      try {
        const dynamicLeafElements = readDynamicLeafElements();
        if (dynamicLeafElements.length === 0) {
          throw new Error(`${config.surfaceName} canonical utility selector matched no elements.`);
        }
        normalizeTextNodes(dynamicLeafElements);
        normalizeTextAttributes(dynamicLeafElements);
        normalizeDisabledAttributes();
      } catch (error) {
        capture.observerError ||= error instanceof Error ? error.message : String(error);
      } finally {
        capture.normalizing = false;
      }
    };
    const restoreCapture = ({ reportObserverError = true } = {}) => {
      if (capture.restored) return [];
      const failures = [];
      const results = [];
      capture.restoring = true;
      try {
        try {
          capture.observer?.takeRecords();
          capture.observer?.disconnect();
        } catch (error) {
          failures.push(error instanceof Error ? error.message : String(error));
        }
        for (const [textNode, record] of capture.textRecords) {
          try {
            if (textNode.data !== record.canonicalText) {
              record.latestActualText = textNode.data;
              record.removeOnRestore = false;
              results.push({ kind: "text", status: "preserved-live-update" });
            } else if (record.removeOnRestore) {
              textNode.remove();
              results.push({ kind: "text", status: "removed-capture-node" });
            } else {
              textNode.data = record.latestActualText;
              results.push({ kind: "text", status: "restored" });
            }
          } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error));
          }
        }
        for (const [element, records] of capture.attributeRecords) {
          for (const [name, record] of records) {
            try {
              const hasAttribute = element.hasAttribute(name);
              const currentValue = hasAttribute ? element.getAttribute(name) : null;
              const currentIsCanonical = hasAttribute === record.canonicalHadAttribute
                && (!hasAttribute || currentValue === record.canonicalValue);
              if (!currentIsCanonical) {
                record.latestActualHadAttribute = hasAttribute;
                record.latestActualValue = currentValue;
                results.push({ kind: "attribute", name, status: "preserved-live-update" });
              } else if (record.latestActualHadAttribute) {
                element.setAttribute(name, record.latestActualValue);
                results.push({ kind: "attribute", name, status: "restored" });
              } else {
                element.removeAttribute(name);
                results.push({ kind: "attribute", name, status: "removed-capture-attribute" });
              }
            } catch (error) {
              failures.push(error instanceof Error ? error.message : String(error));
            }
          }
        }
        if (reportObserverError && capture.observerError) failures.push(capture.observerError);
        if (!capture.targetElement.isConnected) {
          failures.push(`${config.surfaceName} canonical utility target disconnected before restore.`);
        }
      } finally {
        capture.restored = true;
        registry.delete(captureToken);
        if (registry.size === 0 && globalThis[config.registryProperty] === registry) {
          delete globalThis[config.registryProperty];
        }
      }
      if (failures.length > 0) {
        throw new Error(
          `${config.surfaceName} canonical utility cleanup failed: ${failures.join(" | ")}`
        );
      }
      return results;
    };

    capture.restore = restoreCapture;
    capture.observer = new MutationObserver(normalizeCanonicalContent);
    registry.set(captureToken, capture);
    try {
      normalizeCanonicalContent();
      if (capture.observerError) throw new Error(capture.observerError);
      capture.observer.observe(targetElement, {
        attributeFilter: [
          ...config.attributeNames,
          ...(config.canonicalDisabledSelector ? ["disabled", "aria-disabled"] : [])
        ],
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true
      });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (capture.observerError) throw new Error(capture.observerError);
      return { captureToken };
    } catch (error) {
      try {
        restoreCapture({ reportObserverError: false });
      } catch {}
      throw error;
    }
  }, {
    attributeNames: UTILITY_CANONICAL_TEXT_ATTRIBUTE_NAMES,
    authoritativeText: AUTHORITATIVE_TEXT,
    canonicalDisabledSelector: definition.canonicalDisabledSelector || "",
    dynamicLeafSelector: definition.dynamicLeafSelector,
    registryProperty: UTILITY_CANONICAL_CONTENT_REGISTRY_PROPERTY,
    surfaceName
  });
}

export async function restoreUtilityParityCanonicalContent(page, surfaceName, state) {
  const definition = resolveUtilityParitySurface(surfaceName);
  if (!definition.dynamicLeafSelector) return [];
  if (!state?.captureToken) {
    throw new Error(`${surfaceName} canonical utility restore is missing its capture token.`);
  }
  return page.evaluate(async (config) => {
    const registry = globalThis[config.registryProperty];
    const capture = registry instanceof Map ? registry.get(config.captureToken) : null;
    if (!capture) {
      if (registry instanceof Map) {
        registry.delete(config.captureToken);
        if (registry.size === 0 && globalThis[config.registryProperty] === registry) {
          delete globalThis[config.registryProperty];
        }
      }
      throw new Error(`${config.surfaceName} canonical utility capture token is missing.`);
    }
    const results = capture.restore();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return results;
  }, {
    captureToken: state.captureToken,
    registryProperty: UTILITY_CANONICAL_CONTENT_REGISTRY_PROPERTY,
    surfaceName
  });
}

export async function getUtilityParitySurfaceSignature(page, surfaceName) {
  const definition = resolveUtilityParitySurface(surfaceName);
  const target = page.locator(`${definition.targetSelector}:visible`).last();
  await expect(target).toBeVisible();
  await settleUtilitySurface(target, {
    ignoreImageSelector: definition.dynamicLeafSelector
  });
  return target.evaluate((targetElement, config) => {
    const authoritativeText = config.authoritativeText;
    if (config.dynamicLeafSelector) {
      const registry = globalThis[config.registryProperty];
      const hasActiveLock = registry instanceof Map && Array.from(registry.values()).some((capture) => (
        capture.targetElement === targetElement && !capture.restored && !capture.restoring
      ));
      if (!hasActiveLock) {
        throw new Error(`${config.surfaceName} utility signature requires an active content lock.`);
      }
    }
    const normalizeText = (value) => String(value || "").replace(/\s+/gu, " ").trim();
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
    const targetRect = targetElement.getBoundingClientRect();
    const isAuthoritativeLeaf = (element) => Boolean(
      config.dynamicLeafSelector
      && (
        element.matches?.(config.dynamicLeafSelector)
        || element.closest?.(config.dynamicLeafSelector)
      )
    );
    const classNames = (element) => Array.from(element.classList || []).sort();
    const normalizeLayoutUnit = (value) => Math.round(Number(value || 0) * 64) / 64;
    const relativeRect = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        height: normalizeLayoutUnit(rect.height),
        width: normalizeLayoutUnit(rect.width),
        x: normalizeLayoutUnit(rect.left - targetRect.left),
        y: normalizeLayoutUnit(rect.top - targetRect.top)
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
        String(style[propertyName] || "")
      ]));
    };
    const dataset = (element) => ({
      keys: Object.keys(element.dataset || {}).sort(),
      semanticValues: Object.fromEntries(config.semanticDatasetKeys
        .filter((key) => Object.hasOwn(element.dataset || {}, key))
        .map((key) => [key, String(element.dataset[key] || "")]))
    });
    const scrollSignature = (element) => {
      const style = getComputedStyle(element);
      const scrollableOverflow = new Set(["auto", "overlay", "scroll"]);
      const canScrollX = element.scrollWidth > element.clientWidth
        && scrollableOverflow.has(style.overflowX);
      const canScrollY = element.scrollHeight > element.clientHeight
        && scrollableOverflow.has(style.overflowY);
      return {
        canScrollX,
        canScrollY,
        clientHeight: element.clientHeight,
        clientWidth: element.clientWidth,
        maxScrollLeft: canScrollX ? Math.max(0, element.scrollWidth - element.clientWidth) : 0,
        maxScrollTop: canScrollY ? Math.max(0, element.scrollHeight - element.clientHeight) : 0,
        overflow: style.overflow,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        scrollLeft: Math.round(element.scrollLeft),
        scrollTop: Math.round(element.scrollTop)
      };
    };
    const documentScrollSignature = (element, modalOpen) => {
      const signature = scrollSignature(element);
      delete signature.clientHeight;
      delete signature.clientWidth;
      if (modalOpen) {
        // A bottom-flow mobile trigger can sit at a different absolute page Y
        // when authoritative background data changes page height. Once the
        // modal is open, compare the document lock contract rather than that
        // unrelated background coordinate.
        signature.maxScrollTop = 0;
        signature.scrollLeft = 0;
        signature.scrollTop = 0;
      }
      return signature;
    };
    const visibleNodes = [targetElement, ...targetElement.querySelectorAll("*")]
      .filter(isVisible);
    const structuralNodes = visibleNodes.filter((element) => !isAuthoritativeLeaf(element));
    const focusableNodes = visibleNodes.filter((element) => (
      element.matches?.("button, input, select, textarea, a[href], [role='button'], [role='tab'], [tabindex]")
      && !element.matches?.("[disabled], [aria-disabled='true'], [tabindex='-1']")
    ));
    const sectionNodes = Array.from(new Set(config.requiredSectionSelectors.flatMap((selector) => (
      Array.from(targetElement.querySelectorAll(selector)).filter(isVisible)
    )))).sort((left, right) => (
      left === right
        ? 0
        : left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1
    ));
    const modalOpen = Boolean(
      targetElement.matches("[role='dialog'], [aria-modal='true']")
      || targetElement.closest("[role='dialog'], [aria-modal='true']")
      || targetElement.querySelector("[role='dialog'], [aria-modal='true']")
    );
    const activeElement = document.activeElement instanceof Element
      ? document.activeElement
      : null;

    return {
      classNames: Array.from(new Set(visibleNodes.flatMap(classNames))).sort(),
      controls: visibleNodes
        .filter((element) => element.matches?.(
          "button, input, select, textarea, a[href], [role='button'], [role='tab']"
        ))
        .map((element) => ({
          ariaDisabled: element.getAttribute("aria-disabled"),
          ariaExpanded: element.getAttribute("aria-expanded"),
          ariaLabel: isAuthoritativeLeaf(element)
            ? authoritativeText
            : element.getAttribute("aria-label"),
          ariaSelected: element.getAttribute("aria-selected"),
          checked: "checked" in element ? Boolean(element.checked) : null,
          classes: classNames(element),
          dataset: dataset(element),
          disabled: "disabled" in element ? Boolean(element.disabled) : false,
          path: elementPath(element),
          placeholder: element.getAttribute("placeholder"),
          role: element.getAttribute("role"),
          tabIndex: element.tabIndex,
          tag: element.tagName.toLowerCase(),
          text: isAuthoritativeLeaf(element)
            ? authoritativeText
            : normalizeText(element.textContent),
          type: element.getAttribute("type"),
          value: "value" in element ? String(element.value || "") : null
        })),
      domTree: visibleNodes.map((element) => ({
        alt: isAuthoritativeLeaf(element) ? authoritativeText : element.getAttribute("alt"),
        ariaLabel: isAuthoritativeLeaf(element) ? authoritativeText : element.getAttribute("aria-label"),
        ariaSelected: element.getAttribute("aria-selected"),
        classes: classNames(element),
        dataset: dataset(element),
        disabled: "disabled" in element ? Boolean(element.disabled) : false,
        path: elementPath(element),
        role: element.getAttribute("role"),
        src: element.matches?.("img")
          ? isAuthoritativeLeaf(element) ? authoritativeText : element.getAttribute("src")
          : null,
        tag: element.tagName.toLowerCase(),
        text: element.children.length === 0
          ? isAuthoritativeLeaf(element) ? authoritativeText : normalizeText(element.textContent)
          : ""
      })),
      focus: {
        activeElement: activeElement && activeElement !== document.body
          ? {
              classes: classNames(activeElement),
              insideSurface: targetElement.contains(activeElement),
              path: targetElement.contains(activeElement) ? elementPath(activeElement) : "outside-surface",
              role: activeElement.getAttribute("role"),
              tag: activeElement.tagName.toLowerCase()
            }
          : null,
        focusableOrder: focusableNodes.map((element) => ({
          classes: classNames(element),
          path: elementPath(element),
          role: element.getAttribute("role"),
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
      scroll: {
        body: documentScrollSignature(document.body, modalOpen),
        html: documentScrollSignature(document.documentElement, modalOpen),
        regions: structuralNodes
          .filter((element) => {
            const style = getComputedStyle(element);
            return element === targetElement
              || element.scrollHeight > element.clientHeight
              || element.scrollWidth > element.clientWidth
              || !["visible", "clip"].includes(style.overflow)
              || !["visible", "clip"].includes(style.overflowX)
              || !["visible", "clip"].includes(style.overflowY);
          })
          .map((element) => ({
            path: elementPath(element),
            ...scrollSignature(element)
          })),
        target: scrollSignature(targetElement),
        windowX: modalOpen ? 0 : Math.round(window.scrollX),
        windowY: modalOpen ? 0 : Math.round(window.scrollY)
      },
      sectionOrder: sectionNodes.map((element) => ({
        classes: classNames(element),
        path: elementPath(element),
        tag: element.tagName.toLowerCase()
      })),
      target: {
        classes: classNames(targetElement),
        rect: relativeRect(targetElement),
        role: targetElement.getAttribute("role")
      },
      visibleDialogCount: Array.from(document.querySelectorAll("[role='dialog']"))
        .filter(isVisible)
        .length
    };
  }, {
    authoritativeText: AUTHORITATIVE_TEXT,
    computedStyleProperties: parityComputedStyleProperties,
    dynamicLeafSelector: definition.dynamicLeafSelector,
    registryProperty: UTILITY_CANONICAL_CONTENT_REGISTRY_PROPERTY,
    requiredSectionSelectors: definition.requiredSectionSelectors,
    semanticDatasetKeys: definition.semanticDatasetKeys,
    surfaceName
  });
}

export async function exerciseUtilityParitySurfaceScroll(page, surfaceName) {
  const definition = resolveUtilityParitySurface(surfaceName);
  const target = page.locator(`${definition.targetSelector}:visible`).last();
  await expect(target).toBeVisible();
  return target.evaluate(async (targetElement) => {
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
    const candidates = [targetElement, ...targetElement.querySelectorAll("*")]
      .filter(isVisible)
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
        path: null,
        reachedBottom: false,
        resetTop: true
      };
    }
    const region = candidate.element;
    const maxScrollTop = Math.max(0, region.scrollHeight - region.clientHeight);
    region.scrollTop = maxScrollTop;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const reachedBottom = Math.abs(region.scrollTop - maxScrollTop) <= 1;
    const moved = region.scrollTop > 0;
    region.scrollTop = 0;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      available: true,
      maxScrollTop,
      moved,
      overflowY: candidate.overflowY,
      path: elementPath(region),
      reachedBottom,
      resetTop: region.scrollTop === 0
    };
  });
}

export async function captureUtilityParityScreenshot(page, {
  path: screenshotPath,
  surfaceName
}) {
  const definition = resolveUtilityParitySurface(surfaceName);
  const target = page.locator(`${definition.targetSelector}:visible`).last();
  await expect(target).toBeVisible();
  return captureIsolatedParityScreenshot(page, {
    ignoreSelector: definition.dynamicLeafSelector,
    path: screenshotPath,
    roundedCompositeSelector: surfaceName === "profile"
      ? ".player-popup-row"
      : surfaceName === "storage"
        ? ".storage-popup-section,.storage-popup-row,.storage-popup-close"
        : surfaceName === "settings"
          ? "[data-onboarding-launch],#settings-save-btn"
          : "",
    roundedCompositeRasterFringePx: surfaceName === "storage" ? 4 : 2,
    stableBackdropColor: definition.stableBackdropColor || "",
    stableBackdropFilterSelector: definition.stableBackdropFilterSelector || "",
    stableAnimationSelector: definition.stableAnimationSelector || "",
    stableBackdropShellSelector: definition.shellSelector,
    stableDescendantDevicePixelAlignmentSelector: surfaceName === "profile"
      ? ".player-popup-row"
      : surfaceName === "settings"
        ? "[data-onboarding-launch],#settings-save-btn"
        : "",
    stableDescendantDevicePixelAlignmentMode: "target-relative-paint-origin",
    stableTargetDevicePixelAlignment: ["profile", "wanted"].includes(surfaceName),
    stableTargetDevicePixelAlignmentMode: "position-offset",
    target
  });
}
