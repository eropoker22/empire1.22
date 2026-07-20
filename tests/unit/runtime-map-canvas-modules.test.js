import { describe, expect, it } from "vitest";
import { createDistrictCanvasRenderer } from "../../page-assets/js/app/map/districtCanvasRenderer.js";
import { createMapCanvasAnimationRenderers } from "../../page-assets/js/app/map/mapCanvasAnimations.js";

function createFakeGradient() {
  return { addColorStop() {} };
}

function createFakeContext() {
  const target = {
    calls: [],
    createLinearGradient() {
      this.calls.push(["createLinearGradient"]);
      return createFakeGradient();
    },
    createRadialGradient() {
      this.calls.push(["createRadialGradient"]);
      return createFakeGradient();
    },
    measureText(text) {
      return { width: String(text || "").length * 7 };
    }
  };

  return new Proxy(target, {
    get(object, property) {
      if (property in object) {
        return object[property];
      }
      return (...args) => {
        object.calls.push([String(property), ...args]);
      };
    },
    set(object, property, value) {
      object[property] = value;
      return true;
    }
  });
}

function createDistrict() {
  return {
    id: 1,
    centerX: 50,
    centerY: 50,
    polygon: [
      { x: 20, y: 20 },
      { x: 80, y: 20 },
      { x: 80, y: 80 },
      { x: 20, y: 80 }
    ]
  };
}

function drawFakeDistrictPolygon(context, polygon = []) {
  context.beginPath();
  polygon.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.closePath();
}

