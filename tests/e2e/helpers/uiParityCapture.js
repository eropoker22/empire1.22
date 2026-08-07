import fs from "node:fs/promises";
import path from "node:path";
import { expect } from "@playwright/test";
import playwrightUtilsBundle from "playwright-core/lib/utilsBundle";
import {
  resolveBuildingPresentationDefinition
} from "../../../page-assets/js/app/runtime/buildingPresentationContract.js";
import {
  HOSTED_E2E_STARTING_PLAYER_STATE
} from "../../../scripts/local-hosted/hosted-e2e-starting-player-state.mjs";
import {
  ARMORY_RECIPES
} from "../../../packages/game-config/src/legacy-page/economy-config.js";
import {
  APARTMENT_BLOCK_MIN_COLLECT_POPULATION,
  CONVENIENCE_STORE_MIN_COLLECT_POPULATION
} from "../../../page-assets/js/app/runtime/buildingDetailData.js";

const SESSION_KEY = "empireStreets.session.v1";
const SCOPED_SESSION_KEY = "empireStreets.session.free.instance-free-eu-central-public-1.v1";
const { PNG } = playwrightUtilsBundle;

export const parityWeaponResourceKeys = Object.freeze(Array.from(new Set(
  Object.values(ARMORY_RECIPES).map((recipe) => recipe.output.itemId)
)));

export const PARITY_PNG_CHANNEL_TOLERANCE = 6;
export const PARITY_PNG_MAX_CAPTURE_ATTEMPTS = 3;
export const PARITY_SCREENSHOT_RASTER_FRINGE_PX = 1;
export const PARITY_ROUNDED_COMPOSITE_RASTER_FRINGE_PX = 2;
export const BUILDING_POPULATION_BUFFER_DYNAMIC_VALUE = "population-buffer";
export const buildingPopulationBufferDynamicValueSelector =
  `[data-building-dynamic-value="${BUILDING_POPULATION_BUFFER_DYNAMIC_VALUE}"]`;
const CSS_URL_VALUE_PATTERN_SOURCE = String.raw`url\(\s*(?:(["'])(.*?)\1|([^)]*))\s*\)`;
const PARITY_LOCAL_POPULATION_STATE_FREEZE_MS = 5 * 60 * 1000;
const PARITY_POPULATION_SNAPSHOT_MAX_ATTEMPTS = 3;
const PARITY_POPULATION_BUFFER_CONFIG = Object.freeze({
  apartment_block: Object.freeze({
    collectActionId: "collect_population",
    emptyDisabledReason: "Bytový blok zatím nemá připravené obyvatele.",
    minimumCollectAmount: APARTMENT_BLOCK_MIN_COLLECT_POPULATION,
    minimumDisabledReason: `Bytový blok potřebuje alespoň ${APARTMENT_BLOCK_MIN_COLLECT_POPULATION} lidí k výběru.`,
  }),
  convenience_store: Object.freeze({
    collectActionId: "collect_convenience_store_population",
    emptyDisabledReason: "Večerka zatím nemá připravené obyvatele.",
    minimumCollectAmount: CONVENIENCE_STORE_MIN_COLLECT_POPULATION,
    minimumDisabledReason: `Večerka potřebuje alespoň ${CONVENIENCE_STORE_MIN_COLLECT_POPULATION} lidí k výběru.`,
  }),
  school: Object.freeze({
    collectActionId: "collect_school_population",
    emptyDisabledReason: "Škola zatím nemá připravené členy k výběru.",
    minimumCollectAmount: 1,
    minimumDisabledReason: "Škola zatím nemá připravené členy k výběru."
  })
});

const normalizeParityPopulationBuildingTypeId = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/-/gu, "_");

export function createParityPopulationBufferSyncFixture(
  buildingTypeId,
  building,
  updatedAt = Date.now()
) {
  const normalizedTypeId = normalizeParityPopulationBuildingTypeId(buildingTypeId);
  const config = PARITY_POPULATION_BUFFER_CONFIG[normalizedTypeId];
  if (!config || normalizeParityPopulationBuildingTypeId(building?.buildingTypeId) !== normalizedTypeId) {
    return null;
  }
  const buffer = building?.presentation?.populationBuffer;
  const storedAmount = Number(buffer?.storedAmount);
  const capacity = Number(buffer?.capacity);
  const normalizedUpdatedAt = Math.max(0, Math.floor(Number(updatedAt) || 0));
  const collectAction = [
    ...(Array.isArray(building?.actions) ? building.actions : []),
    ...(Array.isArray(building?.specialActions) ? building.specialActions : [])
  ].find((action) => String(action?.actionId || "") === config.collectActionId);
  if (
    !Number.isFinite(storedAmount)
    || storedAmount < 0
    || !Number.isFinite(capacity)
    || capacity <= 0
    || !collectAction
  ) {
    return null;
  }
  const wholeAmount = Math.floor(storedAmount);
  const expectedEnabled = wholeAmount >= config.minimumCollectAmount;
  const expectedDisabledReason = expectedEnabled
    ? ""
    : wholeAmount <= 0
      ? config.emptyDisabledReason
      : config.minimumDisabledReason;
  const actualDisabledReason = String(collectAction.disabledReason || "").trim();
  if (
    collectAction.enabled !== expectedEnabled
    || actualDisabledReason !== expectedDisabledReason
  ) {
    return null;
  }

  return {
    buildingTypeId: normalizedTypeId,
    collect: {
      actionId: config.collectActionId,
      disabledReason: actualDisabledReason,
      enabled: collectAction.enabled === true
    },
    populationBuffer: {
      capacity,
      storedAmount: wholeAmount
    },
    updatedAt: normalizedUpdatedAt
  };
}

function parityPopulationBufferSnapshotsMatch(first, second) {
  if (!first || !second) return first === second;
  return first.buildingTypeId === second.buildingTypeId
    && first.collect?.actionId === second.collect?.actionId
    && first.collect?.disabledReason === second.collect?.disabledReason
    && first.collect?.enabled === second.collect?.enabled
    && first.populationBuffer?.capacity === second.populationBuffer?.capacity
    && first.populationBuffer?.storedAmount === second.populationBuffer?.storedAmount;
}

function parityPopulationSnapshotMatchesRenderedCollectAction(hostedSnapshot, fixture) {
  if (!fixture) return true;
  const presentation = hostedSnapshot?.presentation;
  const renderedAction = Object.prototype.hasOwnProperty.call(
    presentation || {},
    "collectAction"
  )
    ? presentation.collectAction
    : presentation?.actions?.find((action) => (
        String(action?.actionId || "") === fixture.collect?.actionId
      ));
  const expectedDisabled = fixture.collect?.enabled !== true;
  return Boolean(renderedAction)
    && renderedAction.disabled === expectedDisabled
    && (
      !expectedDisabled
      || String(renderedAction.disabledReason || "") === String(fixture.collect?.disabledReason || "")
    );
}

async function readParityHostedPopulationBufferFixture(hostedPage, buildingTypeId) {
  const normalizedTypeId = normalizeParityPopulationBuildingTypeId(buildingTypeId);
  if (!PARITY_POPULATION_BUFFER_CONFIG[normalizedTypeId]) return null;
  const hostedBuilding = await hostedPage.evaluate((targetBuildingTypeId) => {
    const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
      || window.empireStreetsGameplaySliceReadModel
      || null;
    const building = (readModel?.district?.buildings || []).find((entry) => (
      String(entry?.buildingTypeId || "").trim().toLowerCase().replace(/-/gu, "_")
        === targetBuildingTypeId
    ));
    if (!building) return null;
    return {
      actions: Array.isArray(building.actions) ? building.actions : [],
      buildingTypeId: building.buildingTypeId,
      presentation: building.presentation || null,
      specialActions: Array.isArray(building.specialActions) ? building.specialActions : []
    };
  }, normalizedTypeId);
  return createParityPopulationBufferSyncFixture(
    normalizedTypeId,
    hostedBuilding,
    Date.now() + PARITY_LOCAL_POPULATION_STATE_FREEZE_MS
  );
}

async function applyParityLocalDemoPopulationBufferFixture(localPage, fixture) {
  if (!fixture) return null;
  await localPage.evaluate((populationFixture) => {
    if (document.documentElement.dataset.runtimeMode !== "local-demo") {
      throw new Error("Population parity state can only be synchronized into local-demo.");
    }
    const buildingChip = Array.from(document.querySelectorAll(
      "[data-district-building-name][data-district-building-type]"
    )).find((element) => (
      element instanceof HTMLElement
      && element.offsetParent !== null
      && String(element.dataset.districtBuildingType || "") === populationFixture.buildingTypeId
    ));
    const buildingName = String(buildingChip?.dataset?.districtBuildingName || "").trim();
    const bridge = window.empireLocalDemoGameplayBridge;
    if (!buildingName || typeof bridge?.setE2eDistrictBuildingPopulationBuffer !== "function") {
      throw new Error(`Local-demo population fixture bridge is unavailable: ${populationFixture.buildingTypeId}`);
    }
    const applied = bridge.setE2eDistrictBuildingPopulationBuffer({
      buildingName,
      capacity: populationFixture.populationBuffer.capacity,
      storedAmount: populationFixture.populationBuffer.storedAmount,
      updatedAt: populationFixture.updatedAt
    });
    if (
      Number(applied?.storedAmount) !== populationFixture.populationBuffer.storedAmount
      || Number(applied?.capacity) !== populationFixture.populationBuffer.capacity
    ) {
      throw new Error(`Local-demo population fixture did not apply: ${populationFixture.buildingTypeId}`);
    }
  }, fixture);
  return fixture;
}

export async function syncParityLocalDemoPopulationBufferFromHosted(
  localPage,
  hostedPage,
  buildingTypeId
) {
  const normalizedTypeId = normalizeParityPopulationBuildingTypeId(buildingTypeId);
  if (!PARITY_POPULATION_BUFFER_CONFIG[normalizedTypeId]) return null;

  let fixture = null;
  await expect.poll(async () => {
    fixture = await readParityHostedPopulationBufferFixture(hostedPage, normalizedTypeId);
    return fixture;
  }, {
    message: `${normalizedTypeId} authoritative population buffer should be hydrated`,
    timeout: 30_000
  }).not.toBeNull();

  return applyParityLocalDemoPopulationBufferFixture(localPage, fixture);
}

export async function captureStableHostedPopulationParitySnapshot(
  localPage,
  hostedPage,
  buildingTypeId,
  captureHostedSnapshot
) {
  if (typeof captureHostedSnapshot !== "function") {
    throw new TypeError("Hosted population parity capture must be a function");
  }
  let populationFixture = await syncParityLocalDemoPopulationBufferFromHosted(
    localPage,
    hostedPage,
    buildingTypeId
  );

  for (let attempt = 1; attempt <= PARITY_POPULATION_SNAPSHOT_MAX_ATTEMPTS; attempt += 1) {
    const hostedSnapshot = await captureHostedSnapshot();
    if (!populationFixture) {
      return { hostedSnapshot, populationFixture: null, snapshotAttempts: attempt };
    }
    const postCaptureFixture = await readParityHostedPopulationBufferFixture(
      hostedPage,
      buildingTypeId
    );
    if (!postCaptureFixture) {
      throw new Error(`${buildingTypeId} authoritative population snapshot disappeared during parity capture.`);
    }
    const readModelStable = parityPopulationBufferSnapshotsMatch(populationFixture, postCaptureFixture);
    const renderedCollectStable = parityPopulationSnapshotMatchesRenderedCollectAction(
      hostedSnapshot,
      populationFixture
    );
    if (readModelStable && renderedCollectStable) {
      return { hostedSnapshot, populationFixture, snapshotAttempts: attempt };
    }
    if (attempt === PARITY_POPULATION_SNAPSHOT_MAX_ATTEMPTS) {
      throw new Error(readModelStable
        ? `${buildingTypeId} rendered collect state did not match the authoritative population snapshot during ${attempt} parity captures.`
        : `${buildingTypeId} authoritative population snapshot changed during ${attempt} parity captures.`);
    }
    if (readModelStable) {
      continue;
    }
    populationFixture = await applyParityLocalDemoPopulationBufferFixture(
      localPage,
      postCaptureFixture
    );
  }
  throw new Error(`${buildingTypeId} authoritative population snapshot capture did not complete.`);
}

