import { describe, expect, it } from "vitest";
import {
  createLaunchPlayerColorMap,
  getFactionGlyph,
  getRegistrationAccentColor,
  normalizeLaunchPlayerPaletteColor
} from "../../page-assets/js/app/runtime/playerIdentityVisuals.js";

describe("player identity visual helpers", () => {
  it("resolves faction accent colors and glyphs with fallbacks", () => {
    expect(getRegistrationAccentColor("kartel")).toBe("#ff9a3d");
    expect(getFactionGlyph("hackeri")).toBe("⌘");
    expect(getRegistrationAccentColor("unknown")).toBe("#67e1ff");
    expect(getFactionGlyph("unknown")).toBe("✦");
  });

  it("normalizes launch palette colors only when they are available", () => {
    const options = {
      playerColors: ["#67e1ff", "#ff47c2"],
      normalizeHexColor: (value) => String(value || "").toLowerCase()
    };

    expect(normalizeLaunchPlayerPaletteColor("#FF47C2", options)).toBe("#ff47c2");
    expect(normalizeLaunchPlayerPaletteColor("#000000", options)).toBeNull();
  });

  it("creates unique launch player colors without mutating the palette", () => {
    const palette = ["#67e1ff", "#ff47c2", "#ffd166"];
    const colorMap = createLaunchPlayerColorMap("#67e1ff", {
      currentPlayerId: 1,
      playerColors: palette
    });

    expect(colorMap.get(1)).toBe("#67e1ff");
    expect(colorMap.get(2)).toBe("#ff47c2");
    expect(colorMap.get(3)).toBe("#ffd166");
    expect(palette).toEqual(["#67e1ff", "#ff47c2", "#ffd166"]);
  });
});