describe("map canvas extraction modules", () => {
  it("keeps perimeter and animation helpers no-crash with partial marker data", () => {
    const context = createFakeContext();
    const district = createDistrict();
    const animations = createMapCanvasAnimationRenderers({
      getPolygonBounds: () => ({ minX: 20, minY: 20, maxX: 80, maxY: 80, width: 60, height: 60 }),
      drawDistrictPolygonPath: () => true,
      drawDistrictPolygon: () => true,
      createSeededRandom: () => () => 0.5,
      clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
      getLaunchPlayerColor: () => "#67e1ff",
      getCurrentPlayerGangColor: () => "#67e1ff",
      getCurrentPlayerFactionGlyph: () => "◆",
      hexToRgbParts: () => [103, 225, 255]
    });

    expect(animations.getPointOnPolygonPerimeter(district.polygon, 0.25)).toEqual({ x: 80, y: 20 });
    expect(() => animations.drawSpyDistrictAnimation(context, district, {}, 1000)).not.toThrow();
    expect(() => animations.drawPoliceDistrictAnimation(context, district, {}, 1000)).not.toThrow();
    expect(() => animations.drawAttackDistrictAnimation(context, district, {}, 1000)).not.toThrow();
    expect(() => animations.drawRobberyDistrictAnimation(context, district, {}, 1000)).not.toThrow();
    expect(() => animations.drawTrapDistrictAnimation(context, district, 0.5)).not.toThrow();
    expect(() => animations.drawOccupyDistrictAnimation(context, district, 0.5)).not.toThrow();
    expect(() => animations.drawReducedMapActivityMarker(context, district, "spy", "#67e1ff")).not.toThrow();
    expect(context.calls.length).toBeGreaterThan(0);
    expect(context.calls.some(([name]) => name === "fillText")).toBe(false);
  });

  it("anchors the alliance emblem inside the district top-left corner", () => {
    const context = createFakeContext();
    const district = createDistrict();
    const animations = createMapCanvasAnimationRenderers({
      getPolygonBounds: () => ({ minX: 20, minY: 20, maxX: 80, maxY: 80, width: 60, height: 60 }),
      drawDistrictPolygonPath: () => true,
      drawDistrictPolygon: () => true,
      createSeededRandom: () => () => 0.5,
      clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
      getLaunchPlayerColor: () => "#67e1ff",
      getCurrentPlayerGangColor: () => "#67e1ff",
      getCurrentPlayerFactionGlyph: () => "◆",
      hexToRgbParts: () => [103, 225, 255]
    });

    animations.drawAllianceDistrictBadge(context, district, { symbol: "A", color: "#67e1ff" }, true);

    const firstArc = context.calls.find(([name]) => name === "arc");
    expect(firstArc?.[1]).toBeGreaterThan(20);
    expect(firstArc?.[1]).toBeLessThan(50);
    expect(firstArc?.[2]).toBeGreaterThan(20);
    expect(firstArc?.[2]).toBeLessThan(50);
  });

  it("renders a district canvas through the extracted renderer", () => {
    const context = createFakeContext();
    const canvas = { width: 120, height: 80, getContext: () => context };
    const district = createDistrict();
    const renderer = createDistrictCanvasRenderer({
      createDistrictGeometry: () => ({ width: 120, height: 80, districts: [district] }),
      getEffectiveOwnedDistrictIds: () => new Set([district.id]),
      getCurrentPlayerOwnedDistrictIds: () => new Set([district.id]),
      startPhaseOwnerByDistrictId: new Map(),
      getDistrictFillStyle: () => "rgba(103, 225, 255, 0.16)",
      drawDistrictPolygon: () => {},
      getLaunchPlayerColor: () => "#67e1ff",
      getLaunchPlayerLabel: () => "Player",
      drawCurrentPlayerFactionBadge: () => context.calls.push(["badge"])
    });

    const geometry = renderer.renderDistrictCanvas(canvas, "day", {});

    expect(geometry.districts).toHaveLength(1);
    expect(context.calls.some(([name]) => name === "clearRect")).toBe(true);
    expect(context.calls.some(([name]) => name === "badge")).toBe(false);
  });

  it("draws public alliance badges for current and foreign district owners", () => {
    const context = createFakeContext();
    const canvas = { width: 120, height: 80, getContext: () => context };
    const currentDistrict = createDistrict();
    const foreignDistrict = { ...createDistrict(), id: 2, centerX: 90 };
    const badgeOwners = [];
    const drawnBadges = [];
    const renderer = createDistrictCanvasRenderer({
      createDistrictGeometry: () => ({ width: 120, height: 80, districts: [currentDistrict, foreignDistrict] }),
      getEffectiveOwnedDistrictIds: () => new Set([currentDistrict.id, foreignDistrict.id]),
      getCurrentPlayerOwnedDistrictIds: () => new Set([currentDistrict.id]),
      getAllianceMapBadge: (ownerId) => {
        badgeOwners.push(String(ownerId));
        return { symbol: "A", ownerId };
      },
      drawAllianceDistrictBadge: (_context, district, badge) => drawnBadges.push([district.id, String(badge.ownerId)]),
      getDistrictFillStyle: () => "rgba(103, 225, 255, 0.16)",
      drawDistrictPolygon: () => {},
      getLaunchPlayerColor: () => "#67e1ff",
      currentPlayerId: "player:1"
    });

    renderer.renderDistrictCanvas(canvas, "night", {
      mapVisibilityMode: "only-player",
      districtOwnerById: { 1: "player:1", 2: "player:2" }
    });

    expect(badgeOwners).toEqual(["player:1", "player:2"]);
    expect(drawnBadges).toEqual([[1, "player:1"], [2, "player:2"]]);
  });

  it("keeps activity effects in a separate canvas and omits foreign player tags", () => {
    const baseContext = createFakeContext();
    const effectsContext = createFakeContext();
    const canvas = { width: 120, height: 80, getContext: () => baseContext };
    const effectsCanvas = { width: 120, height: 80, getContext: () => effectsContext };
    const district = createDistrict();
    const renderer = createDistrictCanvasRenderer({
      createDistrictGeometry: () => ({ width: 120, height: 80, districts: [district] }),
      getEffectiveOwnedDistrictIds: () => new Set([district.id]),
      getCurrentPlayerOwnedDistrictIds: () => new Set(),
      startPhaseOwnerByDistrictId: new Map([[district.id, 2]]),
      getDistrictFillStyle: () => "rgba(103, 225, 255, 0.16)",
      drawDistrictPolygon: drawFakeDistrictPolygon,
      getLaunchPlayerColor: () => "#67e1ff",
      drawSpyDistrictAnimation: () => effectsContext.calls.push(["spy"]),
      currentPlayerId: 1
    });
    const state = {
      mapVisibilityMode: "all",
      activeSpyDistrictIds: new Set([district.id]),
      activeSpyMarkersByDistrictId: new Map([[district.id, {}]])
    };

    const geometry = renderer.renderDistrictCanvas(canvas, "day", state, null, {
      renderActivityEffects: false
    });
    renderer.renderDistrictEffectsCanvas(effectsCanvas, "day", state, geometry);

    expect(baseContext.calls.some(([name]) => name === "spy")).toBe(false);
    expect(effectsContext.calls.some(([name]) => name === "spy")).toBe(true);
    expect(baseContext.calls.some(([name, text]) => name === "fillText" && /^P\\d+$/u.test(String(text)))).toBe(false);
  });

  it("draws a cyberpunk destroyed district overlay without mutating map state", () => {
    const context = createFakeContext();
    const canvas = { width: 120, height: 80, getContext: () => context };
    const district = createDistrict();
    const destroyedDistrictIds = new Set([district.id]);
    const renderer = createDistrictCanvasRenderer({
      createDistrictGeometry: () => ({ width: 120, height: 80, districts: [district] }),
      getEffectiveOwnedDistrictIds: () => new Set(),
      getCurrentPlayerOwnedDistrictIds: () => new Set(),
      getDistrictFillStyle: () => "rgba(255, 96, 96, 0.16)",
      drawDistrictPolygon: drawFakeDistrictPolygon
    });

    expect(() => renderer.renderDistrictCanvas(canvas, "night", {
      destroyedDistrictIds,
      reducedMapEffects: true
    })).not.toThrow();

    expect(destroyedDistrictIds.has(district.id)).toBe(true);
    expect(context.calls.some(([name, text]) => name === "fillText" && text === "DISTRICT DESTROYED")).toBe(false);
    expect(context.calls.some(([name, text]) => name === "strokeText" && text === "DISTRICT DESTROYED")).toBe(false);
    expect(context.calls.some(([name]) => name === "clip")).toBe(true);
  });
});