export function extractCssUrlValues(value) {
  return Array.from(
    String(value || "").matchAll(new RegExp(CSS_URL_VALUE_PATTERN_SOURCE, "gu"))
  ).map((match) => String(match[2] ?? match[3] ?? "").trim()).filter(Boolean);
}

export function resolveEnclosingRasterBounds(rect, scale = 1) {
  const normalizedScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const left = Math.floor((Number(rect?.left) || 0) * normalizedScale);
  const top = Math.floor((Number(rect?.top) || 0) * normalizedScale);
  const right = Math.ceil((Number(rect?.right) || 0) * normalizedScale);
  const bottom = Math.ceil((Number(rect?.bottom) || 0) * normalizedScale);
  return {
    bottom,
    height: Math.max(0, bottom - top),
    left,
    right,
    top,
    width: Math.max(0, right - left)
  };
}

export function expandParityRasterIgnoreRegions(
  regions,
  fringePx = PARITY_SCREENSHOT_RASTER_FRINGE_PX
) {
  if (!Array.isArray(regions)) {
    throw new TypeError("Parity PNG ignore regions must be an array");
  }
  if (!Number.isInteger(fringePx) || fringePx < 0) {
    throw new RangeError("Parity screenshot raster fringe must be a non-negative integer");
  }
  return regions.map((region) => ({
    height: region.height + (fringePx * 2),
    width: region.width + (fringePx * 2),
    x: region.x - fringePx,
    y: region.y - fringePx
  }));
}

export function createRoundedCornerCompositeIgnoreRegions({
  height,
  radii = {},
  width
}) {
  const rasterHeight = Math.max(0, Math.round(Number(height) || 0));
  const rasterWidth = Math.max(0, Math.round(Number(width) || 0));
  const normalizedRadii = Object.fromEntries([
    "bottomLeft",
    "bottomRight",
    "topLeft",
    "topRight"
  ].map((corner) => [corner, {
    x: Math.max(0, Number(radii[corner]?.x) || 0),
    y: Math.max(0, Number(radii[corner]?.y) || 0)
  }]));
  const positiveRatios = [
    [rasterWidth, normalizedRadii.topLeft.x + normalizedRadii.topRight.x],
    [rasterWidth, normalizedRadii.bottomLeft.x + normalizedRadii.bottomRight.x],
    [rasterHeight, normalizedRadii.topLeft.y + normalizedRadii.bottomLeft.y],
    [rasterHeight, normalizedRadii.topRight.y + normalizedRadii.bottomRight.y]
  ].filter(([, sum]) => sum > 0).map(([limit, sum]) => limit / sum);
  const radiusScale = Math.min(1, ...positiveRatios);
  const regions = [];
  const appendCorner = (radius, { bottom = false, right = false } = {}) => {
    const radiusX = Math.min(rasterWidth, Math.max(0, Number(radius?.x) || 0));
    const radiusY = Math.min(rasterHeight, Math.max(0, Number(radius?.y) || 0));
    if (radiusX <= 0 || radiusY <= 0) return;
    const rowCount = Math.min(rasterHeight, Math.ceil(radiusY));
    for (let row = 0; row < rowCount; row += 1) {
      const distanceFromCenter = Math.max(0, radiusY - (row + 0.5));
      const normalizedDistance = Math.min(1, distanceFromCenter / radiusY);
      const inset = radiusX * (1 - Math.sqrt(1 - (normalizedDistance ** 2)));
      const outsideWidth = Math.min(
        rasterWidth,
        Math.ceil(inset) + PARITY_ROUNDED_COMPOSITE_RASTER_FRINGE_PX
      );
      if (outsideWidth <= 0) continue;
      regions.push({
        height: 1,
        width: outsideWidth,
        x: right ? rasterWidth - outsideWidth : 0,
        y: bottom ? rasterHeight - 1 - row : row
      });
    }
  };

  appendCorner({
    x: normalizedRadii.topLeft.x * radiusScale,
    y: normalizedRadii.topLeft.y * radiusScale
  });
  appendCorner({
    x: normalizedRadii.topRight.x * radiusScale,
    y: normalizedRadii.topRight.y * radiusScale
  }, { right: true });
  appendCorner({
    x: normalizedRadii.bottomLeft.x * radiusScale,
    y: normalizedRadii.bottomLeft.y * radiusScale
  }, { bottom: true });
  appendCorner({
    x: normalizedRadii.bottomRight.x * radiusScale,
    y: normalizedRadii.bottomRight.y * radiusScale
  }, { bottom: true, right: true });
  return regions;
}

export const parityDynamicClassNames = Object.freeze([
  "is-active",
  "is-disabled",
  "is-empty",
  "is-loading",
  "is-selected",
  "city-status-pill--critical",
  "city-status-pill--danger",
  "city-status-pill--final",
  "local-demo",
  "server-authoritative"
]);

export const parityComputedStyleProperties = Object.freeze([
  "alignContent",
  "alignItems",
  "alignSelf",
  "animationDelay",
  "animationDirection",
  "animationDuration",
  "animationFillMode",
  "animationIterationCount",
  "animationName",
  "animationPlayState",
  "animationTimingFunction",
  "backdropFilter",
  "backgroundColor",
  "backgroundImage",
  "borderBottomColor",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "borderBottomStyle",
  "borderBottomWidth",
  "borderLeftColor",
  "borderLeftStyle",
  "borderLeftWidth",
  "borderRightColor",
  "borderRightStyle",
  "borderRightWidth",
  "borderTopColor",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderTopStyle",
  "borderTopWidth",
  "borderRadius",
  "boxSizing",
  "boxShadow",
  "color",
  "columnGap",
  "cursor",
  "display",
  "flexDirection",
  "flexGrow",
  "flexShrink",
  "flexWrap",
  "filter",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "gap",
  "gridAutoFlow",
  "gridTemplateColumns",
  "gridTemplateRows",
  "height",
  "justifyContent",
  "justifyItems",
  "letterSpacing",
  "lineHeight",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginTop",
  "maxHeight",
  "maxWidth",
  "minHeight",
  "minWidth",
  "mixBlendMode",
  "opacity",
  "outlineColor",
  "outlineOffset",
  "outlineStyle",
  "outlineWidth",
  "overflow",
  "overflowX",
  "overflowY",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "position",
  "pointerEvents",
  "rowGap",
  "textAlign",
  "textDecorationLine",
  "textOverflow",
  "textTransform",
  "transform",
  "transitionDelay",
  "transitionDuration",
  "transitionProperty",
  "transitionTimingFunction",
  "visibility",
  "whiteSpace",
  "width",
  "zIndex"
]);

export const gameChromeDynamicMaskSelector = [
  "[data-topbar-clean-money]",
  "[data-topbar-dirty-money]",
  "[data-topbar-influence]",
  "[data-topbar-spy-label]",
  "[data-topbar-spy-value]",
  "[data-city-clock]",
  "[data-city-day-phase]",
  "[data-city-game-phase]",
  "[data-city-status]",
  "[data-city-production]",
  "[data-gang-star]",
  "[data-gang-members]",
  "[data-gang-heat]",
  "[data-gang-faction]",
  "[data-gang-districts]",
  "[data-gang-alliance]",
  "[data-global-chat-log] .server-chat-panel__author",
  "[data-global-chat-log] .server-chat-panel__timestamp",
  "[data-global-chat-log] .server-chat-panel__text",
  "[data-global-chat-log] .alliance-empty-state",
  "#global-chat-status",
  "[data-building-action-state]",
  "[data-building-action-summary]",
  "[data-building-action-meta]",
  "[data-building-action-empty]",
  "[data-building-action-feed]",
  "[data-boost-map-label]",
  "[data-boost-map-time]",
  "[data-production-progress]",
  "[data-production-countdown]",
  "[data-countdown]",
  buildingPopulationBufferDynamicValueSelector,
  "time",
  "[data-district-canvas]"
].join(",");

export const gameChromeScreenshotIgnoreSelector = [
  "[data-topbar-clean-money]",
  "[data-topbar-dirty-money]",
  "[data-topbar-influence]",
  "[data-topbar-spy-label]",
  "[data-topbar-spy-value]",
  "[data-boost-map-label]",
  "[data-boost-map-time]",
  "[data-map-viewport]",
  "[data-city-clock]",
  "[data-city-day-phase]",
  "[data-city-game-phase]",
  "[data-city-status]",
  "[data-gang-star]",
  "[data-gang-members]",
  "[data-gang-heat]",
  "[data-gang-faction]",
  "[data-gang-districts]",
  "[data-gang-alliance]",
  "[data-global-chat-log] .server-chat-panel__author",
  "[data-global-chat-log] .server-chat-panel__timestamp",
  "[data-global-chat-log] .server-chat-panel__text",
  "[data-global-chat-log] .alliance-empty-state",
  "#global-chat-status",
  buildingPopulationBufferDynamicValueSelector
].join(",");

export const parityDynamicDistrictIdentitySelector = [
  ".district-popup-owner-avatar-wrap img",
  "[data-district-popup-owner]",
  "[data-district-popup-owner-meta]"
].join(",");

function createParityIgnoreMask(ignoreRegions, width, height) {
  if (!Array.isArray(ignoreRegions)) {
    throw new TypeError("Parity PNG ignore regions must be an array");
  }
  const mask = new Uint8Array(width * height);
  let ignoreRegionCount = 0;
  let ignoredPixelCount = 0;

  for (const region of ignoreRegions) {
    if (!region || typeof region !== "object") {
      throw new TypeError("Each parity PNG ignore region must be an object");
    }
    const { x, y, width: regionWidth, height: regionHeight } = region;
    if (![x, y, regionWidth, regionHeight].every(Number.isFinite)) {
      throw new TypeError("Parity PNG ignore region coordinates must be finite numbers");
    }
    if (regionWidth < 0 || regionHeight < 0) {
      throw new RangeError("Parity PNG ignore region dimensions must be non-negative");
    }
    const left = Math.max(0, Math.floor(x));
    const top = Math.max(0, Math.floor(y));
    const right = Math.min(width, Math.ceil(x + regionWidth));
    const bottom = Math.min(height, Math.ceil(y + regionHeight));
    if (right <= left || bottom <= top) continue;

    ignoreRegionCount += 1;
    for (let row = top; row < bottom; row += 1) {
      const rowOffset = row * width;
      for (let column = left; column < right; column += 1) {
        const pixelIndex = rowOffset + column;
        if (mask[pixelIndex]) continue;
        mask[pixelIndex] = 1;
        ignoredPixelCount += 1;
      }
    }
  }

  return {
    ignoreRegionCount,
    ignoredPixelCount,
    mask,
    requestedIgnoreRegionCount: ignoreRegions.length
  };
}

