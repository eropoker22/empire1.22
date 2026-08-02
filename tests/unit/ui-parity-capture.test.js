import playwrightUtilsBundle from "playwright-core/lib/utilsBundle";
import { describe, expect, it, vi } from "vitest";
import {
  BUILDING_POPULATION_BUFFER_DYNAMIC_VALUE,
  buildingPopulationBufferDynamicValueSelector,
  captureGameChromeScreenshot,
  captureIsolatedParityScreenshot,
  compareParityPngScreenshotAttempts,
  compareParityPngScreenshots,
  createParityPopulationBufferSyncFixture,
  createRoundedCornerCompositeIgnoreRegions,
  exerciseParitySurfaceScroll,
  expandParityRasterIgnoreRegions,
  extractCssUrlValues,
  findTechnicalBuildingText,
  gameChromeDynamicMaskSelector,
  gameChromeScreenshotIgnoreSelector,
  getBuildingPresentationSignature,
  getGameChromeSignature,
  getParityDomStructureSignature,
  normalizeBuildingPresentationDynamicValues,
  normalizeLockedModalDocumentScrollExtent,
  normalizeParityClassNames,
  openBuildingFromDistrict,
  openDistrictById,
  openParityLocalDemo,
  parityWeaponResourceKeys,
  PARITY_PNG_CHANNEL_TOLERANCE,
  PARITY_PNG_MAX_CAPTURE_ATTEMPTS,
  parityComputedStyleProperties,
  parityDynamicDistrictIdentitySelector,
  parityDynamicClassNames,
  parityViewports,
  readElementRelativeParityIgnoreRegions,
  resolveEnclosingRasterBounds,
  syncParityLocalDemoPopulationBufferFromHosted
} from "../e2e/helpers/uiParityCapture.js";
import { ARMORY_RECIPES } from "../../packages/game-config/src/legacy-page/economy-config.js";

const { PNG } = playwrightUtilsBundle;

function createPngBuffer(width, height, rgbaValues) {
  return PNG.sync.write({
    data: Buffer.from(rgbaValues),
    height,
    width
  });
}

