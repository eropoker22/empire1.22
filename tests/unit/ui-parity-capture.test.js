import playwrightUtilsBundle from "playwright-core/lib/utilsBundle";
import { describe, expect, it, vi } from "vitest";
import {
  BUILDING_POPULATION_BUFFER_DYNAMIC_VALUE,
  buildingPopulationBufferDynamicValueSelector,
  captureStableHostedPopulationParitySnapshot,
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
  PARITY_ROUNDED_COMPOSITE_RASTER_FRINGE_PX,
  PARITY_SCREENSHOT_RASTER_FRINGE_PX,
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

function createParityStyleDeclaration(initialStyles = {}) {
  const priorities = new Map();
  const values = new Map();
  for (const [propertyName, entry] of Object.entries(initialStyles)) {
    values.set(propertyName, String(entry?.value ?? ""));
    priorities.set(propertyName, String(entry?.priority ?? ""));
  }
  const style = {
    getPropertyPriority: vi.fn((propertyName) => priorities.get(propertyName) || ""),
    getPropertyValue: vi.fn((propertyName) => values.get(propertyName) || ""),
    removeProperty: vi.fn((propertyName) => {
      const previousValue = values.get(propertyName) || "";
      values.delete(propertyName);
      priorities.delete(propertyName);
      return previousValue;
    }),
    setProperty: vi.fn((propertyName, value, priority = "") => {
      values.set(propertyName, String(value));
      priorities.set(propertyName, String(priority || ""));
    })
  };
  return { priorities, style, values };
}

function createParityStyleDocument() {
  const styleElements = [];
  const head = {
    append: vi.fn((element) => {
      if (!styleElements.includes(element)) styleElements.push(element);
    })
  };
  const documentRef = {
    createElement: vi.fn((tagName) => {
      if (tagName !== "style") throw new Error(`Unsupported parity test element: ${tagName}`);
      const attributes = new Map();
      const ruleDeclaration = createParityStyleDeclaration();
      const styleElement = {
        getAttribute: vi.fn((attributeName) => attributes.get(attributeName) ?? null),
        remove: vi.fn(() => {
          const index = styleElements.indexOf(styleElement);
          if (index >= 0) styleElements.splice(index, 1);
        }),
        setAttribute: vi.fn((attributeName, value) => {
          attributes.set(attributeName, String(value));
        }),
        sheet: { cssRules: [{ style: ruleDeclaration.style }] },
        textContent: ""
      };
      return styleElement;
    }),
    documentElement: head,
    head,
    querySelectorAll: vi.fn((selector) => {
      const token = String(selector).match(
        /^\[data-parity-capture-stable-target-style-sheet="([^"]+)"\]$/u
      )?.[1];
      if (!token) return [];
      return styleElements.filter((element) => (
        element.getAttribute("data-parity-capture-stable-target-style-sheet") === token
      ));
    }),
    styleElements
  };
  return documentRef;
}

function createParityStyleElement(initialStyles = {}, ownerDocument = createParityStyleDocument()) {
  const attributes = new Map();
  const { priorities, style, values } = createParityStyleDeclaration(initialStyles);
  const element = {
    getAttribute: vi.fn((attributeName) => attributes.get(attributeName) ?? null),
    ownerDocument,
    removeAttribute: vi.fn((attributeName) => attributes.delete(attributeName)),
    setAttribute: vi.fn((attributeName, value) => {
      attributes.set(attributeName, String(value));
    }),
    style
  };
  return { attributes, element, ownerDocument, priorities, style, values };
}

