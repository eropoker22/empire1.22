import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDistrictGeometry,
  getDistrictAtPoint,
  getDistrictFillStyle,
  renderDistrictCanvas
} from "../../page-assets/js/app/runtime.js";
import {
  DAY_MAP_IMAGE_PATH,
  NIGHT_MAP_IMAGE_PATH
} from "../../page-assets/js/app/runtime/constants.js";

const originalWindow = globalThis.window;

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(String(key)) ? values.get(String(key)) : null;
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
    removeItem(key) {
      values.delete(String(key));
    },
    clear() {
      values.clear();
    }
  };
}

class FakeGradient {
  constructor(calls) {
    this.calls = calls;
  }

  addColorStop(offset, color) {
    this.calls.push(["addColorStop", offset, color]);
  }
}

class FakeCanvasContext {
  constructor() {
    this.calls = [];
    this.fillStyle = "";
    this.strokeStyle = "";
    this.lineWidth = 1;
    this.globalAlpha = 1;
    this.globalCompositeOperation = "source-over";
    this.shadowBlur = 0;
    this.shadowColor = "";
    this.font = "";
    this.textAlign = "";
    this.textBaseline = "";
    this.lineJoin = "";
    this.lineCap = "";
  }

  record(name, ...args) {
    this.calls.push([name, ...args]);
  }

  beginPath() { this.record("beginPath"); }
  moveTo(x, y) { this.record("moveTo", x, y); }
  lineTo(x, y) { this.record("lineTo", x, y); }
  closePath() { this.record("closePath"); }
  fill() {
    this.record("fill", {
      fillStyle: this.fillStyle,
      globalAlpha: this.globalAlpha,
      shadowBlur: this.shadowBlur,
      shadowColor: this.shadowColor
    });
  }
  stroke() {
    this.record("stroke", {
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      shadowBlur: this.shadowBlur,
      shadowColor: this.shadowColor
    });
  }
  clearRect(...args) { this.record("clearRect", ...args); }
  fillRect(...args) { this.record("fillRect", ...args); }
  drawImage(...args) { this.record("drawImage", ...args); }
  save() { this.record("save"); }
  restore() { this.record("restore"); }
  arc(...args) { this.record("arc", ...args); }
  clip() { this.record("clip"); }
  translate(...args) { this.record("translate", ...args); }
  rotate(...args) { this.record("rotate", ...args); }
  scale(...args) { this.record("scale", ...args); }
  setLineDash(value) { this.record("setLineDash", value); }
  strokeText(...args) { this.record("strokeText", ...args); }
  fillText(...args) { this.record("fillText", ...args, { fillStyle: this.fillStyle, font: this.font }); }
  measureText(text) { return { width: String(text || "").length * 7 }; }

  createLinearGradient(...args) {
    this.record("createLinearGradient", ...args);
    return new FakeGradient(this.calls);
  }

  createRadialGradient(...args) {
    this.record("createRadialGradient", ...args);
    return new FakeGradient(this.calls);
  }
}

class FakeCanvas {
  constructor(context) {
    this.width = 1600;
    this.height = 980;
    this.context = context;
  }

  getContext(type) {
    return type === "2d" ? this.context : null;
  }
}

