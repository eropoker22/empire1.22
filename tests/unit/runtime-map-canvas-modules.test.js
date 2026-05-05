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
    expect(context.calls.some(([name]) => name === "badge")).toBe(true);
  });
});