describe("UI parity class signature", () => {
  it("maps hosted civil population buffers into the matching local-demo detail fields", () => {
    const fixtures = [
      [
        "apartment_block",
        "collect_population",
        "apartment-block"
      ],
      [
        "convenience_store",
        "collect_convenience_store_population",
        "convenience-store"
      ],
      [
        "school",
        "collect_school_population",
        "school"
      ]
    ].map(([
      buildingTypeId,
      actionId,
      mechanicsType
    ], index) => ({
      fixture: createParityPopulationBufferSyncFixture(buildingTypeId, {
        actions: [{
          actionId,
          disabledReason: index === 0
            ? "Bytový blok zatím nemá připravené obyvatele."
            : index === 1
              ? "Večerka potřebuje alespoň 30 lidí k výběru."
              : "",
          enabled: index === 2
        }],
        buildingTypeId,
        presentation: {
          populationBuffer: {
            capacity: index === 2 ? 20 : 50,
            storedAmount: index + 0.75
          }
        }
      }, 12_345),
      mechanicsType
    }));

    for (const [index, entry] of fixtures.entries()) {
      expect(entry.fixture).toMatchObject({
        buildingTypeId: index === 0
          ? "apartment_block"
          : index === 1
            ? "convenience_store"
            : "school",
        collect: {
          disabledReason: index === 0
            ? "Bytový blok zatím nemá připravené obyvatele."
            : index === 1
              ? "Večerka potřebuje alespoň 30 lidí k výběru."
              : "",
          enabled: index === 2
        },
        updatedAt: 12_345
      });
      expect(entry.fixture.populationBuffer).toEqual({
        capacity: index === 2 ? 20 : 50,
        storedAmount: index + 0.75
      });
      expect(entry.mechanicsType).toBe([
        "apartment-block",
        "convenience-store",
        "school"
      ][index]);
    }
  });

  it("rejects incomplete or mismatched population fixtures", () => {
    const school = {
      actions: [{ actionId: "collect_school_population", enabled: false }],
      buildingTypeId: "school",
      presentation: { populationBuffer: { capacity: 20, storedAmount: 0 } }
    };

    expect(createParityPopulationBufferSyncFixture("factory", school)).toBeNull();
    expect(createParityPopulationBufferSyncFixture("apartment_block", school)).toBeNull();
    expect(createParityPopulationBufferSyncFixture("school", {
      ...school,
      actions: []
    })).toBeNull();
    expect(createParityPopulationBufferSyncFixture("school", {
      ...school,
      presentation: null
    })).toBeNull();
    expect(createParityPopulationBufferSyncFixture("school", {
      ...school,
      actions: [{
        actionId: "collect_school_population",
        disabledReason: "Škola zatím nemá připravené členy k výběru.",
        enabled: true
      }]
    })).toBeNull();
  });

  it("synchronizes only allowlisted population buildings through the test helper", async () => {
    const hostedPage = {
      evaluate: vi.fn().mockResolvedValue({
        actions: [{
          actionId: "collect_school_population",
          disabledReason: "",
          enabled: true
        }],
        buildingTypeId: "school",
        presentation: {
          populationBuffer: { capacity: 20, storedAmount: 1.25 }
        },
        specialActions: []
      })
    };
    const localPage = { evaluate: vi.fn().mockResolvedValue(undefined) };

    const fixture = await syncParityLocalDemoPopulationBufferFromHosted(
      localPage,
      hostedPage,
      "school"
    );

    expect(fixture).toMatchObject({
      buildingTypeId: "school",
      collect: { actionId: "collect_school_population", enabled: true },
      populationBuffer: { capacity: 20, storedAmount: 1.25 }
    });
    expect(hostedPage.evaluate).toHaveBeenCalledOnce();
    expect(localPage.evaluate).toHaveBeenCalledOnce();
    expect(localPage.evaluate.mock.calls[0][1]).toMatchObject({
      buildingTypeId: "school",
      populationBuffer: {
        capacity: 20,
        storedAmount: 1.25
      }
    });

    expect(await syncParityLocalDemoPopulationBufferFromHosted(
      localPage,
      hostedPage,
      "factory"
    )).toBeNull();
    expect(hostedPage.evaluate).toHaveBeenCalledOnce();
    expect(localPage.evaluate).toHaveBeenCalledOnce();
  });

  it("derives every local-demo weapon seed from the canonical Armory registry", () => {
    expect(parityWeaponResourceKeys).toEqual(Array.from(new Set(
      Object.values(ARMORY_RECIPES).map((recipe) => recipe.output.itemId)
    )));
    expect(parityWeaponResourceKeys).toEqual(expect.arrayContaining([
      "barricades",
      "cameras",
      "defense-tower",
      "alarm"
    ]));
  });

  it("removes only explicitly allowlisted runtime state classes", () => {
    expect(normalizeParityClassNames([
      "district-popup-action",
      "district-popup-action--stacked",
      "district-popup-action__label",
      "district-popup-flag--good",
      "district-popup-flag--warning",
      "is-empty",
      "server-authoritative"
    ])).toEqual([
      "district-popup-action",
      "district-popup-action--stacked",
      "district-popup-action__label",
      "district-popup-flag--good",
      "district-popup-flag--warning"
    ]);
    expect(parityDynamicClassNames).toEqual([
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
  });

  it("locks the ten requested viewports and detailed computed-style contract", () => {
    expect(parityViewports.map(({ width, height }) => `${width}x${height}`)).toEqual([
      "1440x900",
      "390x844",
      "320x568",
      "360x800",
      "430x932",
      "768x1024",
      "820x1180",
      "1024x768",
      "1366x768",
      "1920x1080"
    ]);
    expect(parityComputedStyleProperties).toEqual(expect.arrayContaining([
      "backgroundColor",
      "backdropFilter",
      "borderTopWidth",
      "color",
      "columnGap",
      "display",
      "flexDirection",
      "filter",
      "fontFamily",
      "fontSize",
      "fontWeight",
      "gridTemplateColumns",
      "lineHeight",
      "marginTop",
      "maxWidth",
      "minWidth",
      "mixBlendMode",
      "overflowY",
      "paddingTop",
      "rowGap",
      "animationName",
      "animationDuration",
      "transform",
      "transitionDuration",
      "transitionProperty",
      "visibility"
    ]));
    expect(gameChromeDynamicMaskSelector).toContain("[data-district-canvas]");
    expect(gameChromeDynamicMaskSelector).toContain("[data-topbar-clean-money]");
    expect(gameChromeScreenshotIgnoreSelector).toContain("[data-topbar-clean-money]");
    expect(gameChromeScreenshotIgnoreSelector).toContain("[data-map-viewport]");
    expect(gameChromeScreenshotIgnoreSelector).toContain("[data-gang-star]");
    expect(gameChromeScreenshotIgnoreSelector).toContain("[data-city-status]");
    expect(gameChromeScreenshotIgnoreSelector).not.toContain(".resource-pill:has(");
    expect(gameChromeScreenshotIgnoreSelector).not.toContain(".gang-profile-row:has(");
    expect(gameChromeScreenshotIgnoreSelector).not.toContain("[data-boost-open-trigger]");
    expect(gameChromeScreenshotIgnoreSelector).not.toContain("#profile-gang-card");
    expect(gameChromeScreenshotIgnoreSelector).not.toContain("#global-chat-card");
    expect(gameChromeDynamicMaskSelector).not.toContain("[data-gang-stars]");
    expect(parityDynamicDistrictIdentitySelector).toContain(
      ".district-popup-owner-avatar-wrap img"
    );
  });

  it("allows only sub-threshold PNG channel noise and zero meaningful pixels", () => {
    const expected = createPngBuffer(2, 1, [
      20, 40, 60, 255,
      80, 100, 120, 255
    ]);
    const withinTolerance = createPngBuffer(2, 1, [
      26, 40, 60, 255,
      80, 95, 120, 255
    ]);
    const meaningfulDifference = createPngBuffer(2, 1, [
      27, 40, 60, 255,
      80, 100, 120, 255
    ]);

    expect(PARITY_PNG_CHANNEL_TOLERANCE).toBe(6);
    expect(compareParityPngScreenshots(withinTolerance, expected)).toMatchObject({
      dimensionsEqual: true,
      exact: false,
      matches: true,
      maxChannelDelta: 6,
      meaningfulPixelCount: 0,
      rawDifferentPixelCount: 2
    });
    expect(compareParityPngScreenshots(meaningfulDifference, expected)).toMatchObject({
      dimensionsEqual: true,
      exact: false,
      matches: false,
      maxChannelDelta: 7,
      meaningfulPixelCount: 1,
      rawDifferentPixelCount: 1
    });
    expect(() => compareParityPngScreenshots(expected, expected, {
      channelTolerance: 6.5
    })).toThrow(/integer from 0 to 255/u);
  });

  it("allows two bounded recaptures only when the final image has zero meaningful pixels", async () => {
    const expected = createPngBuffer(1, 1, [20, 40, 60, 255]);
    const oneMeaningfulPixel = createPngBuffer(1, 1, [27, 40, 60, 255]);
    const captureAttempt = vi.fn()
      .mockResolvedValueOnce({
        actualBuffer: oneMeaningfulPixel,
        expectedBuffer: expected
      })
      .mockResolvedValueOnce({
        actualBuffer: oneMeaningfulPixel,
        expectedBuffer: expected
      })
      .mockResolvedValueOnce({
        actualBuffer: expected,
        expectedBuffer: expected
      });

    const recovered = await compareParityPngScreenshotAttempts(captureAttempt);

    expect(PARITY_PNG_MAX_CAPTURE_ATTEMPTS).toBe(3);
    expect(captureAttempt).toHaveBeenCalledTimes(3);
    expect(recovered).toMatchObject({
      attemptCount: 3,
      attempts: [
        { attempt: 1, comparison: { matches: false, meaningfulPixelCount: 1 } },
        { attempt: 2, comparison: { matches: false, meaningfulPixelCount: 1 } },
        { attempt: 3, comparison: { matches: true, meaningfulPixelCount: 0 } }
      ],
      comparison: { matches: true, meaningfulPixelCount: 0 }
    });

    const persistentDifference = await compareParityPngScreenshotAttempts(async () => ({
      actualBuffer: oneMeaningfulPixel,
      expectedBuffer: expected
    }));
    expect(persistentDifference).toMatchObject({
      attemptCount: 3,
      comparison: { matches: false, meaningfulPixelCount: 1 }
    });
    await expect(compareParityPngScreenshotAttempts(captureAttempt, {
      maxAttempts: PARITY_PNG_MAX_CAPTURE_ATTEMPTS + 1
    })).rejects.toThrow(/capture attempts must be from 1 to 3/u);
  });

  it("rejects PNG dimension changes as meaningful differences", () => {
    const onePixel = createPngBuffer(1, 1, [20, 40, 60, 255]);
    const twoPixels = createPngBuffer(2, 1, [20, 40, 60, 255, 20, 40, 60, 255]);

    expect(compareParityPngScreenshots(twoPixels, onePixel)).toMatchObject({
      actualHeight: 1,
      actualWidth: 2,
      dimensionsEqual: false,
      expectedHeight: 1,
      expectedWidth: 1,
      matches: false,
      meaningfulPixelCount: 2
    });
  });

  it("ignores the unique union of dynamic regions from both screenshots", () => {
    const expected = createPngBuffer(4, 1, [
      0, 0, 0, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
      0, 0, 0, 255
    ]);
    const dynamicDifferences = createPngBuffer(4, 1, [
      255, 0, 0, 255,
      255, 0, 0, 255,
      255, 0, 0, 255,
      0, 0, 0, 255
    ]);
    const localRegions = [
      { height: 1, width: 2, x: 0, y: 0 },
      { height: 1, width: 1, x: 1, y: 0 }
    ];
    const hostedRegions = [
      { height: 1, width: 1, x: 2, y: 0 }
    ];

    expect(compareParityPngScreenshots(dynamicDifferences, expected, {
      ignoreRegions: localRegions
    })).toMatchObject({
      comparedPixelCount: 2,
      ignoredDifferentPixelCount: 2,
      ignoredPixelCount: 2,
      ignoreRegionCount: 2,
      matches: false,
      meaningfulPixelCount: 1,
      rawDifferentPixelCount: 3,
      requestedIgnoreRegionCount: 2
    });
    expect(compareParityPngScreenshots(dynamicDifferences, expected, {
      ignoreRegions: [...localRegions, ...hostedRegions]
    })).toMatchObject({
      comparedDifferentPixelCount: 0,
      comparedPixelCount: 1,
      exact: false,
      ignoredDifferentPixelCount: 3,
      ignoredPixelCount: 3,
      ignoreRegionCount: 3,
      matches: true,
      maxChannelDelta: 0,
      meaningfulPixelCount: 0,
      rawDifferentPixelCount: 3,
      rawMaxChannelDelta: 255,
      requestedIgnoreRegionCount: 3
    });
  });

  it("limits raster exclusions to text paint and one rounded antialias pixel", () => {
    expect(expandParityRasterIgnoreRegions([
      { height: 6.25, width: 5.5, x: 10.25, y: 20.5 }
    ])).toEqual([
      { height: 8.25, width: 7.5, x: 9.25, y: 19.5 }
    ]);

    const roundedExterior = createRoundedCornerCompositeIgnoreRegions({
      height: 594,
      radii: {
        bottomLeft: { x: 22, y: 22 }
      },
      width: 728
    });
    expect(roundedExterior).toHaveLength(22);
    expect(roundedExterior).toContainEqual({ height: 1, width: 2, x: 0, y: 575 });
    expect(roundedExterior).toContainEqual({ height: 1, width: 19, x: 0, y: 593 });
    expect(Math.max(...roundedExterior.map((region) => region.width))).toBe(19);

    const pillExterior = createRoundedCornerCompositeIgnoreRegions({
      height: 18,
      radii: {
        bottomLeft: { x: 999, y: 999 },
        bottomRight: { x: 999, y: 999 },
        topLeft: { x: 999, y: 999 },
        topRight: { x: 999, y: 999 }
      },
      width: 58
    });
    expect(pillExterior).toHaveLength(36);
    expect(Math.max(...pillExterior.map((region) => region.width))).toBeLessThanOrEqual(8);
  });

  it("limits descendant composite masking to rounded-corner fringe", async () => {
    const target = {
      evaluate: vi.fn().mockResolvedValue({
        dynamicRegions: [],
        roundedBox: { height: 100, radii: {}, width: 100 },
        roundedBoxes: [{
          height: 40,
          radii: { topLeft: { x: 4, y: 4 } },
          width: 80,
          x: 10,
          y: 20
        }]
      })
    };

    await expect(readElementRelativeParityIgnoreRegions(
      target,
      "",
      ".district-modal-hero--district"
    )).resolves.toEqual([
      { height: 1, width: 4, x: 10, y: 20 },
      { height: 1, width: 2, x: 10, y: 21 },
      { height: 1, width: 2, x: 10, y: 22 },
      { height: 1, width: 2, x: 10, y: 23 }
    ]);
    expect(target.evaluate.mock.calls[0][1]).toEqual({
      ignore: "",
      rounded: ".district-modal-hero--district"
    });
  });

  it("captures the real backdrop without mutating the surface or ambience", async () => {
    const screenshot = Buffer.from("png");
    const elementIgnoreRegions = [{ height: 10, width: 20, x: 30, y: 40 }];
    const viewportIgnoreRegions = [{ height: 50, width: 60, x: 70, y: 80 }];
    const roundedCompositeBoxes = [{
      height: 10,
      radii: {
        bottomLeft: { x: 0, y: 0 },
        bottomRight: { x: 0, y: 0 },
        topLeft: { x: 4, y: 4 },
        topRight: { x: 0, y: 0 }
      },
      width: 20,
      x: 5,
      y: 6
    }];
    const surface = { evaluate: vi.fn() };
    const target = {
      evaluate: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          dynamicRegions: elementIgnoreRegions,
          roundedBox: { height: 100, radii: {}, width: 100 }
        }),
      screenshot: vi.fn().mockResolvedValue(screenshot)
    };
    const body = { evaluate: vi.fn().mockResolvedValue(undefined) };
    const page = {
      evaluate: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(viewportIgnoreRegions)
        .mockResolvedValueOnce(roundedCompositeBoxes),
      locator: vi.fn().mockReturnValue(body),
      mouse: { move: vi.fn().mockResolvedValue(undefined) },
      screenshot: vi.fn().mockResolvedValue(screenshot)
    };

    await expect(captureIsolatedParityScreenshot(page, {
      ignoreSelector: "[data-countdown]",
      path: "surface.png",
      surface,
      target
    })).resolves.toEqual({
      ignoreRegions: [{ height: 12, width: 22, x: 29, y: 39 }],
      screenshot
    });
    expect(surface.evaluate).not.toHaveBeenCalled();
    expect(target.screenshot).toHaveBeenCalledWith(expect.objectContaining({
      path: "surface.png",
      scale: "device"
    }));
    expect(target.screenshot.mock.calls[0][0]).not.toHaveProperty("mask");

    await expect(captureGameChromeScreenshot(page, "chrome.png")).resolves.toEqual({
      ignoreRegions: [
        { height: 52, width: 62, x: 69, y: 79 },
        { height: 1, width: 4, x: 5, y: 6 },
        { height: 1, width: 2, x: 5, y: 7 },
        { height: 1, width: 2, x: 5, y: 8 },
        { height: 1, width: 2, x: 5, y: 9 }
      ],
      screenshot
    });
    expect(page.evaluate).toHaveBeenCalledTimes(4);
    expect(page.evaluate.mock.calls[3][1]).toBe([
      ".map-boost-btn",
      "#profile-gang-card .profile-row--alliance"
    ].join(","));
    expect(page.screenshot).toHaveBeenCalledWith(expect.objectContaining({
      fullPage: false,
      path: "chrome.png",
      scale: "device"
    }));
    expect(page.screenshot.mock.calls[0][0]).not.toHaveProperty("mask");
  });

  it("installs and removes a stable underlay only when transparent capture requests it", async () => {
    const screenshot = Buffer.from("png");
    const target = {
      evaluate: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          dynamicRegions: [],
          roundedBox: { height: 100, radii: {}, width: 100 }
        })
        .mockResolvedValueOnce({
          token: "parity-test"
        })
        .mockResolvedValueOnce(undefined),
      screenshot: vi.fn().mockResolvedValue(screenshot)
    };
    const page = {
      evaluate: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn(),
      mouse: { move: vi.fn().mockResolvedValue(undefined) }
    };

    await expect(captureIsolatedParityScreenshot(page, {
      path: "transparent-surface.png",
      stableBackdropShellSelector: "[data-market-popup]",
      target
    })).resolves.toEqual({ ignoreRegions: [], screenshot });

    expect(target.evaluate).toHaveBeenCalledTimes(4);
    expect(captureIsolatedParityScreenshot.toString()).toContain(
      'setProperty("opacity", "0", "important")'
    );
    expect(target.evaluate.mock.calls[2][1]).toBe("[data-market-popup]");
    expect(target.evaluate.mock.calls[3][1]).toEqual({
      shellSelector: "[data-market-popup]",
      state: {
        token: "parity-test"
      }
    });
    expect(target.screenshot).toHaveBeenCalledTimes(1);
  });

  it("keeps path and scroll parity checks lossless", () => {
    expect(getParityDomStructureSignature.toString()).toContain("unmatched-");
    expect(getParityDomStructureSignature.toString()).toContain("maxScrollTop");
    expect(getGameChromeSignature.toString()).toContain("maxPageScrollX");
    expect(getGameChromeSignature.toString()).toContain("maxPageScrollY");
    expect(getGameChromeSignature.toString()).toContain(".filter(isVisible)");
    expect(exerciseParitySurfaceScroll.toString()).toContain("overflowY");
    expect(exerciseParitySurfaceScroll.toString()).toContain("movementPx");
    expect(getParityDomStructureSignature.toString()).toContain("scrollableOverflow");
    expect(getParityDomStructureSignature.toString()).toContain("dynamic-owner-");
    expect(getParityDomStructureSignature.toString()).toContain("surfaceModalOpen");
    expect(getParityDomStructureSignature.toString()).toContain("additionalDynamicTextSelector");
    expect(getParityDomStructureSignature.toString()).toContain("buildingDynamicValue");
    expect(getParityDomStructureSignature.toString()).toContain("buildingPopulationCapacity");
  });

  it("normalizes only semantically marked population-buffer text", () => {
    const normalized = normalizeBuildingPresentationDynamicValues({
      mechanics: [
        {
          dynamicValue: BUILDING_POPULATION_BUFFER_DYNAMIC_VALUE,
          label: "K výběru",
          staticCapacity: "20",
          text: "K výběru 1/20"
        },
        {
          dynamicValue: "",
          label: "Produkce",
          text: "Produkce +0.55 populace/min"
        },
        {
          dynamicValue: "",
          label: "Síť škol",
          text: "Síť škol kapacita +20 %"
        }
      ],
      effects: [{
        dynamicValue: BUILDING_POPULATION_BUFFER_DYNAMIC_VALUE,
        staticPrefix: "Naplnění za",
        text: "Naplnění za 2 min"
      }],
      visibleCopy: [
        { dynamicValue: BUILDING_POPULATION_BUFFER_DYNAMIC_VALUE, text: "1" },
        { dynamicValue: "", text: "/20" },
        { dynamicValue: "", text: "+0.55 populace/min" },
        { dynamicValue: "", text: "Síť škol" },
        "Neměnný popis"
      ]
    });

    expect(buildingPopulationBufferDynamicValueSelector).toBe(
      '[data-building-dynamic-value="population-buffer"]'
    );
    expect(normalized.mechanics).toEqual([
      "K výběru<dynamic:population-buffer>/20",
      "Produkce +0.55 populace/min",
      "Síť škol kapacita +20 %"
    ]);
    expect(normalized.effects).toEqual([
      "Naplnění za<dynamic:population-buffer>"
    ]);
    expect(normalized.visibleCopy).toEqual([
      "/20",
      "+0.55 populace/min",
      "Síť škol",
      "Neměnný popis"
    ]);
  });

  it("normalizes changing population numerators but keeps capacity semantic", () => {
    const normalizeBuffer = (numerator, capacity) => normalizeBuildingPresentationDynamicValues({
      mechanics: [{
        dynamicValue: BUILDING_POPULATION_BUFFER_DYNAMIC_VALUE,
        label: "K výběru",
        staticCapacity: String(capacity),
        text: `K výběru ${numerator}/${capacity}`
      }],
      visibleCopy: []
    });

    expect(normalizeBuffer(0, 20)).toEqual(normalizeBuffer(1, 20));
    expect(normalizeBuffer(0, 20)).not.toEqual(normalizeBuffer(1, 50));
  });

  it("settles the current visible building shell before reading responsive layout", () => {
    const source = getBuildingPresentationSignature.toString();
    expect(source).toContain("`${definition.selector}:visible`).last()");
    expect(source).toContain("settleFiniteAnimations");
    expect(source).toContain("`${definition.shell}:visible`).last()");
    expect(source).toContain("const actionLayout = {");
    expect(source).toContain("gridTemplateColumns: actionLayout.gridTemplateColumns");
    expect(source).toContain("dynamicValueSelector");
    expect(source).toContain("normalizeBuildingPresentationDynamicValues");
  });

  it("re-localizes the visible building chip before real pointer input", () => {
    const source = openBuildingFromDistrict.toString();

    expect(source).toContain("document.querySelectorAll(shellSelector)");
    expect(source).toContain(".filter(isVisible)");
    expect(source).toContain("document.elementFromPoint(point.x, point.y)");
    expect(source).toContain("await page.mouse.click(point.x, point.y)");
    expect(source).not.toContain("await page.mouse.down()");
    expect(source).not.toContain("await page.mouse.up()");
    expect(source).not.toContain("boundingBox()");
    expect(source).not.toContain("dispatchEvent(");
  });

  it("parses quoted css asset urls without truncating filename parentheses", () => {
    expect(extractCssUrlValues([
      'linear-gradient(red, blue), url("/img/Restaurant (2).png")',
      "url('/img/Arcade (final).png')",
      "url(/img/plain.png)"
    ].join(", "))).toEqual([
      "/img/Restaurant (2).png",
      "/img/Arcade (final).png",
      "/img/plain.png"
    ]);
  });

  it("matches Playwright enclosing bounds for fractional element screenshots", () => {
    expect(resolveEnclosingRasterBounds({
      bottom: 694.1,
      left: 20.25,
      right: 748,
      top: 100.5
    })).toEqual({
      bottom: 695,
      height: 595,
      left: 20,
      right: 748,
      top: 100,
      width: 728
    });
  });

  it("normalizes only the background document extent behind an open modal surface", () => {
    const signature = {
      modalScrollLock: {
        bodyClassLocked: true,
        bodyDatasetLocked: false,
        bridgeLocked: true,
        htmlClassLocked: true,
        ownershipLocked: true
      },
      scroll: {
        body: {
          canScrollY: true,
          maxScrollLeft: 17,
          maxScrollTop: 671,
          overflowY: "auto"
        },
        html: {
          canScrollY: true,
          maxScrollLeft: 23,
          maxScrollTop: 864,
          overflowY: "auto"
        },
        regions: [{ maxScrollTop: 412, path: "surface/div:0" }],
        surface: { maxScrollLeft: 29, maxScrollTop: 538 },
        windowX: 0,
        windowY: 0
      }
    };

    const normalized = normalizeLockedModalDocumentScrollExtent(signature, {
      modalSurfaceOpen: true
    });

    expect(normalized).not.toBe(signature);
    expect(normalized.scroll.body).toEqual({
      canScrollY: true,
      maxScrollLeft: 17,
      maxScrollTop: 0,
      overflowY: "auto"
    });
    expect(normalized.scroll.html).toEqual({
      canScrollY: true,
      maxScrollLeft: 23,
      maxScrollTop: 0,
      overflowY: "auto"
    });
    expect(normalized.scroll.surface).toBe(signature.scroll.surface);
    expect(normalized.scroll.regions).toBe(signature.scroll.regions);
    expect(signature.scroll.body.maxScrollTop).toBe(671);
    expect(signature.scroll.html.maxScrollTop).toBe(864);
  });

  it("preserves document scroll extent when the parity surface is not an open modal", () => {
    const unlockedSignature = {
      modalScrollLock: {
        bodyClassLocked: false,
        bodyDatasetLocked: false,
        bridgeLocked: false,
        htmlClassLocked: false,
        ownershipLocked: false
      },
      scroll: {
        body: { maxScrollTop: 671 },
        html: { maxScrollTop: 864 },
        surface: { maxScrollTop: 538 }
      }
    };
    const lockedSignature = {
      ...unlockedSignature,
      modalScrollLock: {
        ...unlockedSignature.modalScrollLock,
        bridgeLocked: true
      }
    };

    const normalizedUnlockedModal = normalizeLockedModalDocumentScrollExtent(unlockedSignature, {
      modalSurfaceOpen: true
    });
    expect(normalizedUnlockedModal.scroll.body.maxScrollTop).toBe(0);
    expect(normalizedUnlockedModal.scroll.html.maxScrollTop).toBe(0);
    expect(normalizedUnlockedModal.scroll.surface).toBe(unlockedSignature.scroll.surface);
    expect(normalizeLockedModalDocumentScrollExtent(lockedSignature, {
      modalSurfaceOpen: false
    })).toBe(lockedSignature);
  });

  it("aligns the demo identity color and waits for hosted district hydration", () => {
    expect(openParityLocalDemo.toString()).toContain('gangColor: "#22d3ee"');
    expect(openParityLocalDemo.toString()).toContain("2854d1df-0f7c-4fe4-aa85-7a70dfe299db.jpg");
    expect(openDistrictById.toString()).toContain("openDistrictAsync");
    expect(openDistrictById.toString()).not.toContain("selectDistrict?.(id)");
    expect(openDistrictById.toString()).toContain("data-server-loading");
    expect(openDistrictById.toString()).toContain("district-popup-server-loading");
    expect(openDistrictById.toString()).toContain("district-popup-body");
  });

  it("rejects technical hosted labels without rejecting shared gameplay copy", () => {
    const technicalText = findTechnicalBuildingText([
      "SERVER",
      "Raw projection",
      "Revision 42",
      "Ověří server",
      "Cena závisí na serverové odpovědi.",
      "Výsledek určí server.",
      "district:21",
      "Serverově sníží heat districtu.",
      "Mechaniky",
      "Efekty"
    ]);
    expect(technicalText).toEqual(expect.arrayContaining([
      "Cena závisí na serverové odpovědi.",
      "Ověří server",
      "Raw projection",
      "Revision 42",
      "SERVER",
      "Serverově sníží heat districtu.",
      "Výsledek určí server.",
      "district:21"
    ]));
    expect(technicalText).not.toContain("Mechaniky");
    expect(technicalText).not.toContain("Efekty");
  });
});
