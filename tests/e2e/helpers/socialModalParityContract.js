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

export const socialModalParityViewports = modalParityViewports;

export const socialModalParityViewportBatches = createModalParityViewportBatches("social");

export const socialModalParitySurfaceNames = Object.freeze([
  "market",
  "alliance",
  "bounty",
  "boost"
]);

export const socialModalParitySurfaces = Object.freeze({
  market: Object.freeze({
    closeSelector: ".market-popup-card [data-market-popup-close]",
    dynamicLeafSelector: [
      '[data-market-dashboard-tone="clean"] strong',
      '[data-market-dashboard-tone="dirty"] strong',
      '[data-market-dashboard-tone="stock"] strong',
      '[data-market-dashboard-tone="danger"] strong',
      ".market-popup-dashboard__recent-entry",
      ".market-popup-row__price",
      ".market-popup-row__trend",
      ".market-popup-row__stock",
      ".market-popup-row__fact strong",
      ".market-popup-row__total",
      "[data-market-feedback]"
    ].join(","),
    expectedFocusRestore: true,
    requiredSectionSelectors: Object.freeze([
      ".market-popup-heading",
      ".market-popup-tabs",
      "[data-market-dashboard]",
      "[data-market-copy]",
      "[data-market-list]"
    ]),
    roundedCompositeSelector: ".market-popup-tab.is-active",
    semanticDatasetKeys: Object.freeze([
      "marketCategory",
      "marketFactTone",
      "marketInventory",
      "marketRarity",
      "marketRisk",
      "marketRowMode",
      "marketTab",
      "marketTier",
      "resourceColor"
    ]),
    shellSelector: "[data-market-popup]",
    targetSelector: ".market-popup-card",
    triggerSelector: "[data-market-popup-open]"
  }),
  alliance: Object.freeze({
    closeSelector: ".alliance-modal__content [data-alliance-modal-close]",
    dynamicLeafSelector: ".alliance-inline-note",
    expectedFocusRestore: true,
    requiredSectionSelectors: Object.freeze([
      ".alliance-active-card",
      ".alliance-tabs",
      ".alliance-tab-panel",
      ".alliance-create-card",
      ".alliance-section__head"
    ]),
    semanticDatasetKeys: Object.freeze([
      "allianceTab",
      "tone"
    ]),
    shellSelector: "#alliance-modal",
    targetSelector: ".alliance-modal__content",
    triggerSelector: "[data-alliance-popup-open]"
  }),
  bounty: Object.freeze({
    closeSelector: "#bounty-modal-close",
    dynamicLeafSelector: [
      "#bounty-target-avatar",
      "#bounty-target-avatar-fallback",
      "#bounty-target-name",
      "#bounty-target-alliance",
      "#bounty-target-districts",
      "#bounty-target-activity",
      "#bounty-target-threat",
      "#bounty-modal-target",
      "[data-bounty-target-toggle] > span",
      ".bounty-board__target-option-name",
      ".bounty-board__target-option-meta",
      "#bounty-cash-available",
      "#bounty-cash-range",
      "#bounty-cash-input",
      "#bounty-preview-value",
      "#bounty-preview-summary",
      "#bounty-preview-target",
      "#bounty-escrow-value",
      "[data-bounty-active-count]",
      "#bounty-submit-hint"
    ].join(","),
    expectedFocusRestore: false,
    requiredSectionSelectors: Object.freeze([
      ".bounty-board__header",
      ".bounty-board__layout",
      ".bounty-board__panel--target",
      ".bounty-board__panel--type",
      ".bounty-board__panel--reward"
    ]),
    semanticDatasetKeys: Object.freeze([
      "bountyTab",
      "bountyTargetToggle",
      "mode",
      "tone"
    ]),
    shellSelector: "#bounty-modal",
    targetSelector: ".bounty-board__content",
    triggerSelector: "[data-bounty-open-trigger]"
  }),
  boost: Object.freeze({
    closeSelector: "#boost-modal-close",
    dynamicLeafSelector: [
      "[data-boost-active-title]",
      "[data-boost-active-effect]",
      "[data-boost-active-time]",
      "[data-boost-active-progress]",
      ".boost-cost-chip",
      "[data-boost-button-label]"
    ].join(","),
    expectedFocusRestore: true,
    requiredSectionSelectors: Object.freeze([
      ".boost-modal__header",
      ".boost-modal__body",
      "[data-boost-active-panel]",
      ".boost-modal__grid",
      "[data-boost-card]"
    ]),
    semanticDatasetKeys: Object.freeze([
      "accent",
      "boostActivate",
      "boostCard",
      "costCount"
    ]),
    shellSelector: "#boost-modal",
    targetSelector: ".boost-modal__content",
    triggerSelector: "[data-boost-open-trigger]"
  })
});