export function compareParityPngScreenshots(actualBuffer, expectedBuffer, {
  channelTolerance = PARITY_PNG_CHANNEL_TOLERANCE,
  ignoreRegions = []
} = {}) {
  if (!Buffer.isBuffer(actualBuffer) || !Buffer.isBuffer(expectedBuffer)) {
    throw new TypeError("Parity screenshots must be PNG buffers");
  }
  if (!Number.isInteger(channelTolerance) || channelTolerance < 0 || channelTolerance > 255) {
    throw new RangeError("Parity PNG channel tolerance must be an integer from 0 to 255");
  }
  const actual = PNG.sync.read(actualBuffer);
  const expected = PNG.sync.read(expectedBuffer);
  const dimensionsEqual = actual.width === expected.width && actual.height === expected.height;
  if (!dimensionsEqual) {
    const pixelCount = Math.max(
      actual.width * actual.height,
      expected.width * expected.height
    );
    const ignoreMask = createParityIgnoreMask(
      ignoreRegions,
      actual.width,
      actual.height
    );
    return {
      actualHeight: actual.height,
      actualWidth: actual.width,
      channelTolerance,
      comparedPixelCount: pixelCount - ignoreMask.ignoredPixelCount,
      dimensionsEqual: false,
      exact: false,
      expectedHeight: expected.height,
      expectedWidth: expected.width,
      ignoredDifferentPixelCount: 0,
      ignoredPixelCount: ignoreMask.ignoredPixelCount,
      ignoreRegionCount: ignoreMask.ignoreRegionCount,
      matches: false,
      maxChannelDelta: 255,
      meaningfulPixelCount: pixelCount - ignoreMask.ignoredPixelCount,
      pixelCount,
      rawDifferentPixelCount: pixelCount,
      rawMaxChannelDelta: 255,
      requestedIgnoreRegionCount: ignoreMask.requestedIgnoreRegionCount
    };
  }

  const pixelCount = actual.width * actual.height;
  const ignoreMask = createParityIgnoreMask(ignoreRegions, actual.width, actual.height);
  let comparedDifferentPixelCount = 0;
  let ignoredDifferentPixelCount = 0;
  let maxChannelDelta = 0;
  let meaningfulPixelCount = 0;
  let rawDifferentPixelCount = 0;
  let rawMaxChannelDelta = 0;
  for (let offset = 0; offset < actual.data.length; offset += 4) {
    const channelDeltas = [
      Math.abs(actual.data[offset] - expected.data[offset]),
      Math.abs(actual.data[offset + 1] - expected.data[offset + 1]),
      Math.abs(actual.data[offset + 2] - expected.data[offset + 2]),
      Math.abs(actual.data[offset + 3] - expected.data[offset + 3])
    ];
    const pixelChannelDelta = Math.max(...channelDeltas);
    rawMaxChannelDelta = Math.max(rawMaxChannelDelta, pixelChannelDelta);
    if (pixelChannelDelta > 0) rawDifferentPixelCount += 1;
    const pixelIndex = offset / 4;
    if (ignoreMask.mask[pixelIndex]) {
      if (pixelChannelDelta > 0) ignoredDifferentPixelCount += 1;
      continue;
    }
    maxChannelDelta = Math.max(maxChannelDelta, pixelChannelDelta);
    if (pixelChannelDelta > 0) comparedDifferentPixelCount += 1;
    if (pixelChannelDelta > channelTolerance) meaningfulPixelCount += 1;
  }

  return {
    actualHeight: actual.height,
    actualWidth: actual.width,
    channelTolerance,
    comparedDifferentPixelCount,
    comparedPixelCount: pixelCount - ignoreMask.ignoredPixelCount,
    dimensionsEqual: true,
    exact: rawDifferentPixelCount === 0,
    expectedHeight: expected.height,
    expectedWidth: expected.width,
    ignoredDifferentPixelCount,
    ignoredPixelCount: ignoreMask.ignoredPixelCount,
    ignoreRegionCount: ignoreMask.ignoreRegionCount,
    matches: meaningfulPixelCount === 0,
    maxChannelDelta,
    meaningfulPixelCount,
    pixelCount,
    rawDifferentPixelCount,
    rawMaxChannelDelta,
    requestedIgnoreRegionCount: ignoreMask.requestedIgnoreRegionCount
  };
}

export async function compareParityPngScreenshotAttempts(captureAttempt, {
  channelTolerance = PARITY_PNG_CHANNEL_TOLERANCE,
  maxAttempts = PARITY_PNG_MAX_CAPTURE_ATTEMPTS
} = {}) {
  if (typeof captureAttempt !== "function") {
    throw new TypeError("Parity screenshot capture attempt must be a function");
  }
  if (
    !Number.isInteger(maxAttempts)
    || maxAttempts < 1
    || maxAttempts > PARITY_PNG_MAX_CAPTURE_ATTEMPTS
  ) {
    throw new RangeError(`Parity PNG capture attempts must be from 1 to ${PARITY_PNG_MAX_CAPTURE_ATTEMPTS}`);
  }

  const attempts = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const capture = await captureAttempt(attempt);
    const comparison = compareParityPngScreenshots(
      capture.actualBuffer,
      capture.expectedBuffer,
      {
        channelTolerance,
        ignoreRegions: capture.ignoreRegions ?? []
      }
    );
    attempts.push({ attempt, comparison });
    if (comparison.matches) {
      return { attemptCount: attempt, attempts, comparison };
    }
  }

  return {
    attemptCount: attempts.length,
    attempts,
    comparison: attempts.at(-1).comparison
  };
}

export const technicalBuildingTextPatterns = Object.freeze([
  Object.freeze({ flags: "u", source: "\\bSERVER\\b" }),
  Object.freeze({ flags: "iu", source: "\\bserver\\p{L}*\\b" }),
  Object.freeze({ flags: "iu", source: "\\bdistrict:\\d+\\b" }),
  Object.freeze({ flags: "iu", source: "\\braw\\s+projection\\b" }),
  Object.freeze({ flags: "iu", source: "\\brevision\\b" }),
  Object.freeze({ flags: "iu", source: "\\bstate\\s*version\\b" }),
  Object.freeze({ flags: "iu", source: "\\binternal\\s+data\\b" }),
  Object.freeze({ flags: "iu", source: "\\bdebug\\s+info\\b" }),
  Object.freeze({ flags: "iu", source: "\\bprojection\\s+internals?\\b" }),
  Object.freeze({ flags: "iu", source: "ověří\\s+server" }),
  Object.freeze({
    flags: "iu",
    source: "serverov(?:á|ou|ý|é)\\s+(?:data|detail|odpově\\p{L}*|stav|upgrade)"
  })
]);

