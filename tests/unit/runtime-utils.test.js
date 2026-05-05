import { describe, expect, it } from "vitest";
import {
  applyHexAlpha,
  clamp,
  createSeededRandom,
  formatCssUrlValue,
  hashCell,
  hexToRgbParts,
  normalizeRuntimeHexColor
} from "../../page-assets/js/app/runtime/utils.js";

describe("runtime utility helpers", () => {
  it("keeps numeric helpers deterministic", () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(hashCell(3, 9)).toBe(502724169);

    const random = createSeededRandom(1234);
    expect(random()).toBeCloseTo(0.7143076679203659);
    expect(random()).toBeCloseTo(0.20701311994343996);
  });

  it("keeps runtime color helpers stable", () => {
    expect(normalizeRuntimeHexColor("#abc")).toBe("#aabbcc");
    expect(normalizeRuntimeHexColor("#A1B2C3")).toBe("#a1b2c3");
    expect(normalizeRuntimeHexColor("bad")).toBeNull();
    expect(hexToRgbParts("#67e1ff")).toEqual([103, 225, 255]);
    expect(applyHexAlpha("#abc", "80")).toBe("#aabbcc80");
    expect(applyHexAlpha("bad", "33")).toBe("#67e1ff33");
  });

  it("escapes css url values", () => {
    globalThis.window = { location: { href: "https://example.test/game/index.html" } };
    try {
      expect(formatCssUrlValue("./img/avatar\"one.png")).toBe("url(\"https://example.test/game/img/avatar%22one.png\")");
      expect(formatCssUrlValue("")).toBe("none");
    } finally {
      delete globalThis.window;
    }
  });
});