function createPinnedTargetStyleCaptureHarness({
  cleanupError = null,
  initialStyles = null,
  onScreenshot = null,
  onSettle = null,
  replacementStyles = null,
  screenshotError = null
} = {}) {
  const propertyName = "--district-owner-avatar-opacity";
  const original = createParityStyleElement(initialStyles || {
    [propertyName]: { priority: "important", value: "0.24" }
  });
  const replacement = createParityStyleElement(replacementStyles || {
    [propertyName]: { priority: "", value: "0" }
  });
  let handleEvaluateCall = 0;
  let locatorEvaluateCall = 0;
  const handle = {
    dispose: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn(async (callback, argument) => {
      handleEvaluateCall += 1;
      if (handleEvaluateCall === 1) return callback(original.element, argument);
      if (handleEvaluateCall === 2) {
        onSettle?.({ original, propertyName, replacement });
        return undefined;
      }
      if (cleanupError) throw cleanupError;
      return callback(original.element, argument);
    }),
    screenshot: vi.fn(async () => {
      onScreenshot?.({ original, propertyName, replacement });
      if (screenshotError) throw screenshotError;
      return Buffer.from("png");
    })
  };
  const target = {
    elementHandle: vi.fn().mockResolvedValue(handle),
    evaluate: vi.fn(async (callback, argument) => {
      locatorEvaluateCall += 1;
      if (locatorEvaluateCall === 1) return undefined;
      if (locatorEvaluateCall === 2) {
        return {
          dynamicRegions: [],
          roundedBox: { height: 100, radii: {}, width: 100 }
        };
      }
      return callback(replacement.element, argument);
    }),
    screenshot: vi.fn()
  };
  const page = {
    evaluate: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn(),
    mouse: { move: vi.fn().mockResolvedValue(undefined) }
  };
  return { handle, original, page, propertyName, replacement, target };
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
        storedAmount: index
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
      populationBuffer: { capacity: 20, storedAmount: 1 }
    });
    expect(hostedPage.evaluate).toHaveBeenCalledOnce();
    expect(localPage.evaluate).toHaveBeenCalledOnce();
    expect(localPage.evaluate.mock.calls[0][1]).toMatchObject({
      buildingTypeId: "school",
      populationBuffer: {
        capacity: 20,
        storedAmount: 1
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

  it("stabilizes fractional population drift within the same visible whole amount", async () => {
    const createHostedBuilding = (storedAmount) => ({
      actions: [{
        actionId: "collect_population",
        disabledReason: "Bytový blok potřebuje alespoň 10 lidí k výběru.",
        enabled: false
      }],
      buildingTypeId: "apartment_block",
      presentation: {
        populationBuffer: { capacity: 50, storedAmount }
      },
      specialActions: []
    });
    const hostedPage = {
      evaluate: vi.fn()
        .mockResolvedValueOnce(createHostedBuilding(1.1))
        .mockResolvedValueOnce(createHostedBuilding(1.9))
    };
    const localPage = { evaluate: vi.fn().mockResolvedValue(undefined) };
    const hostedSignature = {
      presentation: {
        collectAction: {
          disabled: true,
          disabledReason: "Bytový blok potřebuje alespoň 10 lidí k výběru."
        },
        actions: [{
          actionId: "collect_population",
          disabled: true,
          disabledReason: "Bytový blok potřebuje alespoň 10 lidí k výběru."
        }]
      },
      structure: { controls: [{ title: "preserved structural content" }] }
    };
    const captureHostedSnapshot = vi.fn().mockResolvedValue(hostedSignature);

    const result = await captureStableHostedPopulationParitySnapshot(
      localPage,
      hostedPage,
      "apartment_block",
      captureHostedSnapshot
    );

    expect(result).toEqual({
      hostedSnapshot: hostedSignature,
      populationFixture: {
        buildingTypeId: "apartment_block",
        collect: {
          actionId: "collect_population",
          disabledReason: "Bytový blok potřebuje alespoň 10 lidí k výběru.",
          enabled: false
        },
        populationBuffer: { capacity: 50, storedAmount: 1 },
        updatedAt: expect.any(Number)
      },
      snapshotAttempts: 1
    });
    expect(captureHostedSnapshot).toHaveBeenCalledOnce();
    expect(localPage.evaluate).toHaveBeenCalledOnce();
    expect(localPage.evaluate.mock.calls[0][1].populationBuffer.storedAmount).toBe(1);
  });

  it("accepts the informational tooltip on an enabled population collect button", async () => {
    const hostedBuilding = {
      actions: [{
        actionId: "collect_population",
        disabledReason: "",
        enabled: true
      }],
      buildingTypeId: "apartment_block",
      presentation: {
        populationBuffer: { capacity: 50, storedAmount: 10.333 }
      },
      specialActions: []
    };
    const hostedPage = { evaluate: vi.fn().mockResolvedValue(hostedBuilding) };
    const localPage = { evaluate: vi.fn().mockResolvedValue(undefined) };
    const hostedSignature = {
      presentation: {
        collectAction: {
          disabled: false,
          disabledReason: "Vybrat připravený výstup: 10/50 obyvatel"
        }
      }
    };
    const captureHostedSnapshot = vi.fn().mockResolvedValue(hostedSignature);

    await expect(captureStableHostedPopulationParitySnapshot(
      localPage,
      hostedPage,
      "apartment_block",
      captureHostedSnapshot
    )).resolves.toMatchObject({
      hostedSnapshot: hostedSignature,
      populationFixture: {
        collect: { disabledReason: "", enabled: true },
        populationBuffer: { capacity: 50, storedAmount: 10 }
      },
      snapshotAttempts: 1
    });
    expect(captureHostedSnapshot).toHaveBeenCalledOnce();
  });

  it("fails closed when the real header collect button disagrees with stale action-row copy", async () => {
    const hostedBuilding = {
      actions: [{
        actionId: "collect_population",
        disabledReason: "Bytový blok potřebuje alespoň 10 lidí k výběru.",
        enabled: false
      }],
      buildingTypeId: "apartment_block",
      presentation: {
        populationBuffer: { capacity: 50, storedAmount: 1 }
      },
      specialActions: []
    };
    const hostedPage = { evaluate: vi.fn().mockResolvedValue(hostedBuilding) };
    const localPage = { evaluate: vi.fn().mockResolvedValue(undefined) };
    const captureHostedSnapshot = vi.fn().mockResolvedValue({
      presentation: {
        collectAction: {
          disabled: true,
          disabledReason: "Bytový blok zatím nemá připravené obyvatele."
        },
        actions: [{
          actionId: "collect_population",
          disabled: true,
          disabledReason: "Bytový blok potřebuje alespoň 10 lidí k výběru."
        }]
      }
    });

    await expect(captureStableHostedPopulationParitySnapshot(
      localPage,
      hostedPage,
      "apartment_block",
      captureHostedSnapshot
    )).rejects.toThrow(
      "apartment_block rendered collect state did not match the authoritative population snapshot during 3 parity captures."
    );
    expect(captureHostedSnapshot).toHaveBeenCalledTimes(3);
  });

  it("recaptures a hosted signature when population advances after local sync", async () => {
    const createHostedBuilding = (storedAmount) => ({
      actions: [{
        actionId: "collect_population",
        disabledReason: Math.floor(storedAmount) <= 0
          ? "Bytový blok zatím nemá připravené obyvatele."
          : "Bytový blok potřebuje alespoň 10 lidí k výběru.",
        enabled: false
      }],
      buildingTypeId: "apartment_block",
      presentation: {
        populationBuffer: { capacity: 50, storedAmount }
      },
      specialActions: []
    });
    const hostedPage = {
      evaluate: vi.fn()
        .mockResolvedValueOnce(createHostedBuilding(0.75))
        .mockResolvedValueOnce(createHostedBuilding(1.25))
        .mockResolvedValueOnce(createHostedBuilding(1.75))
    };
    const localPage = { evaluate: vi.fn().mockResolvedValue(undefined) };
    const firstSignature = {
      presentation: {
        actions: [{
          actionId: "collect_population",
          disabled: true,
          disabledReason: "Bytový blok zatím nemá připravené obyvatele."
        }]
      },
      structure: { controls: [{ title: "empty" }] }
    };
    const stableSignature = {
      presentation: {
        actions: [{
          actionId: "collect_population",
          disabled: true,
          disabledReason: "Bytový blok potřebuje alespoň 10 lidí k výběru."
        }]
      },
      structure: { controls: [{ title: "minimum" }] }
    };
    const captureHostedSnapshot = vi.fn()
      .mockResolvedValueOnce(firstSignature)
      .mockResolvedValueOnce(stableSignature);

    const result = await captureStableHostedPopulationParitySnapshot(
      localPage,
      hostedPage,
      "apartment_block",
      captureHostedSnapshot
    );

    expect(result).toMatchObject({
      hostedSnapshot: stableSignature,
      populationFixture: {
        buildingTypeId: "apartment_block",
        collect: {
          disabledReason: "Bytový blok potřebuje alespoň 10 lidí k výběru."
        },
        populationBuffer: { capacity: 50, storedAmount: 1 }
      },
      snapshotAttempts: 2
    });
    expect(captureHostedSnapshot).toHaveBeenCalledTimes(2);
    expect(localPage.evaluate).toHaveBeenCalledTimes(2);
    expect(localPage.evaluate.mock.calls.map((call) => (
      call[1].populationBuffer.storedAmount
    ))).toEqual([0, 1]);
  });

  it("fails closed when the visible population amount keeps crossing thresholds", async () => {
    const createHostedBuilding = (storedAmount) => {
      const enabled = Math.floor(storedAmount) >= 10;
      return {
        actions: [{
          actionId: "collect_population",
          disabledReason: enabled ? "" : "Bytový blok potřebuje alespoň 10 lidí k výběru.",
          enabled
        }],
        buildingTypeId: "apartment_block",
        presentation: {
          populationBuffer: { capacity: 50, storedAmount }
        },
        specialActions: []
      };
    };
    const hostedPage = {
      evaluate: vi.fn()
        .mockResolvedValueOnce(createHostedBuilding(9.1))
        .mockResolvedValueOnce(createHostedBuilding(10.1))
        .mockResolvedValueOnce(createHostedBuilding(11.1))
        .mockResolvedValueOnce(createHostedBuilding(12.1))
    };
    const localPage = { evaluate: vi.fn().mockResolvedValue(undefined) };
    const captureHostedSnapshot = vi.fn()
      .mockResolvedValueOnce({
        presentation: {
          actions: [{
            actionId: "collect_population",
            disabled: true,
            disabledReason: "Bytový blok potřebuje alespoň 10 lidí k výběru."
          }]
        }
      })
      .mockResolvedValue({
        presentation: {
          actions: [{
            actionId: "collect_population",
            disabled: false,
            disabledReason: ""
          }]
        }
      });

    await expect(captureStableHostedPopulationParitySnapshot(
      localPage,
      hostedPage,
      "apartment_block",
      captureHostedSnapshot
    )).rejects.toThrow(
      "apartment_block authoritative population snapshot changed during 3 parity captures."
    );

    expect(captureHostedSnapshot).toHaveBeenCalledTimes(3);
    expect(localPage.evaluate.mock.calls.map((call) => (
      call[1].populationBuffer.storedAmount
    ))).toEqual([9, 10, 11]);
  });

  it("recaptures when the rendered collect state lags behind a stable read model", async () => {
    const hostedBuilding = {
      actions: [{
        actionId: "collect_population",
        disabledReason: "Bytový blok potřebuje alespoň 10 lidí k výběru.",
        enabled: false
      }],
      buildingTypeId: "apartment_block",
      presentation: {
        populationBuffer: { capacity: 50, storedAmount: 1 }
      },
      specialActions: []
    };
    const hostedPage = { evaluate: vi.fn().mockResolvedValue(hostedBuilding) };
    const localPage = { evaluate: vi.fn().mockResolvedValue(undefined) };
    const staleSignature = {
      presentation: {
        actions: [{
          actionId: "collect_population",
          disabled: true,
          disabledReason: "Bytový blok zatím nemá připravené obyvatele."
        }]
      }
    };
    const stableSignature = {
      presentation: {
        actions: [{
          actionId: "collect_population",
          disabled: true,
          disabledReason: "Bytový blok potřebuje alespoň 10 lidí k výběru."
        }]
      }
    };
    const captureHostedSnapshot = vi.fn()
      .mockResolvedValueOnce(staleSignature)
      .mockResolvedValueOnce(stableSignature);

    const result = await captureStableHostedPopulationParitySnapshot(
      localPage,
      hostedPage,
      "apartment_block",
      captureHostedSnapshot
    );

    expect(result.hostedSnapshot).toBe(stableSignature);
    expect(result.snapshotAttempts).toBe(2);
    expect(captureHostedSnapshot).toHaveBeenCalledTimes(2);
    expect(localPage.evaluate).toHaveBeenCalledTimes(1);
  });

  it("returns a stable hosted signature without normalizing structural content", async () => {
    const hostedBuilding = {
      actions: [{
        actionId: "collect_population",
        disabledReason: "Bytový blok zatím nemá připravené obyvatele.",
        enabled: false
      }],
      buildingTypeId: "apartment_block",
      presentation: {
        populationBuffer: { capacity: 50, storedAmount: 0 }
      },
      specialActions: []
    };
    const hostedPage = {
      evaluate: vi.fn().mockResolvedValue(hostedBuilding)
    };
    const localPage = { evaluate: vi.fn().mockResolvedValue(undefined) };
    const structuralSignature = {
      presentation: {
        actions: [{
          actionId: "collect_population",
          disabled: true,
          disabledReason: "Bytový blok zatím nemá připravené obyvatele."
        }]
      },
      structure: { controls: [{ title: "genuine structural difference" }] }
    };

    const result = await captureStableHostedPopulationParitySnapshot(
      localPage,
      hostedPage,
      "apartment_block",
      vi.fn().mockResolvedValue(structuralSignature)
    );

    expect(result.hostedSnapshot).toBe(structuralSignature);
    expect(result.snapshotAttempts).toBe(1);
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

  it("keeps text paint at one raster pixel and rounded composites at two", () => {
    expect(PARITY_SCREENSHOT_RASTER_FRINGE_PX).toBe(1);
    expect(PARITY_ROUNDED_COMPOSITE_RASTER_FRINGE_PX).toBe(2);
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
    expect(roundedExterior).toContainEqual({ height: 1, width: 3, x: 0, y: 575 });
    expect(roundedExterior).toContainEqual({ height: 1, width: 20, x: 0, y: 593 });
    expect(Math.max(...roundedExterior.map((region) => region.width))).toBe(20);

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
    expect(Math.max(...pillExterior.map((region) => region.width))).toBeLessThanOrEqual(9);
  });

  it("covers pharmacy quantity antialias pixels without masking inward content", () => {
    const regions = createRoundedCornerCompositeIgnoreRegions({
      height: 33,
      radii: {
        bottomRight: { x: 12, y: 12 }
      },
      width: 46
    });
    const masksPoint = (x, y) => regions.some((region) => (
      x >= region.x
      && x < region.x + region.width
      && y >= region.y
      && y < region.y + region.height
    ));

    expect(masksPoint(43, 25)).toBe(true);
    expect(masksPoint(42, 26)).toBe(true);
    expect(masksPoint(42, 25)).toBe(false);
    expect(masksPoint(41, 26)).toBe(false);
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
      { height: 1, width: 5, x: 10, y: 20 },
      { height: 1, width: 3, x: 10, y: 21 },
      { height: 1, width: 3, x: 10, y: 22 },
      { height: 1, width: 3, x: 10, y: 23 }
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
        { height: 1, width: 5, x: 5, y: 6 },
        { height: 1, width: 3, x: 5, y: 7 },
        { height: 1, width: 3, x: 5, y: 8 },
        { height: 1, width: 3, x: 5, y: 9 }
      ],
      screenshot
    });
    expect(page.evaluate).toHaveBeenCalledTimes(4);
    expect(page.evaluate.mock.calls[3][1]).toBe([
      ".map-boost-btn",
      "#profile-gang-card .profile-row--alliance",
      "#global-chat-card .server-chat-panel__send--arrow"
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
          backgroundColorApplied: true,
          previousBackgroundColor: "rgba(0, 0, 0, 0)",
          previousBackgroundColorPriority: "",
          token: "parity-test"
        })
        .mockResolvedValueOnce(undefined)
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
      stableBackdropColor: "rgb(2, 6, 12)",
      stableBackdropShellSelector: "[data-market-popup]",
      target
    })).resolves.toEqual({ ignoreRegions: [], screenshot });

    expect(target.evaluate).toHaveBeenCalledTimes(5);
    expect(page.evaluate).toHaveBeenCalledTimes(1);
    expect(captureIsolatedParityScreenshot.toString()).toContain(
      'setProperty("opacity", "0", "important")'
    );
    expect(captureIsolatedParityScreenshot.toString()).toContain(
      'setProperty("background-color", config.backgroundColor, "important")'
    );
    expect(target.evaluate.mock.calls[2][1]).toEqual({
      backgroundColor: "rgb(2, 6, 12)",
      shellSelector: "[data-market-popup]"
    });
    expect(target.evaluate.mock.calls[4][1]).toEqual({
      shellSelector: "[data-market-popup]",
      state: {
        backgroundColorApplied: true,
        previousBackgroundColor: "rgba(0, 0, 0, 0)",
        previousBackgroundColorPriority: "",
        token: "parity-test"
      }
    });
    expect(target.screenshot).toHaveBeenCalledTimes(1);
    expect(target.evaluate.mock.invocationCallOrder[2])
      .toBeLessThan(target.evaluate.mock.invocationCallOrder[3]);
    expect(target.evaluate.mock.invocationCallOrder[3])
      .toBeLessThan(target.screenshot.mock.invocationCallOrder[0]);
    expect(target.screenshot.mock.invocationCallOrder[0])
      .toBeLessThan(target.evaluate.mock.invocationCallOrder[4]);
  });

  it("restores capture-only target styles with their original inline priorities", async () => {
    const screenshotFailure = new Error("synthetic screenshot failure");
    const districtOwnerOpacity = "--district-owner-avatar-opacity";
    const { element, style } = createParityStyleElement({
      [districtOwnerOpacity]: { priority: "important", value: "0.24" }
    });
    let evaluateCall = 0;
    const target = {
      evaluate: vi.fn(async (callback, argument) => {
        evaluateCall += 1;
        if (evaluateCall === 2) {
          return {
            dynamicRegions: [],
            roundedBox: { height: 100, radii: {}, width: 100 }
          };
        }
        if (evaluateCall === 3 || evaluateCall === 5) {
          return callback(element, argument);
        }
        return undefined;
      }),
      screenshot: vi.fn().mockRejectedValue(screenshotFailure)
    };
    const page = {
      evaluate: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn(),
      mouse: { move: vi.fn().mockResolvedValue(undefined) }
    };
    const stableTargetStyleProperties = {
      [districtOwnerOpacity]: "0"
    };

    await expect(captureIsolatedParityScreenshot(page, {
      path: "district-surface.png",
      stableTargetStyleProperties,
      target
    })).rejects.toThrow("synthetic screenshot failure");

    expect(target.evaluate).toHaveBeenCalledTimes(5);
    expect(target.evaluate.mock.calls[2][1]).toEqual(stableTargetStyleProperties);
    expect(target.evaluate.mock.calls[4][1]).toEqual(expect.objectContaining({
      entries: [
        {
          previousPriority: "important",
          previousValue: "0.24",
          propertyName: districtOwnerOpacity,
          value: "0"
        }
      ],
      previousToken: null,
      token: expect.stringMatching(/^parity-target-style-/u)
    }));
    expect(style.setProperty).toHaveBeenNthCalledWith(
      1,
      districtOwnerOpacity,
      "0",
      "important"
    );
    expect(style.setProperty).toHaveBeenNthCalledWith(
      2,
      districtOwnerOpacity,
      "0.24",
      "important"
    );
    expect(style.removeProperty).not.toHaveBeenCalled();
    expect(target.screenshot.mock.invocationCallOrder[0])
      .toBeLessThan(target.evaluate.mock.invocationCallOrder[4]);
  });

  it("keeps token-scoped capture styles stable while preserving runtime inline updates", async () => {
    const avatarOpacity = "--district-owner-avatar-opacity";
    const avatarUrl = "--district-owner-avatar-url";
    let screenshotStyleSnapshot = null;
    const harness = createPinnedTargetStyleCaptureHarness({
      initialStyles: {
        [avatarOpacity]: { priority: "important", value: "0.24" },
        [avatarUrl]: { priority: "", value: 'url("initial-owner.png")' }
      },
      onSettle: ({ original }) => {
        original.style.setProperty(avatarOpacity, "0.68", "");
        original.style.setProperty(avatarUrl, 'url("runtime-owner.png")', "");
      },
      onScreenshot: ({ original }) => {
        const captureRuleStyle = original.ownerDocument.styleElements[0]?.sheet?.cssRules?.[0]?.style;
        screenshotStyleSnapshot = {
          captureOpacity: captureRuleStyle?.getPropertyValue(avatarOpacity),
          captureOpacityPriority: captureRuleStyle?.getPropertyPriority(avatarOpacity),
          captureUrl: captureRuleStyle?.getPropertyValue(avatarUrl),
          captureUrlPriority: captureRuleStyle?.getPropertyPriority(avatarUrl),
          inlineOpacity: original.style.getPropertyValue(avatarOpacity),
          inlineOpacityPriority: original.style.getPropertyPriority(avatarOpacity),
          inlineUrl: original.style.getPropertyValue(avatarUrl),
          inlineUrlPriority: original.style.getPropertyPriority(avatarUrl)
        };
      }
    });

    await expect(captureIsolatedParityScreenshot(harness.page, {
      path: "runtime-updated-district-surface.png",
      stableTargetStyleProperties: {
        [avatarOpacity]: "0",
        [avatarUrl]: "none"
      },
      target: harness.target
    })).resolves.toEqual({ ignoreRegions: [], screenshot: Buffer.from("png") });

    expect(screenshotStyleSnapshot).toEqual({
      captureOpacity: "0",
      captureOpacityPriority: "important",
      captureUrl: "none",
      captureUrlPriority: "important",
      inlineOpacity: "0.68",
      inlineOpacityPriority: "",
      inlineUrl: 'url("runtime-owner.png")',
      inlineUrlPriority: ""
    });
    expect(harness.original.ownerDocument.styleElements).toHaveLength(0);
    expect(harness.original.values.get(avatarOpacity)).toBe("0.68");
    expect(harness.original.priorities.get(avatarOpacity)).toBe("");
    expect(harness.original.values.get(avatarUrl)).toBe('url("runtime-owner.png")');
    expect(harness.original.priorities.get(avatarUrl)).toBe("");
    expect(harness.original.attributes.has("data-parity-capture-stable-target-style")).toBe(false);
  });

  it("aligns a capture target to device pixels before reading regions and restores translate", async () => {
    const original = createParityStyleElement({
      translate: { priority: "important", value: "0px 0px" }
    });
    original.element.getBoundingClientRect = vi.fn(() => {
      const [translateX, translateY] = String(
        original.style.getPropertyValue("translate") || "0px 0px"
      ).split(/\s+/u).map((value) => Number.parseFloat(value) || 0);
      return { left: 10.25 + translateX, top: 20.75 + translateY };
    });
    let handleEvaluateCall = 0;
    let screenshotBounds = null;
    let screenshotTranslate = null;
    const handle = {
      dispose: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn(async (callback, argument) => {
        handleEvaluateCall += 1;
        if ([1, 3, 5].includes(handleEvaluateCall)) {
          return callback(original.element, argument);
        }
        if (handleEvaluateCall === 4) {
          return {
            dynamicRegions: [],
            roundedBox: { height: 47, radii: {}, width: 254 },
            roundedBoxes: []
          };
        }
        return undefined;
      }),
      screenshot: vi.fn(async () => {
        screenshotBounds = original.element.getBoundingClientRect();
        screenshotTranslate = {
          priority: original.style.getPropertyPriority("translate"),
          value: original.style.getPropertyValue("translate")
        };
        return Buffer.from("png");
      })
    };
    const target = {
      elementHandle: vi.fn().mockResolvedValue(handle),
      evaluate: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn()
    };
    const page = {
      evaluate: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn(),
      mouse: { move: vi.fn().mockResolvedValue(undefined) }
    };

    vi.stubGlobal("window", {
      devicePixelRatio: 1,
      getComputedStyle: vi.fn(() => ({ translate: "0px 0px" }))
    });
    try {
      await expect(captureIsolatedParityScreenshot(page, {
        path: "fractional-inline-action.png",
        stableTargetDevicePixelAlignment: true,
        target
      })).resolves.toEqual({ ignoreRegions: [], screenshot: Buffer.from("png") });
    } finally {
      vi.unstubAllGlobals();
    }

    expect(screenshotBounds).toEqual({ left: 10, top: 21 });
    expect(screenshotTranslate).toEqual({ priority: "important", value: "-0.25px 0.25px" });
    expect(handle.evaluate).toHaveBeenCalledTimes(5);
    expect(handle.evaluate.mock.invocationCallOrder[1])
      .toBeLessThan(handle.evaluate.mock.invocationCallOrder[2]);
    expect(handle.screenshot.mock.invocationCallOrder[0])
      .toBeLessThan(handle.evaluate.mock.invocationCallOrder[4]);
    expect(original.values.get("translate")).toBe("0px 0px");
    expect(original.priorities.get("translate")).toBe("important");
    expect(original.attributes.has("data-parity-capture-device-pixel-alignment")).toBe(false);
    expect(target.screenshot).not.toHaveBeenCalled();
    expect(handle.dispose).toHaveBeenCalledTimes(1);
  });

  it("stabilizes every descendant edge after rounded dimensions change flex layout", async () => {
    const first = createParityStyleElement();
    const second = createParityStyleElement();
    const readPixels = (element, propertyName, fallback) => {
      const value = Number.parseFloat(element.style.getPropertyValue(propertyName));
      return Number.isFinite(value) ? value : fallback;
    };
    const readTranslate = (element) => String(
      element.style.getPropertyValue("translate") || "0px 0px"
    ).split(/\s+/u).map((value) => Number.parseFloat(value) || 0);
    first.element.getBoundingClientRect = vi.fn(() => {
      const [translateX, translateY] = readTranslate(first.element);
      const left = 10.25 + translateX;
      const top = 20.75 + translateY;
      const width = readPixels(first.element, "width", 80.4);
      const height = readPixels(first.element, "height", 40.4);
      return { bottom: top + height, height, left, right: left + width, top, width };
    });
    second.element.getBoundingClientRect = vi.fn(() => {
      const [translateX, translateY] = readTranslate(second.element);
      const firstWidth = readPixels(first.element, "width", 80.4);
      const left = 10.25 + firstWidth + 10.1 + translateX;
      const top = 20.75 + translateY;
      const width = readPixels(second.element, "width", 70.4);
      const height = readPixels(second.element, "height", 40.4);
      return { bottom: top + height, height, left, right: left + width, top, width };
    });
    const descendants = [first.element, second.element];
    const root = {
      matches: vi.fn().mockReturnValue(false),
      querySelector: vi.fn((selector) => {
        const token = String(selector).match(/="([^"]+)"\]$/u)?.[1] || "";
        return descendants.find((element) => (
          element.getAttribute("data-parity-capture-descendant-device-pixel-alignment") === token
        )) || null;
      }),
      querySelectorAll: vi.fn((selector) => (
        selector === ".district-popup-buildings__chip--button" ? descendants : []
      ))
    };
    let handleEvaluateCall = 0;
    let screenshotBounds = null;
    const handle = {
      dispose: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn(async (callback, argument) => {
        handleEvaluateCall += 1;
        if (handleEvaluateCall === 1 || handleEvaluateCall === 4) {
          return callback(root, argument);
        }
        if (handleEvaluateCall === 3) {
          return {
            dynamicRegions: [],
            roundedBox: { height: 100, radii: {}, width: 200 },
            roundedBoxes: []
          };
        }
        return undefined;
      }),
      screenshot: vi.fn(async () => {
        screenshotBounds = descendants.map((element) => element.getBoundingClientRect());
        return Buffer.from("png");
      })
    };
    const target = {
      elementHandle: vi.fn().mockResolvedValue(handle),
      evaluate: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn()
    };
    const page = {
      evaluate: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn(),
      mouse: { move: vi.fn().mockResolvedValue(undefined) }
    };

    vi.stubGlobal("CSS", { escape: vi.fn((value) => String(value)) });
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback) => callback(0)));
    vi.stubGlobal("window", {
      devicePixelRatio: 1,
      getComputedStyle: vi.fn((element) => ({
        display: "block",
        opacity: "1",
        translate: element.style.getPropertyValue("translate") || "none",
        visibility: "visible"
      }))
    });
    try {
      await expect(captureIsolatedParityScreenshot(page, {
        path: "district-chip-edges.png",
        stableDescendantDevicePixelAlignmentSelector:
          ".district-popup-buildings__chip--button",
        target
      })).resolves.toEqual({ ignoreRegions: [], screenshot: Buffer.from("png") });
    } finally {
      vi.unstubAllGlobals();
    }

    expect(screenshotBounds).toHaveLength(2);
    for (const bounds of screenshotBounds) {
      expect([bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isInteger)).toBe(true);
    }
    for (const { attributes, priorities, values } of [first, second]) {
      expect(values.has("box-sizing")).toBe(false);
      expect(values.has("height")).toBe(false);
      expect(values.has("translate")).toBe(false);
      expect(values.has("width")).toBe(false);
      expect(priorities.size).toBe(0);
      expect(attributes.has("data-parity-capture-descendant-device-pixel-alignment")).toBe(false);
    }
    expect(handle.evaluate).toHaveBeenCalledTimes(4);
    expect(handle.dispose).toHaveBeenCalledTimes(1);
  });

  it("pins capture styles to the original element and preserves a detached runtime update", async () => {
    let capturedToken = "";
    const harness = createPinnedTargetStyleCaptureHarness({
      onScreenshot: ({ original, propertyName }) => {
        capturedToken = original.attributes.get("data-parity-capture-stable-target-style") || "";
        original.element.isConnected = false;
        original.style.setProperty(propertyName, "0.8", "");
      }
    });

    await expect(captureIsolatedParityScreenshot(harness.page, {
      path: "detached-district-surface.png",
      stableTargetStyleProperties: { [harness.propertyName]: "0" },
      target: harness.target
    })).resolves.toEqual({ ignoreRegions: [], screenshot: Buffer.from("png") });

    expect(capturedToken).toMatch(/^parity-target-style-/u);
    expect(harness.target.evaluate).toHaveBeenCalledTimes(2);
    expect(harness.target.screenshot).not.toHaveBeenCalled();
    expect(harness.handle.screenshot).toHaveBeenCalledTimes(1);
    expect(harness.handle.dispose).toHaveBeenCalledTimes(1);
    expect(harness.original.values.get(harness.propertyName)).toBe("0.8");
    expect(harness.original.priorities.get(harness.propertyName)).toBe("");
    expect(harness.original.attributes.has("data-parity-capture-stable-target-style")).toBe(false);
    expect(harness.replacement.style.setProperty).not.toHaveBeenCalled();
    expect(harness.replacement.style.removeProperty).not.toHaveBeenCalled();
  });

  it("keeps the primary capture error when pinned-style cleanup also fails", async () => {
    const captureFailure = new Error("synthetic primary capture failure");
    const cleanupFailure = new Error("synthetic pinned-style cleanup failure");
    const harness = createPinnedTargetStyleCaptureHarness({
      cleanupError: cleanupFailure,
      screenshotError: captureFailure
    });

    await expect(captureIsolatedParityScreenshot(harness.page, {
      path: "failed-district-surface.png",
      stableTargetStyleProperties: { [harness.propertyName]: "0" },
      target: harness.target
    })).rejects.toBe(captureFailure);

    expect(harness.handle.dispose).toHaveBeenCalledTimes(1);
  });

  it("surfaces a pinned-style cleanup error after a successful capture", async () => {
    const cleanupFailure = new Error("synthetic pinned-style cleanup failure");
    const harness = createPinnedTargetStyleCaptureHarness({ cleanupError: cleanupFailure });

    await expect(captureIsolatedParityScreenshot(harness.page, {
      path: "cleanup-failed-district-surface.png",
      stableTargetStyleProperties: { [harness.propertyName]: "0" },
      target: harness.target
    })).rejects.toBe(cleanupFailure);

    expect(harness.handle.dispose).toHaveBeenCalledTimes(1);
  });

  it("restores capture-only raster stabilization when a screenshot fails", async () => {
    const screenshotFailure = new Error("synthetic screenshot failure");
    const stableRasterState = {
      entries: [{
        filter: "saturate(1.06) brightness(0.8)",
        filterPriority: "",
        transform: "scale(1.015)",
        transformPriority: ""
      }],
      token: "parity-raster-test"
    };
    const target = {
      evaluate: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          dynamicRegions: [],
          roundedBox: { height: 100, radii: {}, width: 100 }
        })
        .mockResolvedValueOnce(stableRasterState)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined),
      screenshot: vi.fn().mockRejectedValue(screenshotFailure)
    };
    const page = {
      evaluate: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn(),
      mouse: { move: vi.fn().mockResolvedValue(undefined) }
    };

    await expect(captureIsolatedParityScreenshot(page, {
      path: "district-surface.png",
      stableRasterSelector: ".district-modal-hero__image",
      target
    })).rejects.toThrow("synthetic screenshot failure");

    expect(target.evaluate).toHaveBeenCalledTimes(5);
    expect(target.evaluate.mock.calls[2][1]).toBe(".district-modal-hero__image");
    expect(target.evaluate.mock.calls[4][1]).toEqual(stableRasterState);
    expect(target.evaluate.mock.invocationCallOrder[2])
      .toBeLessThan(target.evaluate.mock.invocationCallOrder[3]);
    expect(target.evaluate.mock.invocationCallOrder[3])
      .toBeLessThan(target.screenshot.mock.invocationCallOrder[0]);
    expect(target.screenshot.mock.invocationCallOrder[0])
      .toBeLessThan(target.evaluate.mock.invocationCallOrder[4]);
  });

  it("restores capture-only backdrop-filter stabilization when a screenshot fails", async () => {
    const screenshotFailure = new Error("synthetic screenshot failure");
    const stableBackdropFilterState = {
      previousRootToken: null,
      token: "parity-backdrop-filter-test"
    };
    const target = {
      evaluate: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          dynamicRegions: [],
          roundedBox: { height: 100, radii: {}, width: 100 }
        })
        .mockResolvedValueOnce(stableBackdropFilterState)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined),
      screenshot: vi.fn().mockRejectedValue(screenshotFailure)
    };
    const page = {
      evaluate: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn(),
      mouse: { move: vi.fn().mockResolvedValue(undefined) }
    };

    await expect(captureIsolatedParityScreenshot(page, {
      path: "district-surface.png",
      stableBackdropFilterSelector: ".district-popup-action",
      target
    })).rejects.toThrow("synthetic screenshot failure");

    expect(target.evaluate).toHaveBeenCalledTimes(5);
    expect(target.evaluate.mock.calls[2][1]).toBe(".district-popup-action");
    expect(target.evaluate.mock.calls[4][1]).toEqual(stableBackdropFilterState);
    expect(captureIsolatedParityScreenshot.toString()).toContain(
      "data-parity-capture-stable-backdrop-filter-root"
    );
    expect(captureIsolatedParityScreenshot.toString()).toContain(
      "const specificRootSelector = rootSelector.repeat(3)"
    );
    expect(captureIsolatedParityScreenshot.toString()).toContain(
      "{-webkit-backdrop-filter:none!important;backdrop-filter:none!important;}"
    );
    expect(captureIsolatedParityScreenshot.toString()).toContain(
      "document.querySelectorAll(styleSelector).forEach((element) => element.remove())"
    );
    expect(target.evaluate.mock.invocationCallOrder[2])
      .toBeLessThan(target.evaluate.mock.invocationCallOrder[3]);
    expect(target.evaluate.mock.invocationCallOrder[3])
      .toBeLessThan(target.screenshot.mock.invocationCallOrder[0]);
    expect(target.screenshot.mock.invocationCallOrder[0])
      .toBeLessThan(target.evaluate.mock.invocationCallOrder[4]);
  });

  it("restores the stable backdrop when backdrop-filter cleanup fails", async () => {
    const screenshot = Buffer.from("png");
    const filterCleanupFailure = new Error("synthetic backdrop-filter cleanup failure");
    const stableBackdropState = {
      backgroundColorApplied: true,
      previousBackgroundColor: "rgba(0, 0, 0, 0)",
      previousBackgroundColorPriority: "",
      token: "parity-backdrop-test"
    };
    const stableBackdropFilterState = {
      previousRootToken: null,
      token: "parity-backdrop-filter-test"
    };
    const target = {
      evaluate: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          dynamicRegions: [],
          roundedBox: { height: 100, radii: {}, width: 100 }
        })
        .mockResolvedValueOnce(stableBackdropState)
        .mockResolvedValueOnce(stableBackdropFilterState)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(filterCleanupFailure)
        .mockResolvedValueOnce(undefined),
      screenshot: vi.fn().mockResolvedValue(screenshot)
    };
    const page = {
      evaluate: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn(),
      mouse: { move: vi.fn().mockResolvedValue(undefined) }
    };

    await expect(captureIsolatedParityScreenshot(page, {
      path: "district-surface.png",
      stableBackdropColor: "rgb(2, 6, 12)",
      stableBackdropFilterSelector: ".district-popup-action",
      stableBackdropShellSelector: "[data-district-popup]",
      target
    })).rejects.toThrow("synthetic backdrop-filter cleanup failure");

    expect(target.evaluate).toHaveBeenCalledTimes(7);
    expect(target.evaluate.mock.calls[6][1]).toEqual({
      shellSelector: "[data-district-popup]",
      state: stableBackdropState
    });
  });

  it("restores the stable backdrop even when raster cleanup fails", async () => {
    const screenshot = Buffer.from("png");
    const rasterCleanupFailure = new Error("synthetic raster cleanup failure");
    const stableBackdropState = {
      backgroundColorApplied: true,
      previousBackgroundColor: "rgba(0, 0, 0, 0)",
      previousBackgroundColorPriority: "",
      token: "parity-backdrop-test"
    };
    const stableRasterState = {
      entries: [{ filter: "", filterPriority: "", transform: "", transformPriority: "" }],
      token: "parity-raster-test"
    };
    const target = {
      evaluate: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          dynamicRegions: [],
          roundedBox: { height: 100, radii: {}, width: 100 }
        })
        .mockResolvedValueOnce(stableBackdropState)
        .mockResolvedValueOnce(stableRasterState)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(rasterCleanupFailure)
        .mockResolvedValueOnce(undefined),
      screenshot: vi.fn().mockResolvedValue(screenshot)
    };
    const page = {
      evaluate: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn(),
      mouse: { move: vi.fn().mockResolvedValue(undefined) }
    };

    await expect(captureIsolatedParityScreenshot(page, {
      path: "district-surface.png",
      stableBackdropColor: "rgb(2, 6, 12)",
      stableBackdropShellSelector: "[data-district-popup]",
      stableRasterSelector: ".district-modal-hero__image",
      target
    })).rejects.toThrow("synthetic raster cleanup failure");

    expect(target.evaluate).toHaveBeenCalledTimes(7);
    expect(target.evaluate.mock.calls[6][1]).toEqual({
      shellSelector: "[data-district-popup]",
      state: stableBackdropState
    });
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
          overflowY: "auto",
          scrollLeft: 7,
          scrollTop: 373
        },
        html: {
          canScrollY: true,
          maxScrollLeft: 23,
          maxScrollTop: 864,
          overflowY: "auto",
          scrollLeft: 11,
          scrollTop: 373
        },
        regions: [{ maxScrollTop: 412, path: "surface/div:0" }],
        surface: { maxScrollLeft: 29, maxScrollTop: 538 },
        windowX: 11,
        windowY: 373
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
      overflowY: "auto",
      scrollLeft: 0,
      scrollTop: 0
    });
    expect(normalized.scroll.html).toEqual({
      canScrollY: true,
      maxScrollLeft: 23,
      maxScrollTop: 0,
      overflowY: "auto",
      scrollLeft: 0,
      scrollTop: 0
    });
    expect(normalized.scroll.windowX).toBe(0);
    expect(normalized.scroll.windowY).toBe(0);
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
    expect(openParityLocalDemo.toString()).toContain('gangColor = "#ef4444"');
    expect(openParityLocalDemo.toString()).toContain("gangColor: configuredGangColor");
    expect(openParityLocalDemo.toString()).toContain("2854d1df-0f7c-4fe4-aa85-7a70dfe299db.jpg");
    expect(openParityLocalDemo.toString()).toContain("bountyDemoTargets: configuredBountyDemoTargets");
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