export function findTechnicalBuildingText(textValues = []) {
  const patterns = technicalBuildingTextPatterns.map(({ flags, source }) => (
    new RegExp(source, flags)
  ));
  return Array.from(new Set(textValues
    .map((value) => String(value || "").replace(/\s+/gu, " ").trim())
    .filter(Boolean)
    .filter((text) => patterns.some((pattern) => pattern.test(text)))))
    .sort();
}

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
  bountyDemoTargets,
  gamePhase = "live",
  ownedDistrictIds = [21, 66, 68],
  startDistrictId = ownedDistrictIds[0] || 21,
  gangColor = "#ef4444",
  mapPhase = "night",
  marketCityDayIndex = 0,
  marketCityMinutes = mapPhase === "night" ? 1_334 : 720,
  startingPlayerState = HOSTED_E2E_STARTING_PLAYER_STATE
} = {}) {
  await page.addInitScript(({
    sessionKey,
    scopedSessionKey,
    gamePhase: configuredGamePhase,
    ownedDistrictIds: configuredOwnedDistrictIds,
    startDistrictId: configuredStartDistrictId,
    gangColor: configuredGangColor,
    mapPhase: configuredMapPhase,
    marketCityDayIndex: configuredMarketCityDayIndex,
    marketCityMinutes: configuredMarketCityMinutes,
    bountyDemoTargets: configuredBountyDemoTargets,
    startingPlayerState: configuredStartingPlayerState,
    weaponResourceKeys: configuredWeaponResourceKeys
  }) => {
    window.EmpireConfigOverrides = Object.freeze({
      ...(window.EmpireConfigOverrides || {}),
      localDemoEnabled: true
    });
    window.__EMPIRE_E2E__ = true;
    const now = new Date().toISOString();
    const serverId = "instance:free:eu-central:public-1";
    const session = {
      bountyDemoTargets: configuredBountyDemoTargets,
      registration: {
        identity: "UI Parity Demo",
        gangName: "UI Parity Demo",
        gangColor: configuredGangColor,
        avatar: "../img/avatars/Mafia/2854d1df-0f7c-4fe4-aa85-7a70dfe299db.jpg",
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
          gamePhase: configuredGamePhase,
          mapPhase: configuredMapPhase,
          cityDayIndex: configuredMarketCityDayIndex,
          cityMinutes: configuredMarketCityMinutes
        }
      },
      inventory: {
        weapons: Object.fromEntries(configuredWeaponResourceKeys.map((resourceKey) => [
          resourceKey,
          configuredStartingPlayerState.materials[resourceKey]
        ])),
        materials: { ...configuredStartingPlayerState.materials },
        drugs: {
          "neon-dust": configuredStartingPlayerState.materials["neon-dust"],
          "pulse-shot": configuredStartingPlayerState.materials["pulse-shot"],
          "velvet-smoke": configuredStartingPlayerState.materials["velvet-smoke"],
          "ghost-serum": configuredStartingPlayerState.materials["ghost-serum"],
          "overdrive-x": configuredStartingPlayerState.materials["overdrive-x"]
        },
        factorySupplies: {
          metalParts: configuredStartingPlayerState.materials["metal-parts"],
          techCore: configuredStartingPlayerState.materials["tech-core"],
          combatModule: configuredStartingPlayerState.materials["combat-module"]
        }
      },
      economy: {
        cleanMoney: configuredStartingPlayerState.cleanCash,
        dirtyMoney: configuredStartingPlayerState.dirtyCash
      },
      gang: {
        members: configuredStartingPlayerState.population,
        population: configuredStartingPlayerState.population,
        heat: 0,
        influence: 0,
        lastHeatDecayAt: now
      },
      missions: {
        attackOrders: [],
        occupyOrders: [],
        robberyOrders: [],
        spy: { available: configuredStartingPlayerState.spySlots, missions: [] }
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
    gamePhase,
    ownedDistrictIds,
    startDistrictId,
    gangColor,
    mapPhase,
    marketCityDayIndex,
    marketCityMinutes,
    bountyDemoTargets,
    startingPlayerState,
    weaponResourceKeys: parityWeaponResourceKeys
  });
  await page.goto("/pages/game.html?runtimeMode=local-demo&autoStartLocalDemo=1", { waitUntil: "load" });
  await page.waitForFunction(() => (
    window.EmpireRuntime
    && document.querySelector("#game-root")?.dataset?.runtimeInit === "ready"
    && document.documentElement?.dataset?.runtimeMode === "local-demo"
  ));
  await page.evaluate(() => {
    const bridge = window.empireLocalDemoGameplayBridge;
    const marketState = window.EmpireMarketState;
    const session = bridge?.getStoredPreviewSession?.();
    const serverId = String(session?.registration?.serverId || "instance:free:eu-central:public-1");
    const currentMarket = session?.marketByServerId?.[serverId]
      || session?.market
      || marketState?.createDefaultMarketPriceState?.(serverId);
    if (!currentMarket || typeof bridge?.updateStoredPreviewSession !== "function") return;
    const frozenMarket = {
      ...currentMarket,
      serverId,
      nextRefreshAt: "9999-12-31T23:59:59.999Z"
    };
    bridge.updateStoredPreviewSession((currentSession) => ({
      ...currentSession,
      market: frozenMarket,
      marketByServerId: {
        ...(currentSession.marketByServerId || {}),
        [serverId]: frozenMarket
      }
    }));
  });
  const milestone = page.locator("[data-server-milestone-modal]");
  if (await milestone.isVisible()) {
    await milestone.locator("[data-server-milestone-confirm]").click();
    await expect(milestone).toBeHidden();
  }
}

export async function syncParityLocalDemoMarketFromHosted(localPage, hostedPage) {
  const resources = await hostedPage.evaluate(() => {
    const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
      || window.empireStreetsGameplaySliceReadModel
      || null;
    return (readModel?.market?.resources || []).map((resource) => ({
      id: String(resource?.id || ""),
      normalMarket: {
        price: Number(resource?.normalMarket?.price || 0),
        stock: Number(resource?.normalMarket?.stock || 0)
      },
      trend: String(resource?.trend || "flat")
    })).filter((resource) => resource.id);
  });
  await localPage.evaluate((hostedResources) => {
    const bridge = window.empireLocalDemoGameplayBridge;
    const marketState = window.EmpireMarketState;
    const session = bridge?.getStoredPreviewSession?.();
    const serverId = String(session?.registration?.serverId || "instance:free:eu-central:public-1");
    const currentMarket = session?.marketByServerId?.[serverId]
      || session?.market
      || marketState?.createDefaultMarketPriceState?.(serverId);
    if (!currentMarket || typeof bridge?.updateStoredPreviewSession !== "function") return;
    const aliases = {
      biomass: "biomass",
      chemicals: "chemicals",
      metalParts: "metal-parts",
      techCore: "tech-core"
    };
    const items = { ...(currentMarket.items || {}) };
    const stock = { ...(currentMarket.stock || {}) };
    for (const resource of hostedResources) {
      const itemId = aliases[resource.id] || resource.id;
      for (const tabId of ["market", "black-market"]) {
        const key = `${tabId}:${itemId}`;
        const currentPrice = Math.max(1, Number(items[key]?.price || resource.normalMarket.price || 1));
        const previousPrice = resource.trend === "up" || resource.trend === "spike"
          ? Math.max(0, currentPrice - 1)
          : resource.trend === "down"
            ? currentPrice + 1
            : currentPrice;
        items[key] = { ...items[key], price: currentPrice, previousPrice };
        if (Number.isFinite(resource.normalMarket.stock)) {
          stock[key] = Math.max(0, Math.floor(resource.normalMarket.stock));
        }
      }
    }
    const frozenMarket = {
      ...currentMarket,
      serverId,
      items,
      stock,
      nextRefreshAt: "9999-12-31T23:59:59.999Z"
    };
    bridge.updateStoredPreviewSession((currentSession) => ({
      ...currentSession,
      market: frozenMarket,
      marketByServerId: {
        ...(currentSession.marketByServerId || {}),
        [serverId]: frozenMarket
      }
    }));
  }, resources);
  return resources;
}

export async function openDistrictById(page, districtId) {
  const canonicalDistrictId = String(districtId).startsWith("district:")
    ? String(districtId)
    : `district:${districtId}`;
  const numericDistrictId = Number(canonicalDistrictId.replace(/^district:/u, ""));
  const result = await page.evaluate(async ({ canonicalId, numericId }) => {
    const executionMode = document.documentElement.dataset.runtimeMode;
    const districtState = window.empireStreetsDistrictState;
    const opened = typeof districtState?.openDistrictAsync === "function"
      ? await districtState.openDistrictAsync(numericId)
      : districtState?.openDistrict?.(numericId)
        || window.EmpireRuntime?.selectDistrict?.(numericId)
        || false;
    const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.();
    return {
      opened: Boolean(opened),
      selected: executionMode !== "server-authoritative"
        || readModel?.district?.districtId === canonicalId
    };
  }, {
    canonicalId: canonicalDistrictId,
    numericId: numericDistrictId
  });
  expect(result.opened, `District ${districtId} should open through the shared map controller`).toBe(true);
  expect(
    result.selected,
    `Server must return the requested district ${canonicalDistrictId}`
  ).toBe(true);
  const shell = page.locator(`${paritySurfaces.district.shell}:visible`).last();
  await expect(shell).toBeVisible();
  await expect(shell.locator("[data-district-popup-card]"))
    .not.toHaveAttribute("data-server-loading", /^(?:true|error)$/u);
  await expect(shell.locator("[data-district-popup-server-loading]")).toBeHidden();
  await expect(shell.locator(".district-popup-body")).toBeVisible();
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
  const presentationDefinition = resolveBuildingPresentationDefinition(normalized);
  const canonicalBuildingTypeId = presentationDefinition?.buildingTypeId || normalized;
  const canonicalBaseName = presentationDefinition?.baseName || "";
  const expectedLabels = Array.from(new Set([
    ...(aliases[normalized] || [normalized]),
    canonicalBaseName.toLocaleLowerCase("cs")
  ].filter(Boolean)));
  const resolveVisiblePointerTarget = () => page.evaluate(({
    buildingTypeId,
    labels,
    shellSelector
  }) => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement) || !element.isConnected || element.hidden) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && style.pointerEvents !== "none"
        && Number.parseFloat(style.opacity || "1") > 0
        && rect.width > 0
        && rect.height > 0;
    };
    const shell = Array.from(document.querySelectorAll(shellSelector))
      .filter(isVisible)
      .at(-1);
    if (!shell) return null;
    const visibleButtons = Array.from(
      shell.querySelectorAll("[data-district-building-name]")
    ).filter(isVisible);
    const button = visibleButtons.find((candidate) => (
      String(candidate.dataset.districtBuildingType || "").toLocaleLowerCase("cs") === buildingTypeId
    )) || visibleButtons.find((candidate) => {
      const type = String(candidate.dataset.districtBuildingType || "").toLocaleLowerCase("cs");
      const text = String(candidate.textContent || "").toLocaleLowerCase("cs");
      return labels.some((label) => type === label || text.includes(label));
    });
    if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return null;
    button.scrollIntoView({ block: "nearest", inline: "nearest" });
    const rect = button.getBoundingClientRect();
    const point = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    if (
      point.x < 0
      || point.y < 0
      || point.x >= document.documentElement.clientWidth
      || point.y >= document.documentElement.clientHeight
    ) {
      return null;
    }
    const pointedButton = document.elementFromPoint(point.x, point.y)
      ?.closest?.("[data-district-building-name]");
    if (pointedButton !== button) return null;
    return point;
  }, {
    buildingTypeId: canonicalBuildingTypeId,
    labels: expectedLabels,
    shellSelector: paritySurfaces.district.shell
  });
  await expect.poll(async () => Boolean(await resolveVisiblePointerTarget()), {
    message: `Building ${buildingTypeOrLabel} should be rendered as an interactive district chip`,
    timeout: 30_000
  }).toBe(true);
  const clickDeadline = Date.now() + 5_000;
  let lastClickError = null;
  const openedBuildingSurface = page.locator([
    paritySurfaces.buildingDetail.shell,
    paritySurfaces.pharmacy.shell,
    paritySurfaces.drugLab.shell,
    paritySurfaces.factory.shell,
    paritySurfaces.armory.shell
  ].map((selector) => `${selector}:visible`).join(",")).first();
  do {
    try {
      const point = await resolveVisiblePointerTarget();
      if (!point) throw new Error(`Building ${buildingTypeOrLabel} chip has no visible pointer target.`);
      const pointedBuildingType = await page.evaluate(({ x, y }) => (
        document.elementFromPoint(x, y)
          ?.closest?.("[data-district-building-name]")
          ?.getAttribute?.("data-district-building-type")
          || ""
      ), point);
      if (pointedBuildingType !== canonicalBuildingTypeId) {
        throw new Error(`Building ${buildingTypeOrLabel} chip moved before pointer dispatch.`);
      }
      await page.mouse.click(point.x, point.y);
      await expect(openedBuildingSurface).toBeVisible({ timeout: 1_000 });
      return;
    } catch (error) {
      if (await openedBuildingSurface.isVisible().catch(() => false)) return;
      lastClickError = error;
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }
  } while (Date.now() < clickDeadline);
  const productionHandoffStatus = await page.locator("#game-root").getAttribute(
    "data-production-popup-open-status"
  ).catch(() => null);
  if (productionHandoffStatus) {
    throw new Error(`${lastClickError?.message || lastClickError} Production handoff: ${productionHandoffStatus}.`);
  }
  throw lastClickError;
}

export async function readVisibleDistrictBuildingTypeIds(page) {
  const districtShell = page.locator(`${paritySurfaces.district.shell}:visible`).last();
  await expect(districtShell).toBeVisible();
  return districtShell.locator("[data-district-building-name]").evaluateAll((chips) => chips
    .map((chip) => String(chip.dataset.districtBuildingType || "").trim())
    .filter(Boolean)
    .sort());
}

export async function syncParityLocalDemoDistrictBuildingsFromHosted(localPage, hostedPage, {
  districtId,
  expectedBuildingTypeIds = []
} = {}) {
  const canonicalDistrictId = String(districtId || "").trim();
  const numericDistrictId = Number(canonicalDistrictId.replace(/^district:/u, ""));
  const canonicalExpectedTypes = Array.from(new Set(expectedBuildingTypeIds
    .map((buildingTypeId) => String(buildingTypeId || "").trim())
    .filter(Boolean))).sort();
  expect(Number.isInteger(numericDistrictId) && numericDistrictId > 0, "Parity district id must be exact")
    .toBe(true);
  expect(canonicalExpectedTypes.length, "Parity building registry must be explicit")
    .toBeGreaterThan(0);

  const hostedShell = hostedPage.locator(
    `${paritySurfaces.district.shell}[data-district-id="${numericDistrictId}"]:visible`
  ).last();
  await expect(hostedShell).toBeVisible();
  await expect.poll(() => hostedShell.evaluate((shell) => {
    const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()
      || window.empireStreetsGameplaySliceReadModel
      || null;
    const authoritativeTypes = (readModel?.district?.buildings || [])
      .map((building) => String(building?.buildingTypeId || "").trim())
      .filter(Boolean)
      .sort();
    const renderedTypes = Array.from(
      shell.querySelectorAll("[data-district-building-name][data-district-building-type]")
    ).map((chip) => String(chip.dataset.districtBuildingType || "").trim())
      .filter(Boolean)
      .sort();
    return {
      authoritativeTypes,
      districtId: String(readModel?.district?.districtId || ""),
      renderedTypes
    };
  }), {
    message: `Hosted ${canonicalDistrictId} must finish rendering its exact authoritative building registry`,
    timeout: 30_000
  }).toEqual({
    authoritativeTypes: canonicalExpectedTypes,
    districtId: canonicalDistrictId,
    renderedTypes: canonicalExpectedTypes
  });
  const fixture = await hostedShell.evaluate((shell) => {
    const list = shell.querySelector("[data-district-popup-buildings-list]");
    const meta = shell.querySelector("[data-district-popup-buildings-meta]");
    const chips = Array.from(list?.querySelectorAll("[data-district-building-name]") || []);
    return {
      buildings: chips.map((chip) => ({
        buildingId: String(chip.dataset.districtBuildingId || ""),
        buildingTypeId: String(chip.dataset.districtBuildingType || ""),
        displayName: String(chip.dataset.districtBuildingDisplayName || ""),
        kindLabel: String(chip.dataset.districtBuildingKind || ""),
        label: String(chip.querySelector(".district-popup-buildings__chip-label")?.textContent || "").trim(),
        name: String(chip.dataset.districtBuildingName || "")
      })),
      interactive: chips.every((chip) => chip instanceof HTMLButtonElement && !chip.disabled),
      metaText: String(meta?.textContent || ""),
      trap: (() => {
        const trap = list?.querySelector("[data-district-building-trap]");
        if (!(trap instanceof HTMLElement)) return null;
        return {
          visible: true,
          label: String(trap.querySelector(".district-popup-buildings__trap-label")?.textContent || ""),
          meta: String(trap.querySelector(".district-popup-buildings__trap-meta")?.textContent || "")
        };
      })()
    };
  });
  expect(fixture.buildings.length, "Hosted starter district must expose authoritative buildings")
    .toBeGreaterThan(0);

  await localPage.evaluate(async ({ authoritativeFixture, targetDistrictId }) => {
    if (document.documentElement.dataset.runtimeMode !== "local-demo") {
      throw new Error("District building parity fixtures may only target explicit local-demo.");
    }
    const { renderDistrictBuildingList } = await import("/page-assets/js/app/ui/districtPanel.js");
    window.__empireUiParityDistrictBuildingSync?.disconnect?.();
    let applyingFixture = false;
    const expectedTypes = authoritativeFixture.buildings
      .map((building) => String(building?.buildingTypeId || "").trim())
      .filter(Boolean)
      .sort();
    const findVisibleCard = () => Array.from(document.querySelectorAll(
      `[data-district-popup][data-district-id="${targetDistrictId}"] [data-district-popup-card]`
    ))
      .filter((element) => element instanceof HTMLElement && element.offsetParent !== null)
      .at(-1);
    const applyFixture = () => {
      if (applyingFixture) return true;
      const shell = findVisibleCard();
      if (!(shell instanceof HTMLElement)) return false;
      const renderedTypes = Array.from(
        shell.querySelectorAll("[data-district-building-name][data-district-building-type]")
      ).map((chip) => String(chip.dataset.districtBuildingType || "").trim())
        .filter(Boolean)
        .sort();
      if (JSON.stringify(renderedTypes) === JSON.stringify(expectedTypes)) return true;
      applyingFixture = true;
      try {
        return renderDistrictBuildingList({
          section: shell.querySelector("[data-district-popup-buildings]"),
          meta: shell.querySelector("[data-district-popup-buildings-meta]"),
          list: shell.querySelector("[data-district-popup-buildings-list]")
        }, {
          ...authoritativeFixture,
          trap: authoritativeFixture.trap || { visible: false }
        });
      } finally {
        applyingFixture = false;
      }
    };
    if (!applyFixture()) {
      throw new Error("Canonical district building renderer rejected the parity fixture.");
    }
    const observer = new MutationObserver(() => {
      queueMicrotask(applyFixture);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const handleDistrictOpened = () => queueMicrotask(applyFixture);
    document.addEventListener("empire:district-opened", handleDistrictOpened);
    window.__empireUiParityDistrictBuildingSync = {
      disconnect() {
        observer.disconnect();
        document.removeEventListener("empire:district-opened", handleDistrictOpened);
      }
    };
  }, { authoritativeFixture: fixture, targetDistrictId: String(numericDistrictId) });

  const expectedBuildingTypes = fixture.buildings
    .map((building) => building.buildingTypeId)
    .filter(Boolean)
    .sort();
  await expect.poll(() => readVisibleDistrictBuildingTypeIds(localPage), {
    message: "Local-demo district must render the same authoritative starter building set"
  }).toEqual(expectedBuildingTypes);
  return fixture;
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
  const runtimeMode = await page.locator("html").getAttribute("data-runtime-mode");
  if (runtimeMode === "server-authoritative") {
    await expect(
      page.locator(".closed-alpha-connection"),
      "City Events parity requires a recovered authoritative connection"
    ).toBeHidden({ timeout: 35_000 });
  }
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

async function settleFiniteAnimations(locator) {
  await locator.evaluate(async (element) => {
    for (const animation of element.getAnimations({ subtree: true })) {
      const endTime = Number(animation.effect?.getComputedTiming?.().endTime);
      if (
        Number.isFinite(endTime)
        && endTime >= 0
        && endTime <= 5_000
        && animation.playState !== "finished"
      ) {
        try {
          animation.finish();
        } catch {}
      }
    }
    await new Promise((resolve) => requestAnimationFrame(() => (
      requestAnimationFrame(resolve)
    )));
  });
}

export async function settleParityPage(page, locator = page.locator("body")) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.mouse.move(1, 1);
  await settleFiniteAnimations(locator);
}

export async function readViewportParityIgnoreRegions(page, ignoreSelector) {
  if (!ignoreSelector) return [];
  if (typeof ignoreSelector !== "string") {
    throw new TypeError("Parity screenshot ignore selector must be a string");
  }
  const regions = await page.evaluate((selector) => {
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
    const scale = window.devicePixelRatio || 1;
    return Array.from(document.querySelectorAll(selector))
      .filter(isVisible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          height: rect.height * scale,
          width: rect.width * scale,
          x: rect.left * scale,
          y: rect.top * scale
        };
      });
  }, ignoreSelector);
  return expandParityRasterIgnoreRegions(regions);
}