const forbiddenDynamicMaskSelectors = new Set([
  "*",
  "body",
  "html",
  "[data-market-dashboard]",
  "[data-market-list]",
  "#alliance-active-panel",
  "#bounty-board-body",
  "#boost-modal-content",
  ".market-popup-row",
  ".alliance-active-card",
  ".bounty-board__panel",
  ".boost-card"
]);

function splitSelectors(selectorList = "") {
  return String(selectorList || "")
    .split(",")
    .map((selector) => selector.trim())
    .filter(Boolean);
}

export function validateSocialModalParityCoverage({
  surfaceNames = socialModalParitySurfaceNames,
  surfaces = socialModalParitySurfaces,
  viewportBatches = socialModalParityViewportBatches,
  viewports = socialModalParityViewports
} = {}) {
  const resolvedSurfaceNames = Array.from(surfaceNames);
  const viewportContract = validateModalParityViewportMatrix({
    batches: viewportBatches,
    viewports
  });
  if (JSON.stringify(resolvedSurfaceNames) !== JSON.stringify(socialModalParitySurfaceNames)) {
    throw new Error("Social modal parity must cover Market, Alliance, Bounty and Boost in canonical order.");
  }

  for (const surfaceName of resolvedSurfaceNames) {
    const definition = surfaces[surfaceName];
    if (!definition) throw new Error(`Social modal parity surface ${surfaceName} is missing.`);
    for (const propertyName of [
      "closeSelector",
      "requiredSectionSelectors",
      "semanticDatasetKeys",
      "shellSelector",
      "targetSelector",
      "triggerSelector"
    ]) {
      if (!definition[propertyName]) {
        throw new Error(`Social modal parity surface ${surfaceName} lacks ${propertyName}.`);
      }
    }
    if (!Array.isArray(definition.requiredSectionSelectors)
      || definition.requiredSectionSelectors.length < 4) {
      throw new Error(`Social modal parity surface ${surfaceName} must guard at least four sections.`);
    }
    const masks = splitSelectors(definition.dynamicLeafSelector);
    if (masks.some((selector) => (
      forbiddenDynamicMaskSelectors.has(selector)
      || selector === definition.shellSelector
      || selector === definition.targetSelector
      || definition.requiredSectionSelectors.includes(selector)
    ))) {
      throw new Error(`Social modal parity surface ${surfaceName} masks a structural container.`);
    }
  }

  return Object.freeze({
    batchCount: viewportContract.batchCount,
    comparisonCount: resolvedSurfaceNames.length * viewportContract.viewportNames.length,
    surfaceNames: Object.freeze(resolvedSurfaceNames),
    viewportNames: viewportContract.viewportNames
  });
}

function resolveSurface(surfaceName) {
  const definition = socialModalParitySurfaces[surfaceName];
  if (!definition) throw new Error(`Unknown social modal parity surface: ${surfaceName}`);
  return definition;
}

