import { describe, expect, it, vi } from "vitest";
import { createServerMapPresentationController } from "../../page-assets/js/app/map/serverMapPresentationController.js";

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }

  listenerCount() {
    return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0);
  }
}

class FakeWindow extends FakeEventTarget {
  constructor() {
    super();
    this.frames = new Map();
    this.cancelledFrames = [];
    this.nextFrameId = 1;
    this.now = 0;
    this.performance = { now: () => this.now };
  }

  requestAnimationFrame(callback) {
    const frameId = this.nextFrameId;
    this.nextFrameId += 1;
    this.frames.set(frameId, callback);
    return frameId;
  }

  cancelAnimationFrame(frameId) {
    this.cancelledFrames.push(frameId);
    this.frames.delete(frameId);
  }

  fireFrame(frameId, time = 16) {
    const callback = this.frames.get(frameId);
    this.frames.delete(frameId);
    this.now = time;
    callback?.(time);
  }
}

class FakeDocument extends FakeEventTarget {
  constructor(windowRef) {
    super();
    this.hidden = false;
    this.defaultView = windowRef;
  }
}

const createCanvas = (width = 1600, height = 980) => {
  const context = {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    closePath: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn()
  };
  return {
    width,
    height,
    getAttribute: (name) => name === "width" ? String(width) : name === "height" ? String(height) : null,
    getContext: () => context
  };
};

const createSlice = (overrides = {}) => ({
  server: {
    selectedDistrictId: "district:1",
    mapManifestId: "empire-city",
    mapManifestVersion: 1,
    mapManifestHash: "hash"
  },
  player: {
    playerId: "player:1",
    color: "#44ddff",
    factionId: "mafia",
    economy: { cleanCash: 100, dirtyCash: 50 },
    dayNight: { uiThemeHint: "day" },
    police: null
  },
  districts: [
    {
      districtId: "district:1",
      name: "One",
      zone: "residential",
      ownerPlayerId: "player:1",
      ownerColor: "#44ddff",
      isOwnedByPlayer: true,
      status: "claimed",
      heat: 1,
      influence: 2,
      buildings: []
    },
    {
      districtId: "district:2",
      name: "Two",
      zone: "industrial",
      ownerPlayerId: "player:2",
      ownerColor: "#ff4488",
      isOwnedByPlayer: false,
      status: "claimed",
      heat: 2,
      influence: 3,
      buildings: []
    }
  ],
  district: { districtId: "district:1" },
  reports: [],
  ...overrides
});

const createHarness = (initialSlice = createSlice(), overrides = {}) => {
  const windowRef = new FakeWindow();
  const documentRef = new FakeDocument(windowRef);
  const root = { ownerDocument: documentRef };
  const viewport = new FakeEventTarget();
  viewport.dataset = {};
  viewport.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 490 });
  const canvasHost = {
    clientWidth: 800,
    clientHeight: 490,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 490 })
  };
  const shell = {
    canRender: true,
    canvas: createCanvas(),
    staticCanvas: createCanvas(),
    selectionCanvas: createCanvas(),
    effectsCanvas: createCanvas(),
    hoverCanvas: createCanvas(),
    canvasHost,
    viewport,
    phaseHost: { dataset: {}, setAttribute: vi.fn() },
    tooltip: null,
    tooltipValue: null,
    tooltipType: null,
    tooltipGossip: null
  };
  const geometry = {
    width: 1600,
    height: 980,
    districts: [{
      id: 1,
      name: "One",
      districtType: "residential",
      centerX: 100,
      centerY: 100,
      polygon: [{ x: 20, y: 20 }, { x: 180, y: 20 }, { x: 100, y: 180 }]
    }]
  };
  const composition = {
    renderDistrictStaticCanvas: vi.fn(() => geometry),
    renderDistrictStateCanvas: vi.fn(() => geometry),
    renderDistrictSelectionCanvas: vi.fn(() => geometry),
    renderDistrictEffectsCanvas: vi.fn(() => geometry)
  };
  let sourceListener = null;
  const unsubscribe = vi.fn();
  const source = {
    getCurrentReadModel: vi.fn(() => initialSlice),
    subscribe: vi.fn((listener) => {
      sourceListener = listener;
      return unsubscribe;
    }),
    emit: (slice) => sourceListener?.(slice)
  };
  const invalidations = [];
  const schedulerDestroy = vi.fn();
  const createScheduler = vi.fn(({ render }) => ({
    invalidate: vi.fn((reason, options) => {
      invalidations.push({ reason, ...options });
      if (options.immediate) render({ reason, layers: options.layers });
      return true;
    }),
    destroy: schedulerDestroy
  }));
  const navigationDestroy = vi.fn();
  const selectDistrict = overrides.selectDistrict || vi.fn();
  const controller = createServerMapPresentationController({
    root,
    documentRef,
    windowRef,
    source,
    selectDistrict,
    initMapShell: () => shell,
    createCanvasComposition: () => composition,
    createScheduler,
    bindNavigation: () => ({ destroy: navigationDestroy }),
    loadMapImages: () => new Promise(() => {}),
    getPerformanceMode: () => ({
      active: false,
      reducedMotion: false,
      renderFpsCap: 60,
      dprCap: Number.POSITIVE_INFINITY
    }),
    ...overrides.controllerOptions
  });
  return {
    controller,
    composition,
    documentRef,
    invalidations,
    navigationDestroy,
    root,
    schedulerDestroy,
    selectDistrict,
    shell,
    source,
    unsubscribe,
    viewport,
    windowRef
  };
};