export async function readViewportRoundedCompositeIgnoreRegions(page, selector) {
  if (!selector) return [];
  if (typeof selector !== "string") {
    throw new TypeError("Parity rounded composite selector must be a string");
  }
  const roundedBoxes = await page.evaluate((roundedSelector) => {
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
    const resolveRadius = (value, widthBasis, heightBasis, scale) => {
      const [horizontal = "0", vertical = horizontal] = String(value || "0")
        .trim()
        .split(/\s+/u);
      const resolveLength = (token, basis) => {
        const numericValue = Number.parseFloat(token);
        if (!Number.isFinite(numericValue)) return 0;
        return token.endsWith("%") ? (numericValue / 100) * basis : numericValue;
      };
      return {
        x: resolveLength(horizontal, widthBasis) * scale,
        y: resolveLength(vertical, heightBasis) * scale
      };
    };
    const scale = window.devicePixelRatio || 1;
    return Array.from(document.querySelectorAll(roundedSelector))
      .filter(isVisible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          height: rect.height * scale,
          radii: {
            bottomLeft: resolveRadius(style.borderBottomLeftRadius, rect.width, rect.height, scale),
            bottomRight: resolveRadius(style.borderBottomRightRadius, rect.width, rect.height, scale),
            topLeft: resolveRadius(style.borderTopLeftRadius, rect.width, rect.height, scale),
            topRight: resolveRadius(style.borderTopRightRadius, rect.width, rect.height, scale)
          },
          width: rect.width * scale,
          x: rect.left * scale,
          y: rect.top * scale
        };
      });
  }, selector);
  return roundedBoxes.flatMap(({ x, y, ...roundedBox }) => (
    createRoundedCornerCompositeIgnoreRegions(roundedBox).map((region) => ({
      ...region,
      x: region.x + x,
      y: region.y + y
    }))
  ));
}

export async function readElementRelativeParityIgnoreRegions(
  target,
  ignoreSelector,
  roundedCompositeSelector = ""
) {
  if (typeof ignoreSelector !== "string" || typeof roundedCompositeSelector !== "string") {
    throw new TypeError("Parity screenshot selectors must be strings");
  }
  const capture = await target.evaluate((targetElement, selectors) => {
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
    const resolveRadius = (value, widthBasis, heightBasis, scale) => {
      const [horizontal = "0", vertical = horizontal] = String(value || "0")
        .trim()
        .split(/\s+/u);
      const resolveLength = (token, basis) => {
        const numericValue = Number.parseFloat(token);
        if (!Number.isFinite(numericValue)) return 0;
        return token.endsWith("%") ? (numericValue / 100) * basis : numericValue;
      };
      return {
        x: resolveLength(horizontal, widthBasis) * scale,
        y: resolveLength(vertical, heightBasis) * scale
      };
    };
    const scale = window.devicePixelRatio || 1;
    const targetRect = targetElement.getBoundingClientRect();
    const resolveRasterBounds = (rect) => {
      const left = Math.floor(rect.left * scale);
      const top = Math.floor(rect.top * scale);
      const right = Math.ceil(rect.right * scale);
      const bottom = Math.ceil(rect.bottom * scale);
      return {
        height: Math.max(0, bottom - top),
        left,
        top,
        width: Math.max(0, right - left)
      };
    };
    const targetRasterBounds = resolveRasterBounds(targetRect);
    const targetStyle = getComputedStyle(targetElement);
    const dynamicRegions = Array.from(
      selectors.ignore ? targetElement.ownerDocument.querySelectorAll(selectors.ignore) : []
    )
      .filter(isVisible)
      .map((element) => element.getBoundingClientRect())
      .map((rect) => ({
        bottom: Math.min(rect.bottom, targetRect.bottom),
        left: Math.max(rect.left, targetRect.left),
        right: Math.min(rect.right, targetRect.right),
        top: Math.max(rect.top, targetRect.top)
      }))
      .filter((rect) => rect.right > rect.left && rect.bottom > rect.top)
      .map((rect) => {
        return {
          height: (rect.bottom - rect.top) * scale,
          width: (rect.right - rect.left) * scale,
          x: (rect.left - targetRect.left) * scale,
          y: (rect.top - targetRect.top) * scale
        };
      });
    const roundedBoxes = Array.from(
      selectors.rounded ? targetElement.querySelectorAll(selectors.rounded) : []
    )
      .filter(isVisible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const rasterBounds = resolveRasterBounds(rect);
        const style = getComputedStyle(element);
        return {
          height: rasterBounds.height,
          radii: {
            bottomLeft: resolveRadius(style.borderBottomLeftRadius, rect.width, rect.height, scale),
            bottomRight: resolveRadius(style.borderBottomRightRadius, rect.width, rect.height, scale),
            topLeft: resolveRadius(style.borderTopLeftRadius, rect.width, rect.height, scale),
            topRight: resolveRadius(style.borderTopRightRadius, rect.width, rect.height, scale)
          },
          width: rasterBounds.width,
          x: rasterBounds.left - targetRasterBounds.left,
          y: rasterBounds.top - targetRasterBounds.top
        };
      });
    return {
      dynamicRegions,
      roundedBoxes,
      roundedBox: {
        height: targetRasterBounds.height,
        radii: {
          bottomLeft: resolveRadius(
            targetStyle.borderBottomLeftRadius,
            targetRect.width,
            targetRect.height,
            scale
          ),
          bottomRight: resolveRadius(
            targetStyle.borderBottomRightRadius,
            targetRect.width,
            targetRect.height,
            scale
          ),
          topLeft: resolveRadius(
            targetStyle.borderTopLeftRadius,
            targetRect.width,
            targetRect.height,
            scale
          ),
          topRight: resolveRadius(
            targetStyle.borderTopRightRadius,
            targetRect.width,
            targetRect.height,
            scale
          )
        },
        width: targetRasterBounds.width
      }
    };
  }, {
    ignore: ignoreSelector,
    rounded: roundedCompositeSelector
  });
  if (Array.isArray(capture)) {
    return expandParityRasterIgnoreRegions(capture);
  }
  return [
    ...expandParityRasterIgnoreRegions(capture.dynamicRegions || []),
    ...createRoundedCornerCompositeIgnoreRegions(capture.roundedBox || {}),
    ...(capture.roundedBoxes || []).flatMap(({ x, y, ...roundedBox }) => (
      createRoundedCornerCompositeIgnoreRegions(roundedBox).map((region) => ({
        ...region,
        x: region.x + x,
        y: region.y + y
      }))
    ))
  ];
}