async function settleSurface(target) {
  await target.evaluate(async (targetElement) => {
    for (const animation of targetElement.getAnimations({ subtree: true })) {
      try {
        animation.finish();
      } catch {}
    }
    await document.fonts?.ready;
    await Promise.all(Array.from(targetElement.querySelectorAll("img")).map(async (image) => {
      if (image.complete) return;
      await new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function selectStableSurfaceState(target, surfaceName) {
  if (surfaceName === "market") {
    await target.locator('[data-market-tab="market"]').click();
    await expect(target.locator('[data-market-tab="market"]')).toHaveAttribute("aria-selected", "true");
  } else if (surfaceName === "alliance") {
    await target.locator('[data-alliance-tab="overview"]').click();
    await expect(target.locator('[data-alliance-tab="overview"]')).toHaveAttribute("aria-selected", "true");
  } else if (surfaceName === "bounty") {
    await target.locator('[data-bounty-tab="create"]').click();
    await expect(target.locator('[data-bounty-tab="create"]')).toHaveAttribute("aria-selected", "true");
    await expect(target.locator("[data-bounty-target-toggle]")).toBeVisible();
  } else if (surfaceName === "boost") {
    await expect(target.locator("[data-boost-card]")).toHaveCount(3);
  }
}

export async function openSocialModalParitySurface(page, surfaceName) {
  const definition = resolveSurface(surfaceName);
  const trigger = page.locator(`${definition.triggerSelector}:visible`).first();
  await expect(trigger, `${surfaceName} must open through a visible game.html trigger`).toBeVisible();
  await trigger.click();
  const shell = page.locator(`${definition.shellSelector}:visible`).last();
  const target = page.locator(`${definition.targetSelector}:visible`).last();
  await expect(shell, `${surfaceName} shell must become visible`).toBeVisible();
  await expect(target, `${surfaceName} card must become visible`).toBeVisible();
  await selectStableSurfaceState(target, surfaceName);
  for (const selector of definition.requiredSectionSelectors) {
    await expect(
      target.locator(selector).first(),
      `${surfaceName} must keep required section ${selector}`
    ).toBeVisible();
  }
  await settleSurface(target);
  return target;
}

export async function closeSocialModalParitySurface(page, surfaceName) {
  const definition = resolveSurface(surfaceName);
  const shell = page.locator(`${definition.shellSelector}:visible`).last();
  if (!await shell.isVisible().catch(() => false)) {
    return { activeTag: null, expectedFocusRestore: definition.expectedFocusRestore, restoredToTrigger: false };
  }
  const closeButton = page.locator(`${definition.closeSelector}:visible`).last();
  await expect(closeButton).toBeVisible();
  await closeButton.click();
  await expect(page.locator(definition.shellSelector)).toBeHidden();
  return page.evaluate(({ expectedFocusRestore, triggerSelector }) => {
    const activeElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    return {
      activeClasses: activeElement ? Array.from(activeElement.classList).sort() : [],
      activeTag: activeElement?.tagName.toLowerCase() || null,
      expectedFocusRestore,
      restoredToTrigger: Boolean(activeElement?.matches?.(triggerSelector))
    };
  }, {
    expectedFocusRestore: definition.expectedFocusRestore,
    triggerSelector: definition.triggerSelector
  });
}

export async function getSocialModalParitySignature(page, surfaceName) {
  const definition = resolveSurface(surfaceName);
  const shell = page.locator(`${definition.shellSelector}:visible`).last();
  const target = page.locator(`${definition.targetSelector}:visible`).last();
  await expect(target).toBeVisible();
  return target.evaluate((targetElement, config) => {
    const authoritativeText = config.authoritativeText;
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
    const isAuthoritativeLeaf = (element) => Boolean(
      config.dynamicLeafSelector
      && (element.matches?.(config.dynamicLeafSelector) || element.closest?.(config.dynamicLeafSelector))
    );
    const hasAuthoritativeContent = (element) => Boolean(
      isAuthoritativeLeaf(element)
      || (config.dynamicLeafSelector && element.querySelector?.(config.dynamicLeafSelector))
    );
    const classNames = (element) => Array.from(element.classList || []).sort();
    const targetRect = targetElement.getBoundingClientRect();
    const relativeRect = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        height: Math.round(rect.height),
        width: Math.round(rect.width),
        x: Math.round(rect.left - targetRect.left),
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
      const scrollable = new Set(["auto", "overlay", "scroll"]);
      const canScrollX = element.scrollWidth > element.clientWidth && scrollable.has(style.overflowX);
      const canScrollY = element.scrollHeight > element.clientHeight && scrollable.has(style.overflowY);
      return {
        canScrollX,
        canScrollY,
        maxScrollLeft: canScrollX ? Math.max(0, element.scrollWidth - element.clientWidth) : 0,
        maxScrollTop: canScrollY ? Math.max(0, element.scrollHeight - element.clientHeight) : 0,
        overflow: style.overflow,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        scrollLeft: Math.round(element.scrollLeft),
        scrollTop: Math.round(element.scrollTop)
      };
    };
    const visibleNodes = [targetElement, ...targetElement.querySelectorAll("*")].filter(isVisible);
    const structuralNodes = visibleNodes.filter((element) => !isAuthoritativeLeaf(element));
    const focusableNodes = structuralNodes.filter((element) => (
      element.matches?.("button, input, select, textarea, a[href], [role='button'], [role='tab'], [tabindex]")
      && !element.matches?.("[disabled], [aria-disabled='true'], [tabindex='-1']")
    ));
    const sectionNodes = Array.from(new Set(config.requiredSectionSelectors.flatMap((selector) => (
      Array.from(targetElement.querySelectorAll(selector)).filter(isVisible)
    )))).sort((left, right) => (
      left === right
        ? 0
        : left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    ));
    const activeElement = document.activeElement instanceof Element ? document.activeElement : null;
    const shellElement = targetElement.closest(config.shellSelector)
      || document.querySelector(`${config.shellSelector}:not([hidden])`);
    const documentScroll = (element) => {
      const signature = scrollSignature(element);
      signature.maxScrollLeft = 0;
      signature.maxScrollTop = 0;
      signature.scrollLeft = 0;
      signature.scrollTop = 0;
      return signature;
    };

    return {
      classNames: Array.from(new Set(structuralNodes.flatMap(classNames))).sort(),
      controls: structuralNodes
        .filter((element) => element.matches?.(
          "button, input, select, textarea, a[href], [role='button'], [role='tab']"
        ))
        .map((element) => ({
          ariaDisabled: element.getAttribute("aria-disabled"),
          ariaExpanded: element.getAttribute("aria-expanded"),
          ariaLabel: hasAuthoritativeContent(element)
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
          text: hasAuthoritativeContent(element)
            ? authoritativeText
            : normalizeText(element.textContent),
          type: element.getAttribute("type"),
          value: "value" in element
            ? hasAuthoritativeContent(element) ? authoritativeText : String(element.value || "")
            : null
        })),
      domTree: visibleNodes.map((element) => ({
        alt: isAuthoritativeLeaf(element) ? authoritativeText : element.getAttribute("alt"),
        ariaLabel: isAuthoritativeLeaf(element) ? authoritativeText : element.getAttribute("aria-label"),
        ariaSelected: element.getAttribute("aria-selected"),
        classes: isAuthoritativeLeaf(element) ? [] : classNames(element),
        dataset: isAuthoritativeLeaf(element) ? { keys: [], semanticValues: {} } : dataset(element),
        disabled: isAuthoritativeLeaf(element)
          ? false
          : "disabled" in element ? Boolean(element.disabled) : false,
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
        body: documentScroll(document.body),
        html: documentScroll(document.documentElement),
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
          .map((element) => ({ path: elementPath(element), ...scrollSignature(element) })),
        target: scrollSignature(targetElement),
        windowX: 0,
        windowY: 0
      },
      sectionOrder: sectionNodes.map((element) => ({
        classes: classNames(element),
        path: elementPath(element),
        tag: element.tagName.toLowerCase()
      })),
      shell: shellElement ? {
        ariaHidden: shellElement.getAttribute("aria-hidden"),
        ariaModal: shellElement.getAttribute("aria-modal"),
        classes: classNames(shellElement),
        role: shellElement.getAttribute("role")
      } : null,
      target: {
        classes: classNames(targetElement),
        rect: relativeRect(targetElement),
        role: targetElement.getAttribute("role")
      },
      visibleDialogCount: Array.from(document.querySelectorAll("[role='dialog']")).filter(isVisible).length
    };
  }, {
    authoritativeText: AUTHORITATIVE_TEXT,
    computedStyleProperties: parityComputedStyleProperties,
    dynamicLeafSelector: definition.dynamicLeafSelector,
    requiredSectionSelectors: definition.requiredSectionSelectors,
    semanticDatasetKeys: definition.semanticDatasetKeys,
    shellSelector: definition.shellSelector
  });
}

export async function exerciseSocialModalParityScroll(page, surfaceName) {
  const definition = resolveSurface(surfaceName);
  const target = page.locator(`${definition.targetSelector}:visible`).last();
  await expect(target).toBeVisible();
  return target.evaluate(async (targetElement) => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement) || element.hidden) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && rect.width > 0
        && rect.height > 0;
    };
    const pathFor = (element) => {
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
        right.element.scrollHeight - right.element.clientHeight
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
      path: pathFor(region),
      reachedBottom,
      resetTop: region.scrollTop === 0
    };
  });
}

export async function captureSocialModalParityScreenshot(page, {
  path: screenshotPath,
  surfaceName
}) {
  const definition = resolveSurface(surfaceName);
  const target = page.locator(`${definition.targetSelector}:visible`).last();
  await expect(target).toBeVisible();
  return captureIsolatedParityScreenshot(page, {
    ignoreSelector: definition.dynamicLeafSelector,
    path: screenshotPath,
    roundedCompositeSelector: definition.roundedCompositeSelector || "",
    stableBackdropShellSelector: definition.shellSelector,
    target
  });
}
