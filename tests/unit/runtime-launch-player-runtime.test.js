import { describe, expect, it } from "vitest";
import { createLaunchPlayerColorMap, normalizeLaunchPlayerPaletteColor } from "../../page-assets/js/app/runtime/playerIdentityVisuals.js";
import { createLaunchPlayerRuntime } from "../../page-assets/js/app/runtime/launchPlayerRuntime.js";

function createRuntime(overrides = {}) {
  return createLaunchPlayerRuntime({
    currentPlayerId: 1,
    playerColors: ["#00f5ff", "#ff2bd6", "#39ff88"],
    playerNames: ["Alpha", "Beta", "Gamma"],
    factionOrder: ["mafian", "hackeri"],
    avatarByFactionId: { mafian: "mafian.png", hackeri: "hackeri.png" },
    startPhaseOwnerByDistrictId: new Map([[4, 1], [5, 2]]),
    getStoredRegistration: () => ({ factionId: "hackeri", gangColor: "#ff2bd6", avatar: "" }),
    getWorldState: () => ({ ownedDistrictIds: [9] }),
    getLegacyAvatar: () => "legacy.png",
    normalizeRuntimeHexColor: (value) => String(value || "").trim().toLowerCase(),
    getRegistrationAccentColor: () => "#00f5ff",
    getFactionGlyph: (factionId) => (factionId === "hackeri" ? "⌘" : "✦"),
    normalizeLaunchPlayerPaletteColor,
    createLaunchPlayerColorMap,
    ...overrides
  });
}

describe("launch player runtime", () => {
  it("resolves current player visuals and launch labels", () => {
    const runtime = createRuntime();

    expect(runtime.getCurrentPlayerGangColor()).toBe("#ff2bd6");
    expect(runtime.getCurrentPlayerFactionGlyph()).toBe("⌘");
    expect(runtime.getLaunchPlayerName(2)).toBe("Beta");
    expect(runtime.getLaunchPlayerLabel(1)).toBe("TY");
  });

  it("resolves avatars and start district with legacy fallback", () => {
    const runtime = createRuntime();

    expect(runtime.getLaunchPlayerAvatar(1)).toBe("legacy.png");
    expect(runtime.getLaunchPlayerAvatar(2)).toBe("hackeri.png");
    expect(runtime.getCurrentPlayerLaunchStartDistrictId()).toBe(4);
  });

  it("builds owned district sets for launch and war phases", () => {
    const runtime = createRuntime();

    expect(Array.from(runtime.getEffectiveOwnedDistrictIds({ gamePhase: "launch" })).sort()).toEqual([4, 5]);
    expect(Array.from(runtime.getCurrentPlayerOwnedDistrictIds({ gamePhase: "launch" })).sort()).toEqual([4]);
    expect(Array.from(runtime.getCurrentPlayerOwnedDistrictIds({ gamePhase: "war", ownedDistrictIds: [9] }))).toEqual([9]);
  });
});