export async function captureIsolatedParityScreenshot(page, {
  ignoreSelector = "",
  path: screenshotPath,
  stableBackdropColor = "",
  roundedCompositeSelector = "",
  stableRasterSelector = "",
  stableBackdropShellSelector = "",
  target
}) {
  await settleParityPage(page, target);
  const ignoreRegions = await readElementRelativeParityIgnoreRegions(
    target,
    ignoreSelector,
    roundedCompositeSelector
  );
  let stableBackdropState = null;
  if (stableBackdropShellSelector) {
    stableBackdropState = await target.evaluate((targetElement, config) => {
      const shell = targetElement.closest(config.shellSelector);
      if (!(shell instanceof HTMLElement)) {
        throw new Error(`Parity screenshot shell not found: ${config.shellSelector}`);
      }
      const token = `parity-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const previousBackgroundColor = shell.style.getPropertyValue("background-color");
      const previousBackgroundColorPriority = shell.style.getPropertyPriority("background-color");
      if (config.backgroundColor) {
        shell.style.setProperty("background-color", config.backgroundColor, "important");
      }
      let branch = shell;
      while (branch.parentElement) {
        for (const sibling of branch.parentElement.children) {
          if (sibling !== branch) {
            sibling.setAttribute("data-parity-capture-hidden", token);
            sibling.setAttribute(
              "data-parity-capture-previous-opacity",
              sibling.style.getPropertyValue("opacity")
            );
            sibling.setAttribute(
              "data-parity-capture-previous-opacity-priority",
              sibling.style.getPropertyPriority("opacity")
            );
            sibling.setAttribute(
              "data-parity-capture-previous-pointer-events",
              sibling.style.getPropertyValue("pointer-events")
            );
            sibling.setAttribute(
              "data-parity-capture-previous-pointer-events-priority",
              sibling.style.getPropertyPriority("pointer-events")
            );
            sibling.style.setProperty("opacity", "0", "important");
            sibling.style.setProperty("pointer-events", "none", "important");
          }
        }
        branch = branch.parentElement;
      }
      return {
        backgroundColorApplied: Boolean(config.backgroundColor),
        previousBackgroundColor,
        previousBackgroundColorPriority,
        token
      };
    }, {
      backgroundColor: stableBackdropColor,
      shellSelector: stableBackdropShellSelector
    });
  }
  let stableRasterState = null;
  try {
    if (stableRasterSelector) {
      stableRasterState = await target.evaluate((targetElement, selector) => {
        const token = `parity-raster-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const elements = [
          ...(targetElement.matches(selector) ? [targetElement] : []),
          ...targetElement.querySelectorAll(selector)
        ];
        const entries = elements.map((element) => ({
          filter: element.style.getPropertyValue("filter"),
          filterPriority: element.style.getPropertyPriority("filter"),
          transform: element.style.getPropertyValue("transform"),
          transformPriority: element.style.getPropertyPriority("transform")
        }));
        elements.forEach((element) => {
          element.setAttribute("data-parity-capture-stable-raster", token);
          element.style.setProperty("filter", "none", "important");
          element.style.setProperty("transform", "none", "important");
        });
        return { entries, token };
      }, stableRasterSelector);
    }
    if (stableBackdropState || stableRasterState) {
      await settleFiniteAnimations(target);
    }
    const screenshot = await target.screenshot({
      path: screenshotPath,
      animations: "disabled",
      caret: "hide",
      scale: "device"
    });
    return { ignoreRegions, screenshot };
  } finally {
    try {
      if (stableRasterState) {
        await target.evaluate((targetElement, state) => {
          const restoreProperty = (element, propertyName, value, priority) => {
            if (value) element.style.setProperty(propertyName, value, priority);
            else element.style.removeProperty(propertyName);
          };
          const selector = `[data-parity-capture-stable-raster="${CSS.escape(state.token)}"]`;
          const elements = [
            ...(targetElement.matches(selector) ? [targetElement] : []),
            ...targetElement.querySelectorAll(selector)
          ];
          elements.forEach((element, index) => {
            const entry = state.entries[index];
            if (entry) {
              restoreProperty(element, "filter", entry.filter, entry.filterPriority);
              restoreProperty(element, "transform", entry.transform, entry.transformPriority);
            }
            element.removeAttribute("data-parity-capture-stable-raster");
          });
        }, stableRasterState);
      }
    } finally {
      if (stableBackdropShellSelector) {
        await target.evaluate((targetElement, config) => {
          const token = CSS.escape(config.state.token);
          const shell = targetElement.closest(config.shellSelector);
          if (config.state.backgroundColorApplied && shell instanceof HTMLElement) {
            if (config.state.previousBackgroundColor) {
              shell.style.setProperty(
                "background-color",
                config.state.previousBackgroundColor,
                config.state.previousBackgroundColorPriority
              );
            } else {
              shell.style.removeProperty("background-color");
            }
          }
          document
            .querySelectorAll(`[data-parity-capture-hidden="${token}"]`)
            .forEach((element) => {
              const restoreProperty = (propertyName, valueAttribute, priorityAttribute) => {
                const value = element.getAttribute(valueAttribute) || "";
                const priority = element.getAttribute(priorityAttribute) || "";
                if (value) element.style.setProperty(propertyName, value, priority);
                else element.style.removeProperty(propertyName);
                element.removeAttribute(valueAttribute);
                element.removeAttribute(priorityAttribute);
              };
              restoreProperty(
                "opacity",
                "data-parity-capture-previous-opacity",
                "data-parity-capture-previous-opacity-priority"
              );
              restoreProperty(
                "pointer-events",
                "data-parity-capture-previous-pointer-events",
                "data-parity-capture-previous-pointer-events-priority"
              );
              element.removeAttribute("data-parity-capture-hidden");
            });
        }, {
          shellSelector: stableBackdropShellSelector,
          state: stableBackdropState
        });
      }
    }
  }
}

export async function captureViewportParityScreenshot(page, {
  ignoreSelector = "",
  roundedCompositeSelector = "",
  path: screenshotPath
}) {
  await settleParityPage(page);
  const ignoreRegions = [
    ...await readViewportParityIgnoreRegions(page, ignoreSelector),
    ...await readViewportRoundedCompositeIgnoreRegions(page, roundedCompositeSelector)
  ];
  const screenshot = await page.screenshot({
    path: screenshotPath,
    animations: "disabled",
    caret: "hide",
    fullPage: false,
    scale: "device"
  });
  return { ignoreRegions, screenshot };
}

export async function readParitySurfaceMetadata(page, surfaceName) {
  const definition = paritySurfaces[surfaceName];
  const target = page.locator(`${definition.selector}:visible`).last();
  await expect(target).toBeVisible();
  const shell = page.locator(`${definition.shell}:visible`).last();
  await settleFiniteAnimations(shell);
  return target.evaluate((targetElement, { dynamicContentSelector, shellSelector }) => {
    const shell = targetElement.closest(shellSelector) || targetElement;
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
        .filter((element) => !element.closest(dynamicContentSelector))
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
  }, {
    dynamicContentSelector: parityDynamicDistrictIdentitySelector,
    shellSelector: definition.shell
  });
}