describe("runtime map rendering guards", () => {
  beforeEach(() => {
    globalThis.window = {
      localStorage: createMemoryStorage(),
      empireStreetsAllianceState: null,
      empireStreetsBountyState: null
    };
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  });

  it("does not throw when the canvas container is missing", () => {
    expect(renderDistrictCanvas(null, "day")).toBeNull();
  });

  it("renders a district canvas with missing overlay data", () => {
    const context = new FakeCanvasContext();
    const canvas = new FakeCanvas(context);

    const geometry = renderDistrictCanvas(canvas, "night", {
      gamePhase: "live",
      ownedDistrictIds: new Set(),
      destroyedDistrictIds: new Set(),
      launchOwnerByDistrictId: new Map()
    });

    expect(geometry.districts).toHaveLength(161);
    expect(context.calls.some(([name]) => name === "clearRect")).toBe(true);
    expect(context.calls.some(([name]) => name === "fill")).toBe(true);
  });

  it("keeps live/dev map image paths relative to pages/game.html", () => {
    expect(DAY_MAP_IMAGE_PATH).toBe("../img/mapaden2.png");
    expect(NIGHT_MAP_IMAGE_PATH).toBe("../img/mapanoc.png");
  });

  it("draws the active day or night map image before district overlays", () => {
    const context = new FakeCanvasContext();
    const canvas = new FakeCanvas(context);
    const dayImage = { width: 1600, height: 980, src: DAY_MAP_IMAGE_PATH };
    const nightImage = { width: 1600, height: 980, src: NIGHT_MAP_IMAGE_PATH };

    renderDistrictCanvas(canvas, "day", {
      gamePhase: "live",
      ownedDistrictIds: new Set(),
      destroyedDistrictIds: new Set(),
      launchOwnerByDistrictId: new Map()
    }, { day: dayImage, night: nightImage });

    expect(context.calls.find(([name]) => name === "drawImage")?.[1]).toBe(dayImage);

    context.calls = [];
    renderDistrictCanvas(canvas, "night", {
      gamePhase: "live",
      ownedDistrictIds: new Set(),
      destroyedDistrictIds: new Set(),
      launchOwnerByDistrictId: new Map()
    }, { day: dayImage, night: nightImage });

    expect(context.calls.find(([name]) => name === "drawImage")?.[1]).toBe(nightImage);
  });

  it("hit-tests a mock district point like a map click", () => {
    const geometry = createDistrictGeometry(1600, 980);
    const district = geometry.districts[0];

    expect(getDistrictAtPoint(geometry, { x: district.centerX, y: district.centerY })?.id).toBe(district.id);
    expect(getDistrictAtPoint(null, { x: district.centerX, y: district.centerY })).toBeNull();
  });

  it("keeps fallback zone and ownership rendering stable during redraw", () => {
    const context = new FakeCanvasContext();
    const canvas = new FakeCanvas(context);
    const geometry = createDistrictGeometry(1600, 980);
    const selectedDistrict = geometry.districts[0];
    const interactionState = {
      gamePhase: "live",
      selectedDistrictId: selectedDistrict.id,
      ownedDistrictIds: new Set(),
      destroyedDistrictIds: new Set(),
      launchOwnerByDistrictId: new Map(),
      reducedMapEffects: true
    };

    expect(getDistrictFillStyle({ id: 9000, districtType: "missing-zone" }, false, {
      gamePhase: "live",
      ownedDistrictIds: new Set(),
      destroyedDistrictIds: new Set(),
      launchOwnerByDistrictId: new Map()
    })).toBe("rgba(250, 204, 21, 0.2)");

    expect(() => renderDistrictCanvas(canvas, "day", interactionState)).not.toThrow();

    interactionState.ownedDistrictIds = new Set([selectedDistrict.id]);
    expect(() => renderDistrictCanvas(canvas, "day", interactionState)).not.toThrow();
  });

  it("simulates district click selection and redraws selected ownership styling", () => {
    const context = new FakeCanvasContext();
    const canvas = new FakeCanvas(context);
    const geometry = createDistrictGeometry(1600, 980);
    const clickedDistrict = getDistrictAtPoint(geometry, {
      x: geometry.districts[0].centerX,
      y: geometry.districts[0].centerY
    });
    const interactionState = {
      gamePhase: "live",
      selectedDistrictId: clickedDistrict.id,
      hoveredDistrictId: clickedDistrict.id,
      ownedDistrictIds: new Set([clickedDistrict.id]),
      destroyedDistrictIds: new Set(),
      launchOwnerByDistrictId: new Map(),
      reducedMapEffects: true,
      geometryCache: geometry
    };

    const playerFill = getDistrictFillStyle(clickedDistrict, true, interactionState);

    expect(playerFill).toBe("#ef444433");
    expect(() => renderDistrictCanvas(canvas, "night", interactionState)).not.toThrow();

    const selectedHighlightStroke = context.calls.some(([name, meta]) => (
      name === "stroke"
      && meta?.strokeStyle === "rgba(255, 154, 61, 0.96)"
      && meta?.lineWidth === 2.4
    ));
    const selectedBorderStroke = context.calls.some(([name, meta]) => (
      name === "stroke"
      && meta?.strokeStyle === "rgba(255, 154, 61, 0.92)"
      && meta?.lineWidth === 2.8
    ));
    const playerOwnershipStroke = context.calls.some(([name, meta]) => (
      name === "stroke"
      && meta?.strokeStyle === "#ef4444"
      && meta?.lineWidth === 2.2
    ));

    expect(selectedHighlightStroke).toBe(true);
    expect(selectedBorderStroke).toBe(true);
    expect(playerOwnershipStroke).toBe(true);
  });

  it("keeps ownership redraw distinct from unowned zone fill", () => {
    const geometry = createDistrictGeometry(1600, 980);
    const district = geometry.districts[1];
    const unownedFill = getDistrictFillStyle(district, false, {
      gamePhase: "live",
      ownedDistrictIds: new Set(),
      destroyedDistrictIds: new Set(),
      launchOwnerByDistrictId: new Map()
    });
    const ownedFill = getDistrictFillStyle(district, false, {
      gamePhase: "live",
      ownedDistrictIds: new Set([district.id]),
      destroyedDistrictIds: new Set(),
      launchOwnerByDistrictId: new Map()
    });

    expect(unownedFill).not.toBe(ownedFill);
    expect(ownedFill).toBe("#ef444433");
  });

  it("draws unowned district borders in black when the black edge mode is selected", () => {
    const context = new FakeCanvasContext();
    const canvas = new FakeCanvas(context);
    const geometry = createDistrictGeometry(1600, 980);

    renderDistrictCanvas(canvas, "day", {
      gamePhase: "live",
      borderColor: "black",
      ownedDistrictIds: new Set(),
      destroyedDistrictIds: new Set(),
      launchOwnerByDistrictId: new Map(),
      reducedMapEffects: true,
      geometryCache: geometry
    });

    expect(context.calls.some(([name, meta]) => (
      name === "stroke"
      && meta?.strokeStyle === "rgba(5, 8, 12, 0.92)"
      && meta?.lineWidth === 1.2
    ))).toBe(true);
  });

  it("fills a captured enemy launch district with the current player color", () => {
    const context = new FakeCanvasContext();
    const canvas = new FakeCanvas(context);
    const geometry = createDistrictGeometry(1600, 980);
    const capturedDistrict = geometry.districts[2];
    const interactionState = {
      gamePhase: "launch",
      selectedDistrictId: capturedDistrict.id,
      ownedDistrictIds: new Set([capturedDistrict.id]),
      destroyedDistrictIds: new Set(),
      launchOwnerByDistrictId: new Map([[capturedDistrict.id, 2]]),
      showAllianceSymbols: true,
      mapVisibilityMode: "all",
      reducedMapEffects: true,
      geometryCache: geometry
    };

    expect(getDistrictFillStyle(capturedDistrict, false, interactionState)).toBe("#ef444433");
    expect(() => renderDistrictCanvas(canvas, "day", interactionState)).not.toThrow();

    const currentPlayerFill = context.calls.some(([name, meta]) => (
      name === "fill"
      && meta?.fillStyle === "#ef444433"
    ));
    const enemyOwnerStroke = context.calls.some(([name, meta]) => (
      name === "stroke"
      && meta?.strokeStyle === "#3b82f6"
      && meta?.lineWidth === 3.8
    ));
    const currentPlayerStroke = context.calls.some(([name, meta]) => (
      name === "stroke"
      && meta?.strokeStyle === "#ef4444"
      && meta?.lineWidth === 2.2
    ));

    expect(currentPlayerFill).toBe(true);
    expect(enemyOwnerStroke).toBe(false);
    expect(currentPlayerStroke).toBe(true);
  });
});