describe("server map presentation controller", () => {
  it("mounts one composition root with exactly five canvas layers", () => {
    const harness = createHarness();

    expect(harness.controller.mount()).toBe(harness.controller);
    expect(harness.controller.mount()).toBe(harness.controller);
    expect(createServerMapPresentationController({ root: harness.root })).toBe(harness.controller);
    expect(harness.source.subscribe).toHaveBeenCalledTimes(1);
    expect(harness.controller.getLayerCanvases()).toEqual({
      static: harness.shell.staticCanvas,
      state: harness.shell.canvas,
      selection: harness.shell.selectionCanvas,
      effects: harness.shell.effectsCanvas,
      hover: harness.shell.hoverCanvas
    });
    expect(harness.composition.renderDistrictStaticCanvas).toHaveBeenCalledTimes(1);
    expect(harness.composition.renderDistrictStateCanvas).toHaveBeenCalledTimes(1);
  });

  it("lets the presentation coordinator own source and page lifecycle", () => {
    const harness = createHarness(createSlice(), {
      controllerOptions: {
        manageSourceSubscription: false,
        managePageLifecycle: false
      }
    });

    harness.controller.mount();
    expect(harness.source.subscribe).not.toHaveBeenCalled();
    expect(harness.windowRef.listeners.get("pagehide")).toBeUndefined();
    expect(harness.controller.update(createSlice())).toBe(true);
    expect(harness.controller.destroy()).toBe(true);
  });

  it("skips equal and cash-only slices while owner changes invalidate only state", () => {
    const harness = createHarness();
    harness.controller.mount();
    harness.invalidations.length = 0;

    expect(harness.controller.update(createSlice())).toBe(false);
    expect(harness.controller.update(createSlice({
      player: {
        ...createSlice().player,
        economy: { cleanCash: 999, dirtyCash: 50 }
      }
    }))).toBe(false);
    expect(harness.invalidations).toEqual([]);

    const ownerChange = createSlice();
    ownerChange.districts[1] = {
      ...ownerChange.districts[1],
      ownerPlayerId: "player:3"
    };
    expect(harness.controller.update(ownerChange)).toBe(true);
    expect(harness.invalidations).toEqual([expect.objectContaining({
      reason: "server-slice-change",
      layers: ["state"]
    })]);
  });

  it("invalidates only selection for a server-selected district change", () => {
    const harness = createHarness();
    harness.controller.mount();
    harness.invalidations.length = 0;

    expect(harness.controller.update(createSlice({
      server: { ...createSlice().server, selectedDistrictId: "district:2" },
      district: { districtId: "district:2" }
    }))).toBe(true);
    expect(harness.invalidations).toEqual([expect.objectContaining({
      reason: "server-slice-change",
      layers: ["selection"]
    })]);
  });

  it("invalidates every size-dependent layer after resize", () => {
    const harness = createHarness();
    harness.controller.mount();
    harness.invalidations.length = 0;

    harness.windowRef.dispatch("resize");
    const [resizeFrameId] = harness.windowRef.frames.keys();
    harness.windowRef.fireFrame(resizeFrameId);

    expect(harness.invalidations).toEqual([expect.objectContaining({
      reason: "resize",
      layers: ["static", "state", "selection", "effects", "hover"]
    })]);
  });

  it("uses the injected selection adapter and commits its response immediately", async () => {
    const commandSlice = createSlice({
      server: { ...createSlice().server, selectedDistrictId: "district:2" },
      district: { districtId: "district:2" }
    });
    const selectDistrict = vi.fn(async () => ({ readModel: commandSlice }));
    const harness = createHarness(createSlice(), { selectDistrict });
    harness.controller.mount();
    harness.invalidations.length = 0;

    await harness.controller.setSelection(2);

    expect(selectDistrict).toHaveBeenCalledWith("district:2", expect.any(Object));
    expect(harness.controller.getPresentationModel().selectedDistrictId).toBe(2);
    expect(harness.source.getCurrentReadModel).toHaveBeenCalledTimes(1);
    expect(harness.invalidations[0]).toMatchObject({
      reason: "selection-change",
      layers: ["selection"],
      immediate: true
    });
  });

  it("signals a map selection only after its targeted response resolves", async () => {
    let resolveSelection;
    const response = new Promise((resolve) => {
      resolveSelection = resolve;
    });
    const selectDistrict = vi.fn(() => response);
    const onDistrictSelected = vi.fn();
    const harness = createHarness(createSlice(), {
      selectDistrict,
      controllerOptions: { onDistrictSelected }
    });
    harness.controller.mount();

    harness.viewport.dispatch("click", {
      clientX: 50,
      clientY: 50,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      stopImmediatePropagation: vi.fn()
    });
    expect(selectDistrict).toHaveBeenCalledWith("district:1", expect.any(Object));
    expect(onDistrictSelected).not.toHaveBeenCalled();

    resolveSelection({
      accepted: true,
      readModel: createSlice(),
      renderState: { districtPanel: { districtId: "district:1" } }
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(onDistrictSelected).toHaveBeenCalledWith(expect.objectContaining({
      districtId: "district:1",
      source: "map-click",
      response: expect.objectContaining({ accepted: true })
    }));
  });

  it("pauses hidden work, resumes once, and cleans all owned lifecycle hooks", () => {
    const future = Date.now() + 60_000;
    const harness = createHarness(createSlice({
      mapEffects: [{ type: "attack-district", districtId: "district:1", expiresAt: future }]
    }));
    harness.controller.mount();
    expect(harness.windowRef.frames.size).toBe(1);
    harness.invalidations.length = 0;

    harness.documentRef.hidden = true;
    harness.documentRef.dispatch("visibilitychange");
    expect(harness.windowRef.frames.size).toBe(0);

    const ownerChange = createSlice();
    ownerChange.districts[1] = { ...ownerChange.districts[1], ownerPlayerId: "player:3" };
    harness.controller.update(ownerChange);
    expect(harness.invalidations).toEqual([]);

    harness.documentRef.hidden = false;
    harness.documentRef.dispatch("visibilitychange");
    harness.documentRef.dispatch("visibilitychange");
    expect(harness.windowRef.frames.size).toBeLessThanOrEqual(1);
    expect(harness.invalidations).toHaveLength(1);

    expect(harness.controller.destroy()).toBe(true);
    expect(harness.controller.destroy()).toBe(false);
    expect(harness.unsubscribe).toHaveBeenCalledTimes(1);
    expect(harness.schedulerDestroy).toHaveBeenCalledTimes(1);
    expect(harness.navigationDestroy).toHaveBeenCalledTimes(1);
    expect(harness.viewport.listenerCount()).toBe(0);
    expect(harness.windowRef.listenerCount()).toBe(0);
    expect(harness.documentRef.listenerCount()).toBe(0);
  });
});