export async function captureParitySurface(page, {
  mode,
  phase = "after",
  viewport,
  surfaceName
}) {
  const definition = paritySurfaces[surfaceName];
  const target = page.locator(`${definition.selector}:visible`).last();
  await expect(target).toBeVisible();
  const directory = artifactDirectory(phase, mode, viewport.name);
  await fs.mkdir(directory, { recursive: true });
  const metadata = await readParitySurfaceMetadata(page, surfaceName);
  const presentation = ["buildingDetail", "restaurant", "arcade"].includes(surfaceName)
    ? await getBuildingPresentationSignature(page, surfaceName)
    : null;
  const basePath = path.join(directory, surfaceName);
  const dynamicContentSelector = [
    "[data-production-progress]",
    "[data-production-countdown]",
    "[data-countdown]",
    "[data-city-events-countdown]",
    buildingPopulationBufferDynamicValueSelector,
    "time"
  ].join(",");
  const screenshotTarget = ["buildingDetail", "restaurant", "arcade"].includes(surfaceName)
    ? target.locator(".district-building-detail-card").first()
    : target;
  const screenshotCapture = await captureIsolatedParityScreenshot(page, {
    ignoreSelector: dynamicContentSelector,
    path: `${basePath}.png`,
    target: screenshotTarget
  });
  await fs.writeFile(`${basePath}.html`, metadata.html, "utf8");
  await fs.writeFile(`${basePath}.json`, `${JSON.stringify({
    ...metadata,
    presentation,
    screenshotIgnoreRegions: screenshotCapture.ignoreRegions,
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

export async function exerciseParitySurfaceScroll(page, surfaceName) {
  const definition = paritySurfaces[surfaceName];
  const target = page.locator(`${definition.selector}:visible`).last();
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
    const candidates = [targetElement, ...targetElement.querySelectorAll("*")]
      .filter(isVisible)
      .map((element) => ({
        element,
        overflowY: getComputedStyle(element).overflowY
      }))
      .filter(({ element, overflowY }) => (
        element.scrollHeight > element.clientHeight + 1
        && ["auto", "overlay", "scroll"].includes(overflowY)
      ))
      .sort((left, right) => (
        (right.element.scrollHeight - right.element.clientHeight)
          - (left.element.scrollHeight - left.element.clientHeight)
      ));
    const candidate = candidates[0];
    const region = candidate?.element;
    if (!(region instanceof HTMLElement)) {
      return {
        available: false,
        maxScrollTop: 0,
        moved: false,
        movementPx: 0,
        overflowY: null,
        reachedBottom: false,
        resetTop: true
      };
    }
    const settle = () => new Promise((resolve) => requestAnimationFrame(() => (
      requestAnimationFrame(() => resolve())
    )));
    region.scrollTo({ behavior: "instant", top: 0 });
    await settle();
    const topScrollTop = region.scrollTop;
    let maxScrollTop = Math.max(0, region.scrollHeight - region.clientHeight);
    let reachedBottom = false;
    for (let attempt = 0; attempt < 3 && !reachedBottom; attempt += 1) {
      region.scrollTo({ behavior: "instant", top: region.scrollHeight });
      await settle();
      maxScrollTop = Math.max(0, region.scrollHeight - region.clientHeight);
      reachedBottom = Math.abs(region.scrollTop - maxScrollTop) <= 1;
    }
    const bottomScrollTop = region.scrollTop;
    const movementPx = Math.abs(bottomScrollTop - topScrollTop);
    const moved = movementPx > 1;
    let resetTop = false;
    for (let attempt = 0; attempt < 3 && !resetTop; attempt += 1) {
      region.scrollTo({ behavior: "instant", top: 0 });
      await settle();
      resetTop = region.scrollTop === 0;
    }
    return {
      available: true,
      bottomScrollTop,
      maxScrollTop,
      moved,
      movementPx,
      overflowY: candidate.overflowY,
      reachedBottom: reachedBottom && moved,
      resetTop
    };
  });
}

export function normalizeBuildingPresentationDynamicValues(signature = {}) {
  const normalizeText = (value) => String(value || "").replace(/\s+/gu, " ").trim();
  const normalizeEntry = (entry) => {
    if (typeof entry === "string") return entry;
    if (entry?.dynamicValue !== BUILDING_POPULATION_BUFFER_DYNAMIC_VALUE) {
      return normalizeText(entry?.text);
    }
    const label = normalizeText(entry?.label);
    const staticPrefix = normalizeText(entry?.staticPrefix);
    const staticCapacity = String(entry?.staticCapacity ?? "").trim();
    return [
      label,
      staticPrefix,
      `<dynamic:${BUILDING_POPULATION_BUFFER_DYNAMIC_VALUE}>`,
      staticCapacity ? `/${staticCapacity}` : ""
    ].filter(Boolean).join("");
  };
  const mechanics = Array.isArray(signature.mechanics)
    ? signature.mechanics.map(normalizeEntry)
    : signature.mechanics;
  const effects = Array.isArray(signature.effects)
    ? signature.effects.map(normalizeEntry)
    : signature.effects;
  const visibleCopy = Array.isArray(signature.visibleCopy)
    ? signature.visibleCopy
      .filter((entry) => (
        typeof entry === "string"
        || entry?.dynamicValue !== BUILDING_POPULATION_BUFFER_DYNAMIC_VALUE
      ))
      .map((entry) => normalizeText(typeof entry === "string" ? entry : entry?.text))
      .filter(Boolean)
    : signature.visibleCopy;
  return {
    ...signature,
    effects,
    mechanics,
    visibleCopy
  };
}

export async function getBuildingPresentationSignature(page, surfaceName) {
  const definition = paritySurfaces[surfaceName];
  const target = page.locator(`${definition.selector}:visible`).last();
  await expect(target).toBeVisible();
  await settleFiniteAnimations(page.locator(`${definition.shell}:visible`).last());
  const signature = await target.evaluate(async (targetElement, config) => {
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
    const collectActionElement = visibleElements(
      "[data-district-building-detail-collect]"
    ).at(-1);
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
    const actionLayout = {
      display: actionStyle?.display || "",
      gridTemplateColumns: actionStyle?.gridTemplateColumns || ""
    };
    const backgroundElement = targetElement.querySelector(".district-building-detail-card")
      || targetElement;
    const backgroundStyle = getComputedStyle(backgroundElement);
    const backgroundBeforeStyle = getComputedStyle(backgroundElement, "::before");
    const backgroundAfterStyle = getComputedStyle(backgroundElement, "::after");
    const customBackgroundImage = backgroundStyle
      .getPropertyValue("--building-detail-background-image")
      .trim();
    const extractBrowserCssUrlValues = (value) => Array.from(
      String(value || "").matchAll(new RegExp(config.cssUrlPatternSource, "gu"))
    ).map((match) => String(match[2] ?? match[3] ?? "").trim()).filter(Boolean);
    const backgroundImageUrls = [
      customBackgroundImage,
      backgroundStyle.backgroundImage,
      backgroundBeforeStyle.backgroundImage,
      backgroundAfterStyle.backgroundImage
    ].flatMap(extractBrowserCssUrlValues);
    const backgroundAssetUrl = backgroundImageUrls.at(-1) || "";
    const backgroundAssetLoaded = backgroundAssetUrl
      ? await new Promise((resolve) => {
          const image = new Image();
          image.addEventListener("load", () => resolve(image.naturalWidth > 0), { once: true });
          image.addEventListener("error", () => resolve(false), { once: true });
          image.src = backgroundAssetUrl;
          if (image.complete) resolve(image.naturalWidth > 0);
        })
      : null;
    const dynamicCopySelector = [
      "[data-production-progress]",
      "[data-production-countdown]",
      "[data-countdown]",
      "time"
    ].join(",");
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
      ).map((element) => {
        const valueElement = element.querySelector(config.dynamicValueSelector);
        return {
          dynamicValue: valueElement?.dataset.buildingDynamicValue || "",
          label: normalizeText(element.querySelector(":scope > span")?.textContent),
          staticCapacity: element.querySelector("[data-building-population-capacity]")
            ?.dataset.buildingPopulationCapacity || "",
          text: normalizeText(element.textContent)
        };
      }),
      effects: visibleElements(
        "[data-district-building-detail-effects-section] .district-building-detail-effect-cell"
      ).map((element) => {
        const valueElement = element.querySelector(config.dynamicValueSelector);
        return {
          dynamicValue: valueElement?.dataset.buildingDynamicValue || "",
          staticPrefix: Array.from(element.querySelectorAll("[data-building-static-value]"))
            .map((item) => normalizeText(item.textContent))
            .join(" "),
          text: normalizeText(element.textContent)
        };
      }),
      visibleCopy: visibleElements("*")
        .filter((element) => element.children.length === 0)
        .filter((element) => !element.closest(dynamicCopySelector))
        .map((element) => ({
          dynamicValue: element.dataset.buildingDynamicValue || "",
          text: normalizeText(element.textContent)
        }))
        .filter((entry) => entry.text),
      actions: actionRows.map((element) => ({
        actionId: element.dataset.districtBuildingDetailActionId || "",
        disabled: element instanceof HTMLButtonElement ? element.disabled : false,
        disabledReason: normalizeText(element.getAttribute("title")),
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
      collectAction: collectActionElement instanceof HTMLButtonElement
        ? {
            disabled: collectActionElement.disabled,
            disabledReason: normalizeText(collectActionElement.getAttribute("title"))
          }
        : null,
      actionGrid: {
        display: actionLayout.display,
        gridTemplateColumns: actionLayout.gridTemplateColumns,
        columnCount: new Set(actionRects.map((rect) => rect.left)).size,
        rowCount: new Set(actionRects.map((rect) => rect.top)).size,
        rects: actionRects
      },
      background: {
        assetLoaded: backgroundAssetLoaded,
        assetUrl: backgroundAssetUrl,
        customImage: customBackgroundImage,
        image: backgroundStyle.backgroundImage,
        position: backgroundStyle.backgroundPosition,
        size: backgroundStyle.backgroundSize,
        beforeImage: backgroundBeforeStyle.backgroundImage,
        beforePosition: backgroundBeforeStyle.backgroundPosition,
        beforeSize: backgroundBeforeStyle.backgroundSize,
        afterImage: backgroundAfterStyle.backgroundImage,
        afterPosition: backgroundAfterStyle.backgroundPosition,
        afterSize: backgroundAfterStyle.backgroundSize
      }
    };
  }, {
    cssUrlPatternSource: CSS_URL_VALUE_PATTERN_SOURCE,
    dynamicValueSelector: buildingPopulationBufferDynamicValueSelector
  });
  return normalizeBuildingPresentationDynamicValues(signature);
}

export async function getProductionPresentationSignature(page, surfaceName) {
  const definition = paritySurfaces[surfaceName];
  const target = page.locator(definition.selector).first();
  await expect(target).toBeVisible();
  return target.evaluate(async (targetElement, cssUrlPatternSource) => {
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
    const backgroundStyle = getComputedStyle(targetElement);
    const backgroundBeforeStyle = getComputedStyle(targetElement, "::before");
    const backgroundAfterStyle = getComputedStyle(targetElement, "::after");
    const customBackgroundImage = backgroundStyle
      .getPropertyValue("--building-detail-background-image")
      .trim();
    const extractBrowserCssUrlValues = (value) => Array.from(
      String(value || "").matchAll(new RegExp(cssUrlPatternSource, "gu"))
    ).map((match) => String(match[2] ?? match[3] ?? "").trim()).filter(Boolean);
    const backgroundImageUrls = [
      customBackgroundImage,
      backgroundStyle.backgroundImage,
      backgroundBeforeStyle.backgroundImage,
      backgroundAfterStyle.backgroundImage
    ].flatMap(extractBrowserCssUrlValues);
    const backgroundAssetUrl = backgroundImageUrls.at(-1) || "";
    const backgroundAssetLoaded = backgroundAssetUrl
      ? await new Promise((resolve) => {
          const image = new Image();
          image.addEventListener("load", () => resolve(image.naturalWidth > 0), { once: true });
          image.addEventListener("error", () => resolve(false), { once: true });
          image.src = backgroundAssetUrl;
          if (image.complete) resolve(image.naturalWidth > 0);
        })
      : null;
    const dynamicCopySelector = [
      "[data-production-progress]",
      "[data-production-countdown]",
      "[data-countdown]",
      "time"
    ].join(",");
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
      ].join(",")).map((element) => normalizeText(element.textContent)),
      visibleCopy: visibleElements("*")
        .filter((element) => element.children.length === 0)
        .filter((element) => !element.closest(dynamicCopySelector))
        .map((element) => normalizeText(element.textContent))
        .filter(Boolean),
      background: {
        assetLoaded: backgroundAssetLoaded,
        assetUrl: backgroundAssetUrl,
        customImage: customBackgroundImage,
        image: backgroundStyle.backgroundImage,
        position: backgroundStyle.backgroundPosition,
        size: backgroundStyle.backgroundSize,
        beforeImage: backgroundBeforeStyle.backgroundImage,
        beforePosition: backgroundBeforeStyle.backgroundPosition,
        beforeSize: backgroundBeforeStyle.backgroundSize,
        afterImage: backgroundAfterStyle.backgroundImage,
        afterPosition: backgroundAfterStyle.backgroundPosition,
        afterSize: backgroundAfterStyle.backgroundSize
      }
    };
  }, CSS_URL_VALUE_PATTERN_SOURCE);
}

export function normalizeLockedModalDocumentScrollExtent(signature, {
  modalSurfaceOpen = false
} = {}) {
  if (!modalSurfaceOpen || !signature?.scroll) {
    return signature;
  }

  const normalizeDocumentScroll = (documentScroll) => (
    documentScroll && typeof documentScroll === "object"
      ? {
          ...documentScroll,
          maxScrollTop: 0,
          scrollLeft: 0,
          scrollTop: 0
        }
      : documentScroll
  );

  return {
    ...signature,
    scroll: {
      ...signature.scroll,
      body: normalizeDocumentScroll(signature.scroll.body),
      html: normalizeDocumentScroll(signature.scroll.html),
      windowX: 0,
      windowY: 0
    }
  };
}

export async function getParityDomStructureSignature(page, surfaceName, {
  additionalDynamicTextSelector = ""
} = {}) {
  const definition = paritySurfaces[surfaceName];
  const target = page.locator(`${definition.selector}:visible`).last();
  await expect(target).toBeVisible();
  await settleFiniteAnimations(page.locator(`${definition.shell}:visible`).last());
  const signature = await target.evaluate((targetElement, config) => {
    const dynamicClassNames = new Set(config.dynamicClassNames);
    const dynamicContentSelector = config.dynamicContentSelector;
    const dynamicTextSelector = config.dynamicTextSelector;
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
      .filter((className) => !dynamicClassNames.has(className))
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
    const elementPath = (element) => {
      if (element === targetElement) return "surface";
      const segments = [];
      let current = element;
      while (current instanceof Element && current !== targetElement) {
        const parent = current.parentElement;
        if (!parent) break;
        const siblings = Array.from(parent.children)
          .filter((candidate) => candidate.tagName === current.tagName)
          .filter(isVisible)
          .filter((candidate) => !candidate.closest(dynamicContentSelector));
        const siblingIndex = siblings.indexOf(current);
        const rawSiblingIndex = Array.from(parent.children)
          .filter((candidate) => candidate.tagName === current.tagName)
          .indexOf(current);
        segments.unshift(`${current.tagName.toLowerCase()}:${
          siblingIndex >= 0 ? siblingIndex : `unmatched-${rawSiblingIndex}`
        }`);
        current = parent;
      }
      return segments.join("/");
    };
    const semanticDataset = (element) => Object.fromEntries(
      config.semanticDatasetKeys
        .filter((key) => Object.hasOwn(element.dataset || {}, key))
        .map((key) => [key, String(element.dataset[key] || "")])
    );
    const controlAttribute = (element, attributeName) => {
      const value = element.getAttribute(attributeName);
      if (
        value
        && element.matches?.(".district-popup-owner-avatar-wrap")
        && ["aria-label", "title"].includes(attributeName)
      ) {
        return `dynamic-owner-${attributeName}`;
      }
      return value;
    };
    const computedStyleSignature = (element) => {
      const style = getComputedStyle(element);
      return Object.fromEntries(config.computedStyleProperties.map((property) => [
        property,
        String(style[property] || "")
      ]));
    };
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
        maxScrollLeft: canScrollX
          ? Math.max(0, element.scrollWidth - element.clientWidth)
          : 0,
        maxScrollTop: canScrollY
          ? Math.max(0, element.scrollHeight - element.clientHeight)
          : 0,
        overflow: style.overflow,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        scrollLeft: Math.round(element.scrollLeft),
        scrollTop: Math.round(element.scrollTop)
      };
    };
    const documentScrollSignature = (element) => {
      const signature = scrollSignature(element);
      delete signature.clientHeight;
      delete signature.clientWidth;
      return signature;
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
    const visibleNodes = [targetElement, ...targetElement.querySelectorAll("*")]
      .filter(isVisible)
      .filter((element) => (
        element === targetElement || !element.closest(dynamicContentSelector)
      ));
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
        ".district-building-detail-card",
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
        "[data-factory-slot-list]",
        ".production-recipe-card",
        ".building-info-action-row",
        ".building-detail-modal__footer",
        ".modal__footer",
        "button",
        "[role='button']",
        "[role='tab']"
      ].join(","))
    ])).filter(isVisible).filter((element) => (
      element === targetElement || !element.closest(dynamicContentSelector)
    ));
    const focusableElements = visibleNodes.filter((element) => (
      element.matches?.("button, input, select, textarea, a[href], [role='button'], [role='tab'], [tabindex]")
      && !element.matches?.("[disabled], [aria-disabled='true'], [tabindex='-1']")
    ));
    const activeElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const surfaceShell = targetElement.closest(config.shellSelector) || targetElement;
    const surfaceModalOpen = isVisible(surfaceShell) && Boolean(
      surfaceShell.matches("[aria-modal='true'], [role='dialog']")
      || surfaceShell.querySelector("[aria-modal='true'], [role='dialog']")
    );
    const modalDebug = window.EmpireModalScrollLock?.debugState?.() || null;
    const ownershipSummary = window.empireUiOwnershipDiagnostics?.getSummary?.() || null;

    return {
      classNames: Array.from(new Set(
        visibleNodes
          .flatMap((element) => normalizeClasses(element))
      )).sort(),
      domTree: visibleNodes.map((element) => ({
        ariaDisabled: element.getAttribute("aria-disabled"),
        ariaExpanded: element.getAttribute("aria-expanded"),
        ariaSelected: element.getAttribute("aria-selected"),
        classes: normalizeClasses(element),
        dataset: semanticDataset(element),
        disabled: "disabled" in element ? Boolean(element.disabled) : false,
        path: elementPath(element),
        role: element.getAttribute("role"),
        tag: element.tagName.toLowerCase(),
        text: element.children.length === 0 && !element.closest(dynamicTextSelector)
          ? normalizeText(element.textContent)
          : ""
      })),
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
        return {
          key: element === targetElement ? "surface" : structuralKey(element, index),
          path: elementPath(element),
          tag: element.tagName.toLowerCase(),
          classes: normalizeClasses(element),
          style: computedStyleSignature(element),
          rect: relativeRect(element)
        };
      }),
      controls: visibleNodes
        .filter((element) => element.matches?.(
          "button, input, select, textarea, a[href], [role='button'], [role='tab']"
        ))
        .map((element) => ({
          ariaLabel: controlAttribute(element, "aria-label"),
          ariaSelected: element.getAttribute("aria-selected"),
          classes: normalizeClasses(element),
          dataset: semanticDataset(element),
          disabled: "disabled" in element ? Boolean(element.disabled) : false,
          path: elementPath(element),
          placeholder: element.getAttribute("placeholder"),
          role: element.getAttribute("role"),
          tabIndex: element.tabIndex,
          tag: element.tagName.toLowerCase(),
          text: normalizeText(element.textContent),
          title: controlAttribute(element, "title")
        })),
      focus: {
        activeElement: activeElement && activeElement !== document.body
          ? {
              classes: normalizeClasses(activeElement),
              dataset: semanticDataset(activeElement),
              insideSurface: targetElement.contains(activeElement),
              role: activeElement.getAttribute("role"),
              tag: activeElement.tagName.toLowerCase()
            }
          : null,
        focusableOrder: focusableElements.map((element) => ({
          classes: normalizeClasses(element),
          dataset: semanticDataset(element),
          path: elementPath(element),
          role: element.getAttribute("role"),
          tabIndex: element.tabIndex,
          tag: element.tagName.toLowerCase()
        }))
      },
      scroll: {
        body: documentScrollSignature(document.body),
        html: documentScrollSignature(document.documentElement),
        surface: scrollSignature(targetElement),
        regions: structuralElements
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
        windowX: Math.round(window.scrollX),
        windowY: Math.round(window.scrollY)
      },
      modalScrollLock: {
        bodyClassLocked: document.body.classList.contains("game-modal-scroll-locked"),
        bodyDatasetLocked: document.body.dataset.overlayScrollLocked === "true",
        bodyOverflow: getComputedStyle(document.body).overflow,
        bridgeInstalled: Boolean(window.EmpireModalScrollLock),
        bridgeLocked: Boolean(window.EmpireModalScrollLock?.isLocked?.(document)),
        htmlClassLocked: document.documentElement.classList.contains("game-modal-scroll-locked"),
        htmlOverflow: getComputedStyle(document.documentElement).overflow,
        ownershipLocked: ownershipSummary?.bodyScrollLocked === true,
        surfaceModalOpen,
        stack: Array.isArray(modalDebug?.stack)
          ? modalDebug.stack.map((entry) => ({
              owner: String(entry?.owner || ""),
              type: String(entry?.type || "")
            }))
          : []
      }
    };
  }, {
    computedStyleProperties: parityComputedStyleProperties,
    dynamicContentSelector: parityDynamicDistrictIdentitySelector,
    dynamicClassNames: parityDynamicClassNames,
    dynamicTextSelector: [
      gameChromeDynamicMaskSelector,
      additionalDynamicTextSelector
    ].filter(Boolean).join(","),
    shellSelector: definition.shell,
    semanticDatasetKeys: [
      "districtBuildingDetailActionId",
      "districtBuildingDetailPanel",
      "districtBuildingDetailTab",
      "districtBuildingType",
      "factoryPanel",
      "factoryTab",
      "productionAction",
      "productionBuildingPanel",
      "productionBuildingTab",
      "productionPanel",
      "buildingDynamicValue",
      "buildingPopulationCapacity",
      "recipeId"
    ]
  });
  return normalizeLockedModalDocumentScrollExtent(signature, {
    modalSurfaceOpen: signature.modalScrollLock.surfaceModalOpen
  });
}

export function normalizeParityClassNames(classNames = []) {
  return Array.from(new Set(classNames
    .filter((className) => !parityDynamicClassNames.includes(className))))
    .sort();
}

export async function getVisibleTechnicalBuildingText(page, surfaceName) {
  const definition = paritySurfaces[surfaceName];
  const target = page.locator(definition.selector).first();
  await expect(target).toBeVisible();
  return target.evaluate((targetElement, patternDefinitions) => {
    const normalizeText = (value) => String(value || "").replace(/\s+/gu, " ").trim();
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
    const technicalPatterns = patternDefinitions.map(({ flags, source }) => (
      new RegExp(source, flags)
    ));
    const roots = [
      targetElement,
      ...Array.from(document.querySelectorAll([
        ".building-special-action-confirm:not([hidden])",
        ".building-upgrade-confirm:not([hidden])"
      ].join(","))).filter(isVisible)
    ];
    const textValues = [];
    for (const root of roots) {
      for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
        if (!isVisible(element)) continue;
        if (element.children.length === 0) textValues.push(element.textContent);
        for (const attribute of ["aria-label", "placeholder", "title"]) {
          textValues.push(element.getAttribute(attribute));
        }
      }
    }
    return Array.from(new Set(textValues
      .map(normalizeText)
      .filter(Boolean)
      .filter((text) => technicalPatterns.some((pattern) => pattern.test(text)))))
      .sort();
  }, technicalBuildingTextPatterns);
}

export async function getGameChromeSignature(page) {
  await expect(page.locator("#game-root")).toBeVisible();
  await settleParityPage(page);
  return page.evaluate((config) => {
    const dynamicClassNames = new Set(config.dynamicClassNames);
    const dynamicTextSelector = config.dynamicTextSelector;
    const surfaceDefinitions = [
      ["body", "body"],
      ["ambience", ".game-shell-ambience"],
      ["topbar", "#game-header"],
      ["resourceBar", ".game-resource-strip"],
      ["gameRoot", "#game-root"],
      ["gameLayout", "#game-layout"],
      ["leftRail", "#game-rail-left"],
      ["leftActions", "#game-left-nav"],
      ["buildingShortcuts", "#building-shortcut-grid"],
      ["streetNews", ".building-action-status"],
      ["mainRegion", "#game-main-region"],
      ["mapStage", "#game-map-stage"],
      ["mapHeader", ".map-stage-header"],
      ["mapDesktopActions", ".map-stage-actions--desktop"],
      ["mapMount", "#game-map-mount"],
      ["mapViewport", "[data-map-viewport]"],
      ["districtCanvas", "[data-district-canvas]"],
      ["commandBar", "#game-command-bar-mount"],
      ["mapMobileActions", ".map-stage-actions--mobile"],
      ["rightRail", "#game-rail-right"],
      ["gangPanel", "#profile-gang-card"],
      ["allianceAction", "#alliance-chat-card"],
      ["chatPanel", "#global-chat-card"],
      ["mobileUtilities", ".game-mobile-utility-actions"]
    ];
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
      .filter((className) => !dynamicClassNames.has(className))
      .sort();
    const computedStyleSignature = (element) => {
      const style = getComputedStyle(element);
      return Object.fromEntries(config.computedStyleProperties.map((property) => [
        property,
        String(style[property] || "")
      ]));
    };
    const viewportRect = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        width: Math.round(rect.width)
      };
    };
    const elementPath = (element) => {
      const segments = [];
      let current = element;
      while (current instanceof Element && current !== document.body) {
        const parent = current.parentElement;
        if (!parent) break;
        const siblings = Array.from(parent.children)
          .filter((candidate) => candidate.tagName === current.tagName)
          .filter(isVisible);
        segments.unshift(
          `${current.tagName.toLowerCase()}:${Math.max(0, siblings.indexOf(current))}`
        );
        current = parent;
      }
      return segments.join("/");
    };
    const surfaceSignature = ([key, selector]) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        return { key, present: false, selector, visible: false };
      }
      const visibleDescendants = [element, ...element.querySelectorAll("*")]
        .filter(isVisible)
        .filter((candidate) => (
          candidate === element || !candidate.closest(dynamicTextSelector)
        ));
      return {
        childClassNames: Array.from(new Set(
          visibleDescendants.flatMap((candidate) => normalizeClasses(candidate))
        )).sort(),
        classes: normalizeClasses(element),
        key,
        present: true,
        rect: viewportRect(element),
        selector,
        style: computedStyleSignature(element),
        visible: isVisible(element)
      };
    };
    const visibleTextOutline = Array.from(document.body.querySelectorAll("*"))
      .filter(isVisible)
      .filter((element) => element.children.length === 0)
      .filter((element) => !element.closest(dynamicTextSelector))
      .map((element) => ({
        classes: normalizeClasses(element),
        path: elementPath(element),
        role: element.getAttribute("role"),
        tag: element.tagName.toLowerCase(),
        text: normalizeText(element.textContent)
      }))
      .filter((entry) => entry.text);
    const modalDebug = window.EmpireModalScrollLock?.debugState?.() || null;
    const ownershipSummary = window.empireUiOwnershipDiagnostics?.getSummary?.() || null;
    const pageScrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    const pageScrollWidth = Math.max(
      document.body.scrollWidth,
      document.documentElement.scrollWidth
    );
    return {
      modalScrollLock: {
        bodyClassLocked: document.body.classList.contains("game-modal-scroll-locked"),
        bodyDatasetLocked: document.body.dataset.overlayScrollLocked === "true",
        bodyOverflow: getComputedStyle(document.body).overflow,
        bridgeInstalled: Boolean(window.EmpireModalScrollLock),
        bridgeLocked: Boolean(window.EmpireModalScrollLock?.isLocked?.(document)),
        htmlClassLocked: document.documentElement.classList.contains("game-modal-scroll-locked"),
        htmlOverflow: getComputedStyle(document.documentElement).overflow,
        ownershipLocked: ownershipSummary?.bodyScrollLocked === true,
        stack: Array.isArray(modalDebug?.stack)
          ? modalDebug.stack.map((entry) => ({
              owner: String(entry?.owner || ""),
              type: String(entry?.type || "")
            }))
          : []
      },
      pageScroll: {
        bodyCanScrollX: document.body.scrollWidth > document.body.clientWidth,
        bodyCanScrollY: document.body.scrollHeight > document.body.clientHeight,
        htmlCanScrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        htmlCanScrollY: document.documentElement.scrollHeight > document.documentElement.clientHeight,
        maxPageScrollX: Math.max(0, pageScrollWidth - window.innerWidth),
        maxPageScrollY: Math.max(0, pageScrollHeight - window.innerHeight),
        pageScrollHeight,
        pageScrollWidth,
        windowX: Math.round(window.scrollX),
        windowY: Math.round(window.scrollY)
      },
      surfaces: surfaceDefinitions.map(surfaceSignature),
      textOutline: visibleTextOutline,
      viewport: {
        height: window.innerHeight,
        width: window.innerWidth
      }
    };
  }, {
    computedStyleProperties: parityComputedStyleProperties,
    dynamicClassNames: parityDynamicClassNames,
    dynamicTextSelector: gameChromeDynamicMaskSelector
  });
}

export async function captureGameChromeScreenshot(page, screenshotPath) {
  return captureViewportParityScreenshot(page, {
    ignoreSelector: gameChromeScreenshotIgnoreSelector,
    roundedCompositeSelector: [
      ".map-boost-btn",
      "#profile-gang-card .profile-row--alliance"
    ].join(","),
    path: screenshotPath
  });
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
